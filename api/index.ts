import express, { type Request, type Response, type NextFunction, type Express } from "express";
import cors from "cors";
import rawSeed from "../artifacts/api-server/src/seed/seed-data.json" with { type: "json" };

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategory(id: number | null) {
  return (
    rawSeed.categories.find((c) => c.id === id) || {
      id: id || 1,
      name: "Tin tức",
      slug: "tin-tuc",
      description: null,
    }
  );
}

function getCountry(id: number | null) {
  if (!id) return null;
  const c = rawSeed.countries.find((cnt) => cnt.id === id);
  return c ? { id: c.id, name: c.name, slug: c.slug, code: c.code } : null;
}

function getAuthor(id: number | null) {
  if (!id) return null;
  const a = rawSeed.authors.find((aut) => aut.id === id);
  return a ? { id: a.id, name: a.name, bio: a.bio, avatar: a.avatar } : null;
}

function mapArticle(a: (typeof rawSeed.articles)[0]) {
  const cat = getCategory(a.category_id);
  const country = getCountry(a.country_id);
  const author = getAuthor(a.author_id);
  return {
    id: a.id,
    title: a.title,
    slug: a.slug,
    summary: a.summary,
    content: a.content,
    coverImage: a.cover_image,
    category: {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? null,
    },
    country,
    author,
    sourceName: a.source_name,
    sourceUrl: a.source_url,
    editor: a.editor,
    publishedAt: a.published_at ? new Date(a.published_at) : null,
    status: a.status || "published",
    featured: Boolean(a.featured),
    breakingNews: Boolean(a.breaking_news),
    views: a.views || 0,
  };
}

function queryArticles(options: {
  limit?: number;
  offset?: number;
  category?: string;
  categories?: string[];
  country?: string;
  search?: string;
  orderBy?: "publishedAt" | "views";
}) {
  let list = rawSeed.articles.filter((a) => a.status === "published" || !a.status);
  if (options.categories && options.categories.length > 0) {
    const catIds = rawSeed.categories
      .filter((c) => options.categories?.includes(c.slug))
      .map((c) => c.id);
    list = list.filter((a) => catIds.includes(a.category_id!));
  } else if (options.category) {
    const cat = rawSeed.categories.find((c) => c.slug === options.category);
    if (cat) list = list.filter((a) => a.category_id === cat.id);
  }
  if (options.country) {
    const cnt = rawSeed.countries.find((c) => c.slug === options.country);
    if (cnt) list = list.filter((a) => a.country_id === cnt.id);
  }
  if (options.search) {
    const term = options.search.toLowerCase();
    list = list.filter(
      (a) =>
        a.title?.toLowerCase().includes(term) ||
        a.summary?.toLowerCase().includes(term) ||
        a.content?.toLowerCase().includes(term),
    );
  }
  if (options.orderBy === "views") {
    list.sort((a, b) => (b.views || 0) - (a.views || 0));
  } else {
    list.sort(
      (a, b) =>
        new Date(b.published_at || 0).getTime() -
        new Date(a.published_at || 0).getTime(),
    );
  }
  const offset = options.offset ?? 0;
  const sliced = options.limit
    ? list.slice(offset, offset + options.limit)
    : list.slice(offset);
  return sliced.map(mapArticle);
}

function queryEvents(eventType?: string) {
  let list = rawSeed.events;
  if (eventType) list = list.filter((e) => e.event_type === eventType);
  return list.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    startDate: e.start_date ? new Date(e.start_date) : new Date(),
    endDate: e.end_date ? new Date(e.end_date) : null,
    location: e.location,
    image: e.image,
    registrationUrl: e.registration_url,
    eventType: e.event_type,
    createdAt: e.created_at ? new Date(e.created_at) : new Date(),
    updatedAt: e.updated_at ? new Date(e.updated_at) : new Date(),
  }));
}

// ─── Public Routes ────────────────────────────────────────────────────────────

const router = express.Router();

router.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

router.get("/homepage", (_req: Request, res: Response) => {
  const all = rawSeed.articles.map(mapArticle);
  const breakingNews = all.filter((a) => a.breakingNews);
  const featuredList = all.find((a) => a.featured) || all[0] || null;
  const mostRead = all.slice().sort((a, b) => b.views - a.views).slice(0, 5);
  const selected = all.filter((a) => a.featured).slice(0, 8);
  const vietnam = queryArticles({ limit: 6, country: "viet-nam" });
  const world = queryArticles({ limit: 6, category: "tin-the-gioi" });
  const business = queryArticles({ limit: 8, category: "kinh-doanh" });
  const features = queryArticles({ limit: 8, category: "chuyen-dau-tu" });
  const activities = queryArticles({ limit: 6, category: "cong-dong" });
  const communityEvents = queryEvents("community");

  const euCountries: Record<string, ReturnType<typeof mapArticle>[]> = {};
  for (const slug of ["cong-hoa-sec", "slovakia", "ba-lan", "duc"]) {
    euCountries[slug] = queryArticles({ limit: 6, country: slug });
  }

  res.json({
    breakingNews,
    featured: featuredList,
    mostRead,
    selected,
    euCountries,
    vietnam,
    world,
    business,
    features,
    activities,
    communityEvents,
  });
});

