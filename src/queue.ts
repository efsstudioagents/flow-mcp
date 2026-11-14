import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export interface SceneParams {
  prompt: string;
  type: "video" | "image";
  max_credits: number;
  duration?: 4 | 6 | 8 | 10;
  resolution?: "360p" | "720p";
  model?: string;
  aspect_ratio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  variants?: number;
  first_frame?: string;
  // Collection to work inside ("Parent/Child"); created when missing. Flow is opened on it before generating.
  collection?: string;
  first_frame_at?: number;
  last_frame?: string;
  reference_images?: string[];
  chain_from?: string;
  reference_from?: string;
  edit_asset?: string;
  agent_scenes?: string[];
  // The scene number each agent scene is saved as. A retry of scenes 7 and 12 keeps scene-07 and scene-12; without it
  // the numbers run on from file_stem.
  agent_numbers?: number[];
  // Reference images for an agent batch: attached once as ingredients in the agent composer (absolute paths, uploaded
  // once, or "asset:<title>"), with a short name each, plus which of them every scene uses (names, per scene).
  agent_refs?: { image: string; name: string }[];
  agent_scene_refs?: string[][];
  // Flow asset names of agent_refs after upload, so a retry round re-attaches without uploading again.
  agent_ref_assets?: string[];
  continue_from?: string;
  attach?: string[];
  continue_mode?: "exact" | "likeness";
  retries?: number;
  download_quality?: "original" | "upscaled";
  // Project address the Flow tab is switched to right before this job runs (scheduled jobs, open_project, and jobs
  // pinned so a scheduled switch cannot drag them into another account). Lives in the params, so a retry keeps it.
  open_url?: string;
  output_dir: string;
  file_stem: string;
}

export interface Job {
  id: string;
  status: JobStatus;
  params: SceneParams;
  files: string[];
  attempts: number;
  credits?: number;
  progress?: string;
  note?: string;
  error?: string;
  // Scene numbers a batch still could not make after all its own retries; flow_retry redoes just these.
  failed_scenes?: number[];
  // start_at: the job stays "queued" (a new status would break cancel, wait and retry) until this moment, epoch ms.
  notBefore?: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export type JobRunner = (job: Job) => Promise<string[]>;

// Flow is driven like a careful person would: one generation at a time, with a
// randomised pause between them.
const PAUSE_MIN_MS = Number(process.env.FLOW_MCP_PAUSE_MIN_S ?? 25) * 1000;
const PAUSE_MAX_MS = Number(process.env.FLOW_MCP_PAUSE_MAX_S ?? 70) * 1000;

// The longest exclusive() may hold the queue back (an account read, a project switch). After that the hold is let go
// with a warning and jobs start again; the work that held it is not stopped, it just no longer blocks the queue.
const HOLD_MAX_MS = Number(process.env.FLOW_MCP_HOLD_MAX_S ?? 90) * 1000;

const MAX_AHEAD_MS = 48 * 3600_000;
// Timers can stall while the Mac sleeps, so a scheduled start is checked against the wall clock at least this often.
const WAKE_SLICE_MS = 15_000;
const KEEP_JOBS = 100;
const MISSED_MS = 30 * 60_000;

const startAtHelp =
  'Use "HH:MM" (24 h, this computer\'s clock; a time already past today means tomorrow), "+90m" / "+2h" / "+1h30m", or an ISO date-time with a time, e.g. 2026-11-13T23:35.';

// start_at as written by the user or Claude. Anything it cannot read for certain throws, so a typo can never turn into
// "start now" on a paid job. Date.parse alone is far too lenient ("1" is a date to V8), so every form is matched first.
export function parseStartAt(text: string, now = Date.now()): number {
  const s = text.trim();
  let at: number;
  const hm = s.match(/^(\d{1,2}):(\d{2})$/);
  const rel = s.match(/^\+\s*(?:(\d{1,3})\s*h)?\s*(?:(\d{1,4})\s*m(?:in)?)?$/i);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?$/i);
  if (hm) {
    const h = Number(hm[1]);
    const m = Number(hm[2]);
    if (h > 23 || m > 59) throw new Error(`start_at "${text}" is not a time of day. ${startAtHelp} Nothing was queued.`);
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    at = d.getTime();
  } else if (rel && (rel[1] !== undefined || rel[2] !== undefined)) {
    const ms = (Number(rel[1] ?? 0) * 60 + Number(rel[2] ?? 0)) * 60_000;
    if (ms <= 0) throw new Error(`start_at "${text}" is not in the future. ${startAtHelp} Nothing was queued.`);
    at = now + ms;
  } else if (iso) {
    at = Date.parse(s.replace(" ", "T"));
    if (Number.isNaN(at)) throw new Error(`start_at "${text}" is not a real date and time. ${startAtHelp} Nothing was queued.`);
    // No offset means this computer's local time; reject dates V8 would roll over (Feb 30 -> Mar 2).
    if (!iso[7]) {
      const d = new Date(at);
      const same = d.getFullYear() === Number(iso[1]) && d.getMonth() + 1 === Number(iso[2]) && d.getDate() === Number(iso[3]) && d.getHours() === Number(iso[4]) && d.getMinutes() === Number(iso[5]);
      if (!same) throw new Error(`start_at "${text}" is not a real date and time. ${startAtHelp} Nothing was queued.`);
    }
    if (at < now - 60_000) throw new Error(`start_at "${text}" is already in the past (${new Date(at).toLocaleString()}). Nothing was queued.`);
  } else {
    throw new Error(`start_at "${text}" is not a time I can read. ${startAtHelp} Nothing was queued.`);
  }
  if (at - now > MAX_AHEAD_MS) throw new Error(`start_at "${text}" is more than 48 hours ahead (${new Date(at).toLocaleString()}). Nothing was queued.`);
  return at;
}

