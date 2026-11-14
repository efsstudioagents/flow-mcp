// Keeps a Flow Studio running for the MCP processes. Without it, the first MCP process to start became the owner of the
// Flow tab and its queue, and both died with that Claude session; a client then failed with a bare "fetch failed".
// Now an MCP process that finds the port FREE starts a detached Studio (node dist/studio.js) and talks to it as a
// client, so the queue - tonight's scheduled job included - outlives every Claude session.
import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, statSync, unlinkSync, writeSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HOME_DIR } from "./chrome.js";
import { PORT } from "./server.js";

export type StudioProbe = "up" | "other" | "down" | "silent";

const LOCK = join(HOME_DIR, "studio.lock");
const LOCK_STALE_MS = 30_000;
// Appended to, never truncated: the old `>` redirect erased the trace of a crash (2026-11-13).
const LOG = process.platform === "win32" ? join(tmpdir(), "flow-studio.log") : "/tmp/flow-studio.log";
const STUDIO_JS = fileURLToPath(new URL("./studio.js", import.meta.url));
const REPO = fileURLToPath(new URL("..", import.meta.url));

// Connection refused: nothing listens on the port, so a request never reached anyone. Undici puts the code on the
// cause, or on one of the cause's errors when it tried several addresses.
export function connectionRefused(err: unknown): boolean {
  const cause = (err as { cause?: { code?: string; errors?: { code?: string }[] } } | null)?.cause;
  return cause?.code === "ECONNREFUSED" || Boolean(cause?.errors?.some((e) => e?.code === "ECONNREFUSED"));
}

// up: a flow-mcp answers. other: something else holds the port. down: nothing listens. silent: no answer in time, which
// can be a Studio busy inside a paid job - never start a second one beside it, never kill it.
export async function probeStudio(ms = 3000): Promise<StudioProbe> {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: AbortSignal.timeout(ms) });
    const body = (await res.json().catch(() => null)) as { name?: string } | null;
    return body?.name === "flow-mcp" ? "up" : "other";
  } catch (err) {
    return connectionRefused(err) ? "down" : "silent";
  }
}

// One spawner at a time: Claude Desktop starts several MCP processes in the same second. A loser just waits for the
// winner's Studio; even if two did spawn, binding the port is atomic and the extra Studio exits by itself.
function takeLock(): boolean {
  mkdirSync(HOME_DIR, { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      closeSync(openSync(LOCK, "wx"));
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") return false;
      try {
        if (Date.now() - statSync(LOCK).mtimeMs <= LOCK_STALE_MS) return false;
        unlinkSync(LOCK);
      } catch {
        // Removed by someone else meanwhile: try again.
      }
    }
  }
  return false;
}

function releaseLock(): void {
  try {
    unlinkSync(LOCK);
  } catch {
    /* already gone */
  }
}

function spawnStudio(): void {
  const fd = openSync(LOG, "a");
  try {
    writeSync(fd, `\n=== ${new Date().toISOString()} flow-mcp pid ${process.pid} found port ${PORT} free and started the Flow Studio ===\n`);
    // As Flow Studio.command does: ffmpeg and whisper are found by bare name, and neither ~/.local/bin nor Homebrew is on
    // a GUI app's PATH. The whole env goes along, so FLOW_MCP_AVOID_ACCOUNTS (and FLOW_MCP_HOME) reach the Studio too.
    const env = { ...process.env, PATH: [join(homedir(), ".local", "bin"), "/opt/homebrew/bin", "/usr/local/bin", process.env.PATH ?? ""].join(delimiter) };
    const child = spawn(process.execPath, [STUDIO_JS, "--no-open"], { cwd: REPO, detached: true, stdio: ["ignore", fd, fd], env });
    child.unref();
  } finally {
    closeSync(fd);
  }
}

// true when a Flow Studio answers on the port, starting one first when the port is free. Spawns ONLY when nothing
// listens ("down"); "silent" and "other" give false and leave the port holder alone.
// FLOW_MCP_AUTOSTUDIO=0 (tests, a hand-run owner) never spawns one: true only when a Studio already answers.
export async function ensureStudio(): Promise<boolean> {
  const now = await probeStudio();
  if (now === "up") return true;
  if (now !== "down" || process.env.FLOW_MCP_AUTOSTUDIO === "0") return false;
  const mine = takeLock();
  if (mine) {
    try {
      spawnStudio();
    } catch (err) {
      releaseLock();
      console.error(`[flow-mcp] could not start the Flow Studio: ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if ((await probeStudio(2000)) === "up") {
      if (mine) releaseLock();
      return true;
    }
  }
  // Left in place on a slow start: it goes stale after 30 s, so nobody spawns a second Studio meanwhile.
  return false;
}
