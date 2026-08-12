/**
 * RSS Ingest Service
 * Fetches RSS/Atom feeds, translates to Vietnamese via OpenAI, saves as draft articles.
 */

import Parser from "rss-parser";
import { eq, inArray } from "drizzle-orm";
import { db, articlesTable, rssFeedsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";

const parser = new Parser({
  timeout: 10_000,
  headers: { "User-Agent": "VietPressEU/1.0 (+https://vietpress.eu)" },
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: false }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: false }],
      ["enclosure", "enclosure", { keepArray: false }],
    ],
  },
});

// ─── Vietnamese slug helper ───────────────────────────────────────────────────

const VI_MAP: Record<string, string> = {
  à:"a",á:"a",â:"a",ã:"a",ä:"a",è:"e",é:"e",ê:"e",ë:"e",ì:"i",í:"i",î:"i",ï:"i",
  ò:"o",ó:"o",ô:"o",õ:"o",ö:"o",ù:"u",ú:"u",û:"u",ü:"u",ý:"y",ÿ:"y",đ:"d",
  ă:"a",ắ:"a",ặ:"a",ẵ:"a",ẳ:"a",ằ:"a",ấ:"a",ầ:"a",ẩ:"a",ẫ:"a",ậ:"a",
  ế:"e",ề:"e",ể:"e",ễ:"e",ệ:"e",ố:"o",ồ:"o",ổ:"o",ỗ:"o",ộ:"o",
  ớ:"o",ờ:"o",ở:"o",ỡ:"o",ợ:"o",ứ:"u",ừ:"u",ử:"u",ữ:"u",ự:"u",ơ:"o",ư:"u",
  ả:"a",ạ:"a",ẻ:"e",ẽ:"e",ẹ:"e",ỉ:"i",ĩ:"i",ị:"i",ỏ:"o",ọ:"o",ủ:"u",ũ:"u",ụ:"u",
  ỳ:"y",ỷ:"y",ỹ:"y",ỵ:"y",
};

function slugify(text: string): string {
  return text.toLowerCase().split("").map((c) => VI_MAP[c] ?? c).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
}

// ─── Strip HTML tags from feed description ────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1000);
}

// ─── Extract cover image from RSS item ───────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractImageUrl(item: Record<string, any>): string | null {
  // 1. media:content (most common in modern feeds)
  const mc = item.mediaContent ?? item["media:content"];
  if (mc) {
    const url = mc?.$ ?.url ?? mc?.url ?? (Array.isArray(mc) ? mc[0]?.$ ?.url : null);
    if (typeof url === "string" && url.startsWith("http")) return url;
  }

  // 2. media:thumbnail
  const mt = item.mediaThumbnail ?? item["media:thumbnail"];
  if (mt) {
    const url = mt?.$ ?.url ?? mt?.url ?? (Array.isArray(mt) ? mt[0]?.$ ?.url : null);
    if (typeof url === "string" && url.startsWith("http")) return url;
  }

  // 3. enclosure (standard RSS podcasts / images)
  const enc = item.enclosure;
  if (enc) {
    const url = enc?.url ?? enc?.$ ?.url;
    const type: string = enc?.type ?? enc?.$ ?.type ?? "";
    if (typeof url === "string" && url.startsWith("http") && type.startsWith("image")) return url;
  }

  // 4. itunes:image
  const itunes = item["itunes:image"] ?? item.itunesImage;
  if (typeof itunes === "string" && itunes.startsWith("http")) return itunes;
  if (itunes?.href?.startsWith("http")) return itunes.href as string;

  // 5. Parse first <img src="…"> from HTML content/description
  const html = item.content ?? item["content:encoded"] ?? item.summary ?? "";
  const match = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  if (match?.[1]?.startsWith("http")) return match[1];

  return null;
}

// ─── Translate one RSS item to Vietnamese ─────────────────────────────────────

type TranslateResult = {
  title: string;
  summary: string;
  content: string;
  slug: string;
};

async function translateItem(
  originalTitle: string,
  originalDescription: string,
  sourceName: string,
): Promise<TranslateResult> {
  const prompt = `Nguồn: ${sourceName}
Tiêu đề gốc: ${originalTitle}
Mô tả gốc: ${originalDescription}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.6-luna",
    max_completion_tokens: 1024,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Bạn là biên tập viên của VietPress EU, tờ báo tiếng Việt dành cho cộng đồng người Việt tại châu Âu.
Dựa trên tiêu đề và mô tả gốc (tiếng Séc, Anh, hoặc ngôn ngữ khác), hãy:
1. Dịch và viết lại tiêu đề thành tiếng Việt — hấp dẫn, ngắn gọn
2. Viết tóm tắt 2 câu bằng tiếng Việt  
3. Viết nội dung bài HTML (3-4 đoạn, ~200 từ) dựa trên thông tin đã có — giữ tên riêng, địa danh, số liệu nguyên bản
4. Đề xuất slug URL

Trả về JSON:
{
  "title": "Tiêu đề tiếng Việt",
  "summary": "Tóm tắt 2 câu tiếng Việt",
  "content": "<p>Nội dung HTML...</p>",
  "slug": "tieu-de-slug"
}`,
      },
      { role: "user", content: prompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as Partial<TranslateResult>;

  const title = parsed.title ?? originalTitle;
  return {
    title,
    summary: parsed.summary ?? "",
    content: parsed.content ?? `<p>${originalDescription}</p>`,
    slug: parsed.slug ?? slugify(title),
  };
}