const STATUSES: JobStatus[] = ["queued", "running", "done", "failed", "cancelled"];
const active = (j: Job) => j.status === "queued" || j.status === "running";

// Only well-formed jobs come back from queue.json: a damaged entry must never turn into a paid generation.
function isJob(x: unknown): x is Job {
  const j = x as Job;
  const p = j?.params as SceneParams | undefined;
  return (
    typeof j === "object" && j !== null && typeof j.id === "string" && /^[\w-]{1,40}$/.test(j.id) && STATUSES.includes(j.status) &&
    Array.isArray(j.files) && typeof j.attempts === "number" && typeof j.createdAt === "string" &&
    (j.notBefore === undefined || (typeof j.notBefore === "number" && Number.isFinite(j.notBefore))) &&
    typeof p === "object" && p !== null && typeof p.prompt === "string" && typeof p.output_dir === "string" && typeof p.file_stem === "string" &&
    (p.type === "video" || p.type === "image") && typeof p.max_credits === "number"
  );
}

// What a restarted owner does with the jobs the previous one left behind. Pure, so it can be checked without Flow.
// - running -> failed: Flow may have finished and charged it, so it is never run again by itself.
// - queued with a start still ahead -> kept, same id and time.
// - other queued -> kept only if it was due (or saved) within the last 30 min; otherwise cancelled with a note.
// - finished -> kept as history, so chain_from / reference_from and flow_wait still find them.
export function planRestore(saved: unknown[], savedAt: number, now = Date.now()): { jobs: Job[]; kept: number; failed: number; cancelled: number; dropped: number } {
  const out = { jobs: [] as Job[], kept: 0, failed: 0, cancelled: 0, dropped: 0 };
  const stamp = new Date(now).toISOString();
  for (const x of saved) {
    if (!isJob(x)) {
      out.dropped++;
      continue;
    }
    const job: Job = { ...x, progress: undefined };
    if (job.status === "running") {
      job.status = "failed";
      job.error = "The studio restarted while this was running; Flow may have finished and charged it. Check flow_assets before retrying.";
      job.finishedAt = stamp;
      out.failed++;
    } else if (job.status === "queued") {
      const due = job.notBefore ?? savedAt;
      if (job.notBefore !== undefined && job.notBefore > now) out.kept++;
      else if (Number.isFinite(due) && now - due <= MISSED_MS) out.kept++;
      else {
        job.status = "cancelled";
        job.note = "missed its start while the studio was off; Retry runs it now";
        job.finishedAt = stamp;
        out.cancelled++;
      }
    }
    out.jobs.push(job);
  }
  return out;
}

export class JobQueue {
  private jobs = new Map<string, Job>();
  private working = false;
  private lastFinished = 0;
  private timer: NodeJS.Timeout | null = null;
  // While > 0 (exclusive(): an account read, a project switch) nothing starts; the job waits, it is not dropped.
  private holds = 0;
  private persistFile: string | null = null;
  persistError: string | null = null;
  // Called after every change of the queue (keep-awake). A throw in it is logged, never passed on.
  onChange?: () => void;
  pausedReason: string | null = null;
  // When the pacing pause between generations ends (epoch ms), so the Monitor can count it down live.
  pausedUntil: number | null = null;
  readonly pauseRange = { min_s: PAUSE_MIN_MS / 1000, max_s: PAUSE_MAX_MS / 1000 };

