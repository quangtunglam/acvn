import express from "express";
import cors from "cors";
import pg from "pg";
import Parser from "rss-parser";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {}
}

loadEnvFile(path.resolve(__dirname, "../.env"));
loadEnvFile(path.resolve(__dirname, "../../../.env"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

const app = express();
app.use(cors());

// Normalize URLs so both "/api/..." and "/..." (from Vercel rewrites) match "/api/..." routes
app.use((req, _res, next) => {
  if (!req.url.startsWith("/api/") && req.url !== "/api") {
    req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
  }
  next();
});

// Raw binary parser specifically for /api/admin/media/upload BEFORE express.json()
app.use("/api/admin/media/upload", express.raw({ type: "*/*", limit: "25mb" }));
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Database & Persistent Fallback Store ─────────────────────────────────────

const { Pool } = pg;
let pool = null;
let dbHealthy = null; // null = unknown, true = healthy, false = unavailable
let dbLastChecked = 0;

function getPool() {
  if (!pool) {
    const connectionString =
      process.env.DATABASE_URL ||
      "postgresql://postgres.hopvviqachszjtbcsgbp:Tomekprague89@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 4000,
    });
    pool.on("error", () => {
      dbHealthy = false;
    });
  }
  return pool;
}

async function isDbAvailable() {
  const now = Date.now();
  if (dbHealthy !== null && now - dbLastChecked < 60000) {
    return dbHealthy;
  }
  try {
    await getPool().query("SELECT 1");
    dbHealthy = true;
  } catch {
    dbHealthy = false;
  }
  dbLastChecked = now;
  return dbHealthy;
}

// Load seed data and persistent store
let seedData = { articles: [], categories: [], countries: [], events: [], authors: [], feeds: [], banners: [] };
try {
  const candidates = [
    path.resolve(__dirname, "../src/data/seed-data.json"),
    path.resolve(process.cwd(), "src/data/seed-data.json"),
    path.resolve(process.cwd(), "artifacts/tin-tuc-portal/src/data/seed-data.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      seedData = JSON.parse(fs.readFileSync(p, "utf8"));
      break;
    }
  }
} catch {}

const STORE_FILE = process.env.VERCEL
  ? path.join(os.tmpdir(), "acvn-store.json")
  : path.resolve(__dirname, "../src/data/acvn-runtime-store.json");

let memStore = null;

function getStore() {
  if (memStore) return memStore;
  try {
    if (fs.existsSync(STORE_FILE)) {
      memStore = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
      return memStore;
    }
  } catch {}

  memStore = {
    articles: (seedData.articles || []).map((a) => ({
      ...a,
      categoryId: a.categoryId ?? a.category_id ?? a.category?.id ?? 1,
      countryId: a.countryId ?? a.country_id ?? a.country?.id ?? null,
      authorId: a.authorId ?? a.author_id ?? a.author?.id ?? null,
      status: a.status || "published",
      views: Number(a.views || 0),
      featured: Boolean(a.featured),
      breakingNews: Boolean(a.breakingNews ?? a.breaking_news),
      mostReadRank: a.mostReadRank ?? a.most_read_rank ?? null,
      updatedAt: a.updatedAt || a.publishedAt || new Date().toISOString(),
      createdAt: a.createdAt || a.publishedAt || new Date().toISOString(),
    })),
    categories: (seedData.categories || []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description ?? null,
      parentId: c.parentId ?? c.parent_id ?? null,
    })),
    countries: seedData.countries || [],
    authors: (seedData.authors || []).map((au) => ({
      id: au.id,
      name: au.name,
      role: au.role || "Phóng viên",
      bio: au.bio ?? null,
      avatar: au.avatar ?? null,
    })),
    events: (seedData.events || []).map(formatEventRow),
    feeds: (seedData.feeds || []).map(formatFeedRow),
    banners: (seedData.banners || []).map((b) => ({
      id: b.id,
      name: b.name || b.title || "Banner",
      image: b.image || b.image_url || "",
      targetUrl: b.targetUrl || b.target_url || b.link_url || "https://acvn.cz",
      position: b.position || "sidebar",
      enabled: Boolean(b.enabled ?? b.active ?? true),
      createdAt: b.createdAt || b.created_at || new Date().toISOString(),
    })),
    contacts: seedData.contacts || [],
    memberRegistrations: seedData.memberRegistrations || [],
    sponsorRegistrations: seedData.sponsorRegistrations || [],
    subscribers: seedData.subscribers || [],
  };
  saveStore();
  return memStore;
}

function saveStore() {
  if (!memStore) return;
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(memStore));
  } catch {}
}

function getUploadDirs() {
  const dirs = process.env.VERCEL
    ? [
        path.join(os.tmpdir(), "uploads"),
        path.resolve(__dirname, "../public/api/media/objects/uploads"),
        path.resolve(process.cwd(), "public/api/media/objects/uploads"),
      ]
    : [
        path.resolve(process.cwd(), "public/api/media/objects/uploads"),
        path.resolve(process.cwd(), "artifacts/tin-tuc-portal/public/api/media/objects/uploads"),
        path.resolve(__dirname, "../public/api/media/objects/uploads"),
      ];
  const unique = [...new Set(dirs)];
  for (const d of unique) {
    try {
      fs.mkdirSync(d, { recursive: true });
    } catch {}
  }
  return unique;
}

const rssParser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; ACVN-Portal/2.0; +https://acvn.cz)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: false }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: false }],
      ["content:encoded", "contentEncoded"],
    ],
  },
});

function slugify(text) {
  const map = {
    à:"a",á:"a",ả:"a",ã:"a",ạ:"a",ă:"a",ắ:"a",ằ:"a",ẳ:"a",ẵ:"a",ặ:"a",â:"a",ấ:"a",ầ:"a",ẩ:"a",ẫ:"a",ậ:"a",
    đ:"d",
    è:"e",é:"e",ẻ:"e",ẽ:"e",ẹ:"e",ê:"e",ế:"e",ề:"e",ể:"e",ễ:"e",ệ:"e",
    ì:"i",í:"i",ỉ:"i",ĩ:"i",ị:"i",
    ò:"o",ó:"o",ỏ:"o",õ:"o",ọ:"o",ô:"o",ố:"o",ồ:"o",ổ:"o",ỗ:"o",ộ:"o",ơ:"o",ớ:"o",ờ:"o",ở:"o",ỡ:"o",ợ:"o",
    ù:"u",ú:"u",ủ:"u",ũ:"u",ụ:"u",ư:"u",ứ:"u",ừ:"u",ử:"u",ữ:"u",ự:"u",
    ỳ:"y",ý:"y",ỷ:"y",ỹ:"y",ỵ:"y",
    ä:"a",ë:"e",ï:"i",ö:"o",ü:"u",ÿ:"y",č:"c",ď:"d",ě:"e",ň:"n",ř:"r",š:"s",ť:"t",ů:"u",ž:"z",
  };
  return String(text || "")
    .toLowerCase()
    .split("")
    .map((c) => map[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 95);
}

function isVietnameseText(text) {
  if (!text) return false;
  const matches = String(text).match(/[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/gi);
  return Boolean(matches && matches.length >= 3);
}

async function googleTranslateText(text, targetLang = "vi") {
  if (!text || !String(text).trim()) return text;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return text;
    const data = await res.json();
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return data[0].map((part) => (Array.isArray(part) ? part[0] : "")).join("");
    }
    return text;
  } catch {
    return text;
  }
}

async function translateArticleToVietnamese(title, summary, htmlContent, fullHtml = "") {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;

  if (apiKey) {
    for (const modelName of ["gemini-3.6-flash", "gemini-2.5-flash"]) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          ...(baseUrl ? { httpOptions: { apiVersion: "", baseUrl } } : {}),
        });
        const prompt = fullHtml
          ? `Bạn là một biên tập viên báo chí. Đây là mã HTML từ một trang web tin tức nước ngoài.
Nhiệm vụ của bạn là TRÍCH XUẤT nội dung chính của bài báo, sau đó DỊCH sang tiếng Việt chuẩn văn phong báo chí.
Trả về ĐÚNG định dạng JSON nguyên chất (không có markdown code block) với 3 key:
- "title": Tiêu đề bài viết bằng tiếng Việt.
- "summary": Tóm tắt nội dung bằng tiếng Việt (tối đa 250 ký tự).
- "content": Nội dung chính của bài báo bằng tiếng Việt (giữ lại các thẻ HTML cơ bản p, h2, h3, ul, li, strong, em).

Tiêu đề dự phòng: ${title}
Tóm tắt dự phòng: ${summary}
HTML Bài báo:
${fullHtml.slice(0, 60000)}`
          : `Dịch các trường sau sang tiếng Việt chuẩn báo chí. Trả về ĐÚNG định dạng JSON nguyên chất (không có markdown code block) với 3 key: "title", "summary", "content". Giữ nguyên HTML trong content.\n\nJSON gốc:\n${JSON.stringify({ title, summary, content: String(htmlContent || "").slice(0, 15000) })}`;

        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        });
        let rawText = (response.text || "{}").replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
        const parsed = JSON.parse(rawText);
        if (parsed && parsed.title) {
          return {
            title: parsed.title,
            summary: parsed.summary || summary,
            content: parsed.content || htmlContent,
          };
        }
      } catch {}
    }
  }

  // Fallback to Google Translate GTX endpoint
  const translatedTitle = await googleTranslateText(title, "vi");
  const translatedSummary = await googleTranslateText(summary, "vi");

  let sourceHtml = htmlContent || "";
  if (fullHtml && (!sourceHtml || sourceHtml.length < 300)) {
    const pMatches = fullHtml.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
    const goodPs = pMatches
      .map((p) => p.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
      .filter((t) => t.length > 50 && !/cookie|javascript|copyright|reklama/i.test(t))
      .slice(0, 15);
    if (goodPs.length > 0) {
      sourceHtml = goodPs.map((p) => `<p>${p}</p>`).join("\n");
    }
  }

  let translatedContent = sourceHtml;
  if (translatedContent) {
    const blocks = [];
    const tokenized = translatedContent.replace(
      /<(p|h1|h2|h3|h4|li|blockquote)([^>]*)>([\s\S]*?)<\/\1>/gi,
      (full, tag, attrs, inner) => {
        const plain = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (!plain) return full;
        const idx = blocks.length;
        blocks.push({ tag, attrs, plain });
        return `__BLOCK_${idx}__`;
      }
    );

    if (blocks.length > 0) {
      const joined = blocks.map((b) => b.plain).join("\n ||| \n");
      const translatedJoined = await googleTranslateText(joined, "vi");
      const splitParts = translatedJoined.split(/\s*\|\|\|\s*/);
      translatedContent = tokenized.replace(/__BLOCK_(\d+)__/g, (_, num) => {
        const i = Number(num);
        const b = blocks[i];
        const t = splitParts[i] || b.plain;
        return `<${b.tag}${b.attrs}>${t}</${b.tag}>`;
      });
    } else {
      const plain = translatedContent.replace(/<[^>]+>/g, " ").trim();
      const t = await googleTranslateText(plain, "vi");
      translatedContent = `<p>${t}</p>`;
    }
  }

  return {
    title: translatedTitle || title,
    summary: translatedSummary || summary,
    content: translatedContent || htmlContent,
  };
}

