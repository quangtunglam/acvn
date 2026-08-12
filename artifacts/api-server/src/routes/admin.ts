import { and, asc, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { Router, type Request, type Response, type NextFunction } from "express";
import {
  adBannersTable,
  articlesTable,
  authorsTable,
  categoriesTable,
  countriesTable,
  db,
  eventsTable,
  newsletterSubscribersTable,
  rssFeedsTable,
} from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ingestFeed, ingestAllFeeds } from "../services/rss-ingest.js";

const router = Router();

// ─── Auth middleware ──────────────────────────────────────────────────────────

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers["x-admin-token"];
  if (!process.env.SESSION_SECRET || token !== process.env.SESSION_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.use(requireAdmin);

// ─── Slug helper ──────────────────────────────────────────────────────────────

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
  ơ: "o", ư: "u",
  ả: "a", ạ: "a",
  ẻ: "e", ẽ: "e", ẹ: "e",
  ỉ: "i", ĩ: "i", ị: "i",
  ỏ: "o", ọ: "o",
  ủ: "u", ũ: "u", ụ: "u",
  ỳ: "y", ỷ: "y", ỹ: "y", ỵ: "y",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .split("")
    .map((c) => VI_MAP[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

// ─── Stats (also used to verify token) ───────────────────────────────────────

router.get("/stats", async (_req, res): Promise<void> => {
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
});

// ─── Articles ─────────────────────────────────────────────────────────────────

router.get("/articles", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize ?? 20)));
  const status = req.query.status as string | undefined;
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
  const rssOnly = req.query.rssOnly === "1";
  const sourceName = req.query.sourceName as string | undefined;
  const dateRange = req.query.date as string | undefined; // "today" | "week"

  const conditions = [];
  if (status) conditions.push(eq(articlesTable.status, status));
  if (categoryId) conditions.push(eq(articlesTable.categoryId, categoryId));
  if (rssOnly) conditions.push(isNotNull(articlesTable.sourceName));
  if (sourceName) conditions.push(eq(articlesTable.sourceName, sourceName));
  if (dateRange === "today") {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    conditions.push(gte(articlesTable.publishedAt, start));
  } else if (dateRange === "week") {
    const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    conditions.push(gte(articlesTable.publishedAt, start));
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const [items, [countRow]] = await Promise.all([
    db
      .select({ article: articlesTable, category: categoriesTable })
      .from(articlesTable)
      .leftJoin(categoriesTable, eq(articlesTable.categoryId, categoriesTable.id))
      .where(where)
      .orderBy(desc(articlesTable.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)` }).from(articlesTable).where(where),
  ]);

  res.json({
    items: items.map((r) => ({ ...r.article, category: r.category })),
    total: Number(countRow?.count ?? 0),
    page,
    pageSize,
  });
});

router.post("/articles", async (req, res): Promise<void> => {
  const b = req.body as {
    title: string; slug?: string; summary?: string; content?: string;
    coverImage?: string; categoryId: number; countryId?: number;
    authorId?: number; sourceName?: string; sourceUrl?: string;
    editor?: string; publishedAt?: string; status?: string;
    featured?: boolean; breakingNews?: boolean; mostReadRank?: number | null;
  };

  const slug = b.slug?.trim() || slugify(b.title);
  try {
    const [article] = await db.insert(articlesTable).values({
      title: b.title, slug,
      summary: b.summary ?? "", content: b.content ?? "",
      coverImage: b.coverImage ?? null,
      categoryId: b.categoryId,
      countryId: b.countryId ?? null,
      authorId: b.authorId ?? null,
      sourceName: b.sourceName ?? null,
      sourceUrl: b.sourceUrl ?? null,
      editor: b.editor ?? null,
      publishedAt: b.publishedAt ? new Date(b.publishedAt) : null,
      status: b.status ?? "draft",
      featured: b.featured ?? false,
      breakingNews: b.breakingNews ?? false,
      mostReadRank: b.mostReadRank ?? null,
    }).returning();
    res.status(201).json(article);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      res.status(409).json({ error: "Slug đã tồn tại. Hãy chọn slug khác." });
    } else { throw err; }
  }
});

router.get("/articles/:id", async (req, res): Promise<void> => {
  const [row] = await db.select().from(articlesTable)
    .where(eq(articlesTable.id, Number(req.params.id))).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.patch("/articles/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;
  const update: Record<string, unknown> = {};

  const strFields = ["title","slug","summary","content","coverImage","sourceName","sourceUrl","editor","status"] as const;
  const numFields = ["categoryId","countryId","authorId","views"] as const;
  const boolFields = ["featured","breakingNews"] as const;

  for (const f of strFields) if (f in b) update[f] = b[f] ?? null;
  for (const f of numFields) if (f in b) update[f] = b[f] ? Number(b[f]) : null;
  for (const f of boolFields) if (f in b) update[f] = Boolean(b[f]);
  if ("mostReadRank" in b) update.mostReadRank = b.mostReadRank ? Number(b.mostReadRank) : null;
  if ("publishedAt" in b) update.publishedAt = b.publishedAt ? new Date(b.publishedAt as string) : null;

  const [article] = await db.update(articlesTable).set(update)
    .where(eq(articlesTable.id, id)).returning();
  if (!article) { res.status(404).json({ error: "Not found" }); return; }
  res.json(article);
});

router.delete("/articles/:id", async (req, res): Promise<void> => {
  await db.delete(articlesTable).where(eq(articlesTable.id, Number(req.params.id)));
  res.status(204).end();
});

// ─── Categories ───────────────────────────────────────────────────────────────

router.get("/categories", async (_req, res): Promise<void> => {
  res.json(await db.select().from(categoriesTable).orderBy(asc(categoriesTable.name)));
});

router.post("/categories", async (req, res): Promise<void> => {
  const b = req.body as { name: string; slug?: string; description?: string };
  const [row] = await db.insert(categoriesTable).values({
    name: b.name, slug: b.slug?.trim() || slugify(b.name), description: b.description ?? null,
  }).returning();
  res.status(201).json(row);
});

router.patch("/categories/:id", async (req, res): Promise<void> => {
  const b = req.body as { name?: string; slug?: string; description?: string };
  const [row] = await db.update(categoriesTable).set({
    ...(b.name !== undefined && { name: b.name }),
    ...(b.slug !== undefined && { slug: b.slug }),
    ...(b.description !== undefined && { description: b.description ?? null }),
  }).where(eq(categoriesTable.id, Number(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/categories/:id", async (req, res): Promise<void> => {
  await db.delete(categoriesTable).where(eq(categoriesTable.id, Number(req.params.id)));
  res.status(204).end();
});

// ─── Countries ────────────────────────────────────────────────────────────────

router.get("/countries", async (_req, res): Promise<void> => {
  res.json(await db.select().from(countriesTable).orderBy(asc(countriesTable.name)));
});

router.post("/countries", async (req, res): Promise<void> => {
  const b = req.body as { name: string; slug?: string; code?: string };
  const [row] = await db.insert(countriesTable).values({
    name: b.name, slug: b.slug?.trim() || slugify(b.name), code: b.code ?? null,
  }).returning();
  res.status(201).json(row);
});

router.patch("/countries/:id", async (req, res): Promise<void> => {
  const b = req.body as { name?: string; slug?: string; code?: string };
  const [row] = await db.update(countriesTable).set({
    ...(b.name !== undefined && { name: b.name }),
    ...(b.slug !== undefined && { slug: b.slug }),
    ...(b.code !== undefined && { code: b.code ?? null }),
  }).where(eq(countriesTable.id, Number(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/countries/:id", async (req, res): Promise<void> => {
  await db.delete(countriesTable).where(eq(countriesTable.id, Number(req.params.id)));
  res.status(204).end();
});

// ─── Authors ──────────────────────────────────────────────────────────────────

router.get("/authors", async (_req, res): Promise<void> => {
  res.json(await db.select().from(authorsTable).orderBy(asc(authorsTable.name)));
});

router.post("/authors", async (req, res): Promise<void> => {
  const b = req.body as { name: string; bio?: string; avatar?: string };
  const [row] = await db.insert(authorsTable).values({
    name: b.name, bio: b.bio ?? null, avatar: b.avatar ?? null,
  }).returning();
  res.status(201).json(row);
});

router.patch("/authors/:id", async (req, res): Promise<void> => {
  const b = req.body as { name?: string; bio?: string; avatar?: string };
  const [row] = await db.update(authorsTable).set({
    ...(b.name !== undefined && { name: b.name }),
    ...(b.bio !== undefined && { bio: b.bio ?? null }),
    ...(b.avatar !== undefined && { avatar: b.avatar ?? null }),
  }).where(eq(authorsTable.id, Number(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/authors/:id", async (req, res): Promise<void> => {
  await db.delete(authorsTable).where(eq(authorsTable.id, Number(req.params.id)));
  res.status(204).end();
});

// ─── Events ───────────────────────────────────────────────────────────────────

router.get("/events", async (_req, res): Promise<void> => {
  res.json(await db.select().from(eventsTable).orderBy(desc(eventsTable.startDate)));
});

router.post("/events", async (req, res): Promise<void> => {
  const b = req.body as {
    title: string; description?: string; startDate: string; endDate?: string;
    location?: string; image?: string; registrationUrl?: string; eventType?: string;
  };
  const [row] = await db.insert(eventsTable).values({
    title: b.title,
    description: b.description ?? null,
    startDate: new Date(b.startDate),
    endDate: b.endDate ? new Date(b.endDate) : null,
    location: b.location ?? null,
    image: b.image ?? null,
    registrationUrl: b.registrationUrl ?? null,
    eventType: b.eventType ?? "community",
  }).returning();
  res.status(201).json(row);
});

router.patch("/events/:id", async (req, res): Promise<void> => {
  const b = req.body as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  const strFields = ["title","description","location","image","registrationUrl","eventType"] as const;
  for (const f of strFields) if (f in b) update[f] = b[f] ?? null;
  if ("startDate" in b && b.startDate) update.startDate = new Date(b.startDate as string);
  if ("endDate" in b) update.endDate = b.endDate ? new Date(b.endDate as string) : null;

  const [row] = await db.update(eventsTable).set(update)
    .where(eq(eventsTable.id, Number(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/events/:id", async (req, res): Promise<void> => {
  await db.delete(eventsTable).where(eq(eventsTable.id, Number(req.params.id)));
  res.status(204).end();
});

// ─── Newsletter subscribers ───────────────────────────────────────────────────

router.get("/newsletter", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 30)));
  const [items, [countRow]] = await Promise.all([
    db.select().from(newsletterSubscribersTable)
      .orderBy(desc(newsletterSubscribersTable.subscribedAt))
      .limit(pageSize).offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)` }).from(newsletterSubscribersTable),
  ]);
  res.json({ items, total: Number(countRow?.count ?? 0), page, pageSize });
});

