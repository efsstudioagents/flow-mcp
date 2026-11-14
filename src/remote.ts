import { readFileSync } from "node:fs";
import { captionPreviewHere, captionSetupHere, captionsHere, narrateHere, presenterHere, transcribeHere, voicesHere, type Core } from "./core.js";
import { PORT, TOKEN_FILE } from "./server.js";
import { connectionRefused, ensureStudio, probeStudio } from "./supervise.js";

// Calls that only read, so sending one again can never run or charge anything twice.
const READ_ONLY = new Set(["status", "wait", "assets", "accounts", "characters", "outputs", "techniques"]);

const readToken = () => {
  try {
    return readFileSync(TOKEN_FILE, "utf8").trim();
  } catch {
    return "";
  }
};

const why = (err: unknown) => {
  const e = err as { message?: string; cause?: { message?: string; code?: string } };
  return e?.cause?.code ?? e?.cause?.message ?? e?.message ?? String(err);
};

// Used when another flow-mcp process (Studio or a second Claude client) already owns the Flow tab and queue.
async function call(method: string, args: unknown, retried = false): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`http://127.0.0.1:${PORT}/api/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-flow-token": readToken() },
      body: JSON.stringify(args ?? {}),
    });
  } catch (err) {
    return recover(method, args, retried, err, connectionRefused(err));
  }
  // A new owner writes a new token; the file is read on every call, so one more try picks it up. A 401 is refused
  // before the core sees the request, so this is safe for every call.
  if (res.status === 401 && !retried) return call(method, args, true);
  let data: { error?: string };
  try {
    data = (await res.json()) as { error?: string };
  } catch (err) {
    // The answer was cut off: the Studio did receive the call and may have acted on it.
    return recover(method, args, retried, err, false);
  }
  if (!res.ok) throw new Error(data.error ?? `flow-mcp owner process answered ${res.status}`);
  return data;
}

async function recover(method: string, args: unknown, retried: boolean, err: unknown, refused: boolean): Promise<unknown> {
  if (refused) {
    // Nothing reached the Studio, so starting one and sending the call again cannot run anything twice.
    if (!retried && (await ensureStudio())) return call(method, args, true);
    throw new Error(`Flow Studio is not running on port ${PORT} and could not be started (${why(err)}). Start it with "npm run studio" (or Flow Studio.command) and try again.`);
  }
  // The connection broke mid-call: the Studio may have acted on it. Bring it back if it is down, but only send a
  // read-only call again. Repeating generate/edit/continue here is how a shot gets paid for twice.
  const down = (await probeStudio()) === "down";
  const restarted = down ? await ensureStudio() : false;
  if (READ_ONLY.has(method)) {
    if (!retried && (restarted || !down)) return call(method, args, true);
    throw new Error(`Flow Studio did not answer ${method} (${why(err)}).`);
  }
  if (restarted) throw new Error("Flow Studio went down during this call and was restarted. Check flow_status and flow_assets before sending it again.");
  throw new Error(`Flow Studio stopped answering during this call (${why(err)}). It may still have done it: check flow_status and flow_assets before sending it again.`);
}

// An owner running older code drops start_at / open_project (the request body is validated with its own shapes) and
// would start a paid job at once. So before sending either, make sure the owner says it understands them.
async function guardSchedule(method: string, a: unknown): Promise<unknown> {
  const x = (a ?? {}) as { start_at?: unknown; open_project?: unknown };
  if (x.start_at !== undefined || x.open_project !== undefined) {
    let caps: unknown;
    try {
      caps = ((await call("status", { detailed: false })) as { capabilities?: unknown }).capabilities;
    } catch (err) {
      throw new Error(`Could not check that the running Flow Studio understands start_at/open_project (${err instanceof Error ? err.message : err}). Nothing was queued.`);
    }
    if (!Array.isArray(caps) || !caps.includes("start_at")) {
      throw new Error("The running Flow Studio is older than this tool and would start the job now; restart it. Nothing was queued.");
    }
  }
  const out = (await call(method, a)) as { starts_at?: string; jobs?: { id?: string; open_project?: string }[] };
  // Belt and braces: the owner said it understands the fields, so its reply must show it used them. If not, the jobs
  // ARE queued already (maybe running), so the message says what to check rather than pretending nothing happened.
  const ids = (out?.jobs ?? []).map((j) => j.id).filter(Boolean).join(", ") || "unknown";
  const lostStart = x.start_at !== undefined && !out?.starts_at;
  const lostProject = x.open_project !== undefined && (out?.jobs ?? []).some((j) => !j.open_project);
  if (lostStart || lostProject) {
    throw new Error(
      `The running Flow Studio queued job(s) ${ids} but ignored ${lostStart ? "start_at" : "open_project"}, so they may start now, or already be running, in whatever project the Flow window shows. Check flow_status at once and flow_cancel them if that is wrong.`,
    );
  }
  return out;
}

export class RemoteCore implements Core {
  status = (a: unknown) => call("status", a);
  generate = (a: unknown) => guardSchedule("generate", a);
  cancel = (a: unknown) => call("cancel", a);
  clear = (a: unknown) => call("clear", a);
  retry = (a: unknown) => call("retry", a);
  assets = (a: unknown) => call("assets", a);
  download = (a: unknown) => call("download", a);
  assemble = (a: unknown) => call("assemble", a);
  techniques = (a: unknown) => call("techniques", a);
  // Run here, not in the owner: they never touch Chrome, and the owner may be running older code.
  voices = voicesHere;
  narrate = narrateHere;
  accounts = (a: unknown) => call("accounts", a);
  open_project = (a: unknown) => call("open_project", a);
  new_project = (a: unknown) => call("new_project", a);
  character = (a: unknown) => call("character", a);
  characters = () => call("characters", {});
  character_edit = (a: unknown) => call("character_edit", a);
  edit = (a: unknown) => call("edit", a);
  trash = (a: unknown) => call("trash", a);
  collect = (a: unknown) => call("collect", a);
  discard = (a: unknown) => call("discard", a);
  set_key = (a: unknown) => call("set_key", a);
  continue_shot = (a: unknown) => call("continue_shot", a);
  agent = (a: unknown) => guardSchedule("agent", a);
  outputs = () => call("outputs", {});
  // Captions, like narration, run here: they never touch the Flow Chrome.
  transcribe = transcribeHere;
  caption_preview = captionPreviewHere;
  captions = captionsHere;
  presenter = presenterHere;
  caption_setup = captionSetupHere;

  // Long waits are split up so no single HTTP request outlives fetch's header timeout.
  async wait(a: { job_ids?: string[]; timeout_seconds: number }): Promise<unknown> {
    const deadline = Date.now() + a.timeout_seconds * 1000;
    for (;;) {
      const left = Math.ceil((deadline - Date.now()) / 1000);
      const out = (await call("wait", { ...a, timeout_seconds: Math.max(5, Math.min(120, left)) })) as { finished: boolean; waiting_for_schedule?: boolean; unknown_ids?: string[] };
      // Those answers come back at once and will not change by asking again right away.
      if (out.finished || out.waiting_for_schedule || out.unknown_ids?.length || left <= 120) return out;
    }
  }
}
