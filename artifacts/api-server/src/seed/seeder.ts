/**
 * One-time production seeder.
 * Triggers when articles count < 300 (handles partial prod data).
 * Uses onConflictDoNothing to safely skip any rows that already exist.
 * Builds a category slug→id remap to handle ID mismatches between dev and prod.
 */
import { sql, eq } from "drizzle-orm";
import {
  db,
  articlesTable,
  categoriesTable,
  countriesTable,
  authorsTable,
  rssFeedsTable,
  eventsTable,
} from "@workspace/db";
import { logger } from "../lib/logger.js";
import rawSeed from "./seed-data.json" with { type: "json" };

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function mapCategory(r: Row) {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description ?? null,
    createdAt: r.created_at ? new Date(r.created_at) : undefined,
    updatedAt: r.updated_at ? new Date(r.updated_at) : undefined,
  };
}

function mapCountry(r: Row) {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    code: r.code ?? null,
    createdAt: r.created_at ? new Date(r.created_at) : undefined,
    updatedAt: r.updated_at ? new Date(r.updated_at) : undefined,
  };
}

function mapAuthor(r: Row) {
  return {
    id: r.id,
    name: r.name,
    bio: r.bio ?? null,
    avatar: r.avatar ?? null,
    createdAt: r.created_at ? new Date(r.created_at) : undefined,
    updatedAt: r.updated_at ? new Date(r.updated_at) : undefined,
  };
}

function mapFeed(r: Row, catRemap: Map<number, number>) {
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    categoryId: r.category_id != null ? (catRemap.get(r.category_id) ?? r.category_id) : null,
    countryId: r.country_id ?? null,
    active: r.active ?? true,
    lastFetchedAt: r.last_fetched_at ? new Date(r.last_fetched_at) : null,
    itemsImported: r.items_imported ?? 0,
    createdAt: r.created_at ? new Date(r.created_at) : undefined,
    updatedAt: r.updated_at ? new Date(r.updated_at) : undefined,
  };
}

function mapEvent(r: Row) {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? null,
    startDate: r.start_date ? new Date(r.start_date) : null,
    endDate: r.end_date ? new Date(r.end_date) : null,
    location: r.location ?? null,
    image: r.image ?? null,
    registrationUrl: r.registration_url ?? null,
    eventType: r.event_type ?? null,
    createdAt: r.created_at ? new Date(r.created_at) : undefined,
    updatedAt: r.updated_at ? new Date(r.updated_at) : undefined,
  };
}

function mapArticle(r: Row, catRemap: Map<number, number>) {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    summary: r.summary ?? null,
    content: r.content ?? null,
    coverImage: r.cover_image ?? null,
    categoryId: r.category_id != null ? (catRemap.get(r.category_id) ?? r.category_id) : null,
    countryId: r.country_id ?? null,
    authorId: r.author_id ?? null,
    editor: r.editor ?? null,
    sourceName: r.source_name ?? null,
    sourceUrl: r.source_url ?? null,
    publishedAt: r.published_at ? new Date(r.published_at) : null,
    createdAt: r.created_at ? new Date(r.created_at) : undefined,
    updatedAt: r.updated_at ? new Date(r.updated_at) : undefined,
    status: r.status ?? "draft",
    featured: r.featured ?? false,
    breakingNews: r.breaking_news ?? false,
    views: r.views ?? 0,
    tags: r.tags ?? [],
  };
}

// ─── Categories to ensure exist on every startup ─────────────────────────────
const ENSURE_CATEGORIES = [
  { name: "Kinh doanh", slug: "kinh-doanh" },
  { name: "Cộng đồng",  slug: "cong-dong"  },
];

export async function ensureCategories(): Promise<void> {
  try {
    for (const cat of ENSURE_CATEGORIES) {
      const existing = await db
        .select({ id: categoriesTable.id })
        .from(categoriesTable)
        .where(sql`slug = ${cat.slug}`)
        .limit(1);
      if (existing.length === 0) {
        await db.insert(categoriesTable).values({ name: cat.name, slug: cat.slug });
        logger.info({ slug: cat.slug }, "Added missing category");
      }
    }
  } catch (err) {
    logger.error({ err }, "ensureCategories failed");
  }
}

