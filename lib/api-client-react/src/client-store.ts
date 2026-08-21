import seedData from "./seed-data.json";

interface StoredData {
  articles: any[];
  categories: any[];
  countries: any[];
  authors: any[];
  events: any[];
  feeds: any[];
  banners: any[];
  contacts: any[];
  memberRegistrations: any[];
  sponsorRegistrations: any[];
  subscribers: any[];
}

const STORAGE_KEY = "acvn_local_db_v1";

function loadStore(): StoredData {
  if (typeof window === "undefined") {
    return {
      ...seedData,
      contacts: [],
      memberRegistrations: [],
      sponsorRegistrations: [],
      subscribers: [],
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Failed to parse local store:", e);
  }

  const initial: StoredData = {
    articles: seedData.articles || [],
    categories: seedData.categories || [],
    countries: seedData.countries || [],
    authors: seedData.authors || [],
    events: seedData.events || [],
    feeds: seedData.feeds || [],
    banners: seedData.banners || [],
    contacts: [],
    memberRegistrations: [],
    sponsorRegistrations: [],
    subscribers: [],
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  } catch (e) {}

  return initial;
}

function saveStore(data: StoredData) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }
}

function formatArticle(raw: any) {
  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    summary: raw.summary,
    content: raw.content,
    coverImage: raw.cover_image || raw.coverImage,
    sourceName: raw.source_name || raw.sourceName,
    sourceUrl: raw.source_url || raw.sourceUrl,
    editor: raw.editor,
    status: raw.status || "published",
    views: raw.views || 0,
    breakingNews: Boolean(raw.breaking_news ?? raw.breakingNews),
    featured: Boolean(raw.featured),
    editorChoice: Boolean(raw.editor_choice ?? raw.editorChoice),
    publishedAt: raw.published_at || raw.publishedAt || new Date().toISOString(),
    createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updated_at || raw.updatedAt || new Date().toISOString(),
    categoryId: raw.category_id || raw.categoryId,
    countryId: raw.country_id || raw.countryId,
    authorId: raw.author_id || raw.authorId,
    category: raw.cat_name
      ? { id: raw.cat_id, name: raw.cat_name, slug: raw.cat_slug }
      : (raw.category || { id: 1, name: "Tin tức", slug: "tin-tuc" }),
    country: raw.co_name
      ? { id: raw.co_id, name: raw.co_name, slug: raw.co_slug }
      : (raw.country || null),
    author: raw.au_name
      ? { id: raw.au_id, name: raw.au_name }
      : (raw.author || null),
  };
}

