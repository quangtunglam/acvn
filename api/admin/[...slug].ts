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
} from "../../lib/db/src/index.js";
import { eq, desc, asc, and, ilike, sql } from "drizzle-orm";
import Parser from "rss-parser";

const rssParser = new Parser();

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

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Token");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { slug } = req.query || {};
  const segments: string[] = Array.isArray(slug) ? slug : (slug ? slug.split("/") : []);
  const path = "/" + segments.join("/");
  const method = req.method;
  const body = req.body || {};

  try {
    // ─── Stats ─────────────────────────────────────────────────────────────
    if (path === "/stats" && method === "GET") {
      const [[art], [cat], [sub], [ev]] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(articlesTable),
        db.select({ count: sql<number>`count(*)` }).from(categoriesTable),
        db.select({ count: sql<number>`count(*)` }).from(newsletterSubscribersTable),
        db.select({ count: sql<number>`count(*)` }).from(eventsTable),
      ]);
      return res.status(200).json({
        articles: Number(art?.count ?? 0),
        categories: Number(cat?.count ?? 0),
        subscribers: Number(sub?.count ?? 0),
        events: Number(ev?.count ?? 0),
      });
    }

    // ─── Inbox Counts ──────────────────────────────────────────────────────
    if (path === "/inbox-counts" && method === "GET") {
      const [[contacts], [members], [sponsors]] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(contactSubmissionsTable).where(eq(contactSubmissionsTable.read, false)),
        db.select({ count: sql<number>`count(*)` }).from(memberRegistrationsTable).where(eq(memberRegistrationsTable.read, false)),
        db.select({ count: sql<number>`count(*)` }).from(sponsorRegistrationsTable).where(eq(sponsorRegistrationsTable.read, false)),
      ]);
      return res.status(200).json({
        contacts: Number(contacts?.count ?? 0),
        members: Number(members?.count ?? 0),
        sponsors: Number(sponsors?.count ?? 0),
      });
    }

    // ─── Articles ──────────────────────────────────────────────────────────
    if (path === "/articles" && method === "GET") {
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

      return res.status(200).json({
        items,
        total: Number(countRes?.count ?? 0),
        page,
        pageSize,
      });
    }

    if (path === "/articles" && method === "POST") {
      const slugVal = body.slug || slugify(body.title) + "-" + Date.now().toString().slice(-4);
      const [inserted] = await db
        .insert(articlesTable)
        .values({
          ...body,
          slug: slugVal,
          publishedAt: body.status === "published" ? new Date() : (body.publishedAt ? new Date(body.publishedAt) : null),
        })
        .returning();
      return res.status(201).json(inserted);
    }

    if (segments[0] === "articles" && segments[1]) {
      const id = Number(segments[1]);
      if (method === "PATCH") {
        const [updated] = await db.update(articlesTable).set({ ...body, updatedAt: new Date() }).where(eq(articlesTable.id, id)).returning();
        return res.status(200).json(updated);
      }
      if (method === "DELETE") {
        await db.delete(articlesTable).where(eq(articlesTable.id, id));
        return res.status(204).end();
      }
    }

    // ─── Categories ────────────────────────────────────────────────────────
    if (path === "/categories" && method === "GET") {
      const cats = await db.select().from(categoriesTable).orderBy(asc(categoriesTable.name));
      return res.status(200).json(cats);
    }
    if (path === "/categories" && method === "POST") {
      const [inserted] = await db.insert(categoriesTable).values({ ...body, slug: slugify(body.name) }).returning();
      return res.status(201).json(inserted);
    }
    if (segments[0] === "categories" && segments[1]) {
      const id = Number(segments[1]);
      if (method === "PATCH") {
        const [updated] = await db.update(categoriesTable).set(body).where(eq(categoriesTable.id, id)).returning();
        return res.status(200).json(updated);
      }
      if (method === "DELETE") {
        await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
        return res.status(204).end();
      }
    }

    // ─── Countries & Authors ───────────────────────────────────────────────
    if (path === "/countries" && method === "GET") {
      const countries = await db.select().from(countriesTable).orderBy(asc(countriesTable.name));
      return res.status(200).json(countries);
    }
    if (path === "/authors" && method === "GET") {
      const authors = await db.select().from(authorsTable).orderBy(asc(authorsTable.name));
      return res.status(200).json(authors);
    }
    if (path === "/authors" && method === "POST") {
      const [inserted] = await db.insert(authorsTable).values(body).returning();
      return res.status(201).json(inserted);
    }
    if (segments[0] === "authors" && segments[1]) {
      const id = Number(segments[1]);
      if (method === "PATCH") {
        const [updated] = await db.update(authorsTable).set(body).where(eq(authorsTable.id, id)).returning();
        return res.status(200).json(updated);
      }
      if (method === "DELETE") {
        await db.delete(authorsTable).where(eq(authorsTable.id, id));
        return res.status(204).end();
      }
    }

    // ─── Events ────────────────────────────────────────────────────────────
    if (path === "/events" && method === "GET") {
      const events = await db.select().from(eventsTable).orderBy(desc(eventsTable.startDate));
      return res.status(200).json(events);
    }
    if (path === "/events" && method === "POST") {
      const [inserted] = await db.insert(eventsTable).values({
        ...body,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : null,
      }).returning();
      return res.status(201).json(inserted);
    }
    if (segments[0] === "events" && segments[1]) {
      const id = Number(segments[1]);
      if (method === "PATCH") {
        const [updated] = await db.update(eventsTable).set({
          ...body,
          startDate: body.startDate ? new Date(body.startDate) : undefined,
          endDate: body.endDate ? new Date(body.endDate) : undefined,
        }).where(eq(eventsTable.id, id)).returning();
        return res.status(200).json(updated);
      }
      if (method === "DELETE") {
        await db.delete(eventsTable).where(eq(eventsTable.id, id));
        return res.status(204).end();
      }
    }

    // ─── RSS Feeds ─────────────────────────────────────────────────────────
    if (path === "/rss/feeds" && method === "GET") {
      const feeds = await db.select().from(rssFeedsTable).orderBy(asc(rssFeedsTable.name));
      return res.status(200).json(feeds);
    }
    if (path === "/rss/feeds" && method === "POST") {
      const [inserted] = await db.insert(rssFeedsTable).values(body).returning();
      return res.status(201).json(inserted);
    }
    if (segments[0] === "rss" && segments[1] === "feeds" && segments[2]) {
      const id = Number(segments[2]);
      if (segments[3] === "ingest" && method === "POST") {
        const [feed] = await db.select().from(rssFeedsTable).where(eq(rssFeedsTable.id, id)).limit(1);
        if (!feed) return res.status(404).json({ error: "Không tìm thấy feed" });
        const parsed = await rssParser.parseURL(feed.url);
        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];
        for (const item of (parsed.items || []).slice(0, 10)) {
          if (!item.title || !item.link) continue;
          const slugVal = slugify(item.title) + "-" + Date.now().toString().slice(-4);
          try {
            const existing = await db.select().from(articlesTable).where(eq(articlesTable.sourceUrl, item.link)).limit(1);
            if (existing.length) { skipped++; continue; }
            await db.insert(articlesTable).values({
              title: item.title,
              slug: slugVal,
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
          } catch (e: any) { errors.push(e.message); }
        }
        await db.update(rssFeedsTable).set({ lastFetchedAt: new Date(), itemsImported: sql`${rssFeedsTable.itemsImported} + ${imported}` }).where(eq(rssFeedsTable.id, id));
        return res.status(200).json([{ feedId: id, feedName: feed.name, fetched: parsed.items?.length || 0, skipped, imported, errors }]);
      }
      if (method === "PATCH") {
        const [updated] = await db.update(rssFeedsTable).set(body).where(eq(rssFeedsTable.id, id)).returning();
        return res.status(200).json(updated);
      }
      if (method === "DELETE") {
        await db.delete(rssFeedsTable).where(eq(rssFeedsTable.id, id));
        return res.status(204).end();
      }
    }

    if (path === "/rss/ingest-all" && method === "POST") {
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
            const slugVal = slugify(item.title) + "-" + Date.now().toString().slice(-4);
            try {
              const existing = await db.select().from(articlesTable).where(eq(articlesTable.sourceUrl, item.link)).limit(1);
              if (existing.length) { skipped++; continue; }
              await db.insert(articlesTable).values({
                title: item.title,
                slug: slugVal,
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
            } catch (e: any) { errors.push(e.message); }
          }
          await db.update(rssFeedsTable).set({ lastFetchedAt: new Date(), itemsImported: sql`${rssFeedsTable.itemsImported} + ${imported}` }).where(eq(rssFeedsTable.id, feed.id));
          results.push({ feedId: feed.id, feedName: feed.name, fetched: parsed.items?.length || 0, skipped, imported, errors });
        } catch (err: any) {
          results.push({ feedId: feed.id, feedName: feed.name, fetched: 0, skipped: 0, imported: 0, errors: [err.message] });
        }
      }
      return res.status(200).json(results);
    }

    // ─── Contacts & Registrations & Banners ─────────────────────────────────
    if (path === "/contacts" && method === "GET") {
      const contacts = await db.select().from(contactSubmissionsTable).orderBy(desc(contactSubmissionsTable.createdAt));
      return res.status(200).json(contacts);
    }
    if (segments[0] === "contacts" && segments[1]) {
      const id = Number(segments[1]);
      if (segments[2] === "read" && method === "PATCH") {
        const [updated] = await db.update(contactSubmissionsTable).set({ read: true }).where(eq(contactSubmissionsTable.id, id)).returning();
        return res.status(200).json(updated);
      }
      if (method === "DELETE") {
        await db.delete(contactSubmissionsTable).where(eq(contactSubmissionsTable.id, id));
        return res.status(204).end();
      }
    }

    if (path === "/registrations/members" && method === "GET") {
      const members = await db.select().from(memberRegistrationsTable).orderBy(desc(memberRegistrationsTable.createdAt));
      return res.status(200).json(members);
    }
    if (segments[0] === "registrations" && segments[1] === "members" && segments[2]) {
      const id = Number(segments[2]);
      if (segments[3] === "read" && method === "PATCH") {
        const [updated] = await db.update(memberRegistrationsTable).set({ read: true }).where(eq(memberRegistrationsTable.id, id)).returning();
        return res.status(200).json(updated);
      }
      if (method === "DELETE") {
        await db.delete(memberRegistrationsTable).where(eq(memberRegistrationsTable.id, id));
        return res.status(204).end();
      }
    }

    if (path === "/registrations/sponsors" && method === "GET") {
      const sponsors = await db.select().from(sponsorRegistrationsTable).orderBy(desc(sponsorRegistrationsTable.createdAt));
      return res.status(200).json(sponsors);
    }
    if (segments[0] === "registrations" && segments[1] === "sponsors" && segments[2]) {
      const id = Number(segments[2]);
      if (segments[3] === "read" && method === "PATCH") {
        const [updated] = await db.update(sponsorRegistrationsTable).set({ read: true }).where(eq(sponsorRegistrationsTable.id, id)).returning();
        return res.status(200).json(updated);
      }
      if (method === "DELETE") {
        await db.delete(sponsorRegistrationsTable).where(eq(sponsorRegistrationsTable.id, id));
        return res.status(204).end();
      }
    }

    if (path === "/newsletter" && method === "GET") {
      const page = Math.max(1, Number(req.query.page || 1));
      const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize || 20)));
      const [items, [countRes]] = await Promise.all([
        db.select().from(newsletterSubscribersTable).orderBy(desc(newsletterSubscribersTable.subscribedAt)).limit(pageSize).offset((page - 1) * pageSize),
        db.select({ count: sql<number>`count(*)` }).from(newsletterSubscribersTable),
      ]);
      return res.status(200).json({ items, total: Number(countRes?.count ?? 0), page, pageSize });
    }
    if (segments[0] === "newsletter" && segments[1] && method === "DELETE") {
      const id = Number(segments[1]);
      await db.delete(newsletterSubscribersTable).where(eq(newsletterSubscribersTable.id, id));
      return res.status(204).end();
    }

    if (path === "/banners" && method === "GET") {
      const banners = await db.select().from(adBannersTable).orderBy(desc(adBannersTable.createdAt));
      return res.status(200).json(banners);
    }
    if (path === "/banners" && method === "POST") {
      const [inserted] = await db.insert(adBannersTable).values(body).returning();
      return res.status(201).json(inserted);
    }
    if (segments[0] === "banners" && segments[1]) {
      const id = Number(segments[1]);
      if (method === "PATCH") {
        const [updated] = await db.update(adBannersTable).set(body).where(eq(adBannersTable.id, id)).returning();
        return res.status(200).json(updated);
      }
      if (method === "DELETE") {
        await db.delete(adBannersTable).where(eq(adBannersTable.id, id));
        return res.status(204).end();
      }
    }

    if (path === "/media" && method === "GET") {
      return res.status(200).json([]);
    }

    if (path === "/ai/suggest" && method === "POST") {
      const { topic } = body;
      return res.status(200).json({
        title: topic ? `Tin tiêu điểm: ${topic}` : "Bản tin cộng đồng người Việt tại Séc",
        summary: "Tổng hợp các sự kiện và thông tin nổi bật nhất trong tuần.",
        content: `<p>Nội dung chi tiết về ${topic || "sự kiện cộng đồng"}...</p>`,
        suggestedSlug: slugify(topic || "tin-tuc-moi"),
        status: "draft",
      });
    }

    return res.status(404).json({ error: `Not found: ${method} ${path}` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