  constructor(private runner: JobRunner, readonly holdMaxMs = HOLD_MAX_MS) {}

  // notBefore is set on the job before work() can see it: work() may start a job synchronously, inside this call.
  add(params: SceneParams, notBefore?: number): Job {
    const job: Job = {
      id: randomUUID().slice(0, 8),
      status: "queued",
      params,
      files: [],
      attempts: 0,
      ...(notBefore !== undefined ? { notBefore } : {}),
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, job);
    this.changed();
    void this.work();
    return job;
  }

  get busy(): boolean {
    return this.list().some((j) => j.status === "running");
  }

  // Anything still to do, scheduled jobs included: the Mac must stay awake for it.
  get pending(): boolean {
    return this.list().some(active);
  }

  // The earliest scheduled start still ahead (epoch ms), or null.
  get nextStart(): number | null {
    const now = Date.now();
    const ahead = this.list().filter((j) => j.status === "queued" && j.notBefore !== undefined && j.notBefore > now).map((j) => j.notBefore!);
    return ahead.length ? Math.min(...ahead) : null;
  }

  // Runs fn (which drives Flow outside the queue) only while no job runs, and keeps any job from starting until it is
  // done. The busy check and the hold happen before the first await, so nothing can slip in between.
  async exclusive<T>(fn: () => Promise<T>, busyMessage = "A generation is running in the Flow tab. Wait for it to finish (flow_wait), then retry.", maxHoldMs = this.holdMaxMs): Promise<T> {
    if (this.busy) throw new Error(busyMessage);
    this.holds++;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      this.holds--;
      void this.work();
    };
    const timer = setTimeout(() => {
      console.error(`[flow-mcp] ${new Date().toISOString()} a Flow action held the queue for more than ${Math.round(maxHoldMs / 1000)} s; letting jobs start again.`);
      release();
    }, maxHoldMs);
    timer.unref?.();
    try {
      return await fn();
    } finally {
      clearTimeout(timer);
      release();
    }
  }

  // Jobs in the queue are being held back by exclusive() right now.
  get held(): boolean {
    return this.holds > 0;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  list(): Job[] {
    return [...this.jobs.values()];
  }

  // Drops cancelled and failed jobs from the list (the Monitor's "Limpar" button). Files already saved stay on disk.
  clear(statuses: JobStatus[] = ["cancelled", "failed"]): Job[] {
    const removed = this.list().filter((j) => statuses.includes(j.status));
    for (const j of removed) this.jobs.delete(j.id);
    if (removed.length) this.changed();
    return removed;
  }

  // Puts a failed or cancelled job back in line with the same settings and file name. A start time still ahead is
  // kept (retrying never makes a scheduled job earlier); one already past means it runs now.
  retry(id: string): Job | undefined {
    const job = this.jobs.get(id);
    if (job && (job.status === "failed" || job.status === "cancelled")) {
      job.status = "queued";
      job.error = undefined;
      job.finishedAt = undefined;
      this.changed();
      void this.work();
    }
    return job;
  }

  cancel(id: string): Job | undefined {
    const job = this.jobs.get(id);
    if (job && job.status === "queued") {
      job.status = "cancelled";
      job.finishedAt = new Date().toISOString();
      this.changed();
    }
    return job;
  }

  // Owner process only (the one that bound the port): brings back what the previous owner left in `file`, then keeps
  // the file current. Client processes never call it, so they never read or write the file. Once per queue.
  restoreFrom(file: string, now = Date.now()): { file: string; kept: number; failed: number; cancelled: number; history: number; error?: string } {
    if (this.persistFile) throw new Error("The queue was already restored.");
    let saved: { saved_at?: string; jobs?: unknown[] } | undefined;
    let error: string | undefined;
    if (existsSync(file)) {
      try {
        const data = JSON.parse(readFileSync(file, "utf8")) as { version?: number; saved_at?: string; jobs?: unknown[] };
        if (data?.version !== 1 || !Array.isArray(data.jobs)) throw new Error("unknown format");
        saved = data;
      } catch (err) {
        // Kept aside, not deleted, and nothing in it is run.
        error = `queue.json could not be read (${err instanceof Error ? err.message : err}); moved aside, nothing restored`;
        try {
          renameSync(file, `${file}.bad-${now}`);
        } catch {
          /* left where it is */
        }
      }
    }
    const plan = planRestore(saved?.jobs ?? [], Date.parse(saved?.saved_at ?? ""), now);
    for (const job of plan.jobs) if (!this.jobs.has(job.id)) this.jobs.set(job.id, job);
    this.persistFile = file;
    this.changed();
    void this.work();
    return { file, kept: plan.kept, failed: plan.failed, cancelled: plan.cancelled, history: plan.jobs.length - plan.kept - plan.failed - plan.cancelled, ...(error ? { error } : {}) };
  }

  // queue.json: every unfinished job plus the newest finished ones, up to 100, written as tmp + rename so a crash
  // mid-write never leaves half a file.
  private save(): void {
    const file = this.persistFile!;
    const all = this.list();
    const live = all.filter(active);
    const finished = new Set(all.filter((j) => !active(j)).slice(-Math.max(0, KEEP_JOBS - live.length)));
    const jobs = all.filter((j) => active(j) || finished.has(j));
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify({ version: 1, saved_at: new Date().toISOString(), jobs }), { mode: 0o600 });
    renameSync(tmp, file);
  }

  // Saves (when persistence is on) and tells onChange. Never throws; returns false when the save failed.
  private changed(): boolean {
    let saved = true;
    if (this.persistFile) {
      try {
        this.save();
        this.persistError = null;
      } catch (err) {
        saved = false;
        this.persistError = err instanceof Error ? err.message : String(err);
        console.error(`[flow-mcp] could not write ${this.persistFile}: ${this.persistError}`);
      }
    }
    try {
      this.onChange?.();
    } catch (err) {
      console.error(`[flow-mcp] queue onChange failed: ${err instanceof Error ? err.message : err}`);
    }
    return saved;
  }

  // Wakes work() for the earliest scheduled job, in slices of at most 15 s against the wall clock.
  private arm(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    // exclusive() calls work() itself when it lets go.
    if (this.holds) return;
    const starts = this.list().filter((j) => j.status === "queued" && j.notBefore !== undefined).map((j) => j.notBefore!);
    if (!starts.length) return;
    const wait = Math.max(0, Math.min(WAKE_SLICE_MS, Math.min(...starts) - Date.now()));
    this.timer = setTimeout(() => void this.work(), wait);
  }

  private async work(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.working) return;
    this.working = true;
    try {
      for (;;) {
        if (this.holds) break;
        // A scheduled job is skipped until its time; unscheduled ones queued meanwhile run at once.
        const job = this.list().find((j) => j.status === "queued" && (j.notBefore ?? 0) <= Date.now());
        if (!job) break;
        if (this.lastFinished) {
          const pause = PAUSE_MIN_MS + Math.random() * (PAUSE_MAX_MS - PAUSE_MIN_MS);
          const remaining = this.lastFinished + pause - Date.now();
          if (remaining > 0) {
            this.pausedReason = `pacing: next generation in ${Math.ceil(remaining / 1000)}s`;
            this.pausedUntil = Date.now() + remaining;
            await new Promise((r) => setTimeout(r, remaining));
            this.pausedReason = null;
            this.pausedUntil = null;
          }
        }
        if (job.status !== "queued" || this.holds) continue;
        job.status = "running";
        job.startedAt = new Date().toISOString();
        job.attempts++;
        // Recorded BEFORE Flow is touched: after a crash this job must come back "running" (never re-run), not
        // "queued". If that record cannot be written, the job does not start at all.
        if (!this.changed()) {
          job.status = "failed";
          job.error = `Not started: the queue file could not be written (${this.persistError}), so a restart could have run this job twice. Nothing was generated.`;
          job.finishedAt = new Date().toISOString();
          this.changed();
          continue;
        }
        try {
          job.files = await this.runner(job);
          job.status = "done";
          job.error = undefined;
        } catch (err) {
          job.error = err instanceof Error ? err.message : String(err);
          // Failed tiles are already retried inside Flow (its own Retry button); only an agent that produced nothing
          // is re-queued here. Timeouts are never retried automatically: they may still have spent credits.
          const retryable = /agent finished without creating/i.test(job.error);
          job.status = retryable && job.attempts <= (job.params.retries ?? 1) ? "queued" : "failed";
        }
        job.finishedAt = new Date().toISOString();
        this.lastFinished = Date.now();
        this.changed();
      }
    } finally {
      this.working = false;
      this.arm();
    }
  }
}