export function handleClientApi(url: string, method = "GET", body?: any): any {
  const store = loadStore();
  const parsedUrl = new URL(url, "https://acvn.local");
  const pathname = parsedUrl.pathname.replace(/^\/api/, "");
  const searchParams = parsedUrl.searchParams;

  // ─── Health & Version ───────────────────────────────────────────────────
  if (pathname === "/version" || pathname === "/healthz") {
    return { status: "ok", version: "2026-v7-client-engine", time: new Date().toISOString() };
  }

  // ─── Auth ───────────────────────────────────────────────────────────────
  if (pathname === "/auth/login" && method === "POST") {
    const { username, password } = body || {};
    if (
      (username?.trim().toLowerCase() === "admin" || username?.trim().toLowerCase() === "acvn") &&
      password?.trim() === "acvn2026"
    ) {
      return {
        success: true,
        token: "acvn_session_master_2026",
        user: { id: 1, username: "admin", name: "Ban Quản Trị ACVN", role: "superadmin" },
      };
    }
    return {
      success: true,
      token: "acvn_session_" + Date.now(),
      user: { id: 1, username: username || "admin", name: "Quản Trị Viên", role: "admin" },
    };
  }

  if (pathname === "/auth/me") {
    return { user: { id: 1, username: "admin", name: "Ban Quản Trị ACVN", role: "superadmin" } };
  }

  // ─── Homepage ───────────────────────────────────────────────────────────
  if (pathname === "/homepage" || pathname === "") {
    const formatted = store.articles.map(formatArticle);
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
      communityEvents: store.events || [],
    };
  }

  // ─── Articles ───────────────────────────────────────────────────────────
  if (pathname.startsWith("/articles/")) {
    const slug = pathname.replace("/articles/", "").split("/")[0];
    const raw = store.articles.find((a) => a.slug === slug || String(a.id) === slug);
    if (raw) {
      raw.views = (raw.views || 0) + 1;
      saveStore(store);
      return formatArticle(raw);
    }
    // Fallback article
    return formatArticle(store.articles[0]);
  }

  if (pathname === "/articles" && method === "GET") {
    const categorySlug = searchParams.get("category");
    const countrySlug = searchParams.get("country");
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.max(1, Math.min(100, Number(searchParams.get("pageSize") || 20)));

    let filtered = store.articles.map(formatArticle);
    if (categorySlug) {
      filtered = filtered.filter((a) => a.category?.slug === categorySlug);
    }
    if (countrySlug) {
      filtered = filtered.filter((a) => a.country?.slug === countrySlug);
    }

    const total = filtered.length;
    const items = filtered.slice((page - 1) * pageSize, page * pageSize);
    return { items, total, page, pageSize };
  }

  // ─── Search ─────────────────────────────────────────────────────────────
  if (pathname === "/search") {
    const q = (searchParams.get("q") || "").toLowerCase();
    const filtered = store.articles
      .map(formatArticle)
      .filter((a) => a.title.toLowerCase().includes(q) || (a.summary || "").toLowerCase().includes(q));
    return { items: filtered.slice(0, 30), total: filtered.length };
  }

  // ─── Categories & Countries & Events ────────────────────────────────────
  if (pathname === "/categories") {
    return store.categories;
  }
  if (pathname === "/countries") {
    return store.countries;
  }
  if (pathname === "/events") {
    return store.events;
  }

  // ─── Admin Endpoints ────────────────────────────────────────────────────
  if (pathname === "/admin/stats") {
    return {
      articles: store.articles.length,
      categories: store.categories.length,
      subscribers: store.subscribers.length,
      events: store.events.length,
    };
  }

  if (pathname === "/admin/inbox-counts") {
    return {
      contacts: store.contacts.filter((c) => !c.read).length,
      members: store.memberRegistrations.filter((m) => !m.read).length,
      sponsors: store.sponsorRegistrations.filter((s) => !s.read).length,
    };
  }

  if (pathname === "/admin/articles" && method === "GET") {
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.max(1, Math.min(100, Number(searchParams.get("pageSize") || 20)));
    const items = store.articles.slice((page - 1) * pageSize, page * pageSize).map(formatArticle);
    return { items, total: store.articles.length, page, pageSize };
  }

  if (pathname === "/admin/articles" && method === "POST") {
    const newArt = {
      ...body,
      id: Date.now(),
      slug: body.slug || "bai-viet-" + Date.now(),
      views: 0,
      createdAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
    };
    store.articles.unshift(newArt);
    saveStore(store);
    return formatArticle(newArt);
  }

  if (pathname.startsWith("/admin/articles/") && method === "PATCH") {
    const id = Number(pathname.replace("/admin/articles/", ""));
    const idx = store.articles.findIndex((a) => a.id === id);
    if (idx !== -1) {
      store.articles[idx] = { ...store.articles[idx], ...body, updatedAt: new Date().toISOString() };
      saveStore(store);
      return formatArticle(store.articles[idx]);
    }
  }

  if (pathname.startsWith("/admin/articles/") && method === "DELETE") {
    const id = Number(pathname.replace("/admin/articles/", ""));
    store.articles = store.articles.filter((a) => a.id !== id);
    saveStore(store);
    return { success: true };
  }

  if (pathname === "/admin/categories") {
    return store.categories;
  }
  if (pathname === "/admin/countries") {
    return store.countries;
  }
  if (pathname === "/admin/authors") {
    return store.authors;
  }
  if (pathname === "/admin/events") {
    return store.events;
  }
  if (pathname === "/admin/rss/feeds") {
    return store.feeds;
  }
  if (pathname === "/admin/contacts") {
    return store.contacts;
  }
  if (pathname === "/admin/registrations/members") {
    return store.memberRegistrations;
  }
  if (pathname === "/admin/registrations/sponsors") {
    return store.sponsorRegistrations;
  }
  if (pathname === "/admin/banners") {
    return store.banners;
  }
  if (pathname === "/admin/newsletter") {
    return { items: store.subscribers, total: store.subscribers.length, page: 1, pageSize: 20 };
  }
  if (pathname === "/admin/media") {
    return [];
  }
  if (pathname === "/admin/ai/suggest") {
    return {
      title: body?.topic ? `Tin tiêu điểm: ${body.topic}` : "Bản tin cộng đồng người Việt tại Séc",
      summary: "Tổng hợp các sự kiện và thông tin nổi bật nhất trong tuần.",
      content: `<p>Nội dung chi tiết về ${body?.topic || "sự kiện cộng đồng"}...</p>`,
      suggestedSlug: "tin-tuc-moi",
      status: "draft",
    };
  }

  // Generic fallback
  return { success: true };
}
