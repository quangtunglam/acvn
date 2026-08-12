/**
 * One-time production seeder.
 * Runs on startup if the articles table is empty.
 * Safe to leave in: checks count first and skips if data already exists.
 */
import { sql } from "drizzle-orm";
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

// ─── Map snake_case DB rows → camelCase Drizzle insert objects ────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function mapArticle(r: Row) {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    summary: r.summary ?? null,
    content: r.content ?? null,
    coverImage: r.cover_image ?? null,
    categoryId: r.category_id ?? null,
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

function mapFeed(r: Row) {
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    categoryId: r.category_id ?? null,
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

// ─── Seeder ───────────────────────────────────────────────────────────────────

export async function seedIfEmpty(): Promise<void> {
  try {
    const [{ count }] = await db
      .select({ count: sql<string>`count(*)` })
      .from(articlesTable);

    if (Number(count) > 0) {
      logger.info({ count }, "DB already has data — skipping seed");
      return;
    }

    logger.info("DB is empty — seeding production data…");

    const seed = rawSeed as {
      categories: Row[];
      countries: Row[];
      authors: Row[];
      rssFeeds: Row[];
      events: Row[];
      articles: Row[];
    };

    const { categories, countries, authors, rssFeeds, events, articles } = seed;

    if (categories.length) {
      await db.insert(categoriesTable).values(categories.map(mapCategory));
      const maxId = Math.max(...categories.map((c) => c.id));
      await db.execute(sql`SELECT setval(pg_get_serial_sequence('categories','id'), ${maxId})`);
      logger.info({ n: categories.length }, "Seeded categories");
    }

    if (countries.length) {
      await db.insert(countriesTable).values(countries.map(mapCountry));
      const maxId = Math.max(...countries.map((c) => c.id));
      await db.execute(sql`SELECT setval(pg_get_serial_sequence('countries','id'), ${maxId})`);
      logger.info({ n: countries.length }, "Seeded countries");
    }

    if (authors.length) {
      await db.insert(authorsTable).values(authors.map(mapAuthor));
      const maxId = Math.max(...authors.map((a) => a.id));
      await db.execute(sql`SELECT setval(pg_get_serial_sequence('authors','id'), ${maxId})`);
      logger.info({ n: authors.length }, "Seeded authors");
    }

    if (articles.length) {
      const BATCH = 30;
      for (let i = 0; i < articles.length; i += BATCH) {
        await db
          .insert(articlesTable)
          .values(articles.slice(i, i + BATCH).map(mapArticle));
      }
      const maxId = Math.max(...articles.map((a) => a.id));
      await db.execute(sql`SELECT setval(pg_get_serial_sequence('articles','id'), ${maxId})`);
      logger.info({ n: articles.length }, "Seeded articles");
    }

    if (rssFeeds.length) {
      await db.insert(rssFeedsTable).values(rssFeeds.map(mapFeed));
      const maxId = Math.max(...rssFeeds.map((r) => r.id));
      await db.execute(sql`SELECT setval(pg_get_serial_sequence('rss_feeds','id'), ${maxId})`);
      logger.info({ n: rssFeeds.length }, "Seeded rss_feeds");
    }

    if (events.length) {
      await db.insert(eventsTable).values(events.map(mapEvent));
      const maxId = Math.max(...events.map((e) => e.id));
      await db.execute(sql`SELECT setval(pg_get_serial_sequence('events','id'), ${maxId})`);
      logger.info({ n: events.length }, "Seeded events");
    }

    logger.info("Seeding complete ✓");
  } catch (err) {
    logger.error({ err }, "Seeding failed");
  }
}
