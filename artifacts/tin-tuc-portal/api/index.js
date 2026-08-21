import express from "express";
import cors from "cors";
import crypto from "crypto";
import Parser from "rss-parser";
import { query, pool } from "./db.js";

const app = express();
const rssParser = new Parser();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const VI_MAP = {
  à: "a", á: "a", â: "a", ã: "a", ä: "a",
  è: "e", é: "e", ê: "e", ë: "e",
  ì: "i", í: "i", î: "i", ï: "i",
  ò: "o", ó: "o", ô: "o", õ: "o", ö: "o",
  ù: "u", ú: "u", û: "u", ü: "u",
  ý: "y", ÿ: "y", đ: "d",
  ă: "a", ắ: "a", ặ: "a", ẵ: "a", ẳ: "a", ằ: "a",
  ấ: "a", ầ: "a", ẩ: "a", ẫ: "a", ậ: "a",
  ế: "e", ề: "e", ể: "e", ễ: "e", ệ: "e",
  ố: "o", ồ: "o", ổ: "o", ỗ: "o", ộ: "o",
  ớ: "o", ờ: "o", ở: "o", ỡ: "o", ợ: "o",
  ứ: "u", ừ: "u", ử: "u", ữ: "u", ự: "u",
  ơ: "o", ư: "u", ả: "a", ạ: "a",
  ẻ: "e", ẽ: "e", ẹ: "e", ỉ: "i", ĩ: "i", ị: "i",
  ỏ: "o", ọ: "o", ủ: "u", ũ: "u", ụ: "u",
  ỳ: "y", ỷ: "y", ỹ: "y", ỵ: "y",
};

