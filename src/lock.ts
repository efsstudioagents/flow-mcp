// A pid lock file: one process at a time may own HOME/queue.json. Binding the port is atomic, but two owners on
// DIFFERENT ports (FLOW_MCP_PORT) share the home, and both would restore and run the same saved jobs. A lock whose pid
// is no longer alive is stale and taken over. Residual race: two processes taking over the same stale lock in the same
// instant; the re-read after a short pause makes the later writer the only winner in practice.
import { closeSync, mkdirSync, openSync, readFileSync, statSync, unlinkSync, writeSync } from "node:fs";
import { dirname } from "node:path";

export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: it exists, it just belongs to someone else.
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

const readPid = (file: string): number | undefined => {
  try {
    const pid = Number((JSON.parse(readFileSync(file, "utf8")) as { pid?: unknown }).pid);
    return Number.isInteger(pid) && pid > 0 ? pid : undefined;
  } catch {
    return undefined;
  }
};

const sleepSync = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export type LockResult = { ok: true } | { ok: false; holder?: number; reason: string };

export function takePidLock(file: string, info: Record<string, unknown> = {}, pid = process.pid, alive = pidAlive, settleMs = 150): LockResult {
  mkdirSync(dirname(file), { recursive: true });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const fd = openSync(file, "wx", 0o600);
      try {
        writeSync(fd, JSON.stringify({ pid, at: new Date().toISOString(), ...info }));
      } finally {
        closeSync(fd);
      }
      if (attempt === 0) return { ok: true };
      // Took over a stale lock: make sure nobody else did the same at the same moment.
      sleepSync(settleMs);
      const now = readPid(file);
      return now === pid ? { ok: true } : { ok: false, holder: now, reason: "another process took the lock at the same moment" };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") return { ok: false, reason: `could not create ${file}: ${err instanceof Error ? err.message : err}` };
    }
    const holder = readPid(file);
    if (holder === pid) return { ok: true };
    if (holder !== undefined && alive(holder)) return { ok: false, holder, reason: `held by pid ${holder}` };
    if (holder === undefined) {
      // Unreadable: maybe being written right now. Only an old one is treated as stale.
      try {
        if (Date.now() - statSync(file).mtimeMs < 5000) return { ok: false, reason: `${file} is being written by another process` };
      } catch {
        continue;
      }
    }
    try {
      unlinkSync(file);
    } catch {
      /* removed by someone else meanwhile: try again */
    }
  }
  return { ok: false, reason: `could not take ${file}` };
}

// Removes the lock only when it is still ours.
export function releasePidLock(file: string, pid = process.pid): void {
  if (readPid(file) !== pid) return;
  try {
    unlinkSync(file);
  } catch {
    /* already gone */
  }
}
