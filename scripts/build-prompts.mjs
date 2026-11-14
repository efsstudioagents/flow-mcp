#!/usr/bin/env node
// Builds prompts/library.json for the Studio's "Prompts" tab from the two markdown collections in the UGC folder.
// Erick's own data (favourites, counts, his prompts, examples) lives in prompts/meus.json and is never touched here.
//
//   node scripts/build-prompts.mjs [--nespol <md>] [--criadores <md>] [--nespol-page <saved nespol.com/prompts html>] [--out <dir>]
//
// --nespol-page is optional: when given, each Nespol card's example picture (hotlinked, never downloaded) and date are
// read from the saved page and kept in <out>/nespol-examples.json, so later rebuilds without the page keep them.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const UGC = join(homedir(), "Documents", "EFS Studio", "UGC", "Referencias");
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const NESPOL_MD = resolve(args.nespol ?? join(UGC, "prompts-nespol-ugc.md"));
const CRIADORES_MD = resolve(args.criadores ?? join(UGC, "prompts-criadores-tiktok.md"));
const OUT = resolve(args.out ?? join(dirname(fileURLToPath(import.meta.url)), "..", "prompts"));
const EXAMPLES = join(OUT, "nespol-examples.json");

/* ---------- text helpers ---------- */
const NAMED = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", hellip: "…", ndash: "–", mdash: "—", laquo: "«", raquo: "»" };
const decode = (s) =>
  String(s ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const slug = (s) => fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Fenced blocks inside one entry. A fence line directly followed by another fence line counts as ONE fence (Nespol
// POV #04 opens with "```text" twice and closes with "```" twice). Text lines between blocks (e.g. "**Parte 2:**")
// become the label of the next block.
function blocksOf(lines) {
  const out = [];
  let inside = false, buf = [], label = "";
  for (let i = 0; i < lines.length; i++) {
    const fence = /^\s*```/.test(lines[i]);
    if (!fence) {
      if (inside) buf.push(lines[i]);
      // Only lines that name a part count ("**Parte 2:**"); comment authors and notes between blocks do not.
      else if (/parte|prompt|comando|imagem|v[ií]deo|movimento/i.test(lines[i]) && lines[i].trim().length < 60 && !/^\s*- \*\*/.test(lines[i])) label = lines[i].replace(/[*_]/g, "").replace(/:\s*$/, "").trim();
      continue;
    }
    while (i + 1 < lines.length && /^\s*```/.test(lines[i + 1])) i++;
    if (!inside) { inside = true; buf = []; continue; }
    inside = false;
    const text = decode(buf.join("\n")).trim();
    if (text) out.push({ label, text });
    label = "";
  }
  if (inside && buf.join("").trim()) out.push({ label, text: decode(buf.join("\n")).trim() });
  return out;
}

// One block can hold an image prompt AND a movement prompt, separated by marker lines such as
// "*———PROMPT DE IMAGEM——-*" or "COMANDO DE MOVIMENTO 🕺:". Split there so each part can go to the right tab.
const MARKER = /^(prompt|comando)s?\b(\s+(de|do|da|dos|para|pra))?(\s+(o|a|os|fazer|gerar|criar|seu|sua|primeira|segunda|ultima|última|último|ultimo))*\s*(imagem|iamgem|omagem|image|movimento|video|vídeo|storyboard|avatar|prompt)\b/i;
const markerText = (line) => line.replace(/[*_—–\-:;👇🏼📸🕺🚀🚨]+/gu, " ").replace(/\s+/g, " ").trim();
// A marker either stands on its own short line or starts a line and is followed by ":" and the prompt itself.
function markerAt(line) {
  const own = markerText(line);
  if (line.length < 70 && MARKER.test(own)) return { label: own, rest: "" };
  const m = line.match(/^[\s*_—–-]*((?:prompt|comando)[^:\n]{0,40}?)\s*:\s*(\S.*)$/i);
  if (m && MARKER.test(markerText(m[1]))) return { label: markerText(m[1]), rest: m[2] };
  return null;
}
function splitParts(block) {
  const lines = block.text.split("\n");
  const cuts = lines.map((l, i) => (markerAt(l) ? i : -1)).filter((i) => i >= 0);
  if (!cuts.length) return [block];
  const parts = [];
  const head = lines.slice(0, cuts[0]).join("\n").replace(/^[\s—–-]+$/gm, "").trim();
  // Text before the first marker is a prompt of its own when it is long; a short one is the creator's note.
  if (head) parts.push(head.length < 320 ? { label: "Observação", text: head, note: true } : { label: block.label, text: head });
  cuts.forEach((c, n) => {
    const mk = markerAt(lines[c]);
    const body = [mk.rest, ...lines.slice(c + 1, cuts[n + 1] ?? lines.length)].join("\n").replace(/^[\s—–-]+$/gm, "").trim();
    if (body) parts.push({ label: mk.label, text: body });
  });
  return parts.length ? parts : [block];
}

const VIDEO_WORDS = /\b(video|vídeo|animate|animação|animation|seconds|segundos|movimento|movement|motion|clip)\b/i;
const IMAGE_WORDS = /\b(photograph|photo|fotografia|foto|image|imagem|iamgem|omagem|picture|storyboard|flat ?lay|avatar)\b/i;
function partKind(p) {
  if (p.note) return "note";
  const label = fold(p.label || "");
  if (/^\s*[[{]/.test(p.text)) return "json";
  if (/storyboard/.test(label) && !/video/.test(label)) return "image";
  if (/imag|iamg|omag|avatar|foto/.test(label)) return "image";
  if (/moviment|video|roteiro/.test(label)) return "video";
  const head = p.text.slice(0, 400);
  if (IMAGE_WORDS.test(head) && !VIDEO_WORDS.test(head)) return "image";
  return "video";
}
// Speech the prompt asks for, ignoring the many "no speaking, no voice" clauses.
function talks(text) {
  const t = text.replace(/\b(no|without|sem|never|nunca|não)\s+(any\s+)?(speaking|speech|voice[-\s]?over|voices?|narration|narração|dialogue|diálogo|talking|lip-?sync|fala|gerar narração)[^.;\n]*/gi, "");
  return /\b(speaks?|speaking|talks?|talking|says|saying|fala|falando|narração|narration|dialogue|diálogo|lip-?sync|voice-?over|pt-br|brazilian portuguese|português do brasil|portugues do brasil)\b/i.test(t);
}
function orientationOf(...texts) {
  const t = texts.join(" ");
  if (/9\s*:\s*16|\bvertical\b/i.test(t)) return "vertical";
  if (/16\s*:\s*9|\bhorizontal\b|\blandscape\b/i.test(t)) return "horizontal";
  return "unknown";
}
// TikTok video ids carry their upload time in the top 32 bits.
function tiktokDate(link) {
  const id = link?.match(/\/video\/(\d{15,})/)?.[1];
  if (!id) return undefined;
  const secs = Number(BigInt(id) >> 32n);
  return secs > 1.4e9 && secs < 2.2e9 ? new Date(secs * 1000).toISOString() : undefined;
}

/* ---------- categories ---------- */
export const CATEGORIES = ["Movimentos UGC", "POV e mãos", "Moda e provador", "Unboxing e embalagem", "Produto em ação", "Com fala", "Imagem inicial", "Storyboard e JSON", "Efeitos virais"];
function categoryOf(item) {
  const t = fold(item.title), all = fold(item.title + " " + item.parts.map((p) => p.text.slice(0, 600)).join(" "));
  if (/storyboard/.test(t) || item.parts.some((p) => p.kind === "json") || /\bjson\b/.test(t)) return "Storyboard e JSON";
  if (item.source === "Nespol") return item.group === "POV" ? "POV e mãos" : "Movimentos UGC";
  if (/tinta|splash|isqueiro|rasg|troca de cor|variacoes de cor|chines|efeito/.test(t)) return "Efeitos virais";
  if (/unboxing|embalagem|pacote|poly bag|caixa|drone|entrega|treno/.test(t)) return "Unboxing e embalagem";
  if (item.parts.every((p) => p.kind === "image" || p.kind === "note")) return "Imagem inicial";
  if (/narracao|fala|roteiro|prompt master|vendas|gancho|motoboy/.test(t)) return "Com fala";
  if (/\bpov\b/.test(t)) return "POV e mãos";
  if (/look|provador|moda|roupa|vestu|calca|short|cos do|tecido|fashion|plus size|faceless|cintura|elasticidade|selfie|espelho|corpo inteiro|bolsa|calcad|tenis|sandalia|chinelo|masculino|cama|esticando/.test(t)) return "Moda e provador";
  if (/\bpov\b/.test(all.slice(0, 300))) return "POV e mãos";
  return "Produto em ação";
}
function kindOf(item) {
  const kinds = new Set(item.parts.map((p) => p.kind).filter((k) => k !== "note"));
  if (/storyboard/i.test(item.title) || item.parts.some((p) => /storyboard/i.test(p.label))) return "storyboard";
  if (kinds.has("json")) return "json";
  if (kinds.has("image") && kinds.has("video")) return "imagem + vídeo";
  if (kinds.has("image") && kinds.size === 1) return "imagem";
  return item.parts.some((p) => p.kind === "video" && talks(p.text)) ? "vídeo com fala" : "movimento";
}

/* ---------- parsers ---------- */
// Splits a document into entries that start at a matching heading line and end at the next heading of any level.
function entries(md, heading) {
  const lines = md.replace(/\r/g, "").split("\n");
  const found = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(heading);
    if (m) { cur = { m, body: [] }; found.push(cur); continue; }
    if (/^#{1,4}\s/.test(line)) { cur = null; continue; }
    cur?.body.push(line);
  }
  return found;
}
const meta = (body, key) => body.find((l) => l.includes(`**${key}:**`))?.split(`**${key}:**`)[1]?.trim();

function parseNespol(md, examples) {
  return entries(md, /^### (UGC|POV) #(\d+) · (.+)$/).map(({ m, body }) => {
    const [, group, num, title] = m;
    const formato = body.find((l) => l.includes("**Formato:**")) ?? "";
    const copies = Number(formato.match(/Cópias na plataforma:\*\*\s*(\d+)/)?.[1] ?? NaN);
    const link = meta(body, "Link original");
    const ex = link ? examples[link] : undefined;
    const parts = blocksOf(body).flatMap(splitParts);
    return {
      id: `nespol-${group.toLowerCase()}-${num}`,
      title: decode(title).trim(),
      title_en: decode(meta(body, "Título em inglês") ?? "") || undefined,
      source: "Nespol",
      group,
      link,
      orientation: /vertical/i.test(formato) ? "vertical" : /horizontal/i.test(formato) ? "horizontal" : orientationOf(parts.map((p) => p.text).join(" ")),
      popularity: Number.isFinite(copies) ? copies : undefined,
      date: ex?.date,
      example: ex?.image ? { url: ex.image, type: /\.gif(\?|$)/i.test(ex.image) ? "gif" : "image" } : undefined,
      parts,
    };
  });
}

const SOURCES = { Pereira: "@pereiracreator_", VendaPro: "@vendapro.ia", Airon: "@airon.ia", Brenda: "Brenda Fontes", Cezar: "Cezar Bueno" };
function parseCriadores(md) {
  return entries(md, /^#{3,4} (Pereira|VendaPro|Airon|Brenda|Cezar) #(\d+) · (.+)$/).map(({ m, body }) => {
    const [, who, num, title] = m;
    const link = meta(body, "Vídeo TikTok") ?? meta(body, "Vídeo de referência");
    const parts = blocksOf(body).flatMap(splitParts);
    return {
      id: `${who.toLowerCase()}-${num}`,
      title: decode(title).replace(/\s+/g, " ").trim(),
      source: SOURCES[who],
      link,
      orientation: orientationOf(title, parts.map((p) => p.text).join(" ")),
      date: tiktokDate(link),
      parts,
    };
  });
}

// Reads every card of a saved nespol.com/prompts page: link -> example picture, date and category slug.
function readNespolPage(html) {
  const map = {};
  for (const card of html.match(/<article class="pgsc-card"[\s\S]*?<\/article>/g) ?? []) {
    const href = card.match(/data-pgsc-title href="([^"]+)"/)?.[1];
    const img = card.match(/<img[^>]*\ssrc="(https:\/\/nespol\.com\/[^"]+)"/)?.[1];
    const date = Number(card.match(/data-date="(\d+)"/)?.[1]);
    if (!href) continue;
    map[decode(href)] = { image: img ? decode(img) : undefined, date: date ? new Date(date * 1000).toISOString() : undefined, category: card.match(/data-category="([^"]+)"/)?.[1] };
  }
  return map;
}