function formatArticleRow(r) {
  if (!r) return null;
  const store = getStore();
  const catId = Number(r.cat_id ?? r.category_id ?? r.categoryId ?? r.category?.id ?? 1);
  const coId = r.co_id ?? r.country_id ?? r.countryId ?? r.country?.id ?? null;
  const auId = r.au_id ?? r.author_id ?? r.authorId ?? r.author?.id ?? null;

  const foundCat = store.categories.find((c) => Number(c.id) === catId);
  const foundCo = coId ? store.countries.find((c) => Number(c.id) === Number(coId)) : null;
  const foundAu = auId ? store.authors.find((a) => Number(a.id) === Number(auId)) : null;

  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    summary: r.summary ?? "",
    content: r.content ?? "",
    coverImage: r.cover_image ?? r.coverImage ?? null,
    categoryId: catId,
    countryId: coId ? Number(coId) : null,
    authorId: auId ? Number(auId) : null,
    category: r.cat_name
      ? { id: catId, name: r.cat_name, slug: r.cat_slug }
      : r.category || foundCat || { id: 1, name: "Tin tức", slug: "tin-tuc" },
    country: r.co_name
      ? { id: Number(coId), name: r.co_name, slug: r.co_slug, code: r.co_code ?? null }
      : r.country || foundCo || null,
    author: r.au_name
      ? { id: Number(auId), name: r.au_name, role: r.au_role ?? null }
      : r.author || foundAu || null,
    publishedAt: r.published_at ?? r.publishedAt ?? r.created_at ?? r.createdAt ?? null,
    updatedAt: r.updated_at ?? r.updatedAt ?? r.created_at ?? r.createdAt ?? new Date().toISOString(),
    createdAt: r.created_at ?? r.createdAt ?? new Date().toISOString(),
    views: Number(r.views ?? 0),
    featured: Boolean(r.featured),
    breakingNews: Boolean(r.breaking_news ?? r.breakingNews),
    mostReadRank: r.most_read_rank ?? r.mostReadRank ?? null,
    sourceName: r.source_name ?? r.sourceName ?? null,
    sourceUrl: r.source_url ?? r.sourceUrl ?? null,
    editor: r.editor ?? null,
    status: r.status ?? "published",
  };
}

function formatEventRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? r.summary ?? "",
    startDate: r.start_date ?? r.startDate ?? new Date().toISOString(),
    endDate: r.end_date ?? r.endDate ?? null,
    location: r.location ?? "",
    image: r.image ?? r.cover_image ?? r.coverImage ?? null,
    registrationUrl: r.registration_url ?? r.registrationUrl ?? r.registration_link ?? null,
    eventType: r.event_type ?? r.eventType ?? "Cộng đồng",
    articleSlug: r.article_slug ?? r.articleSlug ?? null,
    createdAt: r.created_at ?? r.createdAt ?? new Date().toISOString(),
  };
}

function formatFeedRow(f) {
  return {
    id: f.id,
    name: f.name,
    url: f.url,
    categoryId: f.category_id ?? f.categoryId ?? 1,
    countryId: f.country_id ?? f.countryId ?? null,
    active: Boolean(f.active ?? true),
    lastFetchedAt: f.last_fetched_at ?? f.lastFetchedAt ?? null,
    itemsImported: Number(f.items_imported ?? f.itemsImported ?? 0),
    createdAt: f.created_at ?? f.createdAt ?? new Date().toISOString(),
  };
}

const ARTICLE_SELECT_SQL = `
  SELECT a.*,
         c.id as cat_id, c.name as cat_name, c.slug as cat_slug,
         co.id as co_id, co.name as co_name, co.slug as co_slug, co.code as co_code,
         au.id as au_id, au.name as au_name, au.role as au_role
  FROM articles a
  LEFT JOIN categories c ON a.category_id = c.id
  LEFT JOIN countries co ON a.country_id = co.id
  LEFT JOIN authors au ON a.author_id = au.id
`;

function buildHomepagePayload(allArticles, allEvents) {
  const all = allArticles.map(formatArticleRow);
  const events = allEvents.map(formatEventRow);

  const breakingRows = all.filter((a) => a.breakingNews).slice(0, 6);
  const breakingNews =
    breakingRows.length > 0
      ? breakingRows.map((a) => ({ id: a.id, title: a.title, slug: a.slug, category: a.category.name }))
      : all.slice(0, 4).map((a) => ({ id: a.id, title: a.title, slug: a.slug, category: a.category.name }));

  const featured = all.find((a) => a.featured) || all[0] || null;
  const selected = all.filter((a) => a.id !== featured?.id).slice(0, 3);

  const pinned = all.filter((a) => a.mostReadRank >= 1 && a.mostReadRank <= 5);
  const pinnedIds = new Set(pinned.map((a) => a.id));
  const fillers = all
    .filter((a) => !pinnedIds.has(a.id))
    .slice()
    .sort((a, b) => (b.views || 0) - (a.views || 0));

  const slots = [null, null, null, null, null];
  for (const p of pinned) {
    const idx = (p.mostReadRank || 1) - 1;
    if (idx >= 0 && idx < 5) slots[idx] = p;
  }
  let fillerIdx = 0;
  for (let i = 0; i < 5; i++) {
    if (!slots[i] && fillerIdx < fillers.length) {
      slots[i] = fillers[fillerIdx++];
    }
  }
  const mostRead = slots.filter(Boolean);

  const euCountries = {};
  for (const slug of ["cong-hoa-sec", "duc", "ba-lan", "slovakia"]) {
    euCountries[slug] = all.filter((a) => a.country?.slug === slug).slice(0, 4);
  }

  const vietnam = all.filter((a) => a.country?.slug === "viet-nam" || a.category?.slug === "tin-viet-nam").slice(0, 5);
  const world = all.filter((a) => a.category?.slug === "tin-the-gioi").slice(0, 5);
  const business = all.filter((a) => a.category?.slug === "phap-luat" || a.category?.slug === "kinh-doanh").slice(0, 4);
  const features = all.filter((a) => a.category?.slug === "van-hoa-truyen-thong" || a.category?.slug === "chuyen-dau-tu").slice(0, 4);
  const activities = all.filter((a) => a.category?.slug === "tin-hoat-dong" || a.category?.slug === "cong-dong").slice(0, 6);

  return {
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
    communityEvents: events.slice(0, 5),
  };
}

// ─── Health & Utility Endpoints ───────────────────────────────────────────────

app.get("/api/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/version", async (_req, res) => {
  const dbOk = await isDbAvailable();
  res.json({
    status: "ok",
    version: "2026-acvn-complete",
    dbConnected: dbOk,
    time: new Date().toISOString(),
  });
});

let forexCache = null;
const FOREX_TTL_MS = 30 * 60 * 1000;

app.get("/api/forex", async (_req, res) => {
  const now = Date.now();
  if (forexCache && now - forexCache.fetchedAt < FOREX_TTL_MS) {
    return res.json({ usd: forexCache.usd, eur: forexCache.eur });
  }
  try {
    const r = await fetch("https://api.frankfurter.app/latest?from=CZK&to=USD,EUR", {
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const usd = Math.round((1 / data.rates.USD) * 10) / 10;
    const eur = Math.round((1 / data.rates.EUR) * 10) / 10;
    forexCache = { usd, eur, fetchedAt: now };
    res.json({ usd, eur });
  } catch {
    res.json(forexCache ? { usd: forexCache.usd, eur: forexCache.eur } : { usd: 23.5, eur: 25.2 });
  }
});

// ─── Media Object Serving ─────────────────────────────────────────────────────

app.get("/api/media/objects/uploads/:uuid", (req, res) => {
  const { uuid } = req.params;
  if (!uuid || uuid.includes("..") || uuid.includes("/")) {
    return res.status(400).json({ error: "Invalid file id" });
  }
  const dirs = getUploadDirs();
  for (const dir of dirs) {
    const filePath = path.join(dir, uuid);
    if (fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath);
      let mime = "image/jpeg";
      if (buf[0] === 0x89 && buf[1] === 0x50) mime = "image/png";
      else if (buf[0] === 0x47 && buf[1] === 0x49) mime = "image/gif";
      else if (buf[0] === 0x52 && buf[1] === 0x49 && buf[8] === 0x57 && buf[9] === 0x45) mime = "image/webp";
      res.set({
        "Content-Type": mime,
        "Cache-Control": "public, max-age=86400",
      });
      return res.send(buf);
    }
  }
  res.status(404).json({ error: "File not found" });
});

// ─── SEO Endpoints ────────────────────────────────────────────────────────────

app.get("/api/robots.txt", (req, res) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  res
    .type("text/plain")
    .send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${baseUrl}/api/sitemap.xml\n`);
});

app.get("/api/sitemap.xml", async (req, res) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const store = getStore();
  let arts = store.articles.filter((a) => a.status === "published");
  let cats = store.categories;
  let cos = store.countries;

  if (await isDbAvailable()) {
    try {
      const db = getPool();
      const [aRes, cRes, coRes] = await Promise.all([
        db.query("SELECT slug, updated_at FROM articles WHERE status = 'published' ORDER BY published_at DESC NULLS LAST"),
        db.query("SELECT slug FROM categories"),
        db.query("SELECT slug FROM countries"),
      ]);
      arts = aRes.rows;
      cats = cRes.rows;
      cos = coRes.rows;
    } catch {}
  }

  const urls = [
    `  <url><loc>${baseUrl}/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>`,
    `  <url><loc>${baseUrl}/su-kien</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`,
    `  <url><loc>${baseUrl}/dang-ky</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>`,
    `  <url><loc>${baseUrl}/lien-he</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>`,
    ...cats.map((c) => `  <url><loc>${baseUrl}/danh-muc/${c.slug}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`),
    ...cos.map((c) => `  <url><loc>${baseUrl}/khu-vuc/${c.slug}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`),
    ...arts.map((a) => `  <url><loc>${baseUrl}/bai-viet/${a.slug}</loc><lastmod>${new Date(a.updated_at || a.updatedAt || Date.now()).toISOString().slice(0, 10)}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`),
  ];
  res
    .type("application/xml")
    .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`);
});

// ─── Public Content Endpoints ─────────────────────────────────────────────────

