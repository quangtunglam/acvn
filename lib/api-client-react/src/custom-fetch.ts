export type CustomFetchOptions = RequestInit & {
  responseType?: "json" | "text" | "blob" | "auto";
};

export type ErrorType<T = unknown> = ApiError<T>;

export type BodyType<T> = T;

export type AuthTokenGetter = () => Promise<string | null> | string | null;

const NO_BODY_STATUS = new Set([204, 205, 304]);
const DEFAULT_JSON_ACCEPT = "application/json, application/problem+json";

// ---------------------------------------------------------------------------
// Module-level configuration
// ---------------------------------------------------------------------------

let _baseUrl: string | null = null;
let _authTokenGetter: AuthTokenGetter | null = null;

/**
 * Set a base URL that is prepended to every relative request URL
 * (i.e. paths that start with `/`).
 *
 * Useful for Expo bundles that need to call a remote API server.
 * Pass `null` to clear the base URL.
 */
export function setBaseUrl(url: string | null): void {
  _baseUrl = url ? url.replace(/\/+$/, "") : null;
}

/**
 * Register a getter that supplies a bearer auth token.  Before every fetch
 * the getter is invoked; when it returns a non-null string, an
 * `Authorization: Bearer <token>` header is attached to the request.
 *
 * Useful for Expo bundles making token-gated API calls.
 * Pass `null` to clear the getter.
 *
 * NOTE: This function should never be used in web applications where session
 * token cookies are automatically associated with API calls by the browser.
 */
export function setAuthTokenGetter(getter: AuthTokenGetter | null): void {
  _authTokenGetter = getter;
}

function isRequest(input: RequestInfo | URL): input is Request {
  return typeof Request !== "undefined" && input instanceof Request;
}

function resolveMethod(input: RequestInfo | URL, explicitMethod?: string): string {
  if (explicitMethod) return explicitMethod.toUpperCase();
  if (isRequest(input)) return input.method.toUpperCase();
  return "GET";
}

// Use loose check for URL — some runtimes (e.g. React Native) polyfill URL
// differently, so `instanceof URL` can fail.
function isUrl(input: RequestInfo | URL): input is URL {
  return typeof URL !== "undefined" && input instanceof URL;
}

function applyBaseUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (!_baseUrl) return input;
  const url = resolveUrl(input);
  // Only prepend to relative paths (starting with /)
  if (!url.startsWith("/")) return input;

  const absolute = `${_baseUrl}${url}`;
  if (typeof input === "string") return absolute;
  if (isUrl(input)) return new URL(absolute);
  return new Request(absolute, input as Request);
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (isUrl(input)) return input.toString();
  return input.url;
}