/* ---------- build ---------- */
mkdirSync(OUT, { recursive: true });
let examples = existsSync(EXAMPLES) ? JSON.parse(readFileSync(EXAMPLES, "utf8")) : {};
if (args["nespol-page"]) {
  examples = readNespolPage(readFileSync(resolve(args["nespol-page"]), "utf8"));
  writeFileSync(EXAMPLES, JSON.stringify(examples, null, 1));
}

const nespol = parseNespol(readFileSync(NESPOL_MD, "utf8"), examples);
const criadores = parseCriadores(readFileSync(CRIADORES_MD, "utf8"));
const problems = [];
if (nespol.length !== 45) problems.push(`Nespol: ${nespol.length} prompts (esperado 45)`);
for (const it of [...nespol, ...criadores]) {
  if (!it.parts.length) problems.push(`${it.id}: nenhum bloco de prompt`);
  for (const p of it.parts) p.kind = partKind(p);
}
const items = [...nespol, ...criadores].filter((it) => it.parts.length).map((it, order) => {
  const item = { ...it, order };
  item.kind = kindOf(item);
  item.category = categoryOf(item);
  item.parts = item.parts.map(({ label, text, kind }) => ({ label: label || undefined, kind, text }));
  delete item.group;
  return item;
});
const ids = new Set();
for (const it of items) { if (ids.has(it.id)) problems.push(`id repetido: ${it.id}`); ids.add(it.id); }