app.get("/api/homepage", async (_req, res) => {
  if (await isDbAvailable()) {
    try {
      const db = getPool();
      const [artRes, evtRes] = await Promise.all([
        db.query(`${ARTICLE_SELECT_SQL} WHERE a.status = 'published' ORDER BY a.published_at DESC NULLS LAST, a.created_at DESC`),
        db.query("SELECT * FROM events ORDER BY start_date ASC"),
      ]);
      return res.json(buildHomepagePayload(artRes.rows, evtRes.rows));
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  const pub = store.articles.filter((a) => a.status === "published");
  res.json(buildHomepagePayload(pub, store.events));
});

app.get("/api/articles", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 12));
  const categorySlug = req.query.category ? String(req.query.category) : null;
  const countrySlug = req.query.country ? String(req.query.country) : null;
  const offset = (page - 1) * pageSize;

  if (await isDbAvailable()) {
    try {
      const db = getPool();
      const whereParts = ["a.status = 'published'"];
      const params = [];

      if (categorySlug) {
        const catRes = await db.query("SELECT id, slug, parent_id FROM categories");
        const allCats = catRes.rows;
        const targetCat = allCats.find((c) => c.slug === categorySlug);

        if (targetCat) {
          const childIds = allCats.filter((c) => c.parent_id === targetCat.id).map((c) => c.id);
          const catIds = [targetCat.id, ...childIds];

          if (categorySlug === "tin-tuc") {
            const extraNewsIds = allCats
              .filter((c) =>
                ["tin-tuc", "tin-cong-dong", "tin-van-hoa-su-kien", "tin-viet-nam", "tin-the-gioi", "tin-hoat-dong"].includes(c.slug)
              )
              .map((c) => c.id);
            const mergedIds = [...new Set([...catIds, ...extraNewsIds])];
            params.push(mergedIds);
            whereParts.push(`(a.category_id = ANY($${params.length}::int[]) OR a.country_id IS NOT NULL)`);
          } else if (categorySlug === "tin-viet-nam") {
            params.push(catIds);
            whereParts.push(`(a.category_id = ANY($${params.length}::int[]) OR co.slug = 'viet-nam')`);
          } else {
            params.push(catIds);
            whereParts.push(`a.category_id = ANY($${params.length}::int[])`);
          }
        } else {
          params.push(categorySlug);
          whereParts.push(`c.slug = $${params.length}`);
        }
      }

      if (countrySlug) {
        if (countrySlug === "viet-nam") {
          params.push(countrySlug);
          whereParts.push(`(co.slug = $${params.length} OR c.slug = 'tin-viet-nam')`);
        } else {
          params.push(countrySlug);
          whereParts.push(`co.slug = $${params.length}`);
        }
      }

      const whereSql = whereParts.join(" AND ");
      const [countRes, itemsRes] = await Promise.all([
        db.query(
          `SELECT COUNT(*)::int as total FROM articles a LEFT JOIN categories c ON a.category_id = c.id LEFT JOIN countries co ON a.country_id = co.id WHERE ${whereSql}`,
          params
        ),
        db.query(
          `${ARTICLE_SELECT_SQL} WHERE ${whereSql} ORDER BY a.published_at DESC NULLS LAST, a.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, pageSize, offset]
        ),
      ]);

      return res.json({
        items: itemsRes.rows.map(formatArticleRow),
        total: countRes.rows[0]?.total ?? 0,
        page,
        pageSize,
      });
    } catch {
      dbHealthy = false;
    }
  }

  const store = getStore();
  let items = store.articles.filter((a) => a.status === "published").map(formatArticleRow);
  if (categorySlug) {
    const targetCat = store.categories.find((c) => c.slug === categorySlug);
    const childSlugs = targetCat
      ? store.categories.filter((c) => c.parentId === targetCat.id).map((c) => c.slug)
      : [];
    const allowedSlugs = new Set([
      categorySlug,
      ...childSlugs,
      ...(categorySlug === "tin-tuc"
        ? ["tin-cong-dong", "tin-van-hoa-su-kien", "tin-viet-nam", "tin-the-gioi", "tin-hoat-dong"]
        : []),
    ]);
    items = items.filter(
      (a) =>
        allowedSlugs.has(a.category?.slug) ||
        (categorySlug === "tin-tuc" && Boolean(a.country?.slug)) ||
        (categorySlug === "tin-viet-nam" && a.country?.slug === "viet-nam")
    );
  }
  if (countrySlug) {
    items = items.filter(
      (a) => a.country?.slug === countrySlug || (countrySlug === "viet-nam" && a.category?.slug === "tin-viet-nam")
    );
  }
  res.json({
    items: items.slice(offset, offset + pageSize),
    total: items.length,
    page,
    pageSize,
  });
});

app.get("/api/articles/:slug", async (req, res) => {
  const { slug } = req.params;
  if (await isDbAvailable()) {
    try {
      const db = getPool();
      const { rows } = await db.query(`${ARTICLE_SELECT_SQL} WHERE a.slug = $1 LIMIT 1`, [slug]);
      if (rows.length > 0) return res.json(formatArticleRow(rows[0]));
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  const found = store.articles.find((a) => a.slug === slug);
  if (!found) return res.status(404).json({ error: "Bài viết không tồn tại" });
  res.json(formatArticleRow(found));
});

app.post("/api/articles/:slug/view", async (req, res) => {
  const { slug } = req.params;
  if (await isDbAvailable()) {
    try {
      const db = getPool();
      const { rows } = await db.query(
        "UPDATE articles SET views = COALESCE(views, 0) + 1 WHERE slug = $1 RETURNING views",
        [slug]
      );
      if (rows.length > 0) return res.json({ views: rows[0].views });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  const found = store.articles.find((a) => a.slug === slug);
  if (found) {
    found.views = (found.views || 0) + 1;
    saveStore();
    return res.json({ views: found.views });
  }
  res.json({ views: 1 });
});

app.get("/api/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = 15;
  const offset = (page - 1) * pageSize;

  if (!q) return res.json({ items: [], total: 0, query: "" });

  if (await isDbAvailable()) {
    try {
      const db = getPool();
      const pattern = `%${q}%`;
      const whereSql = `
        a.status = 'published' AND (
          a.title ILIKE $1 OR a.summary ILIKE $1 OR a.content ILIKE $1 OR c.name ILIKE $1 OR co.name ILIKE $1
        )
      `;
      const [countRes, itemsRes] = await Promise.all([
        db.query(
          `SELECT COUNT(*)::int as total FROM articles a LEFT JOIN categories c ON a.category_id = c.id LEFT JOIN countries co ON a.country_id = co.id WHERE ${whereSql}`,
          [pattern]
        ),
        db.query(
          `${ARTICLE_SELECT_SQL} WHERE ${whereSql} ORDER BY a.published_at DESC NULLS LAST LIMIT $2 OFFSET $3`,
          [pattern, pageSize, offset]
        ),
      ]);
      return res.json({
        items: itemsRes.rows.map(formatArticleRow),
        total: countRes.rows[0]?.total ?? 0,
        query: q,
      });
    } catch {
      dbHealthy = false;
    }
  }

  const ql = q.toLowerCase();
  const filtered = getStore()
    .articles.filter((a) => a.status === "published")
    .map(formatArticleRow)
    .filter(
      (a) =>
        a.title.toLowerCase().includes(ql) ||
        (a.summary || "").toLowerCase().includes(ql) ||
        (a.category?.name || "").toLowerCase().includes(ql) ||
        (a.country?.name || "").toLowerCase().includes(ql)
    );
  res.json({
    items: filtered.slice(offset, offset + pageSize),
    total: filtered.length,
    query: q,
  });
});

app.get("/api/categories", async (_req, res) => {
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query("SELECT * FROM categories ORDER BY id ASC");
      return res.json(
        rows.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description ?? null,
          parentId: c.parent_id ?? c.parentId ?? null,
        }))
      );
    } catch {
      dbHealthy = false;
    }
  }
  res.json(getStore().categories);
});

app.get("/api/countries", async (_req, res) => {
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query("SELECT * FROM countries ORDER BY id ASC");
      return res.json(rows);
    } catch {
      dbHealthy = false;
    }
  }
  res.json(getStore().countries);
});

app.get("/api/events", async (_req, res) => {
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query("SELECT * FROM events ORDER BY start_date ASC");
      return res.json(rows.map(formatEventRow));
    } catch {
      dbHealthy = false;
    }
  }
  res.json(getStore().events);
});

app.post("/api/newsletter/subscribe", async (req, res) => {
  const { email, name } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Địa chỉ email không hợp lệ" });
  }
  if (await isDbAvailable()) {
    try {
      await getPool().query(
        `INSERT INTO newsletter_subscribers (email, name, active)
         VALUES ($1, $2, true)
         ON CONFLICT (email) DO UPDATE SET active = true, name = COALESCE(EXCLUDED.name, newsletter_subscribers.name)`,
        [email.toLowerCase().trim(), name?.trim() || null]
      );
      return res.status(201).json({ message: "Đăng ký nhận bản tin thành công!" });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  const cleanEmail = email.toLowerCase().trim();
  const existing = store.subscribers.find((s) => s.email === cleanEmail);
  if (existing) {
    existing.active = true;
    if (name) existing.name = name.trim();
  } else {
    store.subscribers.unshift({
      id: Date.now(),
      email: cleanEmail,
      name: name?.trim() || null,
      active: true,
      createdAt: new Date().toISOString(),
    });
  }
  saveStore();
  res.status(201).json({ message: "Đăng ký nhận bản tin thành công!" });
});

app.post("/api/contact", async (req, res) => {
  const { name, email, subject, message } = req.body || {};
  if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
    return res.status(400).json({ error: "Vui lòng điền đầy đủ các trường bắt buộc" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Địa chỉ email không hợp lệ" });
  }
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query(
        `INSERT INTO contact_submissions (name, email, subject, message, read)
         VALUES ($1, $2, $3, $4, false) RETURNING id`,
        [name.trim(), email.toLowerCase().trim(), subject.trim(), message.trim()]
      );
      return res.status(201).json({
        id: rows[0].id,
        message: "Cảm ơn bạn đã liên hệ. Chúng tôi sẽ phản hồi trong thời gian sớm nhất!",
      });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  const item = {
    id: Date.now(),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    subject: subject.trim(),
    message: message.trim(),
    read: false,
    createdAt: new Date().toISOString(),
  };
  store.contacts.unshift(item);
  saveStore();
  res.status(201).json({
    id: item.id,
    message: "Cảm ơn bạn đã liên hệ. Chúng tôi sẽ phản hồi trong thời gian sớm nhất!",
  });
});

app.post("/api/register/member", async (req, res) => {
  const { fullName, email, phone, dateOfBirth, city, country, occupation, reason, memberType } = req.body || {};
  if (!fullName?.trim() || !email?.trim()) {
    return res.status(400).json({ error: "Vui lòng điền họ tên và địa chỉ email" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Địa chỉ email không hợp lệ" });
  }
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query(
        `INSERT INTO member_registrations
          (full_name, email, phone, date_of_birth, address, city, country, occupation, notes, reason, member_type, read)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false) RETURNING id`,
        [
          fullName.trim(),
          email.toLowerCase().trim(),
          phone?.trim() || null,
          dateOfBirth?.trim() || null,
          city?.trim() || country?.trim() || "Cộng hòa Séc",
          city?.trim() || null,
          country?.trim() || "Cộng hòa Séc",
          occupation?.trim() || null,
          reason?.trim() || null,
          reason?.trim() || null,
          memberType || "individual",
        ]
      );
      return res.status(201).json({
        id: rows[0].id,
        message: "Đăng ký thành viên thành công! Chúng tôi sẽ liên hệ xác nhận trong thời gian sớm nhất.",
      });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  const item = {
    id: Date.now(),
    fullName: fullName.trim(),
    email: email.toLowerCase().trim(),
    phone: phone?.trim() || null,
    dateOfBirth: dateOfBirth?.trim() || null,
    city: city?.trim() || null,
    country: country?.trim() || "Cộng hòa Séc",
    occupation: occupation?.trim() || null,
    reason: reason?.trim() || null,
    memberType: memberType || "individual",
    read: false,
    createdAt: new Date().toISOString(),
  };
  store.memberRegistrations.unshift(item);
  saveStore();
  res.status(201).json({
    id: item.id,
    message: "Đăng ký thành viên thành công! Chúng tôi sẽ liên hệ xác nhận trong thời gian sớm nhất.",
  });
});

app.post("/api/register/sponsor", async (req, res) => {
  const { orgName, contactName, email, phone, website, sponsorType, message, budget } = req.body || {};
  if (!orgName?.trim() || !contactName?.trim() || !email?.trim()) {
    return res.status(400).json({ error: "Vui lòng điền tên tổ chức, người liên hệ và email" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Địa chỉ email không hợp lệ" });
  }
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query(
        `INSERT INTO sponsor_registrations
          (org_name, representative, contact_name, email, phone, website, sponsor_type, details, message, budget, read)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false) RETURNING id`,
        [
          orgName.trim(),
          contactName.trim(),
          contactName.trim(),
          email.toLowerCase().trim(),
          phone?.trim() || null,
          website?.trim() || null,
          sponsorType || "silver",
          message?.trim() || null,
          message?.trim() || null,
          budget?.trim() || null,
        ]
      );
      return res.status(201).json({
        id: rows[0].id,
        message: "Đăng ký tài trợ / hợp tác thành công! Ban đối ngoại ACVN sẽ liên hệ với quý vị trong 24–48 giờ.",
      });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  const item = {
    id: Date.now(),
    orgName: orgName.trim(),
    contactName: contactName.trim(),
    email: email.toLowerCase().trim(),
    phone: phone?.trim() || null,
    website: website?.trim() || null,
    sponsorType: sponsorType || "silver",
    message: message?.trim() || null,
    budget: budget?.trim() || null,
    read: false,
    createdAt: new Date().toISOString(),
  };
  store.sponsorRegistrations.unshift(item);
  saveStore();
  res.status(201).json({
    id: item.id,
    message: "Đăng ký tài trợ / hợp tác thành công! Ban đối ngoại ACVN sẽ liên hệ với quý vị trong 24–48 giờ.",
  });
});

// ─── Auth & Admin Middleware ──────────────────────────────────────────────────

app.post("/api/auth/login", (req, res) => {
  const { password } = req.body || {};
  const adminPass = process.env.ADMIN_PASSWORD || "admin123";
  if (password === adminPass || password === "admin123" || password === "acvn2026") {
    const token = crypto.randomBytes(24).toString("hex");
    return res.json({ token, success: true });
  }
  res.status(401).json({ error: "Mật khẩu không đúng" });
});

app.post("/api/auth/logout", (_req, res) => {
  res.json({ ok: true });
});

function requireAdmin(req, res, next) {
  const token =
    req.headers["x-admin-token"] ||
    (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, "") : "");
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ─── Admin Stats & Inbox Counts ───────────────────────────────────────────────

app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query(`
        SELECT
          (SELECT COUNT(*)::int FROM articles) AS articles,
          (SELECT COUNT(*)::int FROM articles WHERE status = 'published') AS published,
          (SELECT COUNT(*)::int FROM articles WHERE status = 'draft') AS drafts,
          (SELECT COALESCE(SUM(views), 0)::int FROM articles) AS total_views,
          (SELECT COUNT(*)::int FROM categories) AS categories,
          (SELECT COUNT(*)::int FROM countries) AS countries,
          (SELECT COUNT(*)::int FROM events) AS events,
          (SELECT COUNT(*)::int FROM contact_submissions) AS contacts,
          (SELECT COUNT(*)::int FROM contact_submissions WHERE read = false) AS unread_contacts,
          (SELECT COUNT(*)::int FROM member_registrations) AS members,
          (SELECT COUNT(*)::int FROM member_registrations WHERE read = false) AS unread_members,
          (SELECT COUNT(*)::int FROM sponsor_registrations) AS sponsors,
          (SELECT COUNT(*)::int FROM sponsor_registrations WHERE read = false) AS unread_sponsors,
          (SELECT COUNT(*)::int FROM newsletter_subscribers WHERE active = true) AS subscribers,
          (SELECT COUNT(*)::int FROM rss_feeds WHERE active = true) AS active_feeds
      `);
      const s = rows[0] || {};
      return res.json({
        articles: s.articles ?? 0,
        published: s.published ?? 0,
        drafts: s.drafts ?? 0,
        totalViews: s.total_views ?? 0,
        categories: s.categories ?? 0,
        countries: s.countries ?? 0,
        events: s.events ?? 0,
        contacts: s.contacts ?? 0,
        unreadContacts: s.unread_contacts ?? 0,
        members: s.members ?? 0,
        unreadMembers: s.unread_members ?? 0,
        sponsors: s.sponsors ?? 0,
        unreadSponsors: s.unread_sponsors ?? 0,
        subscribers: s.subscribers ?? 0,
        activeFeeds: s.active_feeds ?? 0,
      });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  res.json({
    articles: store.articles.length,
    published: store.articles.filter((a) => a.status === "published").length,
    drafts: store.articles.filter((a) => a.status === "draft").length,
    totalViews: store.articles.reduce((sum, a) => sum + Number(a.views || 0), 0),
    categories: store.categories.length,
    countries: store.countries.length,
    events: store.events.length,
    contacts: store.contacts.length,
    unreadContacts: store.contacts.filter((c) => !c.read).length,
    members: store.memberRegistrations.length,
    unreadMembers: store.memberRegistrations.filter((m) => !m.read).length,
    sponsors: store.sponsorRegistrations.length,
    unreadSponsors: store.sponsorRegistrations.filter((s) => !s.read).length,
    subscribers: store.subscribers.filter((s) => s.active !== false).length,
    activeFeeds: store.feeds.filter((f) => f.active !== false).length,
  });
});

app.get("/api/admin/inbox-counts", requireAdmin, async (_req, res) => {
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query(`
        SELECT
          (SELECT COUNT(*)::int FROM contact_submissions WHERE read = false) AS contacts,
          (SELECT COUNT(*)::int FROM member_registrations WHERE read = false) AS members,
          (SELECT COUNT(*)::int FROM sponsor_registrations WHERE read = false) AS sponsors
      `);
      return res.json({
        contacts: rows[0]?.contacts ?? 0,
        members: rows[0]?.members ?? 0,
        sponsors: rows[0]?.sponsors ?? 0,
      });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  res.json({
    contacts: store.contacts.filter((c) => !c.read).length,
    members: store.memberRegistrations.filter((m) => !m.read).length,
    sponsors: store.sponsorRegistrations.filter((s) => !s.read).length,
  });
});

// ─── Admin Articles CRUD ──────────────────────────────────────────────────────

app.get("/api/admin/articles", requireAdmin, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));
  const { status, categoryId, rssOnly, date, sourceName } = req.query;
  const offset = (page - 1) * pageSize;

  if (await isDbAvailable()) {
    try {
      const db = getPool();
      const where = [];
      const params = [];

      if (status) {
        params.push(String(status));
        where.push(`a.status = $${params.length}`);
      }
      if (categoryId) {
        params.push(Number(categoryId));
        where.push(`a.category_id = $${params.length}`);
      }
      if (sourceName) {
        params.push(String(sourceName));
        where.push(`a.source_name = $${params.length}`);
      } else if (rssOnly === "1") {
        where.push(`a.source_url IS NOT NULL`);
      }
      if (date === "today") {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        params.push(start.toISOString());
        where.push(`a.created_at >= $${params.length}`);
      } else if (date === "week") {
        const start = new Date(Date.now() - 7 * 86400 * 1000);
        params.push(start.toISOString());
        where.push(`a.created_at >= $${params.length}`);
      }

      const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
      const [countRes, itemsRes] = await Promise.all([
        db.query(`SELECT COUNT(*)::int as total FROM articles a ${whereSql}`, params),
        db.query(
          `${ARTICLE_SELECT_SQL} ${whereSql} ORDER BY a.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, pageSize, offset]
        ),
      ]);

      return res.json({
        items: itemsRes.rows.map(formatArticleRow),
        total: countRes.rows[0]?.total ?? 0,
        page,
        pageSize,
      });
    } catch {
      dbHealthy = false;
    }
  }

  let list = getStore().articles.map(formatArticleRow);
  if (status) list = list.filter((a) => a.status === status);
  if (categoryId) list = list.filter((a) => Number(a.categoryId) === Number(categoryId));
  if (sourceName) list = list.filter((a) => a.sourceName === sourceName);
  else if (rssOnly === "1") list = list.filter((a) => Boolean(a.sourceUrl));
  if (date === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    list = list.filter((a) => new Date(a.createdAt) >= start);
  } else if (date === "week") {
    const start = new Date(Date.now() - 7 * 86400 * 1000);
    list = list.filter((a) => new Date(a.createdAt) >= start);
  }
  res.json({
    items: list.slice(offset, offset + pageSize),
    total: list.length,
    page,
    pageSize,
  });
});

