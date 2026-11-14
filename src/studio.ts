#!/usr/bin/env node
// Standalone Studio: runs the panel without Claude. If Claude's MCP process already serves it, just opens that.
// `--no-open` (used when an MCP process starts it in the background) skips opening the browser.
import { LocalCore } from "./core.js";
import { PORT, startServer } from "./server.js";
import { openUrl } from "./platform.js";

// Node ends the process on an unhandled rejection, and the queue with it (the likely cause of the 2026-11-13 crash).
// A stray rejection (Playwright emits some) is logged and survived. An uncaught exception, or 10 rejections within a
// minute, means the process is in an unknown state: log and exit non-zero, so the next MCP call starts a fresh Studio.
// Nothing needs saving first: a job is written to queue.json as "running" BEFORE Flow is touched, and a restored
// "running" job comes back failed (it may have been charged), never re-run. The exit handler frees queue.lock.
const stamp = () => new Date().toISOString();
const recent: number[] = [];
const die = (why: string, err: unknown) => {
  console.error(`[${stamp()}] ${why}; exiting with code 1 so the Studio can be started fresh:`, err);
  process.exit(1);
};
process.on("unhandledRejection", (err) => {
  const now = Date.now();
  recent.push(now);
  while (recent.length && now - recent[0] > 60_000) recent.shift();
  if (recent.length >= 10) return die(`${recent.length} unhandled rejections within a minute`, err);
  console.error(`[${stamp()}] unhandledRejection (kept running):`, err);
});
process.on("uncaughtException", (err) => die("uncaughtException", err));

const core = new LocalCore();
const role = await startServer(core);
const url = `http://127.0.0.1:${PORT}`;
if (role === "none") {
  console.error(`Port ${PORT} is used by another program. Set FLOW_MCP_PORT to a free port.`);
  process.exit(1);
}
console.log(role === "owner" ? `Flow Studio running at ${url} (Ctrl+C to stop)` : `Flow Studio is already served by Claude's flow-mcp at ${url}`);
if (role === "owner") {
  const restored = core.restoreQueue(PORT);
  console.log(`[${new Date().toISOString()}] pid ${process.pid}, queue restored: ${JSON.stringify(restored)}`);
}
if (!process.argv.includes("--no-open")) openUrl(url);
if (role === "client") process.exit(0);
