import {
  db,
  articlesTable,
  categoriesTable,
  countriesTable,
  authorsTable,
  eventsTable,
} from "../lib/db/src/index.js";
import { eq, desc, asc } from "drizzle-orm";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Token");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

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

    res.status(200).json({
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
}