router.patch("/newsletter/:id", async (req, res): Promise<void> => {
  const b = req.body as { active?: boolean };
  const [row] = await db.update(newsletterSubscribersTable)
    .set({ active: Boolean(b.active) })
    .where(eq(newsletterSubscribersTable.id, Number(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/newsletter/:id", async (req, res): Promise<void> => {
  await db.delete(newsletterSubscribersTable)
    .where(eq(newsletterSubscribersTable.id, Number(req.params.id)));
  res.status(204).end();
});

// ─── Ad banners ───────────────────────────────────────────────────────────────

router.get("/banners", async (_req, res): Promise<void> => {
  res.json(await db.select().from(adBannersTable).orderBy(asc(adBannersTable.position)));
});

router.post("/banners", async (req, res): Promise<void> => {
  const b = req.body as { name: string; image?: string; targetUrl?: string; position: string; enabled?: boolean };
  const [row] = await db.insert(adBannersTable).values({
    name: b.name, image: b.image ?? null, targetUrl: b.targetUrl ?? null,
    position: b.position, enabled: b.enabled ?? true,
  }).returning();
  res.status(201).json(row);
});

router.patch("/banners/:id", async (req, res): Promise<void> => {
  const b = req.body as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  if ("name" in b) update.name = b.name;
  if ("image" in b) update.image = b.image ?? null;
  if ("targetUrl" in b) update.targetUrl = b.targetUrl ?? null;
  if ("position" in b) update.position = b.position;
  if ("enabled" in b) update.enabled = Boolean(b.enabled);

  const [row] = await db.update(adBannersTable).set(update)
    .where(eq(adBannersTable.id, Number(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/banners/:id", async (req, res): Promise<void> => {
  await db.delete(adBannersTable).where(eq(adBannersTable.id, Number(req.params.id)));
  res.status(204).end();
});

// ─── AI Article Suggest ───────────────────────────────────────────────────────

router.post("/ai/suggest", async (req, res): Promise<void> => {
  const { prompt } = req.body as { prompt?: string };
  if (!prompt?.trim()) {
    res.status(400).json({ error: "Cần có nội dung gợi ý (prompt)." });
    return;
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-5.6-luna",
    max_completion_tokens: 2048,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Bạn là biên tập viên của VietPress EU, tờ báo tiếng Việt dành cho cộng đồng người Việt tại châu Âu.
Dựa trên chủ đề hoặc thông tin người dùng cung cấp, hãy soạn thảo một bài tin tức tiếng Việt chất lượng.
Trả về JSON với đúng cấu trúc này:
{
  "title": "Tiêu đề bài viết ngắn gọn, hấp dẫn",
  "summary": "Tóm tắt 1-2 câu, nêu bật điểm chính",
  "content": "<p>Nội dung bài viết dưới dạng HTML...</p>",
  "suggestedSlug": "tieu-de-dang-slug"
}
Nội dung phải khách quan, chính xác và phù hợp với phong cách báo chí.`,
      },
      { role: "user", content: prompt },
    ],
  });

  try {
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const draft = JSON.parse(raw) as {
      title?: string; summary?: string; content?: string; suggestedSlug?: string;
    };
    res.json({
      title: draft.title ?? "",
      summary: draft.summary ?? "",
      content: draft.content ?? "",
      suggestedSlug: draft.suggestedSlug ?? slugify(draft.title ?? ""),
      status: "draft",
    });
  } catch {
    res.status(500).json({ error: "Không thể phân tích phản hồi từ AI." });
  }
});

// ─── RSS Feeds ────────────────────────────────────────────────────────────────

router.get("/rss/feeds", async (_req, res): Promise<void> => {
  const feeds = await db
    .select()
    .from(rssFeedsTable)
    .orderBy(asc(rssFeedsTable.name));
  res.json(feeds);
});

router.post("/rss/feeds", async (req, res): Promise<void> => {
  const body = req.body as {
    name: string; url: string; categoryId: number;
    countryId?: number | null; active?: boolean;
  };
  const [feed] = await db.insert(rssFeedsTable).values({
    name: body.name,
    url: body.url,
    categoryId: body.categoryId,
    countryId: body.countryId ?? null,
    active: body.active ?? true,
  }).returning();
  res.status(201).json(feed);
});

router.patch("/rss/feeds/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const body = req.body as Partial<{
    name: string; url: string; categoryId: number;
    countryId: number | null; active: boolean;
  }>;
  const [feed] = await db
    .update(rssFeedsTable)
    .set(body)
    .where(eq(rssFeedsTable.id, id))
    .returning();
  if (!feed) { res.status(404).json({ error: "Not found" }); return; }
  res.json(feed);
});

router.delete("/rss/feeds/:id", async (req, res): Promise<void> => {
  await db.delete(rssFeedsTable).where(eq(rssFeedsTable.id, Number(req.params.id)));
  res.status(204).end();
});

router.post("/rss/feeds/:id/ingest", async (req, res): Promise<void> => {
  try {
    const result = await ingestFeed(Number(req.params.id));
    res.json([result]);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post("/rss/ingest-all", async (_req, res): Promise<void> => {
  const results = await ingestAllFeeds();
  res.json(results);
});

export default router;