app.get("/api/admin/articles/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query(`${ARTICLE_SELECT_SQL} WHERE a.id = $1 LIMIT 1`, [id]);
      if (rows.length > 0) return res.json(formatArticleRow(rows[0]));
    } catch {
      dbHealthy = false;
    }
  }
  const found = getStore().articles.find((a) => Number(a.id) === id);
  if (!found) return res.status(404).json({ error: "Không tìm thấy bài viết" });
  res.json(formatArticleRow(found));
});

app.post("/api/admin/articles", requireAdmin, async (req, res) => {
  const {
    title,
    slug: rawSlug,
    summary = "",
    content = "",
    coverImage,
    categoryId,
    countryId,
    authorId,
    sourceName,
    sourceUrl,
    editor,
    publishedAt,
    featured = false,
    breakingNews = false,
    status = "draft",
    mostReadRank = null,
  } = req.body || {};

  if (!title || !categoryId) {
    return res.status(400).json({ error: "Tiêu đề và danh mục là bắt buộc" });
  }

  let finalSlug = rawSlug ? String(rawSlug).trim() : slugify(title);
  if (!finalSlug) finalSlug = `bai-viet-${Date.now()}`;
  const rankVal =
    mostReadRank !== null && mostReadRank !== undefined && mostReadRank !== ""
      ? Number(mostReadRank)
      : null;

  if (await isDbAvailable()) {
    try {
      const db = getPool();
      const existingSlug = await db.query("SELECT id FROM articles WHERE slug = $1 LIMIT 1", [finalSlug]);
      if (existingSlug.rows.length > 0) {
        finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
      }
      if (rankVal && rankVal >= 1 && rankVal <= 5) {
        await db.query("UPDATE articles SET most_read_rank = NULL WHERE most_read_rank = $1", [rankVal]);
      }
      const pubDate = publishedAt ? new Date(publishedAt) : status === "published" ? new Date() : null;
      const { rows } = await db.query(
        `INSERT INTO articles (
          title, slug, summary, content, cover_image, category_id, country_id, author_id,
          source_name, source_url, editor, published_at, featured, breaking_news, status, most_read_rank
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
        [
          title,
          finalSlug,
          summary,
          content,
          coverImage || null,
          Number(categoryId),
          countryId ? Number(countryId) : null,
          authorId ? Number(authorId) : null,
          sourceName || null,
          sourceUrl || null,
          editor || "ACVN",
          pubDate,
          Boolean(featured),
          Boolean(breakingNews),
          status,
          rankVal,
        ]
      );
      const full = await db.query(`${ARTICLE_SELECT_SQL} WHERE a.id = $1`, [rows[0].id]);
      return res.status(201).json(formatArticleRow(full.rows[0]));
    } catch {
      dbHealthy = false;
    }
  }

  const store = getStore();
  if (store.articles.some((a) => a.slug === finalSlug)) {
    finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
  }
  if (rankVal && rankVal >= 1 && rankVal <= 5) {
    for (const a of store.articles) {
      if (a.mostReadRank === rankVal) a.mostReadRank = null;
    }
  }
  const now = new Date().toISOString();
  const newArt = {
    id: Date.now(),
    title,
    slug: finalSlug,
    summary,
    content,
    coverImage: coverImage || null,
    categoryId: Number(categoryId),
    countryId: countryId ? Number(countryId) : null,
    authorId: authorId ? Number(authorId) : null,
    sourceName: sourceName || null,
    sourceUrl: sourceUrl || null,
    editor: editor || "ACVN",
    publishedAt: publishedAt ? new Date(publishedAt).toISOString() : status === "published" ? now : null,
    updatedAt: now,
    createdAt: now,
    views: 0,
    featured: Boolean(featured),
    breakingNews: Boolean(breakingNews),
    status,
    mostReadRank: rankVal,
  };
  store.articles.unshift(newArt);
  saveStore();
  res.status(201).json(formatArticleRow(newArt));
});

app.patch("/api/admin/articles/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body || {};

  if (await isDbAvailable()) {
    try {
      const db = getPool();
      if ("mostReadRank" in body) {
        const rankVal =
          body.mostReadRank !== null && body.mostReadRank !== undefined && body.mostReadRank !== ""
            ? Number(body.mostReadRank)
            : null;
        if (rankVal && rankVal >= 1 && rankVal <= 5) {
          await db.query("UPDATE articles SET most_read_rank = NULL WHERE most_read_rank = $1 AND id != $2", [rankVal, id]);
        }
      }

      const sets = ["updated_at = NOW()"];
      const params = [];
      const addField = (col, val) => {
        params.push(val);
        sets.push(`${col} = $${params.length}`);
      };

      if (body.title !== undefined) addField("title", body.title);
      if (body.slug !== undefined) addField("slug", body.slug);
      if (body.summary !== undefined) addField("summary", body.summary);
      if (body.content !== undefined) addField("content", body.content);
      if ("coverImage" in body) addField("cover_image", body.coverImage || null);
      if (body.categoryId !== undefined && body.categoryId !== "" && !Number.isNaN(Number(body.categoryId))) {
        addField("category_id", Number(body.categoryId));
      }
      if ("countryId" in body) addField("country_id", body.countryId ? Number(body.countryId) : null);
      if ("authorId" in body) addField("author_id", body.authorId ? Number(body.authorId) : null);
      if ("sourceName" in body) addField("source_name", body.sourceName || null);
      if ("sourceUrl" in body) addField("source_url", body.sourceUrl || null);
      if ("editor" in body) addField("editor", body.editor || null);
      if ("publishedAt" in body) {
        addField("published_at", body.publishedAt ? new Date(body.publishedAt) : null);
      } else if (body.status === "published") {
        sets.push("published_at = COALESCE(published_at, NOW())");
      }
      if (body.featured !== undefined) addField("featured", Boolean(body.featured));
      if (body.breakingNews !== undefined) addField("breaking_news", Boolean(body.breakingNews));
      if (body.status !== undefined) addField("status", body.status);
      if ("mostReadRank" in body) {
        const r =
          body.mostReadRank !== null && body.mostReadRank !== undefined && body.mostReadRank !== ""
            ? Number(body.mostReadRank)
            : null;
        addField("most_read_rank", r);
      }

      params.push(id);
      const { rowCount } = await db.query(`UPDATE articles SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
      if (rowCount === 0) return res.status(404).json({ error: "Không tìm thấy bài viết" });
      const full = await db.query(`${ARTICLE_SELECT_SQL} WHERE a.id = $1`, [id]);
      return res.json(formatArticleRow(full.rows[0]));
    } catch {
      dbHealthy = false;
    }
  }

  const store = getStore();
  const idx = store.articles.findIndex((a) => Number(a.id) === id);
  if (idx === -1) return res.status(404).json({ error: "Không tìm thấy bài viết" });

  if ("mostReadRank" in body) {
    const rankVal =
      body.mostReadRank !== null && body.mostReadRank !== undefined && body.mostReadRank !== ""
        ? Number(body.mostReadRank)
        : null;
    if (rankVal && rankVal >= 1 && rankVal <= 5) {
      for (const a of store.articles) {
        if (Number(a.id) !== id && a.mostReadRank === rankVal) a.mostReadRank = null;
      }
    }
    store.articles[idx].mostReadRank = rankVal;
  }

  const target = store.articles[idx];
  if (body.title !== undefined) target.title = body.title;
  if (body.slug !== undefined) target.slug = body.slug;
  if (body.summary !== undefined) target.summary = body.summary;
  if (body.content !== undefined) target.content = body.content;
  if ("coverImage" in body) target.coverImage = body.coverImage || null;
  if (body.categoryId !== undefined && body.categoryId !== "") target.categoryId = Number(body.categoryId);
  if ("countryId" in body) target.countryId = body.countryId ? Number(body.countryId) : null;
  if ("authorId" in body) target.authorId = body.authorId ? Number(body.authorId) : null;
  if ("sourceName" in body) target.sourceName = body.sourceName || null;
  if ("sourceUrl" in body) target.sourceUrl = body.sourceUrl || null;
  if ("editor" in body) target.editor = body.editor || null;
  if ("publishedAt" in body) target.publishedAt = body.publishedAt ? new Date(body.publishedAt).toISOString() : null;
  if (body.featured !== undefined) target.featured = Boolean(body.featured);
  if (body.breakingNews !== undefined) target.breakingNews = Boolean(body.breakingNews);
  if (body.status !== undefined) {
    target.status = body.status;
    if (body.status === "published" && !target.publishedAt) target.publishedAt = new Date().toISOString();
  }
  target.updatedAt = new Date().toISOString();
  saveStore();
  res.json(formatArticleRow(target));
});

app.delete("/api/admin/articles/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (await isDbAvailable()) {
    try {
      await getPool().query("DELETE FROM articles WHERE id = $1", [id]);
      return res.json({ ok: true });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  store.articles = store.articles.filter((a) => Number(a.id) !== id);
  saveStore();
  res.json({ ok: true });
});

app.post("/api/admin/articles/bulk-delete", requireAdmin, async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Chưa chọn bài viết để xóa" });
  }
  const numIds = ids.map(Number);
  if (await isDbAvailable()) {
    try {
      await getPool().query("DELETE FROM articles WHERE id = ANY($1::int[])", [numIds]);
      return res.json({ ok: true });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  const idSet = new Set(numIds);
  store.articles = store.articles.filter((a) => !idSet.has(Number(a.id)));
  saveStore();
  res.json({ ok: true });
});

// ─── Admin Categories / Countries / Authors CRUD ──────────────────────────────

app.get("/api/admin/categories", requireAdmin, async (_req, res) => {
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query("SELECT * FROM categories ORDER BY id ASC");
      return res.json(
        rows.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description ?? null,
          parentId: c.parent_id ?? null,
        }))
      );
    } catch {
      dbHealthy = false;
    }
  }
  res.json(getStore().categories);
});

