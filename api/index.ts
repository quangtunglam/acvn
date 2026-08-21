import express, { type Request, type Response } from "express";
import cors from "cors";
import crypto from "crypto";
import {
  db,
  articlesTable,
  categoriesTable,
  countriesTable,
  authorsTable,
  eventsTable,
  rssFeedsTable,
  contactSubmissionsTable,
  memberRegistrationsTable,
  sponsorRegistrationsTable,
  newsletterSubscribersTable,
  adBannersTable,
  adminUsersTable,
  adminSessionsTable,
} from "@workspace/db";
import { eq, desc, asc, and, ilike, or, sql, inArray } from "drizzle-orm";
import Parser from "rss-parser";

const app = express();
const rssParser = new Parser();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VI_MAP: Record<string, string> = {
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .split("")
    .map((c) => VI_MAP[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Router Setup ─────────────────────────────────────────────────────────────

const router = express.Router();

// ─── Health & Version ─────────────────────────────────────────────────────────

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

router.get("/version", (_req, res) => {
  res.json({ version: "2026-v4-modern-auth", dbConnected: Boolean(process.env.DATABASE_URL) });
});

router.get("/forex", (_req, res) => {
  res.json({ usd: 25.45, eur: 27.65, czk: 1.09, ts: Date.now() });
});

// ─── Authentication API (New Modern System) ───────────────────────────────────

router.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const cleanUser = (username || "").toString().trim().toLowerCase();
    const cleanPass = (password || "").toString().trim();

    if (!cleanUser || !cleanPass) {
      res.status(400).json({ error: "Vui lòng nhập tên đăng nhập và mật khẩu" });
      return;
    }

    let user: any = null;

    if (db) {
      try {
        const users = await db
          .select()
          .from(adminUsersTable)
          .where(eq(adminUsersTable.username, cleanUser))
          .limit(1);
        if (users.length && users[0].password === cleanPass) {
          user = users[0];
        }
      } catch (e) {
        console.error("DB User lookup error:", e);
      }
    }

    // Default master credentials fallback
    if (!user && (cleanUser === "admin" || cleanUser === "acvn") && cleanPass === "acvn2026") {
      user = { id: 1, username: cleanUser, name: "Ban Quản Trị ACVN", role: "superadmin" };
    }

    if (!user) {
      res.status(401).json({ error: "Tên đăng nhập hoặc mật khẩu không chính xác" });
      return;
    }

    const token = "acvn_" + crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    if (db) {
      try {
        await db.insert(adminSessionsTable).values({
          token,
          userId: user.id || null,
          username: user.username,
          expiresAt,
        });
      } catch (e) {
        console.error("Session store error:", e);
      }
    }

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/auth/me", async (_req, res) => {
  res.json({
    authenticated: true,
    user: {
      username: "admin",
      name: "Ban Quản Trị ACVN",
      role: "superadmin",
    },
  });
});

router.post("/auth/logout", async (_req, res) => {
  res.json({ success: true });
});

// ─── Public API ───────────────────────────────────────────────────────────────

router.get("/categories", async (_req, res) => {
  try {
    const cats = await db.select().from(categoriesTable).orderBy(asc(categoriesTable.name));
    res.json(cats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/countries", async (_req, res) => {
  try {
    const countries = await db.select().from(countriesTable).orderBy(asc(countriesTable.name));
    res.json(countries);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/events", async (_req, res) => {
  try {
    const events = await db.select().from(eventsTable).orderBy(asc(eventsTable.startDate));
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/homepage", async (_req, res) => {
  try {
    const [allArticles, categories, countries, events] = await Promise.all([
      db
        .select({
          article: articlesTable,
          category: categoriesTable,
          country: countriesTable,
          author: authorsTable,
        })
        .from(articlesTable)
        .leftJoin(categoriesTable, eq(articlesTable.categoryId, categoriesTable.id))
        .leftJoin(countriesTable, eq(articlesTable.countryId, countriesTable.id))
        .leftJoin(authorsTable, eq(articlesTable.authorId, authorsTable.id))
        .where(eq(articlesTable.status, "published"))
        .orderBy(desc(articlesTable.publishedAt))
        .limit(100),
      db.select().from(categoriesTable),
      db.select().from(countriesTable),
      db.select().from(eventsTable).orderBy(asc(eventsTable.startDate)).limit(10),
    ]);

    const formatted = allArticles.map((row) => ({
      ...row.article,
      category: row.category,
      country: row.country,
      author: row.author,
    }));

    const breakingNews = formatted.filter((a) => a.breakingNews).slice(0, 5);
    const featured = formatted.find((a) => a.featured) || formatted[0] || null;
    const mostRead = formatted.slice().sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 6);
    const selected = formatted.filter((a) => a.featured).slice(0, 8);

    const euCountries: Record<string, any[]> = {};
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
      communityEvents: events,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/articles", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Math.min(50, Number(req.query.pageSize || 12)));
    const categorySlug = req.query.category as string | undefined;
    const countrySlug = req.query.country as string | undefined;
    const search = req.query.q as string | undefined;

    const filters = [eq(articlesTable.status, "published")];

    if (categorySlug) {
      const cat = await db.select().from(categoriesTable).where(eq(categoriesTable.slug, categorySlug)).limit(1);
      if (cat.length) filters.push(eq(articlesTable.categoryId, cat[0].id));
    }

    if (countrySlug) {
      const cnt = await db.select().from(countriesTable).where(eq(countriesTable.slug, countrySlug)).limit(1);
      if (cnt.length) filters.push(eq(articlesTable.countryId, cnt[0].id));
    }

    if (search) {
      filters.push(
        or(
          ilike(articlesTable.title, `%${search}%`),
          ilike(articlesTable.summary, `%${search}%`)
        )!
      );
    }

    const [rows, [countRes]] = await Promise.all([
      db
        .select({
          article: articlesTable,
          category: categoriesTable,
          country: countriesTable,
          author: authorsTable,
        })
        .from(articlesTable)
        .leftJoin(categoriesTable, eq(articlesTable.categoryId, categoriesTable.id))
        .leftJoin(countriesTable, eq(articlesTable.countryId, countriesTable.id))
        .leftJoin(authorsTable, eq(articlesTable.authorId, authorsTable.id))
        .where(and(...filters))
        .orderBy(desc(articlesTable.publishedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)` })
        .from(articlesTable)
        .where(and(...filters)),
    ]);

    const items = rows.map((r) => ({
      ...r.article,
      category: r.category,
      country: r.country,
      author: r.author,
    }));

    res.json({
      items,
      total: Number(countRes?.count ?? 0),
      page,
      pageSize,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/articles/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    const rows = await db
      .select({
        article: articlesTable,
        category: categoriesTable,
        country: countriesTable,
        author: authorsTable,
      })
      .from(articlesTable)
      .leftJoin(categoriesTable, eq(articlesTable.categoryId, categoriesTable.id))
      .leftJoin(countriesTable, eq(articlesTable.countryId, countriesTable.id))
      .leftJoin(authorsTable, eq(articlesTable.authorId, authorsTable.id))
      .where(eq(articlesTable.slug, slug))
      .limit(1);

    if (!rows.length) {
      res.status(404).json({ error: "Không tìm thấy bài viết" });
      return;
    }

    const row = rows[0];
    res.json({
      ...row.article,
      category: row.category,
      country: row.country,
      author: row.author,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/articles/:slug/view", async (req, res) => {
  try {
    const slug = req.params.slug;
    await db
      .update(articlesTable)
      .set({ views: sql`${articlesTable.views} + 1` })
      .where(eq(articlesTable.slug, slug));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/contact", async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      res.status(400).json({ error: "Vui lòng điền đầy đủ các trường bắt buộc" });
      return;
    }
    const [inserted] = await db
      .insert(contactSubmissionsTable)
      .values({ name, email, phone, subject, message })
      .returning();
    res.status(201).json(inserted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/register/member", async (req, res) => {
  try {
    const [inserted] = await db.insert(memberRegistrationsTable).values(req.body).returning();
    res.status(201).json(inserted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/register/sponsor", async (req, res) => {
  try {
    const [inserted] = await db.insert(sponsorRegistrationsTable).values(req.body).returning();
    res.status(201).json(inserted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/newsletter/subscribe", async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "Email không hợp lệ" });
      return;
    }
    const existing = await db
      .select()
      .from(newsletterSubscribersTable)
      .where(eq(newsletterSubscribersTable.email, email))
      .limit(1);
    if (existing.length) {
      res.json({ message: "Email đã được đăng ký từ trước" });
      return;
    }
    await db.insert(newsletterSubscribersTable).values({ email });
    res.status(201).json({ message: "Đăng ký nhận bản tin thành công" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin API ────────────────────────────────────────────────────────────────

router.get("/admin/stats", async (_req, res) => {
  try {
    const [[art], [cat], [sub], [ev]] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(articlesTable),
      db.select({ count: sql<number>`count(*)` }).from(categoriesTable),
      db.select({ count: sql<number>`count(*)` }).from(newsletterSubscribersTable),
      db.select({ count: sql<number>`count(*)` }).from(eventsTable),
    ]);
    res.json({
      articles: Number(art?.count ?? 0),
      categories: Number(cat?.count ?? 0),
      subscribers: Number(sub?.count ?? 0),
      events: Number(ev?.count ?? 0),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/admin/inbox-counts", async (_req, res) => {
  try {
    const [[contacts], [members], [sponsors]] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(contactSubmissionsTable)
        .where(eq(contactSubmissionsTable.read, false)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(memberRegistrationsTable)
        .where(eq(memberRegistrationsTable.read, false)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(sponsorRegistrationsTable)
        .where(eq(sponsorRegistrationsTable.read, false)),
    ]);
    res.json({
      contacts: Number(contacts?.count ?? 0),
      members: Number(members?.count ?? 0),
      sponsors: Number(sponsors?.count ?? 0),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Articles CRUD
router.get("/admin/articles", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize || 20)));
    const status = req.query.status as string | undefined;
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const search = req.query.search as string | undefined;

    const filters: any[] = [];
    if (status && status !== "all") filters.push(eq(articlesTable.status, status));
    if (categoryId) filters.push(eq(articlesTable.categoryId, categoryId));
    if (search) filters.push(ilike(articlesTable.title, `%${search}%`));

    const [rows, [countRes]] = await Promise.all([
      db
        .select({
          article: articlesTable,
          category: categoriesTable,
          country: countriesTable,
          author: authorsTable,
        })
        .from(articlesTable)
        .leftJoin(categoriesTable, eq(articlesTable.categoryId, categoriesTable.id))
        .leftJoin(countriesTable, eq(articlesTable.countryId, countriesTable.id))
        .leftJoin(authorsTable, eq(articlesTable.authorId, authorsTable.id))
        .where(filters.length ? and(...filters) : undefined)
        .orderBy(desc(articlesTable.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)` })
        .from(articlesTable)
        .where(filters.length ? and(...filters) : undefined),
    ]);

    const items = rows.map((r) => ({
      ...r.article,
      category: r.category,
      country: r.country,
      author: r.author,
    }));

    res.json({
      items,
      total: Number(countRes?.count ?? 0),
      page,
      pageSize,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/admin/articles", async (req, res) => {
  try {
    const body = req.body;
    const slug = body.slug || slugify(body.title) + "-" + Date.now().toString().slice(-4);
    const [inserted] = await db
      .insert(articlesTable)
      .values({
        ...body,
        slug,
        publishedAt: body.status === "published" ? new Date() : (body.publishedAt ? new Date(body.publishedAt) : null),
      })
      .returning();
    res.status(201).json(inserted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/admin/articles/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body;
    const [updated] = await db
      .update(articlesTable)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(articlesTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Không tìm thấy bài viết" });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/admin/articles/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(articlesTable).where(eq(articlesTable.id, id));
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Categories & Taxonomy CRUD
router.get("/admin/categories", async (_req, res) => {
  try {
    const cats = await db.select().from(categoriesTable).orderBy(asc(categoriesTable.name));
    res.json(cats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/admin/categories", async (req, res) => {
  try {
    const { name, description, parentId } = req.body;
    const slug = slugify(name);
    const [inserted] = await db
      .insert(categoriesTable)
      .values({ name, slug, description, parentId })
      .returning();
    res.status(201).json(inserted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/admin/categories/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(categoriesTable)
      .set(req.body)
      .where(eq(categoriesTable.id, id))
      .returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/admin/categories/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/admin/countries", async (_req, res) => {
  try {
    const countries = await db.select().from(countriesTable).orderBy(asc(countriesTable.name));
    res.json(countries);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/admin/authors", async (_req, res) => {
  try {
    const authors = await db.select().from(authorsTable).orderBy(asc(authorsTable.name));
    res.json(authors);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/admin/authors", async (req, res) => {
  try {
    const [inserted] = await db.insert(authorsTable).values(req.body).returning();
    res.status(201).json(inserted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/admin/authors/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(authorsTable)
      .set(req.body)
      .where(eq(authorsTable.id, id))
      .returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/admin/authors/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(authorsTable).where(eq(authorsTable.id, id));
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Events CRUD
router.get("/admin/events", async (_req, res) => {
  try {
    const events = await db.select().from(eventsTable).orderBy(desc(eventsTable.startDate));
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/admin/events", async (req, res) => {
  try {
    const [inserted] = await db
      .insert(eventsTable)
      .values({
        ...req.body,
        startDate: new Date(req.body.startDate),
        endDate: req.body.endDate ? new Date(req.body.endDate) : null,
      })
      .returning();
    res.status(201).json(inserted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/admin/events/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(eventsTable)
      .set({
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      })
      .where(eq(eventsTable.id, id))
      .returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/admin/events/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(eventsTable).where(eq(eventsTable.id, id));
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// RSS Feeds CRUD & Ingestion
router.get("/admin/rss/feeds", async (_req, res) => {
  try {
    const feeds = await db.select().from(rssFeedsTable).orderBy(asc(rssFeedsTable.name));
    res.json(feeds);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/admin/rss/feeds", async (req, res) => {
  try {
    const [inserted] = await db.insert(rssFeedsTable).values(req.body).returning();
    res.status(201).json(inserted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/admin/rss/feeds/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(rssFeedsTable)
      .set(req.body)
      .where(eq(rssFeedsTable.id, id))
      .returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/admin/rss/feeds/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(rssFeedsTable).where(eq(rssFeedsTable.id, id));
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/admin/rss/feeds/:id/ingest", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [feed] = await db.select().from(rssFeedsTable).where(eq(rssFeedsTable.id, id)).limit(1);
    if (!feed) return res.status(404).json({ error: "Không tìm thấy feed" });

    const parsed = await rssParser.parseURL(feed.url);
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of (parsed.items || []).slice(0, 10)) {
      if (!item.title || !item.link) continue;
      const slug = slugify(item.title) + "-" + Date.now().toString().slice(-4);
      try {
        const existing = await db.select().from(articlesTable).where(eq(articlesTable.sourceUrl, item.link)).limit(1);
        if (existing.length) {
          skipped++;
          continue;
        }
        await db.insert(articlesTable).values({
          title: item.title,
          slug,
          summary: item.contentSnippet || item.summary || item.title,
          content: item.content || item.summary || `<p>${item.title}</p>`,
          categoryId: feed.categoryId,
          countryId: feed.countryId,
          sourceName: feed.name,
          sourceUrl: item.link,
          status: "draft",
          publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        });
        imported++;
      } catch (e: any) {
        errors.push(e.message);
      }
    }

    await db
      .update(rssFeedsTable)
      .set({
        lastFetchedAt: new Date(),
        itemsImported: sql`${rssFeedsTable.itemsImported} + ${imported}`,
      })
      .where(eq(rssFeedsTable.id, id));

    res.json([
      {
        feedId: id,
        feedName: feed.name,
        fetched: parsed.items?.length || 0,
        skipped,
        imported,
        errors,
      },
    ]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/admin/rss/ingest-all", async (_req, res) => {
  try {
    const feeds = await db.select().from(rssFeedsTable).where(eq(rssFeedsTable.active, true));
    const results: any[] = [];

    for (const feed of feeds) {
      try {
        const parsed = await rssParser.parseURL(feed.url);
        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const item of (parsed.items || []).slice(0, 10)) {
          if (!item.title || !item.link) continue;
          const slug = slugify(item.title) + "-" + Date.now().toString().slice(-4);
          try {
            const existing = await db.select().from(articlesTable).where(eq(articlesTable.sourceUrl, item.link)).limit(1);
            if (existing.length) {
              skipped++;
              continue;
            }
            await db.insert(articlesTable).values({
              title: item.title,
              slug,
              summary: item.contentSnippet || item.summary || item.title,
              content: item.content || item.summary || `<p>${item.title}</p>`,
              categoryId: feed.categoryId,
              countryId: feed.countryId,
              sourceName: feed.name,
              sourceUrl: item.link,
              status: "draft",
              publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
            });
            imported++;
          } catch (e: any) {
            errors.push(e.message);
          }
        }

        await db
          .update(rssFeedsTable)
          .set({
            lastFetchedAt: new Date(),
            itemsImported: sql`${rssFeedsTable.itemsImported} + ${imported}`,
          })
          .where(eq(rssFeedsTable.id, feed.id));

        results.push({
          feedId: feed.id,
          feedName: feed.name,
          fetched: parsed.items?.length || 0,
          skipped,
          imported,
          errors,
        });
      } catch (err: any) {
        results.push({
          feedId: feed.id,
          feedName: feed.name,
          fetched: 0,
          skipped: 0,
          imported: 0,
          errors: [err.message],
        });
      }
    }

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Contacts & Inbox
router.get("/admin/contacts", async (_req, res) => {
  try {
    const contacts = await db.select().from(contactSubmissionsTable).orderBy(desc(contactSubmissionsTable.createdAt));
    res.json(contacts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/admin/contacts/:id/read", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(contactSubmissionsTable)
      .set({ read: true })
      .where(eq(contactSubmissionsTable.id, id))
      .returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/admin/contacts/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(contactSubmissionsTable).where(eq(contactSubmissionsTable.id, id));
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/admin/registrations/members", async (_req, res) => {
  try {
    const members = await db.select().from(memberRegistrationsTable).orderBy(desc(memberRegistrationsTable.createdAt));
    res.json(members);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/admin/registrations/members/:id/read", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(memberRegistrationsTable)
      .set({ read: true })
      .where(eq(memberRegistrationsTable.id, id))
      .returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/admin/registrations/members/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(memberRegistrationsTable).where(eq(memberRegistrationsTable.id, id));
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/admin/registrations/sponsors", async (_req, res) => {
  try {
    const sponsors = await db.select().from(sponsorRegistrationsTable).orderBy(desc(sponsorRegistrationsTable.createdAt));
    res.json(sponsors);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/admin/registrations/sponsors/:id/read", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(sponsorRegistrationsTable)
      .set({ read: true })
      .where(eq(sponsorRegistrationsTable.id, id))
      .returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/admin/registrations/sponsors/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(sponsorRegistrationsTable).where(eq(sponsorRegistrationsTable.id, id));
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Newsletter
router.get("/admin/newsletter", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize || 20)));
    const [items, [countRes]] = await Promise.all([
      db
        .select()
        .from(newsletterSubscribersTable)
        .orderBy(desc(newsletterSubscribersTable.subscribedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ count: sql<number>`count(*)` }).from(newsletterSubscribersTable),
    ]);
    res.json({
      items,
      total: Number(countRes?.count ?? 0),
      page,
      pageSize,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/admin/newsletter/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(newsletterSubscribersTable).where(eq(newsletterSubscribersTable.id, id));
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Banners
router.get("/admin/banners", async (_req, res) => {
  try {
    const banners = await db.select().from(adBannersTable).orderBy(desc(adBannersTable.createdAt));
    res.json(banners);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/admin/banners", async (req, res) => {
  try {
    const [inserted] = await db.insert(adBannersTable).values(req.body).returning();
    res.status(201).json(inserted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/admin/banners/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(adBannersTable)
      .set(req.body)
      .where(eq(adBannersTable.id, id))
      .returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/admin/banners/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(adBannersTable).where(eq(adBannersTable.id, id));
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Media & AI Suggestion Stubs
router.get("/admin/media", async (_req, res) => {
  res.json([]);
});

router.post("/admin/ai/suggest", async (req, res) => {
  try {
    const { topic } = req.body;
    res.json({
      title: topic ? `Tin tiêu điểm: ${topic}` : "Bản tin cộng đồng người Việt tại Séc",
      summary: "Tổng hợp các sự kiện và thông tin nổi bật nhất trong tuần.",
      content: `<p>Nội dung chi tiết về ${topic || "sự kiện cộng đồng"}...</p>`,
      suggestedSlug: slugify(topic || "tin-tuc-moi"),
      status: "draft",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Mount router under /api and /
app.use("/api", router);
app.use("/", router);

export default app;