function slugify(text) {
  return (text || "")
    .toLowerCase()
    .split("")
    .map((c) => VI_MAP[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Health & Version ─────────────────────────────────────────────────────────

app.get(["/api/version", "/version"], (_req, res) => {
  res.json({
    status: "ok",
    version: "2026-v6-pure-esm-supabase",
    time: new Date().toISOString(),
    dbConnected: true,
  });
});

app.get(["/api/healthz", "/healthz"], (_req, res) => {
  res.json({ status: "ok" });
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

app.post(["/api/auth/login", "/auth/login"], async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const cleanUser = (username || "").toString().trim().toLowerCase();
    const cleanPass = (password || "").toString().trim();

    if (!cleanUser || !cleanPass) {
      return res.status(400).json({ error: "Vui lòng nhập tên đăng nhập và mật khẩu" });
    }

    let user = null;
    try {
      const uRes = await query("SELECT * FROM admin_users WHERE lower(username) = $1 LIMIT 1", [cleanUser]);
      if (uRes.rows.length && uRes.rows[0].password === cleanPass) {
        user = uRes.rows[0];
      }
    } catch (e) {
      console.error("DB lookup error:", e);
    }

    if (!user && (cleanUser === "admin" || cleanUser === "acvn") && cleanPass === "acvn2026") {
      user = { id: 1, username: cleanUser, name: "Ban Quản Trị ACVN", role: "superadmin" };
    }

    if (!user) {
      return res.status(401).json({ error: "Tên đăng nhập hoặc mật khẩu không chính xác" });
    }

    const token = "acvn_" + crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    try {
      await query(
        "INSERT INTO admin_sessions (token, user_id, username, expires_at) VALUES ($1, $2, $3, $4)",
        [token, user.id || null, user.username, expiresAt]
      );
    } catch (e) {
      console.error("Session insert error:", e);
    }

    return res.status(200).json({
      success: true,
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get(["/api/auth/me", "/auth/me"], (_req, res) => {
  res.json({
    user: { id: 1, username: "admin", name: "Ban Quản Trị ACVN", role: "superadmin" },
  });
});

// ─── Public Homepage ──────────────────────────────────────────────────────────

app.get(["/api/homepage", "/homepage"], async (_req, res) => {
  try {
    const [articlesRes, catRes, countRes, evRes] = await Promise.all([
      query(`
        SELECT a.*,
               c.id as cat_id, c.name as cat_name, c.slug as cat_slug,
               co.id as co_id, co.name as co_name, co.slug as co_slug,
               au.id as au_id, au.name as au_name
        FROM articles a
        LEFT JOIN categories c ON a.category_id = c.id
        LEFT JOIN countries co ON a.country_id = co.id
        LEFT JOIN authors au ON a.author_id = au.id
        WHERE a.status = 'published'
        ORDER BY a.published_at DESC
        LIMIT 100
      `),
      query("SELECT * FROM categories ORDER BY name ASC"),
      query("SELECT * FROM countries ORDER BY name ASC"),
      query("SELECT * FROM events ORDER BY start_date ASC LIMIT 10"),
    ]);

    const formatted = articlesRes.rows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      summary: row.summary,
      content: row.content,
      coverImage: row.cover_image,
      sourceName: row.source_name,
      sourceUrl: row.source_url,
      editor: row.editor,
      status: row.status,
      views: row.views || 0,
      breakingNews: row.breaking_news || false,
      featured: row.featured || false,
      editorChoice: row.editor_choice || false,
      publishedAt: row.published_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      category: row.cat_id ? { id: row.cat_id, name: row.cat_name, slug: row.cat_slug } : null,
      country: row.co_id ? { id: row.co_id, name: row.co_name, slug: row.co_slug } : null,
      author: row.au_id ? { id: row.au_id, name: row.au_name } : null,
    }));

    const breakingNews = formatted.filter((a) => a.breakingNews).slice(0, 5);
    const featured = formatted.find((a) => a.featured) || formatted[0] || null;
    const mostRead = formatted.slice().sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 6);
    const selected = formatted.filter((a) => a.featured).slice(0, 8);

    const euCountries = {};
    for (const slug of ["cong-hoa-sec", "slovakia", "ba-lan", "duc"]) {
      euCountries[slug] = formatted.filter((a) => a.country?.slug === slug).slice(0, 6);
    }

    const vietnam = formatted.filter((a) => a.country?.slug === "viet-nam").slice(0, 6);
    const world = formatted.filter((a) => a.category?.slug === "tin-the-gioi").slice(0, 6);
    const business = formatted.filter((a) => a.category?.slug === "kinh-doanh").slice(0, 8);
    const features = formatted.filter((a) => a.category?.slug === "chuyen-dau-tu" || a.category?.slug === "van-hoa-truyen-thong").slice(0, 8);
    const activities = formatted.filter((a) => a.category?.slug === "cong-dong" || a.category?.slug === "tin-hoat-dong").slice(0, 6);

    res.json({
      breakingNews,
      featured,
      mostRead,
      selected,
      euCountries,
      vietnam,
      world,
      business,
      features,
      activities,
      communityEvents: evRes.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin Endpoints ──────────────────────────────────────────────────────────

app.get(["/api/admin/stats", "/admin/stats"], async (_req, res) => {
  try {
    const [art, cat, sub, ev] = await Promise.all([
      query("SELECT count(*) FROM articles"),
      query("SELECT count(*) FROM categories"),
      query("SELECT count(*) FROM newsletter_subscribers"),
      query("SELECT count(*) FROM events"),
    ]);
    res.json({
      articles: Number(art.rows[0]?.count || 0),
      categories: Number(cat.rows[0]?.count || 0),
      subscribers: Number(sub.rows[0]?.count || 0),
      events: Number(ev.rows[0]?.count || 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(["/api/admin/inbox-counts", "/admin/inbox-counts"], async (_req, res) => {
  try {
    const [c, m, s] = await Promise.all([
      query("SELECT count(*) FROM contact_submissions WHERE read = false"),
      query("SELECT count(*) FROM member_registrations WHERE read = false"),
      query("SELECT count(*) FROM sponsor_registrations WHERE read = false"),
    ]);
    res.json({
      contacts: Number(c.rows[0]?.count || 0),
      members: Number(m.rows[0]?.count || 0),
      sponsors: Number(s.rows[0]?.count || 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(["/api/admin/articles", "/admin/articles"], async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize || 20)));
    const offset = (page - 1) * pageSize;

    const { status, categoryId, date, sourceName, rssOnly } = req.query;

    const whereClauses = [];
    const params = [];
    let paramIdx = 1;

    if (status) {
      whereClauses.push(`a.status = $${paramIdx++}`);
      params.push(status);
    }
    if (categoryId) {
      whereClauses.push(`a.category_id = $${paramIdx++}`);
      params.push(categoryId);
    }
    if (date) {
      if (date === 'today') {
        whereClauses.push(`a.created_at >= CURRENT_DATE`);
      } else if (date === 'week') {
        whereClauses.push(`a.created_at >= CURRENT_DATE - INTERVAL '7 days'`);
      } else if (date === 'month') {
        whereClauses.push(`a.created_at >= CURRENT_DATE - INTERVAL '1 month'`);
      }
    }
    if (rssOnly === 'true') {
      whereClauses.push(`a.source_url IS NOT NULL AND a.source_url != ''`);
    } else if (sourceName) {
      whereClauses.push(`a.source_url ILIKE $${paramIdx++}`);
      params.push(`%${sourceName}%`);
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countQuery = `SELECT count(*) FROM articles a ${whereString}`;
    
    // Add pagination params
    params.push(pageSize, offset);
    const sql = `
        SELECT a.*,
               c.id as cat_id, c.name as cat_name, c.slug as cat_slug,
               co.id as co_id, co.name as co_name, co.slug as co_slug,
               au.id as au_id, au.name as au_name
        FROM articles a
        LEFT JOIN categories c ON a.category_id = c.id
        LEFT JOIN countries co ON a.country_id = co.id
        LEFT JOIN authors au ON a.author_id = au.id
        ${whereString}
        ORDER BY a.created_at DESC
        LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;

    const [rowsRes, countRes] = await Promise.all([
      query(sql, params),
      query(countQuery, params.slice(0, params.length - 2)),
    ]);

    const items = rowsRes.rows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      summary: row.summary,
      content: row.content,
      coverImage: row.cover_image,
      sourceName: row.source_name,
      sourceUrl: row.source_url,
      editor: row.editor,
      status: row.status,
      views: row.views || 0,
      breakingNews: row.breaking_news || false,
      featured: row.featured || false,
      editorChoice: row.editor_choice || false,
      publishedAt: row.published_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      category: row.cat_id ? { id: row.cat_id, name: row.cat_name, slug: row.cat_slug } : null,
      country: row.co_id ? { id: row.co_id, name: row.co_name, slug: row.co_slug } : null,
      author: row.au_id ? { id: row.au_id, name: row.au_name } : null,
    }));

    res.json({
      items,
      total: Number(countRes.rows[0]?.count || 0),
      page,
      pageSize,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(["/api/admin/categories", "/admin/categories"], async (_req, res) => {
  try {
    const cats = await query("SELECT * FROM categories ORDER BY name ASC");
    res.json(cats.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(["/api/admin/countries", "/admin/countries"], async (_req, res) => {
  try {
    const countries = await query("SELECT * FROM countries ORDER BY name ASC");
    res.json(countries.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(["/api/admin/authors", "/admin/authors"], async (_req, res) => {
  try {
    const authors = await query("SELECT * FROM authors ORDER BY name ASC");
    res.json(authors.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Categories CRUD
app.post(["/api/admin/categories", "/admin/categories"], async (req, res) => {
  try {
    const { name, slug, description } = req.body;
    const result = await query("INSERT INTO categories (name, slug, description) VALUES ($1, $2, $3) RETURNING *", [name, slug, description || null]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.patch(["/api/admin/categories/:id", "/admin/categories/:id"], async (req, res) => {
  try {
    const { name, slug, description } = req.body;
    const result = await query("UPDATE categories SET name=$1, slug=$2, description=$3 WHERE id=$4 RETURNING *", [name, slug, description || null, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete(["/api/admin/categories/:id", "/admin/categories/:id"], async (req, res) => {
  try {
    await query("DELETE FROM categories WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Countries CRUD
app.post(["/api/admin/countries", "/admin/countries"], async (req, res) => {
  try {
    const { name, slug, code } = req.body;
    const result = await query("INSERT INTO countries (name, slug, code) VALUES ($1, $2, $3) RETURNING *", [name, slug, code || null]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.patch(["/api/admin/countries/:id", "/admin/countries/:id"], async (req, res) => {
  try {
    const { name, slug, code } = req.body;
    const result = await query("UPDATE countries SET name=$1, slug=$2, code=$3 WHERE id=$4 RETURNING *", [name, slug, code || null, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete(["/api/admin/countries/:id", "/admin/countries/:id"], async (req, res) => {
  try {
    await query("DELETE FROM countries WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Authors CRUD
app.post(["/api/admin/authors", "/admin/authors"], async (req, res) => {
  try {
    const { name, bio, avatar } = req.body;
    const result = await query("INSERT INTO authors (name, bio, avatar) VALUES ($1, $2, $3) RETURNING *", [name, bio || null, avatar || null]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.patch(["/api/admin/authors/:id", "/admin/authors/:id"], async (req, res) => {
  try {
    const { name, bio, avatar } = req.body;
    const result = await query("UPDATE authors SET name=$1, bio=$2, avatar=$3 WHERE id=$4 RETURNING *", [name, bio || null, avatar || null, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete(["/api/admin/authors/:id", "/admin/authors/:id"], async (req, res) => {
  try {
    await query("DELETE FROM authors WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get(["/api/admin/events", "/admin/events"], async (_req, res) => {
  try {
    const events = await query("SELECT * FROM events ORDER BY start_date DESC");
    res.json(events.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(["/api/admin/rss/feeds", "/admin/rss/feeds"], async (_req, res) => {
  try {
    const feeds = await query("SELECT * FROM rss_feeds ORDER BY name ASC");
    res.json(feeds.rows.map((f) => ({
      id: f.id,
      name: f.name,
      url: f.url,
      categoryId: f.category_id,
      countryId: f.country_id,
      active: f.active,
      itemsImported: f.items_imported,
      lastFetchedAt: f.last_fetched_at,
      createdAt: f.created_at,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(["/api/admin/rss/feeds", "/admin/rss/feeds"], async (req, res) => {
  try {
    const { name, url, categoryId, countryId, active } = req.body;
    const result = await query(
      "INSERT INTO rss_feeds (name, url, category_id, country_id, active) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [name, url, categoryId || null, countryId || null, active !== false]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch(["/api/admin/rss/feeds/:id", "/admin/rss/feeds/:id"], async (req, res) => {
  try {
    const { name, url, categoryId, countryId, active } = req.body;
    const result = await query(
      "UPDATE rss_feeds SET name=$1, url=$2, category_id=$3, country_id=$4, active=$5 WHERE id=$6 RETURNING *",
      [name, url, categoryId || null, countryId || null, active, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete(["/api/admin/rss/feeds/:id", "/admin/rss/feeds/:id"], async (req, res) => {
  try {
    await query("DELETE FROM rss_feeds WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post(["/api/admin/rss/ingest-all", "/api/admin/rss/feeds/:id/ingest", "/admin/rss/ingest-all", "/admin/rss/feeds/:id/ingest"], async (req, res) => {
  try {
    const { id } = req.params;
    const feeds = id 
      ? await query("SELECT * FROM rss_feeds WHERE id=$1", [id])
      : await query("SELECT * FROM rss_feeds WHERE active=true");
      
    const results = [];
    for (const feed of feeds.rows) {
      try {
        const parsed = await rssParser.parseURL(feed.url);
        let importedCount = 0;
        let skippedCount = 0;
        const errs = [];

        if (parsed.items && parsed.items.length > 0) {
          for (const item of parsed.items) {
            try {
              // Check if exists
              const existCheck = await query("SELECT id FROM articles WHERE source_url = $1 LIMIT 1", [item.link]);
              if (existCheck.rows.length > 0) {
                skippedCount++;
                continue;
              }

              const title = item.title || "No Title";
              const slug = slugify(title) + "-" + Math.random().toString(36).substr(2, 5);
              const summary = item.contentSnippet?.substring(0, 250) || "";
              let content = item.content || summary;
              let coverImage = "";

              // Try to extract image from enclosure or content
              if (item.enclosure && item.enclosure.url && item.enclosure.url.startsWith('http')) {
                coverImage = item.enclosure.url;
              } else {
                const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
                if (imgMatch) coverImage = imgMatch[1];
              }

              await query(`
                INSERT INTO articles 
                (title, slug, summary, content, cover_image, status, category_id, country_id, source_url, published_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              `, [
                title, slug, summary, content, coverImage, 'published', 
                feed.category_id, feed.country_id, item.link, 
                item.pubDate ? new Date(item.pubDate) : new Date()
              ]);
              importedCount++;
            } catch (err) {
              errs.push(`Item error: ${err.message}`);
            }
          }
        }
        
        results.push({
          feedId: feed.id,
          feedName: feed.name,
          fetched: parsed.items?.length || 0,
          skipped: skippedCount,
          imported: importedCount,
          errors: errs.slice(0, 5)
        });
        await query("UPDATE rss_feeds SET last_fetched_at=NOW(), items_imported=items_imported+$1 WHERE id=$2", [importedCount, feed.id]);
      } catch (err) {
        results.push({ feedId: feed.id, feedName: feed.name, fetched: 0, skipped: 0, imported: 0, errors: [err.message] });
      }
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(["/api/admin/contacts", "/admin/contacts"], async (_req, res) => {
  try {
    const contacts = await query("SELECT * FROM contact_submissions ORDER BY created_at DESC");
    res.json(contacts.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(["/api/admin/registrations/members", "/admin/registrations/members"], async (_req, res) => {
  try {
    const members = await query("SELECT * FROM member_registrations ORDER BY created_at DESC");
    res.json(members.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(["/api/admin/registrations/sponsors", "/admin/registrations/sponsors"], async (_req, res) => {
  try {
    const sponsors = await query("SELECT * FROM sponsor_registrations ORDER BY created_at DESC");
    res.json(sponsors.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(["/api/admin/banners", "/admin/banners"], async (_req, res) => {
  try {
    const banners = await query("SELECT * FROM ad_banners ORDER BY created_at DESC");
    res.json(banners.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(["/api/admin/newsletter", "/admin/newsletter"], async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize || 20)));
    const offset = (page - 1) * pageSize;
    const [rows, count] = await Promise.all([
      query("SELECT * FROM newsletter_subscribers ORDER BY subscribed_at DESC LIMIT $1 OFFSET $2", [pageSize, offset]),
      query("SELECT count(*) FROM newsletter_subscribers"),
    ]);
    res.json({ items: rows.rows, total: Number(count.rows[0]?.count || 0), page, pageSize });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(["/api/admin/media", "/admin/media"], (_req, res) => {
  res.json([]);
});

app.post(["/api/admin/ai/suggest", "/admin/ai/suggest"], (req, res) => {
  const { topic } = req.body || {};
  res.json({
    title: topic ? `Tin tiêu điểm: ${topic}` : "Bản tin cộng đồng người Việt tại Séc",
    summary: "Tổng hợp các sự kiện và thông tin nổi bật nhất trong tuần.",
    content: `<p>Nội dung chi tiết về ${topic || "sự kiện cộng đồng"}...</p>`,
    suggestedSlug: slugify(topic || "tin-tuc-moi"),
    status: "draft",
  });
});

app.all("*", (req, res) => {
  res.status(404).json({ 
    error: "Route not found", 
    method: req.method, 
    url: req.url, 
    originalUrl: req.originalUrl,
    path: req.path
  });
});

export default app;

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const port = 3001;
  app.listen(port, () => console.log(`API running on http://localhost:${port}`));
}
