/**
 * One-time production seeder.
 * Runs on startup if the articles table is empty.
 * Safe to leave in: it checks count first and skips if data already exists.
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
import seedData from "./seed-data.json" with { type: "json" };

type SeedData = typeof seedData;

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

    const { categories, countries, authors, rssFeeds, events, articles } =
      seedData as SeedData;

    // Insert in FK order
    if (categories.length) {
      await db.insert(categoriesTable).values(categories as never[]);
      // Reset sequence
      const maxId = Math.max(...categories.map((c: { id: number }) => c.id));
      await db.execute(
        sql`SELECT setval(pg_get_serial_sequence('categories','id'), ${maxId})`
      );
      logger.info({ n: categories.length }, "Seeded categories");
    }

    if (countries.length) {
      await db.insert(countriesTable).values(countries as never[]);
      const maxId = Math.max(...countries.map((c: { id: number }) => c.id));
      await db.execute(
        sql`SELECT setval(pg_get_serial_sequence('countries','id'), ${maxId})`
      );
      logger.info({ n: countries.length }, "Seeded countries");
    }

    if (authors.length) {
      await db.insert(authorsTable).values(authors as never[]);
      const maxId = Math.max(...authors.map((a: { id: number }) => a.id));
      await db.execute(
        sql`SELECT setval(pg_get_serial_sequence('authors','id'), ${maxId})`
      );
      logger.info({ n: authors.length }, "Seeded authors");
    }

    if (articles.length) {
      // Insert in batches of 50 to avoid query size limits
      const BATCH = 50;
      for (let i = 0; i < articles.length; i += BATCH) {
        await db.insert(articlesTable).values(articles.slice(i, i + BATCH) as never[]);
      }
      const maxId = Math.max(...articles.map((a: { id: number }) => a.id));
      await db.execute(
        sql`SELECT setval(pg_get_serial_sequence('articles','id'), ${maxId})`
      );
      logger.info({ n: articles.length }, "Seeded articles");
    }

    if (rssFeeds.length) {
      await db.insert(rssFeedsTable).values(rssFeeds as never[]);
      const maxId = Math.max(...rssFeeds.map((r: { id: number }) => r.id));
      await db.execute(
        sql`SELECT setval(pg_get_serial_sequence('rss_feeds','id'), ${maxId})`
      );
      logger.info({ n: rssFeeds.length }, "Seeded rss_feeds");
    }

    if (events.length) {
      await db.insert(eventsTable).values(events as never[]);
      const maxId = Math.max(...events.map((e: { id: number }) => e.id));
      await db.execute(
        sql`SELECT setval(pg_get_serial_sequence('events','id'), ${maxId})`
      );
      logger.info({ n: events.length }, "Seeded events");
    }

    logger.info("Seeding complete ✓");
  } catch (err) {
    logger.error({ err }, "Seeding failed — continuing without seed data");
  }
}
