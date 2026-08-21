import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import rawSeed from "../seed/seed-data.json" with { type: "json" };
import {
  GetArticleParams,
  GetArticleResponse,
  GetHomepageResponse,
  IncrementArticleViewParams,
  IncrementArticleViewResponse,
  ListArticlesQueryParams,
  ListArticlesResponse,
  ListCategoriesResponse,
  ListCountriesResponse,
  ListEventsQueryParams,
  ListEventsResponse,
  SearchArticlesQueryParams,
  SearchArticlesResponse,
  SubscribeNewsletterBody,
  SubscribeNewsletterResponse,
} from "@workspace/api-zod";
import {
  articlesTable,
  authorsTable,
  categoriesTable,
  countriesTable,
  db,
  eventsTable,
  newsletterSubscribersTable,
  type Article as DbArticle,
  type Author as DbAuthor,
  type Category as DbCategory,
  type Country as DbCountry,
} from "@workspace/db";

const router: IRouter = Router();

type ArticleJoinRow = {
  article: DbArticle;
  category: DbCategory | null;
  country: DbCountry | null;
  author: DbAuthor | null;
};

const publishedFilter = eq(articlesTable.status, "published");

function mapArticle(row: ArticleJoinRow) {
  if (!row.category) {
    throw new Error(`Article ${row.article.id} is missing a category`);
  }

  return {
    id: row.article.id,
    title: row.article.title,
    slug: row.article.slug,
    summary: row.article.summary,
    content: row.article.content,
    coverImage: row.article.coverImage,
    category: {
      id: row.category.id,
      name: row.category.name,
      slug: row.category.slug,
      description: row.category.description,
    },
    country: row.country
      ? {
          id: row.country.id,
          name: row.country.name,
          slug: row.country.slug,
          code: row.country.code,
        }
      : null,
    author: row.author
      ? {
          id: row.author.id,
          name: row.author.name,
          bio: row.author.bio,
          avatar: row.author.avatar,
        }
      : null,
    sourceName: row.article.sourceName,
    sourceUrl: row.article.sourceUrl,
    editor: row.article.editor,
    publishedAt: row.article.publishedAt,
    status: row.article.status,
    featured: row.article.featured,
    breakingNews: row.article.breakingNews,
    views: row.article.views,
  };
}

function getSeedCategory(id: number | null) {
  return rawSeed.categories.find((c) => c.id === id) || { id: id || 1, name: "Tin tức", slug: "tin-tuc", description: null };
}
function getSeedCountry(id: number | null) {
  if (!id) return null;
  const c = rawSeed.countries.find((cnt) => cnt.id === id);
  return c ? { id: c.id, name: c.name, slug: c.slug, code: c.code } : null;
}
function getSeedAuthor(id: number | null) {
  if (!id) return null;
  const a = rawSeed.authors.find((aut) => aut.id === id);
  return a ? { id: a.id, name: a.name, bio: a.bio, avatar: a.avatar } : null;
}
function mapSeedArticle(a: (typeof rawSeed.articles)[0]): ReturnType<typeof mapArticle> {
  const cat = getSeedCategory(a.category_id);
  const country = getSeedCountry(a.country_id);
  const author = getSeedAuthor(a.author_id);
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
    status: a.status,
    featured: a.featured,
    breakingNews: a.breaking_news,
    views: a.views || 0,
  };
}

// Returns category IDs for a slug, including all child categories
async function getCategoryIds(slug: string): Promise<number[]> {
  if (!db) {
    const parent = rawSeed.categories.find((c) => c.slug === slug);
    return parent ? [parent.id] : [];
  }
  const [parent] = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(eq(categoriesTable.slug, slug))
    .limit(1);
  if (!parent) return [];
  const children = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(eq(categoriesTable.parentId, parent.id));
  return [parent.id, ...children.map((c) => c.id)];
}