function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers();

  for (const source of sources) {
    if (!source) continue;
    new Headers(source).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

function getMediaType(headers: Headers): string | null {
  const value = headers.get("content-type");
  return value ? value.split(";", 1)[0].trim().toLowerCase() : null;
}

function isJsonMediaType(mediaType: string | null): boolean {
  return mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"));
}

function isTextMediaType(mediaType: string | null): boolean {
  return Boolean(
    mediaType &&
      (mediaType.startsWith("text/") ||
        mediaType === "application/xml" ||
        mediaType === "text/xml" ||
        mediaType.endsWith("+xml") ||
        mediaType === "application/x-www-form-urlencoded"),
  );
}

// Use strict equality: in browsers, `response.body` is `null` when the
// response genuinely has no content.  In React Native, `response.body` is
// always `undefined` because the ReadableStream API is not implemented —
// even when the response carries a full payload readable via `.text()` or
// `.json()`.  Loose equality (`== null`) matches both `null` and `undefined`,
// which causes every React Native response to be treated as empty.
function hasNoBody(response: Response, method: string): boolean {
  if (method === "HEAD") return true;
  if (NO_BODY_STATUS.has(response.status)) return true;
  if (response.headers.get("content-length") === "0") return true;
  if (response.body === null) return true;
  return false;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function getStringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;

  const candidate = (value as Record<string, unknown>)[key];
  if (typeof candidate !== "string") return undefined;

  const trimmed = candidate.trim();
  return trimmed === "" ? undefined : trimmed;
}

function truncate(text: string, maxLength = 300): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function buildErrorMessage(response: Response, data: unknown): string {
  const prefix = `HTTP ${response.status} ${response.statusText}`;

  if (typeof data === "string") {
    const text = data.trim();
    return text ? `${prefix}: ${truncate(text)}` : prefix;
  }

  const title = getStringField(data, "title");
  const detail = getStringField(data, "detail");
  const message =
    getStringField(data, "message") ??
    getStringField(data, "error_description") ??
    getStringField(data, "error");

  if (title && detail) return `${prefix}: ${title} — ${detail}`;
  if (detail) return `${prefix}: ${detail}`;
  if (message) return `${prefix}: ${message}`;
  if (title) return `${prefix}: ${title}`;

  return prefix;
}

export class ApiError<T = unknown> extends Error {
  readonly name = "ApiError";
  readonly status: number;
  readonly statusText: string;
  readonly data: T | null;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;

  constructor(
    response: Response,
    data: T | null,
    requestInfo: { method: string; url: string },
  ) {
    super(buildErrorMessage(response, data));
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.data = data;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
  }
}

export class ResponseParseError extends Error {
  readonly name = "ResponseParseError";
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;
  readonly rawBody: string;
  readonly cause: unknown;

  constructor(
    response: Response,
    rawBody: string,
    cause: unknown,
    requestInfo: { method: string; url: string },
  ) {
    super(
      `Failed to parse response from ${requestInfo.method} ${response.url || requestInfo.url} ` +
        `(${response.status} ${response.statusText}) as JSON`,
    );
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
    this.rawBody = rawBody;
    this.cause = cause;
  }
}

async function parseJsonBody(
  response: Response,
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  const raw = await response.text();
  const normalized = stripBom(raw);

  if (normalized.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(normalized);
  } catch (cause) {
    throw new ResponseParseError(response, raw, cause, requestInfo);
  }
}

async function parseErrorBody(response: Response, method: string): Promise<unknown> {
  if (hasNoBody(response, method)) {
    return null;
  }

  const mediaType = getMediaType(response.headers);

  // Fall back to text when blob() is unavailable (e.g. some React Native builds).
  if (mediaType && !isJsonMediaType(mediaType) && !isTextMediaType(mediaType)) {
    return typeof response.blob === "function" ? response.blob() : response.text();
  }

  const raw = await response.text();
  const normalized = stripBom(raw);
  const trimmed = normalized.trim();

  if (trimmed === "") {
    return null;
  }

  if (isJsonMediaType(mediaType) || looksLikeJson(normalized)) {
    try {
      return JSON.parse(normalized);
    } catch {
      return raw;
    }
  }

  return raw;
}

function inferResponseType(response: Response): "json" | "text" | "blob" {
  const mediaType = getMediaType(response.headers);

  if (isJsonMediaType(mediaType)) return "json";
  if (isTextMediaType(mediaType) || mediaType == null) return "text";
  return "blob";
}

async function parseSuccessBody(
  response: Response,
  responseType: "json" | "text" | "blob" | "auto",
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  if (hasNoBody(response, requestInfo.method)) {
    return null;
  }

  const effectiveType =
    responseType === "auto" ? inferResponseType(response) : responseType;

  switch (effectiveType) {
    case "json":
      return parseJsonBody(response, requestInfo);

    case "text": {
      const text = await response.text();
      return text === "" ? null : text;
    }

    case "blob":
      if (typeof response.blob !== "function") {
        throw new TypeError(
          "Blob responses are not supported in this runtime. " +
            "Use responseType \"json\" or \"text\" instead.",
        );
      }
      return response.blob();
  }
}

import { rawSeed } from "./seed-data";

function getMockResponse(urlStr: string, method: string): unknown {
  try {
    const url = new URL(urlStr, "https://acvn.local");
    const path = url.pathname;

    const getCat = (id: number | null) =>
      rawSeed.categories.find((c) => c.id === id) || {
        id: id || 1,
        name: "Tin tức",
        slug: "tin-tuc",
        description: null,
      };
    const getCnt = (id: number | null) => {
      const c = rawSeed.countries.find((cnt) => cnt.id === id);
      return c ? { id: c.id, name: c.name, slug: c.slug, code: c.code } : null;
    };
    const getAut = (id: number | null) => {
      const a = rawSeed.authors.find((aut) => aut.id === id);
      return a ? { id: a.id, name: a.name, bio: a.bio, avatar: a.avatar } : null;
    };
    const mapArt = (a: (typeof rawSeed.articles)[0]) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      summary: a.summary,
      content: a.content,
      coverImage: a.cover_image,
      category: {
        id: getCat(a.category_id).id,
        name: getCat(a.category_id).name,
        slug: getCat(a.category_id).slug,
        description: getCat(a.category_id).description ?? null,
      },
      country: a.country_id ? getCnt(a.country_id) : null,
      author: a.author_id ? getAut(a.author_id) : null,
      sourceName: a.source_name,
      sourceUrl: a.source_url,
      editor: a.editor,
      publishedAt: a.published_at ? new Date(a.published_at) : null,
      status: a.status || "published",
      featured: Boolean(a.featured),
      breakingNews: Boolean(a.breaking_news),
      views: a.views || 0,
    });

    if (path.endsWith("/api/homepage") || path === "/api/homepage") {
      const all = rawSeed.articles.map(mapArt);
      const breakingNews = all.filter((a) => a.breakingNews);
      const featuredList = all.find((a) => a.featured) || all[0] || null;
      const mostRead = all.slice().sort((a, b) => b.views - a.views).slice(0, 5);
      const selected = all.filter((a) => a.featured).slice(0, 8);
      const vietnam = all.filter((a) => a.country?.slug === "viet-nam").slice(0, 6);
      const world = all.filter((a) => a.category?.slug === "tin-the-gioi").slice(0, 6);
      const business = all.filter((a) => a.category?.slug === "kinh-doanh").slice(0, 8);
      const features = all.filter((a) => a.category?.slug === "chuyen-dau-tu").slice(0, 8);
      const activities = all.filter((a) => a.category?.slug === "cong-dong").slice(0, 6);
      const communityEvents = rawSeed.events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        startDate: e.start_date ? new Date(e.start_date) : new Date(),
        endDate: e.end_date ? new Date(e.end_date) : null,
        location: e.location,
        image: e.image,
        registrationUrl: e.registration_url,
        eventType: e.event_type,
        createdAt: e.created_at ? new Date(e.created_at) : new Date(),
        updatedAt: e.updated_at ? new Date(e.updated_at) : new Date(),
      }));
      const euCountries: Record<string, ReturnType<typeof mapArt>[]> = {};
      for (const slug of ["cong-hoa-sec", "slovakia", "ba-lan", "duc"]) {
        euCountries[slug] = all.filter((a) => a.country?.slug === slug).slice(0, 6);
      }
      return {
        breakingNews,
        featured: featuredList,
        mostRead,
        selected,
        euCountries,
        vietnam,
        world,
        business,
        features,
        activities,
        communityEvents,
      };
    }

    if (path.includes("/api/articles/")) {
      const slug = path.split("/api/articles/")[1]?.split("/")[0];
      const found = rawSeed.articles.find((a) => a.slug === slug);
      if (found) return mapArt(found);
    }

    if (path.endsWith("/api/articles") || path === "/api/articles") {
      const cat = url.searchParams.get("category");
      const cnt = url.searchParams.get("country");
      let list = rawSeed.articles.map(mapArt);
      if (cat) list = list.filter((a) => a.category.slug === cat);
      if (cnt) list = list.filter((a) => a.country?.slug === cnt);
      return { items: list.slice(0, 12), total: list.length, page: 1, pageSize: 12 };
    }

    if (path.includes("/categories")) {
      return rawSeed.categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description ?? null,
        parentId: null,
      }));
    }

    if (path.includes("/countries")) {
      return rawSeed.countries.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        code: c.code ?? null,
      }));
    }

    if (path.includes("/authors")) {
      return rawSeed.authors.map((a) => ({
        id: a.id,
        name: a.name,
        bio: a.bio ?? null,
        avatar: a.avatar ?? null,
      }));
    }

    if (path.includes("/rss/feeds")) {
      return [];
    }

    if (path.includes("/events")) {
      return rawSeed.events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        startDate: e.start_date ? new Date(e.start_date) : new Date(),
        endDate: e.end_date ? new Date(e.end_date) : null,
        location: e.location,
        image: e.image,
        registrationUrl: e.registration_url,
        eventType: e.event_type,
        createdAt: e.created_at ? new Date(e.created_at) : new Date(),
        updatedAt: e.updated_at ? new Date(e.updated_at) : new Date(),
      }));
    }

    if (path.includes("/forex")) {
      return { usd: 23.5, eur: 25.2, ts: Date.now() };
    }

    if (path.includes("/admin/stats")) {
      return {
        articles: rawSeed.articles.length,
        categories: rawSeed.categories.length,
        subscribers: 12,
        events: rawSeed.events.length,
      };
    }

    if (path.includes("/api/admin/inbox-counts")) {
      return { contacts: 0, members: 0, sponsors: 0 };
    }

    if (path.includes("/api/admin/articles") || path.includes("/admin/articles")) {
      return {
        items: rawSeed.articles.slice(0, 20).map(mapArt),
        total: rawSeed.articles.length,
        page: 1,
        pageSize: 20,
      };
    }

    if (path.includes("/api/admin/contacts") || path.includes("/contacts")) {
      return [];
    }

    if (path.includes("/api/admin/registrations") || path.includes("/registrations")) {
      return [];
    }

    if (path.includes("/api/admin/newsletter") || path.includes("/newsletter")) {
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }

    if (path.includes("/api/admin/banners") || path.includes("/banners")) {
      return [];
    }

    if (path.includes("/api/admin/media") || path.includes("/media")) {
      return [];
    }

    if (method === "POST" || method === "PATCH" || method === "DELETE") {
      return { ok: true };
    }
  } catch {
    // fallback
  }
  return null;
}