// ─── Set parent_id for subcategories ─────────────────────────────────────────
// "Tin Việt Nam" and "Tin thế giới" are children of "Tin tức"
const SUBCATEGORY_MAP: { childSlug: string; parentSlug: string }[] = [
  { childSlug: "tin-viet-nam", parentSlug: "tin-tuc" },
  { childSlug: "tin-the-gioi", parentSlug: "tin-tuc" },
];

export async function ensureCategoryHierarchy(): Promise<void> {
  try {
    for (const { childSlug, parentSlug } of SUBCATEGORY_MAP) {
      const [parent] = await db.select({ id: categoriesTable.id }).from(categoriesTable).where(sql`slug = ${parentSlug}`).limit(1);
      const [child]  = await db.select({ id: categoriesTable.id, parentId: categoriesTable.parentId }).from(categoriesTable).where(sql`slug = ${childSlug}`).limit(1);
      if (parent && child && child.parentId !== parent.id) {
        await db.execute(sql`UPDATE categories SET parent_id = ${parent.id} WHERE id = ${child.id}`);
        logger.info({ childSlug, parentSlug }, "Set category parent");
      }
    }
  } catch (err) {
    logger.error({ err }, "ensureCategoryHierarchy failed");
  }
}

// ─── New feeds to ensure exist on every startup ───────────────────────────────
const ENSURE_FEEDS = [
  // Slovakia
  { name: "SME.sk", url: "https://www.sme.sk/rss-title.asp", countryId: 2, categoryId: 1 },
  { name: "Aktuality.sk", url: "https://www.aktuality.sk/rss/", countryId: 2, categoryId: 1 },
  // Ba Lan
  { name: "TVN24", url: "https://tvn24.pl/najnowsze.xml", countryId: 3, categoryId: 1 },
  { name: "Polskie Radio 24", url: "https://www.polskieradio.pl/rss/4.xml", countryId: 3, categoryId: 1 },
  // Đức
  { name: "Tagesschau", url: "https://www.tagesschau.de/xml/rss2/", countryId: 4, categoryId: 1 },
  { name: "Spiegel Online", url: "https://www.spiegel.de/schlagzeilen/tops/index.rss", countryId: 4, categoryId: 1 },
];

export async function ensureFeeds(): Promise<void> {
  try {
    for (const feed of ENSURE_FEEDS) {
      const existing = await db
        .select({ id: rssFeedsTable.id })
        .from(rssFeedsTable)
        .where(sql`url = ${feed.url}`)
        .limit(1);

      if (existing.length === 0) {
        await db.insert(rssFeedsTable).values({
          name: feed.name,
          url: feed.url,
          countryId: feed.countryId,
          categoryId: feed.categoryId,
          active: true,
          itemsImported: 0,
        });
        logger.info({ name: feed.name }, "Added new RSS feed");
      }
    }
  } catch (err) {
    logger.error({ err }, "ensureFeeds failed");
  }
}