async function queryArticles(options: {
  limit?: number;
  offset?: number;
  category?: string;
  categories?: string[];
  country?: string;
  search?: string;
  orderBy?: "publishedAt" | "views";
}): Promise<ReturnType<typeof mapArticle>[]> {
  if (!db) {
    let list = rawSeed.articles.filter((a) => a.status === "published" || !a.status);
    if (options.categories && options.categories.length > 0) {
      const catIds = rawSeed.categories.filter((c) => options.categories?.includes(c.slug)).map((c) => c.id);
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
      list.sort((a, b) => new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime());
    }
    const offset = options.offset ?? 0;
    const sliced = options.limit ? list.slice(offset, offset + options.limit) : list.slice(offset);
    return sliced.map(mapSeedArticle);
  }

  const filters = [publishedFilter];
  if (options.categories && options.categories.length > 0) {
    const allIds = (await Promise.all(options.categories.map(getCategoryIds))).flat();
    if (allIds.length === 1) filters.push(eq(articlesTable.categoryId, allIds[0]));
    else if (allIds.length > 1) filters.push(inArray(articlesTable.categoryId, allIds));
  } else if (options.category) {
    const ids = await getCategoryIds(options.category);
    if (ids.length === 1) filters.push(eq(articlesTable.categoryId, ids[0]));
    else if (ids.length > 1) filters.push(inArray(articlesTable.categoryId, ids));
  }
  if (options.country) {
    filters.push(eq(countriesTable.slug, options.country));
  }
  if (options.search) {
    const term = `%${options.search}%`;
    filters.push(
      or(
        ilike(articlesTable.title, term),
        ilike(articlesTable.summary, term),
        ilike(articlesTable.content, term),
        ilike(categoriesTable.name, term),
        ilike(countriesTable.name, term),
      )!,
    );
  }

  const query = db
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
    .orderBy(
      options.orderBy === "views"
        ? desc(articlesTable.views)
        : desc(articlesTable.publishedAt),
    );

  const rows = await (options.limit === undefined
    ? query
    : query.limit(options.limit).offset(options.offset ?? 0));
  return rows.map(mapArticle);
}

async function countArticles(options: {
  category?: string;
  country?: string;
  search?: string;
}): Promise<number> {
  if (!db) {
    const list = await queryArticles({ ...options });
    return list.length;
  }

  const filters = [publishedFilter];
  if (options.category) {
    const ids = await getCategoryIds(options.category);
    if (ids.length === 1) filters.push(eq(articlesTable.categoryId, ids[0]));
    else if (ids.length > 1) filters.push(inArray(articlesTable.categoryId, ids));
  }
  if (options.country) filters.push(eq(countriesTable.slug, options.country));
  if (options.search) {
    const term = `%${options.search}%`;
    filters.push(
      or(
        ilike(articlesTable.title, term),
        ilike(articlesTable.summary, term),
        ilike(articlesTable.content, term),
        ilike(categoriesTable.name, term),
        ilike(countriesTable.name, term),
      )!,
    );
  }

  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(articlesTable)
    .leftJoin(categoriesTable, eq(articlesTable.categoryId, categoriesTable.id))
    .leftJoin(countriesTable, eq(articlesTable.countryId, countriesTable.id))
    .where(and(...filters));

  return Number(result?.count ?? 0);
}

