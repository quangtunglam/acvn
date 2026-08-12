import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
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

async function queryArticles(options: {
  limit?: number;
  offset?: number;
  category?: string;
  country?: string;
  search?: string;
  orderBy?: "publishedAt" | "views";
}): Promise<ReturnType<typeof mapArticle>[]> {
  const filters = [publishedFilter];
  if (options.category) {
    filters.push(eq(categoriesTable.slug, options.category));
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
  const filters = [publishedFilter];
  if (options.category) filters.push(eq(categoriesTable.slug, options.category));
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

async function queryEvents(eventType?: string) {
  const where = eventType
    ? and(
        eq(eventsTable.eventType, eventType),
        sql`${eventsTable.startDate} >= now()`,
      )
    : sql`${eventsTable.startDate} >= now()`;

  return db
    .select()
    .from(eventsTable)
    .where(where)
    .orderBy(asc(eventsTable.startDate));
}

router.get("/homepage", async (_req, res): Promise<void> => {
  const [
    breakingNews,
    featuredList,
    mostRead,
    selected,
    vietnam,
    world,
    business,
    features,
    golfEvents,
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
    queryArticles({ limit: 8, category: "kinh-doanh" }),
    queryArticles({ limit: 8, category: "chuyen-dau-tu" }),
    queryEvents("golf"),
    queryEvents("community"),
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
      golfEvents,
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
  const categories = await db
    .select({
      id: categoriesTable.id,
      name: categoriesTable.name,
      slug: categoriesTable.slug,
      description: categoriesTable.description,
    })
    .from(categoriesTable)
    .orderBy(asc(categoriesTable.name));
  res.json(ListCategoriesResponse.parse(categories));
});

router.get("/countries", async (_req, res): Promise<void> => {
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
  const events = await queryEvents(parsed.data.eventType);
  res.json(ListEventsResponse.parse(events));
});

router.post("/newsletter/subscribe", async (req, res): Promise<void> => {
  const parsed = SubscribeNewsletterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(newsletterSubscribersTable)
    .where(eq(newsletterSubscribersTable.email, parsed.data.email))
    .limit(1);

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

export default router;