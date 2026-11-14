// "Pesquisa" tab: TikTok Shop products and TikTok videos through Apify.
// Apify keys: APIFY_TOKEN, APIFY_TOKEN_2 ... APIFY_TOKEN_5, each with an optional label APIFY_TOKEN_NAME,
// APIFY_TOKEN_2_NAME ..., from the environment or ~/flow-mcp/.env (the user writes them). A key is never logged, returned
// or written by this code: status and replies carry only the label and the account's monthly usage. Every result set is saved, normalised, as JSON in
// <outputs>/pesquisas/, so results fetched elsewhere (e.g. by Claude through its own Apify connector) can be dropped in
// that folder and show up in the panel without any key. Files are normalised again when loaded, so a raw dataset dump
// works too.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { OUTPUT_DIR, bodyJson, sendJson, str, writeJsonSafe } from "./extras-http.js";

export const RESEARCH_DIR = join(OUTPUT_DIR, "pesquisas");
const ENV_FILE = process.env.FLOW_MCP_ENV ?? fileURLToPath(new URL("../.env", import.meta.url));
const ACTORS = { products: "memo23~tiktok-shop-scraper", videos: "clockworks~tiktok-scraper" } as const;
const DEFAULT_LIMIT = 20, MAX_LIMIT = 50;
type Mode = keyof typeof ACTORS;

interface ApifyKey { slot: number; label: string; token: string }