async function queryEvents(eventType?: string, includePast = false) {
  if (!db) {
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

  const dateCond = includePast ? undefined : sql`${eventsTable.startDate} >= now()`;
  const where = eventType
    ? dateCond
      ? and(eq(eventsTable.eventType, eventType), dateCond)
      : eq(eventsTable.eventType, eventType)
    : dateCond;

  return db
    .select()
    .from(eventsTable)
    .where(where)
    .orderBy(asc(eventsTable.startDate));
}

router.get("/homepage", async (_req, res): Promise<void> => {
  if (!db) {
    const all = rawSeed.articles.filter((a) => a.status === "published" || !a.status).map(mapSeedArticle);
    const breakingNews = all.filter((a) => a.breakingNews);
    const featuredList = all.find((a) => a.featured) || all[0] || null;
    const mostRead = all.slice().sort((a, b) => b.views - a.views).slice(0, 5);
    const selected = all.filter((a) => a.featured).slice(0, 8);
    const vietnam = await queryArticles({ limit: 6, country: "viet-nam" });
    const world = await queryArticles({ limit: 6, category: "tin-the-gioi" });
    const business = await queryArticles({ limit: 8, category: "kinh-doanh" });
    const features = await queryArticles({ limit: 8, category: "chuyen-dau-tu" });
    const activities = await queryArticles({ limit: 6, category: "cong-dong" });
    const communityEvents = await queryEvents("community", true);

    const euCountries: Record<string, ReturnType<typeof mapArticle>[]> = {};
    for (const slug of ["cong-hoa-sec", "slovakia", "ba-lan", "duc"]) {
      euCountries[slug] = await queryArticles({ limit: 6, country: slug });
    }

    res.json(
      GetHomepageResponse.parse({
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
      }),
    );
    return;
  }

  const [
    breakingNews,
    featuredList,
    mostRead,
    selected,
    vietnam,
    world,
    business,
    features,
    activities,
    communityEvents,
  ] = await Promise.all([
    // breaking news for ticker — scan more rows so we don't miss any
    queryArticles({ limit: 30, orderBy: "publishedAt" }).then((items) =>
      items.filter((item) => item.breakingNews),
    ),
    // hero: first featured article by publish date
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
      .where(and(publishedFilter, eq(articlesTable.featured, true)))
      .orderBy(desc(articlesTable.publishedAt))
      .limit(1)
      .then((rows) => (rows[0] ? mapArticle(rows[0]) : null)),
    // mostRead: pinned by rank first, then fill with top-viewed
    db.select({ article: articlesTable, category: categoriesTable, country: countriesTable, author: authorsTable })
      .from(articlesTable)
      .leftJoin(categoriesTable, eq(articlesTable.categoryId, categoriesTable.id))
      .leftJoin(countriesTable, eq(articlesTable.countryId, countriesTable.id))
      .leftJoin(authorsTable, eq(articlesTable.authorId, authorsTable.id))
      .where(and(publishedFilter, sql`${articlesTable.mostReadRank} IS NOT NULL`))
      .orderBy(articlesTable.mostReadRank)
      .limit(5)
      .then(async (pinned) => {
        const mapped = pinned.map(mapArticle);
        if (mapped.length >= 5) return mapped;
        const used = new Set(mapped.map((a) => a.id));
        const filler = await queryArticles({ limit: 5 - mapped.length, orderBy: "views" });
        return [...mapped, ...filler.filter((a) => !used.has(a.id))];
      }),
    // selected: featured articles (cards below hero)
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
      .where(and(publishedFilter, eq(articlesTable.featured, true)))
      .orderBy(desc(articlesTable.publishedAt))
      .limit(8)
      .then((rows) => rows.map(mapArticle)),
    queryArticles({ limit: 6, country: "viet-nam" }),
    queryArticles({ limit: 6, category: "tin-the-gioi" }),
    queryArticles({ limit: 8, category: "phap-luat" }),
    queryArticles({ limit: 8, category: "van-hoa-truyen-thong", orderBy: "publishedAt" }),
    queryArticles({ limit: 6, category: "tin-hoat-dong", orderBy: "publishedAt" }),
    queryEvents("community", true),
  ]);

  const euCountries: Record<string, ReturnType<typeof mapArticle>[]> = {};
  for (const slug of ["cong-hoa-sec", "slovakia", "ba-lan", "duc"]) {
    euCountries[slug] = await queryArticles({ limit: 6, country: slug });
  }

  res.json(
    GetHomepageResponse.parse({
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
    }),
  );
});

router.get("/articles", async (req, res): Promise<void> => {
  const parsed = ListArticlesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { page = 1, pageSize = 12, category, country } = parsed.data;
  const [items, total] = await Promise.all([
    queryArticles({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      category,
      country,
    }),
    countArticles({ category, country }),
  ]);

  res.json(ListArticlesResponse.parse({ items, page, pageSize, total }));
});

router.get("/articles/:slug", async (req, res): Promise<void> => {
  const parsed = GetArticleParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (!db) {
    const row = rawSeed.articles.find((a) => a.slug === parsed.data.slug);
    if (!row) {
      res.status(404).json({ error: "Article not found" });
      return;
    }
    res.json(GetArticleResponse.parse(mapSeedArticle(row)));
    return;
  }

  const [row] = await db
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
    .where(and(eq(articlesTable.slug, parsed.data.slug), publishedFilter));

  if (!row) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  res.json(GetArticleResponse.parse(mapArticle(row)));
});

router.post("/articles/:slug/view", async (req, res): Promise<void> => {
  const parsed = IncrementArticleViewParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (!db) {
    res.json(IncrementArticleViewResponse.parse({ views: 100 }));
    return;
  }

  const [article] = await db
    .update(articlesTable)
    .set({ views: sql`${articlesTable.views} + 1` })
    .where(
      and(eq(articlesTable.slug, parsed.data.slug), publishedFilter),
    )
    .returning({ views: articlesTable.views });

  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  res.json(IncrementArticleViewResponse.parse(article));
});

router.get("/search", async (req, res): Promise<void> => {
  const parsed = SearchArticlesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { q, page = 1, pageSize = 12 } = parsed.data;
  const [items, total] = await Promise.all([
    queryArticles({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      search: q,
    }),
    countArticles({ search: q }),
  ]);

  res.json(SearchArticlesResponse.parse({ items, page, pageSize, total }));
});

router.get("/categories", async (_req, res): Promise<void> => {
  if (!db) {
    res.json(
      ListCategoriesResponse.parse(
        rawSeed.categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description ?? null,
          parentId: null,
        })),
      ),
    );
    return;
  }

  const categories = await db
    .select({
      id: categoriesTable.id,
      name: categoriesTable.name,
      slug: categoriesTable.slug,
      description: categoriesTable.description,
      parentId: categoriesTable.parentId,
    })
    .from(categoriesTable)
    .orderBy(asc(categoriesTable.name));
  res.json(ListCategoriesResponse.parse(categories));
});

