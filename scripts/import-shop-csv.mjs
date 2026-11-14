#!/usr/bin/env node
// Turns a TikTok Shop CSV (columns: busca, produto, preco_R$, vendidos_total, faturamento_estimado_R$, nota, loja, link)
// into saved searches for the Studio's "Pesquisa" tab: one file per "busca" value in <outputs>/pesquisas/.
//
//   node scripts/import-shop-csv.mjs <file.csv> [--date AAAA-MM-DD] [--out <dir>]
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const csvPath = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
if (!csvPath) { console.error("Uso: node scripts/import-shop-csv.mjs <arquivo.csv> [--date AAAA-MM-DD] [--out <pasta>]"); process.exit(1); }
const OUT = resolve(opt("out") ?? join(process.env.FLOW_MCP_OUTPUT ?? join(homedir(), "flow-mcp-out"), "pesquisas"));
const day = opt("date") ?? new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

// RFC 4180: quoted fields may hold commas, line breaks and doubled quotes.
function parseCsv(text) {
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c; continue; }
    if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim()));
}
const num = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : undefined; };
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "busca";

const [head, ...rows] = parseCsv(readFileSync(resolve(csvPath), "utf8").replace(/^﻿/, ""));
const col = (name) => head.findIndex((h) => h.trim().toLowerCase() === name);
const C = { busca: col("busca"), produto: col("produto"), preco: col("preco_r$"), vendidos: col("vendidos_total"), fat: col("faturamento_estimado_r$"), nota: col("nota"), loja: col("loja"), link: col("link") };
if (C.produto < 0) { console.error("O CSV não tem a coluna 'produto'."); process.exit(1); }

const groups = new Map();
for (const r of rows) {
  const busca = (r[C.busca] ?? "").trim() || "sem busca";
  const link = (r[C.link] ?? "").trim();
  groups.set(busca, [...(groups.get(busca) ?? []), {
    title: r[C.produto]?.trim(), price: num(r[C.preco]), sold: num(r[C.vendidos]), revenue: num(r[C.fat]),
    rating: num(r[C.nota]), shop: r[C.loja]?.trim() || undefined, url: /^https?:\/\//.test(link) ? link : undefined, currency: "BRL",
  }]);
}
mkdirSync(OUT, { recursive: true });
for (const [query, items] of groups) {
  const file = join(OUT, `${day}-produtos-${slug(query)}.json`);
  const data = { mode: "products", query, region: "BR", source: `csv:${basename(csvPath)}`, created: `${day}T12:00:00.000Z`, count: items.length, items };
  writeFileSync(file + ".tmp", JSON.stringify(data, null, 1));
  renameSync(file + ".tmp", file);
  console.log(`${String(items.length).padStart(3)} produtos · ${query} -> ${file}`);
}