function envFile(): Record<string, string> {
  if (!existsSync(ENV_FILE)) return {};
  const out: Record<string, string> = {};
  for (const l of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

// In slot order: slot 1 is APIFY_TOKEN, slot 2 APIFY_TOKEN_2 and so on.
function apifyKeys(): ApifyKey[] {
  const file = envFile();
  const val = (k: string) => process.env[k]?.trim() || file[k] || "";
  const keys: ApifyKey[] = [];
  for (let slot = 1; slot <= 5; slot++) {
    const name = slot === 1 ? "APIFY_TOKEN" : `APIFY_TOKEN_${slot}`;
    const token = val(name);
    if (token) keys.push({ slot, label: val(`${name}_NAME`) || `Conta ${slot}`, token });
  }
  return keys;
}

// Monthly usage of each account (US$), cached a minute: the panel asks for status every time the tab opens.
type Usage = { used_usd?: number; limit_usd?: number; left_usd?: number; cycle_end?: string; error?: string };
let usageCache: { at: number; data: Map<number, Usage> } | null = null;
async function usageOf(key: ApifyKey): Promise<Usage> {
  try {
    const res = await fetch("https://api.apify.com/v2/users/me/limits", { headers: { authorization: `Bearer ${key.token}` }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { error: res.status === 401 || res.status === 403 ? "o Apify recusou esta chave" : `o Apify respondeu ${res.status}` };
    const d = ((await res.json()) as { data?: { limits?: { maxMonthlyUsageUsd?: number }; current?: { monthlyUsageUsd?: number }; monthlyUsageCycle?: { endAt?: string } } }).data;
    const used = d?.current?.monthlyUsageUsd, limit = d?.limits?.maxMonthlyUsageUsd;
    return { used_usd: used, limit_usd: limit, left_usd: typeof used === "number" && typeof limit === "number" ? Math.max(0, limit - used) : undefined, cycle_end: d?.monthlyUsageCycle?.endAt };
  } catch (err) {
    return { error: `sem resposta do Apify (${err instanceof Error ? err.name : err})` };
  }
}
async function accountsView(fresh = false) {
  const keys = apifyKeys();
  if (fresh || !usageCache || Date.now() - usageCache.at > 60_000) {
    const data = new Map<number, Usage>();
    await Promise.all(keys.map(async (k) => data.set(k.slot, await usageOf(k))));
    usageCache = { at: Date.now(), data };
  }
  return keys.map((k) => ({ slot: k.slot, label: k.label, ...(usageCache!.data.get(k.slot) ?? {}) }));
}

/* ---------- normalising ---------- */
type Obj = Record<string, unknown>;
const get = (o: unknown, path: string): unknown => path.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Obj)[/^\d+$/.test(k) ? Number(k) : k] : undefined), o);
// The first path holding a plain value: "price" may be an object ({ sale, original }) in one scraper and a number in another.
const first = (o: unknown, paths: string[]) => { for (const p of paths) { const v = get(o, p); if ((typeof v === "string" && v.trim()) || (typeof v === "number" && Number.isFinite(v))) return v; } return undefined; };
// "R$ 67,55", "1.234,5", "67.55", 6755 (cents is not guessed), "11,2 mil", "1.2K"
function num(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v !== "string") return undefined;
  let s = v.trim().toLowerCase().replace(/r\$|\$|us|brl|usd|vendidos?|sold|\+/g, "").trim();
  const mult = /\b(mil|k)\b|k$/.test(s) ? 1e3 : /\b(mi|m)\b|m$/.test(s) ? 1e6 : 1;
  s = s.replace(/mil|mi|k|m/g, "").trim();
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n * mult : undefined;
}
const text = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : undefined);
const url = (v: unknown) => { const s = text(Array.isArray(v) ? v[0] : v); return s && /^https?:\/\//.test(s) ? s : undefined; };

export interface Product { title?: string; price?: number; originalPrice?: number; discount?: number; sold?: number; rating?: number; shop?: string; image?: string; url?: string; revenue?: number; currency?: string }
export interface Video { description?: string; author?: string; language?: string; plays?: number; likes?: number; comments?: number; shares?: number; duration?: number; cover?: string; url?: string; date?: string }

export function normProduct(r: Obj): Product {
  const price = num(first(r, ["price", "salePrice", "price.sale", "price.min", "priceMin", "minPrice", "price.salePrice", "price.value", "realPrice", "preco"]));
  const originalPrice = num(first(r, ["originalPrice", "price.original", "listPrice", "originPrice", "price.originalPrice", "maxPrice", "originalPriceMin"]));
  let discount = num(first(r, ["discount", "discountPercent", "price.discount", "discountRate"]));
  if (discount !== undefined && discount > 0 && discount < 1) discount = Math.round(discount * 100);
  if (discount === undefined && price && originalPrice && originalPrice > price) discount = Math.round((1 - price / originalPrice) * 100);
  const id = text(first(r, ["productId", "product_id", "id"]));
  return {
    title: text(first(r, ["title", "productName", "name", "product_name", "produto"])),
    price, originalPrice: originalPrice && price && originalPrice > price ? originalPrice : undefined, discount: discount || undefined,
    sold: num(first(r, ["sold", "soldCount", "sold_count", "unitsSold", "sales", "salesCount", "totalSold", "vendidos_total"])),
    rating: num(first(r, ["rating", "ratingAverage", "rating.average", "productRating", "reviewRating", "nota"])),
    shop: text(first(r, ["shop", "shopName", "shop.name", "seller.name", "sellerName", "store.name", "loja"])),
    image: url(first(r, ["image", "image.url", "imageUrl", "cover", "cover.url", "mainImage", "images.0", "images.0.url", "imageUrls.0", "thumbnail"])),
    url: url(first(r, ["url", "productUrl", "link", "detailUrl", "pdpUrl"])) ?? (id && /^\d{12,}$/.test(id) ? `https://www.tiktok.com/shop/pdp/${id}` : undefined),
    // memo23/tiktok-shop-scraper (checked on a real run 2026-11-13): productId, title, price, originalPrice, discount "50%",
    // currency, soldCount, estimatedLifetimeRevenue, rating, shopName, productUrl, imageUrl.
    revenue: num(first(r, ["revenue", "estimatedRevenue", "estimatedLifetimeRevenue", "gmv", "faturamento_estimado"])),
    currency: text(first(r, ["currency", "price.currency"])),
  };
}
export function normVideo(r: Obj): Video {
  const created = first(r, ["date", "createTimeISO", "createTime", "uploadDate"]);
  const date = typeof created === "number" ? new Date(created * (created < 1e12 ? 1000 : 1)).toISOString() : text(created);
  return {
    description: text(first(r, ["description", "text", "desc", "title"])),
    author: text(first(r, ["author", "authorMeta.name", "authorMeta.nickName", "author.uniqueId", "username"])),
    language: text(first(r, ["language", "textLanguage"])),
    plays: num(first(r, ["plays", "playCount", "stats.playCount", "views"])),
    likes: num(first(r, ["likes", "diggCount", "stats.diggCount", "likeCount"])),
    comments: num(first(r, ["comments", "commentCount", "stats.commentCount"])),
    shares: num(first(r, ["shares", "shareCount", "stats.shareCount"])),
    duration: num(first(r, ["duration", "videoMeta.duration", "video.duration"])),
    cover: url(first(r, ["cover", "videoMeta.coverUrl", "covers.0", "video.cover", "coverUrl", "videoMeta.originalCoverUrl"])),
    url: url(first(r, ["url", "webVideoUrl", "videoUrl", "link"])),
    date,
  };
}
const looksLikeVideo = (r: Obj) => ["playCount", "webVideoUrl", "diggCount", "plays", "videoMeta", "authorMeta"].some((k) => k in r);

export interface Saved { mode: Mode; query: string; region?: string; source?: string; account?: string; created: string; count: number; items: (Product | Video)[] }
// A saved file may be our own shape, or a bare array / { items } of raw rows from any scraper.
export function normaliseFile(raw: unknown, name = ""): Saved {
  const rows = (Array.isArray(raw) ? raw : ((raw as Obj)?.items as unknown[])) ?? [];
  const meta = (Array.isArray(raw) ? {} : raw) as Obj;
  const objs = rows.filter((r): r is Obj => Boolean(r) && typeof r === "object");
  const mode: Mode = meta.mode === "videos" || meta.mode === "products" ? meta.mode : objs.some(looksLikeVideo) || /video/i.test(name) ? "videos" : "products";
  const items = objs.map((r) => (mode === "videos" ? normVideo(r) : normProduct(r))).filter((x) => Object.values(x).some((v) => v !== undefined));
  return {
    mode,
    query: text(meta.query) ?? (name.replace(/\.json$/i, "").replace(/^\d{4}-\d{2}-\d{2}-(produtos|videos|vídeos)-/, "").replace(/-/g, " ") || "busca"),
    region: text(meta.region), source: text(meta.source), account: text(meta.account),
    created: text(meta.created) ?? (name.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? new Date().toISOString()),
    count: items.length, items,
  };
}

function listSaved() {
  if (!existsSync(RESEARCH_DIR)) return [];
  return readdirSync(RESEARCH_DIR)
    .filter((f) => f.toLowerCase().endsWith(".json"))
    .map((file) => {
      const full = join(RESEARCH_DIR, file);
      try {
        const s = normaliseFile(JSON.parse(readFileSync(full, "utf8")), file);
        return { file, mode: s.mode, query: s.query, created: s.created, count: s.count, source: s.source, mtime: statSync(full).mtimeMs };
      } catch {
        return { file, mode: "products" as Mode, query: file, created: "", count: 0, broken: true, mtime: statSync(full).mtimeMs };
      }
    })
    .sort((a, b) => b.mtime - a.mtime);
}

/* ---------- Apify ---------- */
function actorInput(mode: Mode, query: string, limit: number) {
  if (mode === "products") return { keywords: [query], region: "BR", includeDetails: false, includeReviews: false, includeSalesTrend: false, maxProductsPerKeyword: limit, maxItems: limit };
  // A query starting with # searches the hashtag; anything else is a video search. No paid add-ons are switched on.
  const tag = query.match(/^#(\S+)$/)?.[1];
  // proxyCountryCode BR: TikTok answers as it would to someone in Brazil. Without it the search runs from a US server
  // and comes back mostly in English (13/11: a "vestido" search returned wedding dresses from the US).
  return tag ? { hashtags: [tag], resultsPerPage: limit, proxyCountryCode: "BR" } : { searchQueries: [query], searchSection: "/video", resultsPerPage: limit, proxyCountryCode: "BR" };
}
// An answer that means "this account cannot pay for it" (no credit, monthly limit reached, key refused): the next key
// may still work. Anything else (a timeout, a bad input, a server error) is not retried on another account, since a
// run may already have started and cost money.
class AccountRefused extends Error {}

async function runActor(mode: Mode, query: string, limit: number, token: string): Promise<Obj[]> {
  const qs = new URLSearchParams({ timeout: "240", clean: "true", format: "json", limit: String(limit), maxItems: String(limit) });
  // The key goes in a header, never in the address, so it cannot end up in any log.
  const res = await fetch(`https://api.apify.com/v2/acts/${ACTORS[mode]}/run-sync-get-dataset-items?${qs}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(actorInput(mode, query, limit)),
    signal: AbortSignal.timeout(270_000),
  }).catch((err: Error) => { throw new Error(err.name === "TimeoutError" ? "O Apify demorou mais de 4 minutos. Tente de novo com menos itens." : `Sem conexão com o Apify: ${err.message}`); });
  const body = await res.text();
  let msg = body.slice(0, 300);
  try { msg = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? msg; } catch { /* plain text or a dataset */ }
  if (res.status === 401 || res.status === 403) throw new AccountRefused("o Apify recusou a chave");
  if (res.status === 402) throw new AccountRefused("a conta está sem saldo");
  if (res.status === 408) throw new Error("O Apify demorou mais de 4 minutos. Tente de novo com menos itens.");
  if (!res.ok) {
    if (res.status < 500 && /limit|quota|usage|exceed|insufficient|credit|balance|payment/i.test(msg)) throw new AccountRefused(`limite da conta: ${msg}`);
    throw new Error(`O Apify respondeu ${res.status}: ${msg}`);
  }
  const data = JSON.parse(body) as unknown;
  return (Array.isArray(data) ? data : []).filter((r): r is Obj => Boolean(r) && typeof r === "object");
}

// What the run that just finished cost, from the account's newest run. Apify fills the total in a moment after the run
// (a products run first showed US$ 0.002, then 0.022), so it is read until two readings agree (at most ~6 s).
async function lastRunCost(token: string): Promise<number | undefined> {
  let prev: number | undefined;
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch("https://api.apify.com/v2/actor-runs?desc=1&limit=1", { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6000) });
      const run = ((await res.json()) as { data?: { items?: { usageTotalUsd?: number }[] } }).data?.items?.[0];
      const now = typeof run?.usageTotalUsd === "number" ? run.usageTotalUsd : undefined;
      if (now !== undefined && now === prev) return now;
      prev = now;
    } catch {
      return prev;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return prev;
}

const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "busca";
const fileFor = (mode: Mode, query: string) => {
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const base = `${day}-${mode === "products" ? "produtos" : "videos"}-${slugify(query)}`;
  let name = `${base}.json`;
  for (let n = 2; existsSync(join(RESEARCH_DIR, name)); n++) name = `${base}-${n}.json`;
  return name;
};

// Answers /api/research/<action>; returns false for any other path.
export async function handleResearch(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  const m = url.pathname.match(/^\/api\/research\/(\w+)$/);
  if (!m) return false;
  const b = req.method === "POST" ? await bodyJson(req) : {};
  if (m[1] === "status") {
    const accounts = await accountsView(b.fresh === true);
    sendJson(res, 200, { has_token: accounts.length > 0, accounts, folder: RESEARCH_DIR, searches: listSaved(), limit: { default: DEFAULT_LIMIT, max: MAX_LIMIT } });
    return true;
  }
  if (m[1] === "load") {
    const file = basename(str(b.file, 300) ?? "");
    const full = join(RESEARCH_DIR, file);
    if (!file.endsWith(".json") || !existsSync(full)) throw new Error("Busca salva não encontrada.");
    sendJson(res, 200, { file, ...normaliseFile(JSON.parse(readFileSync(full, "utf8")), file) });
    return true;
  }
  if (m[1] === "run") {
    if (req.method !== "POST") return false;
    const keys = apifyKeys();
    if (!keys.length) throw new Error("Sem a chave do Apify, peça a busca ao Claude e ela aparece aqui.");
    const mode: Mode = b.mode === "videos" ? "videos" : "products";
    const query = str(b.query, 120)?.trim();
    if (!query) throw new Error("Escreva o que buscar.");
    const limit = Math.max(1, Math.min(MAX_LIMIT, Math.round(Number(b.limit) || DEFAULT_LIMIT)));
    // The chosen account goes first; the others follow only when Apify says that one cannot pay for the run.
    const chosen = Number(b.account);
    const order = [...keys.filter((k) => k.slot === chosen), ...keys.filter((k) => k.slot !== chosen)];
    const refused: string[] = [];
    let rows: Obj[] | undefined;
    let used: ApifyKey | undefined;
    for (const key of order) {
      try {
        rows = (await runActor(mode, query, limit, key.token)).slice(0, limit);
        used = key;
        break;
      } catch (err) {
        if (!(err instanceof AccountRefused)) throw err;
        refused.push(`${key.label}: ${err.message}`);
      }
    }
    usageCache = null;
    if (!rows || !used) throw new Error(`Nenhuma conta do Apify conseguiu fazer a busca (${refused.join("; ")}).`);
    const cost_usd = await lastRunCost(used.token);
    const saved: Saved = { mode, query, region: "BR", source: `apify:${ACTORS[mode].replace("~", "/")}`, account: used.label, created: new Date().toISOString(), count: 0, items: [] };
    saved.items = rows.map((r) => (mode === "videos" ? normVideo(r) : normProduct(r)));
    // Videos in Portuguese first; the rest stay, after them.
    if (mode === "videos") saved.items.sort((a, b) => Number((b as Video).language === "pt") - Number((a as Video).language === "pt"));
    saved.count = saved.items.length;
    mkdirSync(RESEARCH_DIR, { recursive: true });
    const file = fileFor(mode, query);
    writeJsonSafe(join(RESEARCH_DIR, file), saved);
    sendJson(res, 200, { file, ...saved, account_slot: used.slot, ...(refused.length ? { skipped_accounts: refused } : {}), ...(cost_usd !== undefined ? { cost_usd } : {}) });
    return true;
  }
  return false;
}
