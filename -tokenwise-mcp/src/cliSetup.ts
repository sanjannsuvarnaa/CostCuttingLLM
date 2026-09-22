import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";

interface HookCommand {
  type: string;
  command?: string;
}
interface HookEntry {
  matcher?: string;
  hooks?: HookCommand[];
}

function settingsPath(): string {
  return join(homedir(), ".claude", "settings.json");
}

function hookScriptPath(): string {
  // dist/cliSetup.js -> dist/hooks/sessionStart.js; forward slashes are safe on
  // Windows and avoid backslash-escaping ambiguity across bash/PowerShell.
  return join(__dirname, "hooks", "sessionStart.js").replace(/\\/g, "/");
}

function isOurCommand(h: HookCommand): boolean {
  return typeof h.command === "string" && h.command.includes("hooks") && h.command.includes("sessionStart.js") && h.command.includes("tokenwise-mcp");
}

function isOurHook(entry: HookEntry): boolean {
  return (entry.hooks ?? []).some(isOurCommand);
}

/** Idempotently install the tokenwise SessionStart hook into the user's global Claude Code settings. */
export function runSetup(): void {
  const path = settingsPath();
  mkdirSync(dirname(path), { recursive: true });

  let settings: Record<string, unknown> = {};
  if (existsSync(path)) {
    const raw = readFileSync(path, "utf8").trim();
    if (raw) {
      try {
        settings = JSON.parse(raw);
      } catch {
        throw new Error(
          `${path} exists but is not valid JSON. Fix or back up/remove it, then re-run "tokenwise-mcp setup".`
        );
      }
    }
  }

  const hooks = (settings.hooks ??= {}) as Record<string, HookEntry[]>;
  const sessionStart = (hooks.SessionStart ??= []);

  if (sessionStart.some(isOurHook)) {
    process.stdout.write(`tokenwise: SessionStart hook already installed in ${path} — nothing to do.\n`);
    return;
  }

  sessionStart.push({
    matcher: "startup|resume|clear",
    hooks: [{ type: "command", command: `node "${hookScriptPath()}"` }],
  });

  writeFileSync(path, JSON.stringify(settings, null, 2), "utf8");
  process.stdout.write(
    `tokenwise: installed SessionStart hook in ${path}.\n` +
    `Restart Claude Code (or open /hooks once) for it to take effect.\n` +
    `Claude will ask once whether to use tokenwise tools proactively; your answer is remembered in ~/.tokenwise/.\n`
  );
}

/** Reverse of runSetup(): removes the tokenwise SessionStart hook, leaving everything else untouched. */
export function runUninstall(): void {
  const path = settingsPath();
  if (!existsSync(path)) {
    process.stdout.write(`tokenwise: ${path} does not exist — nothing to uninstall.\n`);
    return;
  }

  const raw = readFileSync(path, "utf8").trim();
  let settings: Record<string, unknown> = {};
  if (raw) {
    try {
      settings = JSON.parse(raw);
    } catch {
      throw new Error(
        `${path} exists but is not valid JSON. Fix or back up/remove it, then re-run "tokenwise-mcp uninstall".`
      );
    }
  }

  const hooks = settings.hooks as Record<string, HookEntry[]> | undefined;
  const sessionStart = hooks?.SessionStart;
  if (!hooks || !sessionStart || !sessionStart.some(isOurHook)) {
    process.stdout.write(`tokenwise: no SessionStart hook found in ${path} — nothing to uninstall.\n`);
    return;
  }

  const filtered = sessionStart
    .map((entry) => ({ ...entry, hooks: (entry.hooks ?? []).filter((h) => !isOurCommand(h)) }))
    .filter((entry) => (entry.hooks ?? []).length > 0);

  if (filtered.length > 0) {
    hooks.SessionStart = filtered;
  } else {
    delete hooks.SessionStart;
    if (Object.keys(hooks).length === 0) {
      delete (settings as { hooks?: unknown }).hooks;
    }
  }

  writeFileSync(path, JSON.stringify(settings, null, 2), "utf8");
  process.stdout.write(
    `tokenwise: removed the SessionStart hook from ${path}.\n` +
    `Restart Claude Code (or open /hooks once) for it to take effect — Claude will stop asking about or using proactive tokenwise mode.\n` +
    `Your previous yes/no answer is still saved under ~/.tokenwise/proactive/ — delete that file too if you want a future "setup" to ask again.\n`
  );
}
