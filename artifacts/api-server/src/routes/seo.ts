import { desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { articlesTable, categoriesTable, countriesTable, db } from "@workspace/db";

const router: IRouter = Router();

const BASE_URL = "https://acvn.replit.app";
const DEV_DOMAIN = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : BASE_URL;

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

router.get("/sitemap.xml", async (_req, res): Promise<void> => {
  const [articles, categories, countries] = await Promise.all([
    db
      .select({
        slug: articlesTable.slug,
        publishedAt: articlesTable.publishedAt,
        updatedAt: articlesTable.updatedAt,
      })
      .from(articlesTable)
      .where(eq(articlesTable.status, "published"))
      .orderBy(desc(articlesTable.publishedAt))
      .limit(1000),
    db.select({ slug: categoriesTable.slug }).from(categoriesTable),
    db.select({ slug: countriesTable.slug }).from(countriesTable),
  ]);

  const domain = process.env.NODE_ENV === "production" ? BASE_URL : DEV_DOMAIN;

  const staticUrls = [
    { loc: domain, priority: "1.0", changefreq: "daily" },
    { loc: `${domain}/tim-kiem`, priority: "0.5", changefreq: "monthly" },
    { loc: `${domain}/admin`, priority: "0.1", changefreq: "monthly" },
  ];

  const articleUrls = articles.map((a) => ({
    loc: `${domain}/bai-viet/${a.slug}`,
    lastmod: (a.updatedAt ?? a.publishedAt)?.toISOString().split("T")[0] ?? "",
    priority: "0.8",
    changefreq: "weekly",
  }));

  const categoryUrls = categories.map((c) => ({
    loc: `${domain}/danh-muc/${c.slug}`,
    priority: "0.7",
    changefreq: "daily",
  }));

  const countryUrls = countries.map((c) => ({
    loc: `${domain}/khu-vuc/${c.slug}`,
    priority: "0.7",
    changefreq: "daily",
  }));

  const allUrls = [...staticUrls, ...articleUrls, ...categoryUrls, ...countryUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (u) => `  <url>
    <loc>${xmlEscape(u.loc)}</loc>${
      "lastmod" in u && u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""
    }
    <changefreq>${"changefreq" in u ? u.changefreq : "monthly"}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(xml);
});

router.get("/robots.txt", (_req, res): void => {
  const domain = process.env.NODE_ENV === "production" ? BASE_URL : DEV_DOMAIN;
  res.setHeader("Content-Type", "text/plain");
  res.send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: ${domain}/api/sitemap.xml
`);
});

export default router;
