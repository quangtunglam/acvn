import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const authorsTable = pgTable("authors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  bio: text("bio"),
  avatar: text("avatar"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const countriesTable = pgTable("countries", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  code: text("code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const articlesTable = pgTable(
  "articles",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    summary: text("summary").notNull().default(""),
    content: text("content").notNull().default(""),
    coverImage: text("cover_image"),
    categoryId: integer("category_id").references(() => categoriesTable.id),
    countryId: integer("country_id").references(() => countriesTable.id),
    authorId: integer("author_id").references(() => authorsTable.id),
    editor: text("editor"),
    sourceName: text("source_name"),
    sourceUrl: text("source_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    status: text("status").notNull().default("draft"),
    featured: boolean("featured").notNull().default(false),
    breakingNews: boolean("breaking_news").notNull().default(false),
    views: integer("views").notNull().default(0),
    mostReadRank: integer("most_read_rank"),
    tags: text("tags").array().notNull().default([]),
  },
  (table) => ({
    slugIndex: uniqueIndex("articles_slug_idx").on(table.slug),
  }),
);

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  location: text("location"),
  image: text("image"),
  registrationUrl: text("registration_url"),
  eventType: text("event_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const newsletterSubscribersTable = pgTable(
  "newsletter_subscribers",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    subscribedAt: timestamp("subscribed_at", { withTimezone: true }).notNull().defaultNow(),
    active: boolean("active").notNull().default(true),
  },
  (table) => ({
    emailIndex: uniqueIndex("newsletter_subscribers_email_idx").on(table.email),
  }),
);

export const adBannersTable = pgTable("ad_banners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  image: text("image"),
  targetUrl: text("target_url"),
  position: text("position").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const rssFeedsTable = pgTable("rss_feeds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull().unique(),
  categoryId: integer("category_id").references(() => categoriesTable.id).notNull(),
  countryId: integer("country_id").references(() => countriesTable.id),
  active: boolean("active").notNull().default(true),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  itemsImported: integer("items_imported").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAuthorSchema = createInsertSchema(authorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCategorySchema = createInsertSchema(categoriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCountrySchema = createInsertSchema(countriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertArticleSchema = createInsertSchema(articlesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertNewsletterSubscriberSchema = createInsertSchema(newsletterSubscribersTable).omit({ id: true });
export const insertAdBannerSchema = createInsertSchema(adBannersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRssFeedSchema = createInsertSchema(rssFeedsTable).omit({ id: true, createdAt: true, updatedAt: true, lastFetchedAt: true, itemsImported: true });

export type Author = typeof authorsTable.$inferSelect;
export type InsertAuthor = z.infer<typeof insertAuthorSchema>;
export type Category = typeof categoriesTable.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Country = typeof countriesTable.$inferSelect;
export type InsertCountry = z.infer<typeof insertCountrySchema>;
export type Article = typeof articlesTable.$inferSelect;
export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type Event = typeof eventsTable.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type NewsletterSubscriber = typeof newsletterSubscribersTable.$inferSelect;
export type InsertNewsletterSubscriber = z.infer<typeof insertNewsletterSubscriberSchema>;
export type AdBanner = typeof adBannersTable.$inferSelect;
export type InsertAdBanner = z.infer<typeof insertAdBannerSchema>;
export type RssFeed = typeof rssFeedsTable.$inferSelect;
export type InsertRssFeed = z.infer<typeof insertRssFeedSchema>;