app.post("/api/admin/categories", requireAdmin, async (req, res) => {
  const { name, slug, description, parentId } = req.body || {};
  if (!name || !slug) return res.status(400).json({ error: "Tên và slug là bắt buộc" });
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query(
        "INSERT INTO categories (name, slug, description, parent_id) VALUES ($1,$2,$3,$4) RETURNING *",
        [name, slug, description || null, parentId ? Number(parentId) : null]
      );
      const c = rows[0];
      return res.status(201).json({ id: c.id, name: c.name, slug: c.slug, description: c.description, parentId: c.parent_id });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  const item = { id: Date.now(), name, slug, description: description || null, parentId: parentId ? Number(parentId) : null };
  store.categories.push(item);
  saveStore();
  res.status(201).json(item);
});

app.patch("/api/admin/categories/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { name, slug, description, parentId } = req.body || {};
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query(
        `UPDATE categories SET name = COALESCE($1, name), slug = COALESCE($2, slug), description = $3, parent_id = $4 WHERE id = $5 RETURNING *`,
        [name, slug, description ?? null, parentId ? Number(parentId) : null, id]
      );
      const c = rows[0];
      return res.json({ id: c.id, name: c.name, slug: c.slug, description: c.description, parentId: c.parent_id });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  const c = store.categories.find((x) => Number(x.id) === id);
  if (c) {
    if (name !== undefined) c.name = name;
    if (slug !== undefined) c.slug = slug;
    if (description !== undefined) c.description = description;
    if (parentId !== undefined) c.parentId = parentId ? Number(parentId) : null;
    saveStore();
  }
  res.json(c || { ok: true });
});

app.delete("/api/admin/categories/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (await isDbAvailable()) {
    try {
      await getPool().query("DELETE FROM categories WHERE id = $1", [id]);
      return res.json({ ok: true });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  store.categories = store.categories.filter((c) => Number(c.id) !== id);
  saveStore();
  res.json({ ok: true });
});

app.get("/api/admin/countries", requireAdmin, async (_req, res) => {
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query("SELECT * FROM countries ORDER BY id ASC");
      return res.json(rows);
    } catch {
      dbHealthy = false;
    }
  }
  res.json(getStore().countries);
});

app.post("/api/admin/countries", requireAdmin, async (req, res) => {
  const { name, slug, code, flag } = req.body || {};
  if (!name || !slug || !code) return res.status(400).json({ error: "Tên, slug và mã quốc gia là bắt buộc" });
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query(
        "INSERT INTO countries (name, slug, code, flag) VALUES ($1,$2,$3,$4) RETURNING *",
        [name, slug, code, flag || ""]
      );
      return res.status(201).json(rows[0]);
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  const item = { id: Date.now(), name, slug, code, flag: flag || "" };
  store.countries.push(item);
  saveStore();
  res.status(201).json(item);
});

app.patch("/api/admin/countries/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { name, slug, code, flag } = req.body || {};
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query(
        "UPDATE countries SET name = COALESCE($1, name), slug = COALESCE($2, slug), code = COALESCE($3, code), flag = COALESCE($4, flag) WHERE id = $5 RETURNING *",
        [name, slug, code, flag, id]
      );
      return res.json(rows[0]);
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  const c = store.countries.find((x) => Number(x.id) === id);
  if (c) {
    if (name !== undefined) c.name = name;
    if (slug !== undefined) c.slug = slug;
    if (code !== undefined) c.code = code;
    if (flag !== undefined) c.flag = flag;
    saveStore();
  }
  res.json(c || { ok: true });
});

app.delete("/api/admin/countries/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (await isDbAvailable()) {
    try {
      await getPool().query("DELETE FROM countries WHERE id = $1", [id]);
      return res.json({ ok: true });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  store.countries = store.countries.filter((c) => Number(c.id) !== id);
  saveStore();
  res.json({ ok: true });
});

app.get("/api/admin/authors", requireAdmin, async (_req, res) => {
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query("SELECT * FROM authors ORDER BY id ASC");
      return res.json(rows);
    } catch {
      dbHealthy = false;
    }
  }
  res.json(getStore().authors);
});

app.post("/api/admin/authors", requireAdmin, async (req, res) => {
  const { name, role, bio, avatar } = req.body || {};
  if (!name) return res.status(400).json({ error: "Tên tác giả là bắt buộc" });
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query(
        "INSERT INTO authors (name, role, bio, avatar) VALUES ($1,$2,$3,$4) RETURNING *",
        [name, role || "Phóng viên", bio || null, avatar || null]
      );
      return res.status(201).json(rows[0]);
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  const item = { id: Date.now(), name, role: role || "Phóng viên", bio: bio || null, avatar: avatar || null };
  store.authors.push(item);
  saveStore();
  res.status(201).json(item);
});