// ─── Make slug unique ─────────────────────────────────────────────────────────

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let attempt = 0;
  while (true) {
    const existing = await db
      .select({ id: articlesTable.id })
      .from(articlesTable)
      .where(eq(articlesTable.slug, slug))
      .limit(1);
    if (!existing.length) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
}

// ─── Main ingest function ─────────────────────────────────────────────────────

export type IngestResult = {
  feedId: number;
  feedName: string;
  fetched: number;
  skipped: number;
  imported: number;
  errors: string[];
};

export async function ingestFeed(feedId: number): Promise<IngestResult> {
  const [feed] = await db
    .select()
    .from(rssFeedsTable)
    .where(eq(rssFeedsTable.id, feedId))
    .limit(1);

  if (!feed) throw new Error(`Feed ${feedId} not found`);

  const result: IngestResult = {
    feedId: feed.id,
    feedName: feed.name,
    fetched: 0,
    skipped: 0,
    imported: 0,
    errors: [],
  };

  let parsed;
  try {
    parsed = await parser.parseURL(feed.url);
  } catch (err) {
    throw new Error(`Cannot fetch RSS: ${(err as Error).message}`);
  }

  // Only keep items published within the last 24 hours
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const todayItems = parsed.items.filter((i) => {
    if (!i.isoDate) return false; // no date → skip
    return new Date(i.isoDate) >= cutoff;
  });

  const items = todayItems.slice(0, 20); // max 20 per run
  result.fetched = items.length;

  // Collect all source URLs to dedup in one query
  const sourceUrls = items.map((i) => i.link ?? i.guid ?? "").filter(Boolean);
  const existing = await db
    .select({ sourceUrl: articlesTable.sourceUrl })
    .from(articlesTable)
    .where(inArray(articlesTable.sourceUrl, sourceUrls));
  const existingUrls = new Set(existing.map((r) => r.sourceUrl));

  for (const item of items) {
    const sourceUrl = item.link ?? item.guid ?? "";
    if (!sourceUrl || existingUrls.has(sourceUrl)) {
      result.skipped++;
      continue;
    }

    const originalTitle = item.title ?? "";
    const originalDesc = stripHtml(item.contentSnippet ?? item.content ?? item.summary ?? "");

    if (!originalTitle) {
      result.skipped++;
      continue;
    }

    try {
      const translated = await translateItem(originalTitle, originalDesc, feed.name);
      const slug = await uniqueSlug(translated.slug);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const coverImage = extractImageUrl(item as Record<string, any>);

      await db.insert(articlesTable).values({
        title: translated.title,
        slug,
        summary: translated.summary,
        content: translated.content,
        coverImage,
        categoryId: feed.categoryId,
        countryId: feed.countryId ?? null,
        sourceName: feed.name,
        sourceUrl,
        status: "draft",
        publishedAt: item.isoDate ? new Date(item.isoDate) : null,
        editor: "ACVN",
        tags: [],
        featured: false,
        breakingNews: false,
        views: 0,
      });

      existingUrls.add(sourceUrl); // prevent double-insert in same run
      result.imported++;
    } catch (err) {
      result.errors.push(`${originalTitle.slice(0, 60)}: ${(err as Error).message}`);
    }
  }

  // Update lastFetchedAt and itemsImported
  await db
    .update(rssFeedsTable)
    .set({
      lastFetchedAt: new Date(),
      itemsImported: feed.itemsImported + result.imported,
    })
    .where(eq(rssFeedsTable.id, feedId));

  return result;
}

export async function ingestAllFeeds(): Promise<IngestResult[]> {
  const feeds = await db
    .select({ id: rssFeedsTable.id })
    .from(rssFeedsTable)
    .where(eq(rssFeedsTable.active, true));

  const results: IngestResult[] = [];
  for (const { id } of feeds) {
    try {
      results.push(await ingestFeed(id));
    } catch (err) {
      results.push({
        feedId: id, feedName: `Feed #${id}`,
        fetched: 0, skipped: 0, imported: 0,
        errors: [(err as Error).message],
      });
    }
  }
  return results;
}