export async function customFetch<T = unknown>(
  input: RequestInfo | URL,
  options: CustomFetchOptions = {},
): Promise<T> {
  input = applyBaseUrl(input);
  const { responseType = "auto", headers: headersInit, ...init } = options;

  const method = resolveMethod(input, init.method);

  if (init.body != null && (method === "GET" || method === "HEAD")) {
    throw new TypeError(`customFetch: ${method} requests cannot have a body.`);
  }

  const headers = mergeHeaders(isRequest(input) ? input.headers : undefined, headersInit);

  if (
    typeof init.body === "string" &&
    !headers.has("content-type") &&
    looksLikeJson(init.body)
  ) {
    headers.set("content-type", "application/json");
  }

  if (responseType === "json" && !headers.has("accept")) {
    headers.set("accept", DEFAULT_JSON_ACCEPT);
  }

  // Attach bearer token when an auth getter is configured and no
  // Authorization header has been explicitly provided.
  if (_authTokenGetter && !headers.has("authorization")) {
    const token = await _authTokenGetter();
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
  }

  const requestInfo = { method, url: resolveUrl(input) };

  try {
    const response = await fetch(input, { ...init, method, headers });

    // Detect if Vercel SPA rewrite intercepted our API call by returning HTML
    const contentType = response.headers.get("content-type") || "";
    if (response.ok && !contentType.includes("text/html")) {
      return (await parseSuccessBody(response, responseType, requestInfo)) as T;
    }

    const fallback = getMockResponse(requestInfo.url, method);
    if (fallback !== null) return fallback as T;

    if (!response.ok) {
      const errorData = await parseErrorBody(response, method);
      throw new ApiError(response, errorData, requestInfo);
    }
    
    // If it was ok but was HTML and no fallback, just parse it anyway
    return (await parseSuccessBody(response, responseType, requestInfo)) as T;
  } catch (err) {
    const fallback = getMockResponse(requestInfo.url, method);
    if (fallback !== null) return fallback as T;
    throw err;
  }
}