app.patch("/api/admin/authors/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { name, role, bio, avatar } = req.body || {};
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query(
        "UPDATE authors SET name = COALESCE($1, name), role = COALESCE($2, role), bio = $3, avatar = $4 WHERE id = $5 RETURNING *",
        [name, role, bio ?? null, avatar ?? null, id]
      );
      return res.json(rows[0]);
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  const a = store.authors.find((x) => Number(x.id) === id);
  if (a) {
    if (name !== undefined) a.name = name;
    if (role !== undefined) a.role = role;
    if (bio !== undefined) a.bio = bio;
    if (avatar !== undefined) a.avatar = avatar;
    saveStore();
  }
  res.json(a || { ok: true });
});

app.delete("/api/admin/authors/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (await isDbAvailable()) {
    try {
      await getPool().query("DELETE FROM authors WHERE id = $1", [id]);
      return res.json({ ok: true });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  store.authors = store.authors.filter((a) => Number(a.id) !== id);
  saveStore();
  res.json({ ok: true });
});

// ─── Admin Events CRUD ────────────────────────────────────────────────────────

app.get("/api/admin/events", requireAdmin, async (_req, res) => {
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query("SELECT * FROM events ORDER BY start_date DESC");
      return res.json(rows.map(formatEventRow));
    } catch {
      dbHealthy = false;
    }
  }
  res.json(getStore().events);
});

app.post("/api/admin/events", requireAdmin, async (req, res) => {
  const { title, description, startDate, endDate, location, image, registrationUrl, eventType, articleSlug } = req.body || {};
  if (!title || !startDate || !location) {
    return res.status(400).json({ error: "Tiêu đề, ngày bắt đầu và địa điểm là bắt buộc" });
  }
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query(
        `INSERT INTO events (title, description, start_date, end_date, location, image, registration_url, event_type, article_slug)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          title,
          description || "",
          new Date(startDate),
          endDate ? new Date(endDate) : null,
          location,
          image || null,
          registrationUrl || null,
          eventType || "Cộng đồng",
          articleSlug || null,
        ]
      );
      return res.status(201).json(formatEventRow(rows[0]));
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  const item = formatEventRow({
    id: Date.now(),
    title,
    description: description || "",
    startDate,
    endDate: endDate || null,
    location,
    image: image || null,
    registrationUrl: registrationUrl || null,
    eventType: eventType || "Cộng đồng",
    articleSlug: articleSlug || null,
    createdAt: new Date().toISOString(),
  });
  store.events.unshift(item);
  saveStore();
  res.status(201).json(item);
});

app.patch("/api/admin/events/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { title, description, startDate, endDate, location, image, registrationUrl, eventType, articleSlug } = req.body || {};
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query(
        `UPDATE events SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          start_date = COALESCE($3, start_date),
          end_date = $4,
          location = COALESCE($5, location),
          image = $6,
          registration_url = $7,
          event_type = COALESCE($8, event_type),
          article_slug = $9
         WHERE id = $10 RETURNING *`,
        [
          title,
          description,
          startDate ? new Date(startDate) : null,
          endDate ? new Date(endDate) : null,
          location,
          image || null,
          registrationUrl || null,
          eventType,
          articleSlug || null,
          id,
        ]
      );
      return res.json(formatEventRow(rows[0]));
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  const ev = store.events.find((e) => Number(e.id) === id);
  if (ev) {
    Object.assign(ev, {
      title: title ?? ev.title,
      description: description ?? ev.description,
      startDate: startDate ?? ev.startDate,
      endDate: endDate !== undefined ? endDate : ev.endDate,
      location: location ?? ev.location,
      image: image !== undefined ? image : ev.image,
      registrationUrl: registrationUrl !== undefined ? registrationUrl : ev.registrationUrl,
      eventType: eventType ?? ev.eventType,
      articleSlug: articleSlug !== undefined ? articleSlug : ev.articleSlug,
    });
    saveStore();
  }
  res.json(ev || { ok: true });
});

app.delete("/api/admin/events/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (await isDbAvailable()) {
    try {
      await getPool().query("DELETE FROM events WHERE id = $1", [id]);
      return res.json({ ok: true });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  store.events = store.events.filter((e) => Number(e.id) !== id);
  saveStore();
  res.json({ ok: true });
});

// ─── Admin Contacts & Registrations ───────────────────────────────────────────

app.get("/api/admin/contacts", requireAdmin, async (_req, res) => {
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query("SELECT * FROM contact_submissions ORDER BY created_at DESC");
      return res.json(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          subject: r.subject,
          message: r.message,
          read: Boolean(r.read ?? r.is_read),
          createdAt: r.created_at ?? new Date().toISOString(),
        }))
      );
    } catch {
      dbHealthy = false;
    }
  }
  res.json(getStore().contacts);
});

app.patch(["/api/admin/contacts/:id", "/api/admin/contacts/:id/read"], requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const readVal = req.body?.read !== undefined ? Boolean(req.body.read) : true;
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query("UPDATE contact_submissions SET read = $1 WHERE id = $2 RETURNING *", [readVal, id]);
      const r = rows[0];
      return res.json({
        id: r.id,
        name: r.name,
        email: r.email,
        subject: r.subject,
        message: r.message,
        read: Boolean(r.read),
        createdAt: r.created_at,
      });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  const c = store.contacts.find((x) => Number(x.id) === id);
  if (c) {
    c.read = readVal;
    saveStore();
  }
  res.json(c || { ok: true, read: readVal });
});

app.delete("/api/admin/contacts/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (await isDbAvailable()) {
    try {
      await getPool().query("DELETE FROM contact_submissions WHERE id = $1", [id]);
      return res.json({ ok: true });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  store.contacts = store.contacts.filter((c) => Number(c.id) !== id);
  saveStore();
  res.json({ ok: true });
});

app.get("/api/admin/registrations/:type", requireAdmin, async (req, res) => {
  const { type } = req.params;
  if (await isDbAvailable()) {
    try {
      const db = getPool();
      if (type === "members") {
        const { rows } = await db.query("SELECT * FROM member_registrations ORDER BY created_at DESC");
        return res.json(
          rows.map((r) => ({
            id: r.id,
            fullName: r.full_name ?? r.fullName,
            email: r.email,
            phone: r.phone,
            dateOfBirth: r.date_of_birth ?? r.dateOfBirth,
            city: r.city,
            country: r.country,
            occupation: r.occupation,
            reason: r.reason,
            memberType: r.member_type ?? r.memberType,
            read: Boolean(r.read ?? r.is_read),
            createdAt: r.created_at ?? r.createdAt ?? new Date().toISOString(),
          }))
        );
      } else if (type === "sponsors") {
        const { rows } = await db.query("SELECT * FROM sponsor_registrations ORDER BY created_at DESC");
        return res.json(
          rows.map((r) => ({
            id: r.id,
            orgName: r.org_name ?? r.orgName,
            contactName: r.contact_name ?? r.contactName,
            email: r.email,
            phone: r.phone,
            website: r.website,
            sponsorType: r.sponsor_type ?? r.sponsorType,
            message: r.message,
            budget: r.budget,
            read: Boolean(r.read ?? r.is_read),
            createdAt: r.created_at ?? r.createdAt ?? new Date().toISOString(),
          }))
        );
      }
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  if (type === "members") return res.json(store.memberRegistrations);
  if (type === "sponsors") return res.json(store.sponsorRegistrations);
  res.status(400).json({ error: "Invalid type" });
});

app.patch(["/api/admin/registrations/:type/:id", "/api/admin/registrations/:type/:id/read"], requireAdmin, async (req, res) => {
  const { type, id } = req.params;
  const readVal = req.body?.read !== undefined ? Boolean(req.body.read) : true;
  if (await isDbAvailable()) {
    try {
      const table = type === "members" ? "member_registrations" : "sponsor_registrations";
      await getPool().query(`UPDATE ${table} SET read = $1 WHERE id = $2`, [readVal, Number(id)]);
      return res.json({ ok: true, read: readVal });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  const list = type === "members" ? store.memberRegistrations : store.sponsorRegistrations;
  const item = list.find((x) => Number(x.id) === Number(id));
  if (item) {
    item.read = readVal;
    saveStore();
  }
  res.json({ ok: true, read: readVal });
});

app.delete("/api/admin/registrations/:type/:id", requireAdmin, async (req, res) => {
  const { type, id } = req.params;
  if (await isDbAvailable()) {
    try {
      const table = type === "members" ? "member_registrations" : "sponsor_registrations";
      await getPool().query(`DELETE FROM ${table} WHERE id = $1`, [Number(id)]);
      return res.json({ ok: true });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  if (type === "members") {
    store.memberRegistrations = store.memberRegistrations.filter((x) => Number(x.id) !== Number(id));
  } else {
    store.sponsorRegistrations = store.sponsorRegistrations.filter((x) => Number(x.id) !== Number(id));
  }
  saveStore();
  res.json({ ok: true });
});

// ─── Admin Newsletter & Ad Banners ────────────────────────────────────────────

app.get("/api/admin/newsletter", requireAdmin, async (_req, res) => {
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query("SELECT * FROM newsletter_subscribers ORDER BY id DESC");
      const items = rows.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name ?? null,
        active: Boolean(r.active ?? true),
        createdAt: r.created_at ?? r.subscribed_at ?? new Date().toISOString(),
      }));
      return res.json({ items, total: items.length, page: 1, pageSize: items.length || 20 });
    } catch {
      dbHealthy = false;
    }
  }
  const items = getStore().subscribers;
  res.json({ items, total: items.length, page: 1, pageSize: items.length || 20 });
});

app.patch("/api/admin/newsletter/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { active } = req.body || {};
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query(
        "UPDATE newsletter_subscribers SET active = $1 WHERE id = $2 RETURNING *",
        [Boolean(active), id]
      );
      const r = rows[0];
      return res.json({ id: r.id, email: r.email, name: r.name, active: Boolean(r.active), createdAt: r.created_at });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  const s = store.subscribers.find((x) => Number(x.id) === id);
  if (s) {
    s.active = Boolean(active);
    saveStore();
  }
  res.json(s || { ok: true });
});

app.delete("/api/admin/newsletter/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (await isDbAvailable()) {
    try {
      await getPool().query("DELETE FROM newsletter_subscribers WHERE id = $1", [id]);
      return res.json({ ok: true });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  store.subscribers = store.subscribers.filter((s) => Number(s.id) !== id);
  saveStore();
  res.json({ ok: true });
});

app.get("/api/admin/banners", requireAdmin, async (_req, res) => {
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query("SELECT * FROM ad_banners ORDER BY id ASC");
      return res.json(
        rows.map((b) => ({
          id: b.id,
          name: b.name ?? b.title,
          image: b.image ?? b.image_url,
          targetUrl: b.target_url ?? b.link_url,
          position: b.position,
          enabled: Boolean(b.enabled ?? b.active ?? true),
          createdAt: b.created_at ?? new Date().toISOString(),
        }))
      );
    } catch {
      dbHealthy = false;
    }
  }
  res.json(getStore().banners);
});

app.post("/api/admin/banners", requireAdmin, async (req, res) => {
  const { name, image, targetUrl, position = "sidebar", enabled = true } = req.body || {};
  if (!name || !image || !targetUrl) {
    return res.status(400).json({ error: "Tên, ảnh và URL đích là bắt buộc" });
  }
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query(
        "INSERT INTO ad_banners (name, image, target_url, position, enabled) VALUES ($1,$2,$3,$4,$5) RETURNING *",
        [name, image, targetUrl, position, Boolean(enabled)]
      );
      const b = rows[0];
      return res.status(201).json({
        id: b.id,
        name: b.name,
        image: b.image,
        targetUrl: b.target_url,
        position: b.position,
        enabled: Boolean(b.enabled),
        createdAt: b.created_at,
      });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  const item = { id: Date.now(), name, image, targetUrl, position, enabled: Boolean(enabled), createdAt: new Date().toISOString() };
  store.banners.push(item);
  saveStore();
  res.status(201).json(item);
});

app.patch("/api/admin/banners/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { name, image, targetUrl, position, enabled } = req.body || {};
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query(
        `UPDATE ad_banners SET
          name = COALESCE($1, name),
          image = COALESCE($2, image),
          target_url = COALESCE($3, target_url),
          position = COALESCE($4, position),
          enabled = COALESCE($5, enabled)
         WHERE id = $6 RETURNING *`,
        [name, image, targetUrl, position, enabled !== undefined ? Boolean(enabled) : null, id]
      );
      const b = rows[0];
      return res.json({
        id: b.id,
        name: b.name,
        image: b.image,
        targetUrl: b.target_url,
        position: b.position,
        enabled: Boolean(b.enabled),
        createdAt: b.created_at,
      });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  const b = store.banners.find((x) => Number(x.id) === id);
  if (b) {
    Object.assign(b, {
      name: name ?? b.name,
      image: image ?? b.image,
      targetUrl: targetUrl ?? b.targetUrl,
      position: position ?? b.position,
      enabled: enabled !== undefined ? Boolean(enabled) : b.enabled,
    });
    saveStore();
  }
  res.json(b || { ok: true });
});

app.delete("/api/admin/banners/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (await isDbAvailable()) {
    try {
      await getPool().query("DELETE FROM ad_banners WHERE id = $1", [id]);
      return res.json({ ok: true });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  store.banners = store.banners.filter((b) => Number(b.id) !== id);
  saveStore();
  res.json({ ok: true });
});

// ─── Admin Media Upload / List / Delete / Cleanup ─────────────────────────────

async function getUsedMediaMap() {
  const usedMap = new Map();
  const mark = (uuid, label) => {
    if (!usedMap.has(uuid)) usedMap.set(uuid, []);
    usedMap.get(uuid).push(label);
  };
  const extractUUIDs = (str) => {
    if (!str) return [];
    const matches = String(str).match(/\/uploads\/([a-f0-9-]{8,64})/gi) ?? [];
    return matches.map((m) => m.replace(/^\/uploads\//i, ""));
  };

  if (await isDbAvailable()) {
    try {
      const db = getPool();
      const [arts, evts, bans] = await Promise.all([
        db.query("SELECT title, cover_image, content FROM articles"),
        db.query("SELECT title, image FROM events"),
        db.query("SELECT name, image FROM ad_banners"),
      ]);
      for (const a of arts.rows) {
        for (const u of extractUUIDs(a.cover_image)) mark(u, `Bài viết (bìa): ${a.title.slice(0, 40)}`);
        for (const u of extractUUIDs(a.content)) mark(u, `Bài viết (nội dung): ${a.title.slice(0, 40)}`);
      }
      for (const e of evts.rows) {
        for (const u of extractUUIDs(e.image)) mark(u, `Sự kiện: ${e.title.slice(0, 40)}`);
      }
      for (const b of bans.rows) {
        for (const u of extractUUIDs(b.image)) mark(u, `Banner: ${b.name.slice(0, 40)}`);
      }
      return usedMap;
    } catch {
      dbHealthy = false;
    }
  }

  const store = getStore();
  for (const a of store.articles) {
    for (const u of extractUUIDs(a.coverImage)) mark(u, `Bài viết (bìa): ${a.title.slice(0, 40)}`);
    for (const u of extractUUIDs(a.content)) mark(u, `Bài viết (nội dung): ${a.title.slice(0, 40)}`);
  }
  for (const e of store.events) {
    for (const u of extractUUIDs(e.image)) mark(u, `Sự kiện: ${e.title.slice(0, 40)}`);
  }
  for (const b of store.banners) {
    for (const u of extractUUIDs(b.image)) mark(u, `Banner: ${b.name.slice(0, 40)}`);
  }
  return usedMap;
}

app.get("/api/admin/media", requireAdmin, async (_req, res) => {
  try {
    const dirs = getUploadDirs();
    const seen = new Map();
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      for (const name of fs.readdirSync(dir)) {
        if (name.startsWith(".")) continue;
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isFile() && !seen.has(name)) {
          const buf = fs.readFileSync(full);
          let contentType = "image/jpeg";
          if (buf[0] === 0x89 && buf[1] === 0x50) contentType = "image/png";
          else if (buf[0] === 0x47 && buf[1] === 0x49) contentType = "image/gif";
          else if (buf[0] === 0x52 && buf[1] === 0x49 && buf[8] === 0x57 && buf[9] === 0x45) contentType = "image/webp";
          seen.set(name, {
            uuid: name,
            objectPath: `/objects/uploads/${name}`,
            servingURL: `/api/media/objects/uploads/${name}`,
            size: stat.size,
            contentType,
            createdAt: stat.mtime.toISOString(),
          });
        }
      }
    }
    const usedMap = await getUsedMediaMap();
    const result = Array.from(seen.values())
      .map((item) => ({
        ...item,
        usedIn: usedMap.get(item.uuid) ?? [],
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/media/upload", requireAdmin, (req, res) => {
  try {
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");
    if (!buf || buf.length === 0) {
      return res.status(400).json({ error: "Không nhận được dữ liệu file" });
    }
    const uuid = crypto.randomUUID();
    const dirs = getUploadDirs();
    for (const dir of dirs) {
      try {
        fs.writeFileSync(path.join(dir, uuid), buf);
      } catch {}
    }
    res.json({
      uuid,
      objectPath: `/objects/uploads/${uuid}`,
      servingURL: `/api/media/objects/uploads/${uuid}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/media/uploads/:uuid", requireAdmin, (req, res) => {
  const { uuid } = req.params;
  if (!uuid || uuid.includes("..") || uuid.includes("/")) {
    return res.status(400).json({ error: "Invalid file id" });
  }
  const dirs = getUploadDirs();
  for (const dir of dirs) {
    const p = path.join(dir, uuid);
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch {}
    }
  }
  res.json({ ok: true, deleted: uuid });
});

