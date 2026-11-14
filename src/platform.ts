import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join } from "node:path";

// Everything that differs between macOS, Windows and Linux lives here, so the rest of the code stays the same on all
// three. macOS is the tested platform; the Windows and Linux branches are written to each system's own documented
// tools but have not been run on a real machine yet.
export const IS_MAC = process.platform === "darwin";
export const IS_WIN = process.platform === "win32";

// How the panel names this computer and its bin, so nothing says "Mac" on a PC.
export const COMPUTER = IS_MAC ? "this Mac" : IS_WIN ? "this PC" : "this computer";
export const BIN = IS_MAC ? "the Mac's Trash" : IS_WIN ? "the Recycle Bin" : "the Trash";

export const FFMPEG_HINT = IS_MAC ? "brew install ffmpeg" : IS_WIN ? "winget install Gyan.FFmpeg" : "sudo apt install ffmpeg";

// PowerShell single-quoted string: the only character that needs escaping is the quote itself.
export const psQuote = (s: string) => `'${s.replace(/'/g, "''")}'`;

export function powershell(script: string, timeout = 120_000): string {
  return execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], {
    encoding: "utf8",
    timeout,
    windowsHide: true,
  });
}

// Puts a file or folder in the system's own bin so it can be restored: the Mac's Trash, Windows' Recycle Bin, or the
// freedesktop Trash on Linux. Never deletes anything outright.
export function moveToBin(target: string): string {
  if (IS_MAC) {
    const bin = join(homedir(), ".Trash");
    const name = basename(target);
    const ext = extname(name);
    const dest = existsSync(join(bin, name)) ? join(bin, `${name.slice(0, name.length - ext.length)}-${Date.now()}${ext}`) : join(bin, name);
    renameSync(target, dest);
    return dest;
  }
  if (IS_WIN) {
    const kind = statSync(target).isDirectory() ? "DeleteDirectory" : "DeleteFile";
    powershell(
      `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::${kind}(${psQuote(target)}, 'OnlyErrorDialogs', 'SendToRecycleBin')`,
    );
    return BIN;
  }
  try {
    execFileSync("gio", ["trash", target], { stdio: "ignore" });
    return BIN;
  } catch {
    const bin = join(homedir(), ".local", "share", "Trash", "files");
    mkdirSync(bin, { recursive: true });
    const dest = join(bin, `${basename(target)}-${Date.now()}`);
    renameSync(target, dest);
    return dest;
  }
}

// Unpacks a ZIP with the system's own tools: tar on macOS and Windows 10+ is bsdtar, which reads ZIPs; unzip is the
// fallback (Linux, older Windows). Returns every file inside, however deeply the archive nested them.
export function extractZip(zip: string, dest: string): string[] {
  mkdirSync(dest, { recursive: true });
  try {
    execFileSync("tar", ["-xf", zip, "-C", dest], { stdio: "ignore" });
  } catch {
    execFileSync("unzip", ["-o", "-q", zip, "-d", dest], { stdio: "ignore" });
  }
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      if (f.startsWith(".") || f === "__MACOSX") continue;
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(dest);
  return files;
}

// Keeps the Mac awake while the queue has work (scheduled jobs included), with the same caffeinate flags proven by hand
// on 2026-11-13: -d display, -i idle, -m disk, -s system sleep (on AC only), -w <pid> so it ends with this process.
// Not covered: battery (-s does nothing there) and a closed lid, which sleeps the Mac unless it runs in clamshell mode
// with external display and power; changing that needs pmset, which is the user's call. FLOW_MCP_AWAKE=0 turns this off,
// FLOW_MCP_AWAKE_DISPLAY=0 lets the display sleep (Flow with the display asleep is untested). No-op off a Mac.
let awake: ChildProcess | null = null;

export function keepAwake(on: boolean): void {
  if (!IS_MAC || process.env.FLOW_MCP_AWAKE === "0") return;
  if (on && !awake) {
    const flags = [...(process.env.FLOW_MCP_AWAKE_DISPLAY === "0" ? [] : ["-d"]), "-i", "-m", "-s", "-w", String(process.pid)];
    try {
      const child = spawn("/usr/bin/caffeinate", flags, { stdio: "ignore" });
      const gone = () => {
        if (awake === child) awake = null;
      };
      child.on("error", gone);
      child.on("exit", gone);
      awake = child;
    } catch {
      awake = null;
    }
  } else if (!on && awake) {
    awake.kill();
    awake = null;
  }
}

export const isAwake = (): boolean => awake !== null;

// Opens a page in the default browser.
export function openUrl(url: string): void {
  try {
    if (IS_MAC) execFileSync("open", [url], { stdio: "ignore" });
    else if (IS_WIN) execFileSync("cmd", ["/c", "start", "", url], { stdio: "ignore", windowsHide: true });
    else execFileSync("xdg-open", [url], { stdio: "ignore" });
  } catch {
    // Opening the browser is a convenience; the address is printed either way.
  }
}