export async function seedIfEmpty(): Promise<void> {
  try {
    const [{ count }] = await db
      .select({ count: sql<string>`count(*)` })
      .from(articlesTable);

    if (Number(count) >= 300) {
      logger.info({ count }, "DB already seeded — skipping");
      return;
    }

    logger.info({ count }, "DB needs seeding — starting…");

    const seed = rawSeed as {
      categories: Row[];
      countries: Row[];
      authors: Row[];
      rssFeeds: Row[];
      events: Row[];
      articles: Row[];
    };

    const { categories, countries, authors, rssFeeds, events, articles } = seed;

    // --- Categories ---
    // Insert what we can; slug conflicts will be skipped by onConflictDoNothing.
    // Then build a remap: devCategoryId → prodCategoryId (matched by slug).
    if (categories.length) {
      await db
        .insert(categoriesTable)
        .values(categories.map(mapCategory))
        .onConflictDoNothing();
      const maxId = Math.max(...categories.map((c) => c.id));
      await db.execute(sql`SELECT setval(pg_get_serial_sequence('categories','id'), GREATEST(${maxId}, (SELECT MAX(id) FROM categories)))`);
      logger.info({ n: categories.length }, "Attempted category upsert");
    }

    // Build slug→id map from what's actually in prod now
    const prodCats = await db.select({ id: categoriesTable.id, slug: categoriesTable.slug }).from(categoriesTable);
    const slugToId = new Map(prodCats.map((c) => [c.slug, c.id]));

    // Build dev_id → prod_id remap
    const catRemap = new Map<number, number>();
    for (const devCat of categories) {
      const prodId = slugToId.get(devCat.slug);
      if (prodId != null && prodId !== devCat.id) {
        catRemap.set(devCat.id, prodId);
        logger.info({ devId: devCat.id, prodId, slug: devCat.slug }, "Category ID remapped");
      }
    }

    // --- Countries ---
    if (countries.length) {
      await db
        .insert(countriesTable)
        .values(countries.map(mapCountry))
        .onConflictDoNothing();
      const maxId = Math.max(...countries.map((c) => c.id));
      await db.execute(sql`SELECT setval(pg_get_serial_sequence('countries','id'), GREATEST(${maxId}, (SELECT MAX(id) FROM countries)))`);
      logger.info({ n: countries.length }, "Upserted countries");
    }

    // --- Authors ---
    if (authors.length) {
      await db
        .insert(authorsTable)
        .values(authors.map(mapAuthor))
        .onConflictDoNothing();
      const maxId = Math.max(...authors.map((a) => a.id));
      await db.execute(sql`SELECT setval(pg_get_serial_sequence('authors','id'), GREATEST(${maxId}, (SELECT MAX(id) FROM authors)))`);
      logger.info({ n: authors.length }, "Upserted authors");
    }

    // --- Articles in batches of 30 (with category remap) ---
    if (articles.length) {
      const BATCH = 30;
      let inserted = 0;
      for (let i = 0; i < articles.length; i += BATCH) {
        try {
          const batch = articles.slice(i, i + BATCH).map((r) => mapArticle(r, catRemap));
          await db.insert(articlesTable).values(batch).onConflictDoNothing();
          inserted += batch.length;
        } catch (batchErr) {
          logger.warn({ batchErr, batchStart: i }, "Batch failed — skipping");
        }
      }
      const maxId = Math.max(...articles.map((a) => a.id));
      await db.execute(sql`SELECT setval(pg_get_serial_sequence('articles','id'), GREATEST(${maxId}, (SELECT MAX(id) FROM articles)))`);
      logger.info({ n: inserted }, "Upserted articles");
    }

    // --- RSS Feeds (with category remap) ---
    if (rssFeeds.length) {
      await db
        .insert(rssFeedsTable)
        .values(rssFeeds.map((r) => mapFeed(r, catRemap)))
        .onConflictDoNothing();
      const maxId = Math.max(...rssFeeds.map((r) => r.id));
      await db.execute(sql`SELECT setval(pg_get_serial_sequence('rss_feeds','id'), GREATEST(${maxId}, (SELECT MAX(id) FROM rss_feeds)))`);
      logger.info({ n: rssFeeds.length }, "Upserted rss_feeds");
    }

    // --- Events ---
    if (events.length) {
      await db
        .insert(eventsTable)
        .values(events.map(mapEvent))
        .onConflictDoNothing();
      const maxId = Math.max(...events.map((e) => e.id));
      await db.execute(sql`SELECT setval(pg_get_serial_sequence('events','id'), GREATEST(${maxId}, (SELECT MAX(id) FROM events)))`);
      logger.info({ n: events.length }, "Upserted events");
    }

    logger.info("Seeding complete ✓");
  } catch (err) {
    logger.error({ err }, "Seeding failed");
  }
}
