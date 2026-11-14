// Small HTTP helpers for the add-on routes (prompts.ts, research.ts). Kept apart from server.ts so those files never
// import server.ts (no import cycle) and can be tested on their own.
import { renameSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";

// Same rule as core.ts OUTPUT_ROOT, repeated here so these modules load without pulling in the Flow driver.
export const OUTPUT_DIR = process.env.FLOW_MCP_OUTPUT ?? join(homedir(), "flow-mcp-out");

export const sendJson = (res: ServerResponse, code: number, data: unknown) => {
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
};

export async function bodyJson(req: IncomingMessage, limit = 1024 * 1024): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > limit) throw new Error("Body too large.");
    chunks.push(c as Buffer);
  }
  const raw = Buffer.concat(chunks).toString().trim();
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected a JSON object.");
  return parsed as Record<string, unknown>;
}

// Write to a temporary file first and rename it into place, so a crash mid-write never leaves half a file.
export function writeJsonSafe(file: string, data: unknown) {
  writeFileSync(file + ".tmp", JSON.stringify(data, null, 1));
  renameSync(file + ".tmp", file);
}

export const str = (v: unknown, max = 200_000) => (typeof v === "string" ? v.slice(0, max) : undefined);