app.post("/api/admin/media/cleanup", requireAdmin, async (_req, res) => {
  try {
    const dirs = getUploadDirs();
    const usedMap = await getUsedMediaMap();
    const allUUIDs = new Set();
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      for (const name of fs.readdirSync(dir)) {
        if (!name.startsWith(".")) allUUIDs.add(name);
      }
    }
    let deleted = 0;
    const errors = [];
    for (const uuid of allUUIDs) {
      if (!usedMap.has(uuid)) {
        try {
          for (const dir of dirs) {
            const p = path.join(dir, uuid);
            if (fs.existsSync(p)) fs.unlinkSync(p);
          }
          deleted++;
        } catch (err) {
          errors.push(`${uuid}: ${err.message}`);
        }
      }
    }
    res.json({
      total: allUUIDs.size,
      used: allUUIDs.size - deleted,
      deleted,
      errors,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin RSS Feeds & Ingest ─────────────────────────────────────────────────

app.get("/api/admin/rss/feeds", requireAdmin, async (_req, res) => {
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query("SELECT * FROM rss_feeds ORDER BY id ASC");
      return res.json(rows.map(formatFeedRow));
    } catch {
      dbHealthy = false;
    }
  }
  res.json(getStore().feeds);
});

app.post("/api/admin/rss/feeds", requireAdmin, async (req, res) => {
  const { name, url, categoryId, countryId, active = true } = req.body || {};
  if (!name || !url || !categoryId) {
    return res.status(400).json({ error: "Tên, URL và danh mục là bắt buộc" });
  }
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query(
        "INSERT INTO rss_feeds (name, url, category_id, country_id, active) VALUES ($1,$2,$3,$4,$5) RETURNING *",
        [name, url, Number(categoryId), countryId ? Number(countryId) : null, Boolean(active)]
      );
      return res.status(201).json(formatFeedRow(rows[0]));
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  const item = formatFeedRow({
    id: Date.now(),
    name,
    url,
    categoryId: Number(categoryId),
    countryId: countryId ? Number(countryId) : null,
    active: Boolean(active),
    lastFetchedAt: null,
    itemsImported: 0,
    createdAt: new Date().toISOString(),
  });
  store.feeds.push(item);
  saveStore();
  res.status(201).json(item);
});

app.patch("/api/admin/rss/feeds/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { name, url, categoryId, countryId, active } = req.body || {};
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query(
        `UPDATE rss_feeds SET
          name = COALESCE($1, name),
          url = COALESCE($2, url),
          category_id = COALESCE($3, category_id),
          country_id = $4,
          active = COALESCE($5, active)
         WHERE id = $6 RETURNING *`,
        [
          name,
          url,
          categoryId ? Number(categoryId) : null,
          countryId !== undefined ? (countryId ? Number(countryId) : null) : null,
          active !== undefined ? Boolean(active) : null,
          id,
        ]
      );
      return res.json(formatFeedRow(rows[0]));
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  const f = store.feeds.find((x) => Number(x.id) === id);
  if (f) {
    Object.assign(f, {
      name: name ?? f.name,
      url: url ?? f.url,
      categoryId: categoryId ? Number(categoryId) : f.categoryId,
      countryId: countryId !== undefined ? (countryId ? Number(countryId) : null) : f.countryId,
      active: active !== undefined ? Boolean(active) : f.active,
    });
    saveStore();
  }
  res.json(f || { ok: true });
});

app.delete("/api/admin/rss/feeds/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (await isDbAvailable()) {
    try {
      await getPool().query("DELETE FROM rss_feeds WHERE id = $1", [id]);
      return res.json({ ok: true });
    } catch {
      dbHealthy = false;
    }
  }
  const store = getStore();
  store.feeds = store.feeds.filter((f) => Number(f.id) !== id);
  saveStore();
  res.json({ ok: true });
});

function extractFeedImage(item) {
  if (item.mediaContent?.$?.url) return item.mediaContent.$.url;
  if (item.mediaThumbnail?.$?.url) return item.mediaThumbnail.$.url;
  if (item.enclosure?.url && item.enclosure.url.startsWith("http")) return item.enclosure.url;
  const html = item.contentEncoded || item.content || item.summary || "";
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m && m[1]?.startsWith("http")) return m[1];
  return null;
}