router.get("/countries", async (_req, res): Promise<void> => {
  if (!db) {
    res.json(
      ListCountriesResponse.parse(
        rawSeed.countries.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          code: c.code ?? null,
        })),
      ),
    );
    return;
  }

  const countries = await db
    .select({
      id: countriesTable.id,
      name: countriesTable.name,
      slug: countriesTable.slug,
      code: countriesTable.code,
    })
    .from(countriesTable)
    .orderBy(asc(countriesTable.name));
  res.json(ListCountriesResponse.parse(countries));
});

router.get("/events", async (req, res): Promise<void> => {
  const parsed = ListEventsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const events = await queryEvents(parsed.data.eventType, parsed.data.includePast ?? false);
  res.json(ListEventsResponse.parse(events));
});

router.post("/newsletter/subscribe", async (req, res): Promise<void> => {
  const parsed = SubscribeNewsletterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (!db) {
    res.status(201).json(
      SubscribeNewsletterResponse.parse({
        id: 1,
        email: parsed.data.email,
        active: true,
        subscribedAt: new Date(),
      }),
    );
    return;
  }

  const subscriber =
    existing[0] ??
    (
      await db
        .insert(newsletterSubscribersTable)
        .values({ email: parsed.data.email, active: true })
        .returning()
    )[0];

  res.status(201).json(
    SubscribeNewsletterResponse.parse({
      id: subscriber.id,
      email: subscriber.email,
      active: subscriber.active,
      subscribedAt: subscriber.subscribedAt,
    }),
  );
});

// ─── Forex proxy ─────────────────────────────────────────────────────────────
// Proxy to frankfurter.app so the browser avoids CORS issues.
// Cache in memory for 30 minutes.
let fxCache: { usd: number; eur: number; ts: number } | null = null;

router.get("/forex", async (_req, res): Promise<void> => {
  const now = Date.now();
  if (fxCache && now - fxCache.ts < 30 * 60 * 1000) {
    res.json(fxCache);
    return;
  }
  try {
    const r = await fetch("https://api.frankfurter.app/latest?from=CZK&to=USD,EUR");
    if (!r.ok) throw new Error("upstream error");
    const j = await r.json() as { rates: { USD: number; EUR: number } };
    fxCache = { usd: 1 / j.rates.USD, eur: 1 / j.rates.EUR, ts: now };
    res.json(fxCache);
  } catch {
    if (fxCache) { res.json(fxCache); return; }
    res.status(502).json({ error: "forex unavailable" });
  }
});

export default router;