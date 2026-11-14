// Small user settings file, HOME/config.json (~/.flow-mcp/config.json). Re-read on every check, so an edit applies at
// once without a restart. Today it holds one thing:
//   avoid_accounts: Google account indexes (/u/N/) that no job may ever run in. Erick's standing rule is "never use
//   account 4 (efsstudiodigital)", so a missing file is created with [4].
// FLOW_MCP_AVOID_ACCOUNTS (comma list, e.g. "4" or "4,6") overrides the file when it is set and not blank.
// Index based: it points at the wrong account if the accounts are ever signed in again in another order.
import { closeSync, mkdirSync, openSync, readFileSync, writeSync } from "node:fs";
import { join } from "node:path";
import { HOME_DIR } from "./chrome.js";

export const CONFIG_FILE = join(HOME_DIR, "config.json");
const DEFAULT_CONFIG = { avoid_accounts: [4] };

// Creates the file with the defaults when it does not exist yet; never overwrites one that does.
export function ensureConfig(file = CONFIG_FILE): void {
  try {
    mkdirSync(join(file, ".."), { recursive: true });
    const fd = openSync(file, "wx", 0o600);
    try {
      writeSync(fd, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
    } finally {
      closeSync(fd);
    }
  } catch {
    /* already there (or not writable: avoidAccounts then fails closed) */
  }
}

// The do-not-use account indexes. Throws (fail closed: nothing is queued or run) when the file exists but cannot be
// read, so a typo in it never silently turns the guard off.
export function avoidAccounts(env = process.env.FLOW_MCP_AVOID_ACCOUNTS, file = CONFIG_FILE): number[] {
  if (env !== undefined && env.trim() !== "") {
    const list = env.split(",").map((s) => s.trim()).filter(Boolean).map(Number);
    if (list.some((n) => !Number.isInteger(n) || n < 0)) throw new Error(`FLOW_MCP_AVOID_ACCOUNTS="${env}" is not a list of account numbers (e.g. "4"). Nothing was queued.`);
    return list;
  }
  ensureConfig(file);
  let data: { avoid_accounts?: unknown };
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`${file} could not be read (${err instanceof Error ? err.message : err}), so the do-not-use account list is unknown. Fix the file (e.g. {"avoid_accounts": [4]}). Nothing was queued.`);
  }
  const list = data?.avoid_accounts ?? [];
  if (!Array.isArray(list) || list.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new Error(`${file}: "avoid_accounts" must be a list of account numbers, e.g. [4]. Nothing was queued.`);
  }
  return list as number[];
}

// Throws when the account index is on the list. `index` undefined = unknown, which the caller decides about.
export function refuseAvoidedAccount(index: number, list = avoidAccounts()): void {
  if (list.includes(index)) {
    throw new Error(`Account /u/${index}/ is on the do-not-use list (avoid_accounts in ${CONFIG_FILE}). Nothing was queued or generated.`);
  }
}