const lib = { built: new Date().toISOString(), sources: [NESPOL_MD, CRIADORES_MD], categories: CATEGORIES, items };
const file = join(OUT, "library.json");
writeFileSync(file + ".tmp", JSON.stringify(lib));
renameSync(file + ".tmp", file);

const by = (k) => items.reduce((acc, it) => ((acc[it[k]] = (acc[it[k]] ?? 0) + 1), acc), {});
console.log(`${items.length} prompts (${nespol.length} Nespol + ${criadores.length} criadores) -> ${file}`);
console.log(`${items.reduce((n, it) => n + it.parts.length, 0)} partes · ${items.filter((it) => it.parts.length > 1).length} cartões com mais de uma parte`);
console.log(`com exemplo: ${items.filter((it) => it.example).length} · com link TikTok: ${items.filter((it) => /tiktok\.com/.test(it.link ?? "")).length}`);
console.log("\nPor categoria:");
for (const c of CATEGORIES) {
  const list = items.filter((it) => it.category === c);
  console.log(`  ${String(list.length).padStart(3)}  ${c}  · ${list.slice(0, 3).map((it) => it.title.slice(0, 38)).join(" | ")}`);
}
console.log("\nPor tipo:", by("kind"));
console.log("Por formato:", by("orientation"));
console.log("Por fonte:", by("source"));
if (problems.length) { console.error("\nPROBLEMAS:\n  " + problems.join("\n  ")); process.exitCode = 1; }