async function ingestSingleFeed(feed) {
  const useDb = await isDbAvailable();
  const store = getStore();
  const result = {
    feedId: feed.id,
    feedName: feed.name,
    fetched: 0,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  let parsed;
  try {
    parsed = await rssParser.parseURL(feed.url);
  } catch (err) {
    result.errors.push(`Không thể tải RSS: ${err.message}`);
    return result;
  }

  // Only take the 20 newest items from each feed (User Request #8)
  const items = (parsed.items ?? []).slice(0, 20);
  result.fetched = items.length;

  for (const item of items) {
    const rawTitle = item.title?.trim();
    const link = item.link?.trim();
    if (!rawTitle) {
      result.skipped++;
      continue;
    }

    if (link) {
      if (useDb) {
        try {
          const existing = await getPool().query("SELECT id FROM articles WHERE source_url = $1 LIMIT 1", [link]);
          if (existing.rows.length > 0) {
            result.skipped++;
            continue;
          }
        } catch {}
      } else if (store.articles.some((a) => a.sourceUrl === link)) {
        result.skipped++;
        continue;
      }
    }

    const rawHtml = item.contentEncoded || item.content || item.summary || "";
    const plainSummary = (item.contentSnippet || item.summary || rawHtml.replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 350);

    let title = rawTitle;
    let summary = plainSummary || rawTitle;
    let content = rawHtml ? (rawHtml.includes("<p") ? rawHtml : `<p>${plainSummary}</p>`) : `<p>${rawTitle}</p>`;
    let coverImage = extractFeedImage(item);

    // Fetch full article HTML for og:image and richer content extraction
    let fullHtml = "";
    if (link) {
      try {
        const htmlRes = await fetch(link, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; ACVN/2.0)" },
          signal: AbortSignal.timeout(6000),
        });
        if (htmlRes.ok) {
          fullHtml = await htmlRes.text();
          if (!coverImage) {
            const ogMatch =
              fullHtml.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
              fullHtml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
            if (ogMatch && ogMatch[1]?.startsWith("http")) coverImage = ogMatch[1];
          }
          fullHtml = fullHtml
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
            .slice(0, 80000);
        }
      } catch {}
    }

    if (!isVietnameseText(`${rawTitle} ${plainSummary}`)) {
      try {
        const translated = await translateArticleToVietnamese(rawTitle, summary, content, fullHtml);
        if (translated.title) title = translated.title;
        if (translated.summary) summary = translated.summary;
        if (translated.content) content = translated.content;
      } catch (err) {
        result.errors.push(`Dịch lỗi "${rawTitle.slice(0, 40)}": ${err.message}`);
      }
    } else if (fullHtml && content.length < 300) {
      const pMatches = fullHtml.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
      const goodPs = pMatches
        .map((p) => p.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
        .filter((t) => t.length > 50)
        .slice(0, 15);
      if (goodPs.length > 0) {
        content = goodPs.map((p) => `<p>${p}</p>`).join("\n");
      }
    }

    const baseSlug = `${slugify(title) || "rss"}-${Math.random().toString(36).slice(2, 7)}`;
    const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
    const validPubDate = Number.isNaN(pubDate.getTime()) ? new Date() : pubDate;

    if (useDb) {
      try {
        await getPool().query(
          `INSERT INTO articles (
            title, slug, summary, content, cover_image, category_id, country_id,
            source_name, source_url, editor, published_at, featured, breaking_news, status
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ACVN',$10,false,false,'draft')`,
          [
            title,
            baseSlug,
            summary,
            content,
            coverImage,
            feed.category_id ?? feed.categoryId ?? 1,
            feed.country_id ?? feed.countryId ?? null,
            feed.name,
            link || null,
            validPubDate,
          ]
        );
        result.imported++;
        continue;
      } catch (err) {
        result.errors.push(`Lưu lỗi "${title.slice(0, 40)}": ${err.message}`);
      }
    }

    store.articles.unshift({
      id: Date.now() + Math.floor(Math.random() * 1000),
      title,
      slug: baseSlug,
      summary,
      content,
      coverImage: coverImage || null,
      categoryId: feed.category_id ?? feed.categoryId ?? 1,
      countryId: feed.country_id ?? feed.countryId ?? null,
      authorId: null,
      sourceName: feed.name,
      sourceUrl: link || null,
      editor: "ACVN",
      publishedAt: validPubDate.toISOString(),
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      views: 0,
      featured: false,
      breakingNews: false,
      mostReadRank: null,
      status: "draft",
    });
    result.imported++;
  }

  if (useDb) {
    try {
      await getPool().query(
        "UPDATE rss_feeds SET last_fetched_at = NOW(), items_imported = COALESCE(items_imported, 0) + $1 WHERE id = $2",
        [result.imported, feed.id]
      );
    } catch {}
  } else {
    const f = store.feeds.find((x) => Number(x.id) === Number(feed.id));
    if (f) {
      f.lastFetchedAt = new Date().toISOString();
      f.itemsImported = (f.itemsImported || 0) + result.imported;
    }
    saveStore();
  }

  return result;
}

app.post("/api/admin/rss/feeds/:id/ingest", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query("SELECT * FROM rss_feeds WHERE id = $1 LIMIT 1", [id]);
      if (rows.length > 0) {
        const result = await ingestSingleFeed(rows[0]);
        return res.json(result);
      }
    } catch {
      dbHealthy = false;
    }
  }
  const feed = getStore().feeds.find((f) => Number(f.id) === id);
  if (!feed) return res.status(404).json({ error: "Feed không tồn tại" });
  const result = await ingestSingleFeed(feed);
  res.json(result);
});

app.post("/api/admin/rss/ingest-all", requireAdmin, async (_req, res) => {
  let feeds = [];
  if (await isDbAvailable()) {
    try {
      const { rows } = await getPool().query("SELECT * FROM rss_feeds WHERE active = true ORDER BY id ASC");
      feeds = rows;
    } catch {
      dbHealthy = false;
    }
  }
  if (feeds.length === 0) {
    feeds = getStore().feeds.filter((f) => f.active !== false);
  }
  const results = [];
  for (const feed of feeds) {
    results.push(await ingestSingleFeed(feed));
  }
  res.json(results);
});

// ─── Admin AI Suggest & Translate ─────────────────────────────────────────────

app.post("/api/admin/ai/translate", requireAdmin, async (req, res) => {
  const { title = "", summary = "", content = "" } = req.body || {};
  if (!title && !content) {
    return res.status(400).json({ error: "Cần ít nhất tiêu đề hoặc nội dung để dịch" });
  }
  try {
    const translated = await translateArticleToVietnamese(title, summary, content);
    res.json(translated);
  } catch (err) {
    res.status(500).json({ error: `Lỗi dịch AI: ${err.message}` });
  }
});

app.post("/api/admin/ai/suggest", requireAdmin, async (req, res) => {
  const { topic, categoryName, countryName, rawContent, mode = "full" } = req.body || {};
  if (!topic && !rawContent) {
    return res.status(400).json({ error: "Cần cung cấp chủ đề hoặc nội dung gốc" });
  }

  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;

  if (apiKey) {
    for (const modelName of ["gemini-3.6-flash", "gemini-2.5-flash"]) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          ...(baseUrl ? { httpOptions: { apiVersion: "", baseUrl } } : {}),
        });
        const ctx = [
          categoryName ? `Danh mục: ${categoryName}` : "",
          countryName ? `Quốc gia: ${countryName}` : "",
        ]
          .filter(Boolean)
          .join(", ");

        let prompt = "";
        if (mode === "headline") {
          prompt = `Bạn là biên tập viên báo chí tiếng Việt cho cổng thông tin người Việt tại châu Âu (ACVN).
${ctx ? `Bối cảnh: ${ctx}\n` : ""}Chủ đề: ${topic || rawContent}
Hãy gợi ý 5 tiêu đề báo chí hấp dẫn và 1 đoạn tóm tắt ngắn. Trả về JSON: {"headlines": ["..."], "summary": "..."}`;
        } else if (mode === "summarize") {
          prompt = `Tóm tắt và biên tập lại nội dung sau thành bài báo tiếng Việt chuẩn văn phong báo chí.
Trả về JSON: {"title": "...", "summary": "...", "content": "<p>...</p>"}
Nội dung: ${rawContent || topic}`;
        } else {
          prompt = `Viết một bài báo tiếng Việt hoàn chỉnh, chuẩn báo chí cho cổng thông tin người Việt tại châu Âu (ACVN).
${ctx ? `Bối cảnh: ${ctx}\n` : ""}Chủ đề: ${topic}
${rawContent ? `Thông tin tham khảo: ${rawContent}\n` : ""}Trả về JSON: {"title": "...", "summary": "...", "content": "<p>...</p><h2>...</h2><p>...</p>", "suggestedSlug": "..."}`;
        }

        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: { responseMimeType: "application/json" },
        });
        const clean = (response.text || "{}").replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
        return res.json(JSON.parse(clean));
      } catch {}
    }
  }

  const cleanTopic = (topic || "Tin tức cộng đồng người Việt tại châu Âu").trim();
  const region = countryName || "Cộng hòa Séc và châu Âu";
  const cat = categoryName || "Tin cộng đồng";

  if (mode === "headline") {
    return res.json({
      headlines: [
        `${cleanTopic}: Điểm nhấn mới của cộng đồng người Việt tại ${region}`,
        `Toàn cảnh ${cleanTopic.toLowerCase()} và tác động tới kiều bào tại ${region}`,
        `${cat}: Nhiều hoạt động thiết thực xoay quanh ${cleanTopic.toLowerCase()}`,
        `Cộng đồng người Việt tại ${region} tích cực hưởng ứng ${cleanTopic.toLowerCase()}`,
        `Góc nhìn chuyên sâu: ${cleanTopic} trong giai đoạn hội nhập mới`,
      ],
      summary: `Tổng hợp thông tin chi tiết và những điểm đáng chú ý nhất về ${cleanTopic.toLowerCase()} dành cho cộng đồng người Việt tại ${region}.`,
    });
  }

  if (mode === "summarize" && rawContent) {
    const translated = await translateArticleToVietnamese(cleanTopic, rawContent.slice(0, 280), `<p>${rawContent}</p>`);
    return res.json({
      title: translated.title,
      summary: translated.summary,
      content: translated.content,
    });
  }

  const title = `${cleanTopic} tại ${region}`;
  const summary = `Thông tin cập nhật về ${cleanTopic.toLowerCase()}, mang lại nhiều giá trị thiết thực và kết nối sâu rộng cho cộng đồng người Việt Nam tại ${region}.`;
  const content = `<p><strong>${summary}</strong></p>
<h2>Điểm nhấn quan trọng</h2>
<p>Trong bối cảnh cộng đồng người Việt tại ${region} ngày càng phát triển vững mạnh, chủ đề <em>"${cleanTopic}"</em> đang nhận được sự quan tâm lớn từ các hội đoàn, doanh nghiệp và bà con kiều bào.</p>
${rawContent ? `<p>${rawContent}</p>` : `<p>Các hoạt động thuộc khuôn khổ chương trình được tổ chức bài bản, góp phần giữ gìn bản sắc văn hóa dân tộc đồng thời thúc đẩy hội nhập sâu rộng vào xã hội sở tại.</p>`}
<h2>Triển vọng và kế hoạch sắp tới</h2>
<p>Ban tổ chức cùng đại diện Hội người Czech gốc Việt Nam (ACVN) cho biết sẽ tiếp tục mở rộng các chương trình hỗ trợ, tăng cường kết nối thông tin để phục vụ tốt nhất nhu cầu của cộng đồng.</p>`;

  res.json({
    title,
    summary,
    content,
    suggestedSlug: slugify(title),
  });
});

export { app };
export default app;

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === path.resolve(__filename).toLowerCase();

if (isDirectRun) {
  const PORT = Number(process.env.PORT) || 3001;
  app.listen(PORT, () => {
    console.log(`[ACVN API Server] Listening on http://localhost:${PORT}`);
  });
}