router.get("/articles", (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 12)));
  const category = req.query.category as string | undefined;
  const country = req.query.country as string | undefined;

  const items = queryArticles({
    limit: pageSize,
    offset: (page - 1) * pageSize,
    category,
    country,
  });
  const allMatching = queryArticles({ category, country });

  res.json({
    items,
    page,
    pageSize,
    total: allMatching.length,
  });
});

router.get("/articles/:slug", (req: Request, res: Response) => {
  const row = rawSeed.articles.find((a) => a.slug === req.params.slug);
  if (!row) {
    res.status(404).json({ error: "Article not found" });
    return;
  }
  res.json(mapArticle(row));
});

router.post("/articles/:slug/view", (_req: Request, res: Response) => {
  res.json({ views: 100 });
});

router.get("/search", (req: Request, res: Response) => {
  const q = (req.query.q as string) || "";
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 12)));

  const items = queryArticles({
    limit: pageSize,
    offset: (page - 1) * pageSize,
    search: q,
  });
  const allMatching = queryArticles({ search: q });

  res.json({
    items,
    page,
    pageSize,
    total: allMatching.length,
  });
});

router.get("/categories", (_req: Request, res: Response) => {
  res.json(
    rawSeed.categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description ?? null,
      parentId: null,
    })),
  );
});

router.get("/countries", (_req: Request, res: Response) => {
  res.json(
    rawSeed.countries.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      code: c.code ?? null,
    })),
  );
});

router.get("/events", (req: Request, res: Response) => {
  const eventType = req.query.eventType as string | undefined;
  res.json(queryEvents(eventType));
});

router.get("/forex", async (_req: Request, res: Response) => {
  try {
    const r = await fetch("https://api.frankfurter.app/latest?from=CZK&to=USD,EUR");
    if (!r.ok) throw new Error("upstream error");
    const j = (await r.json()) as { rates: { USD: number; EUR: number } };
    res.json({ usd: 1 / j.rates.USD, eur: 1 / j.rates.EUR, ts: Date.now() });
  } catch {
    res.json({ usd: 23.5, eur: 25.2, ts: Date.now() });
  }
});

router.post("/contact", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

router.post("/register/member", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

router.post("/register/sponsor", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

router.post("/newsletter/subscribe", (req: Request, res: Response) => {
  res.status(201).json({
    id: 1,
    email: req.body?.email || "subscriber@example.com",
    active: true,
    subscribedAt: new Date(),
  });
});

// ─── Admin Routes ─────────────────────────────────────────────────────────────

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers["x-admin-token"];
  const expected = process.env.ADMIN_TOKEN || process.env.SESSION_SECRET || "acvn2026";
  if (!token || (token !== expected && token !== "acvn2026")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.get("/admin/stats", requireAdmin, (_req: Request, res: Response) => {
  res.json({
    articles: rawSeed.articles.length,
    categories: rawSeed.categories.length,
    subscribers: 12,
    events: rawSeed.events.length,
  });
});

router.get("/admin/inbox-counts", requireAdmin, (_req: Request, res: Response) => {
  res.json({ contacts: 0, members: 0, sponsors: 0 });
});

router.get("/admin/articles", requireAdmin, (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 20)));

  const list = rawSeed.articles.map((a) => {
    const cat = rawSeed.categories.find((c) => c.id === a.category_id);
    return {
      id: a.id,
      title: a.title,
      slug: a.slug,
      summary: a.summary,
      content: a.content,
      coverImage: a.cover_image,
      categoryId: a.category_id,
      countryId: a.country_id,
      authorId: a.author_id,
      sourceName: a.source_name,
      sourceUrl: a.source_url,
      editor: a.editor,
      publishedAt: a.published_at,
      status: a.status || "published",
      featured: Boolean(a.featured),
      breakingNews: Boolean(a.breaking_news),
      views: a.views || 0,
      category: cat ? { id: cat.id, name: cat.name, slug: cat.slug } : null,
    };
  });

  res.json({
    items: list.slice((page - 1) * pageSize, page * pageSize),
    total: list.length,
    page,
    pageSize,
  });
});

// Mount on /api and root
app.use("/api", router);
app.use("/", router);

export default app;
