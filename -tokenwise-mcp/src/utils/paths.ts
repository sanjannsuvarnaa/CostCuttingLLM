import { mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const BASE_DIR = join(homedir(), ".tokenwise");

/** Root config/data directory (~/.tokenwise), created on demand. */
export function getBaseDir(): string {
  mkdirSync(BASE_DIR, { recursive: true });
  return BASE_DIR;
}

/**
 * Identifies which "user" this process is acting on behalf of, so per-user
 * data (cache_context, usage stats) doesn't collide when multiple sessions
 * share a host. Defaults to "default" for local single-user installs.
 */
export function getNamespace(): string {
  const raw = process.env.TOKENWISE_NAMESPACE || "default";
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return safe || "default";
}

/** Path to ~/.tokenwise/<subdir>/<namespace>.json, creating <subdir> on demand. */
export function getNamespacedFile(subdir: string): string {
  const dir = join(getBaseDir(), subdir);
  mkdirSync(dir, { recursive: true });
  return join(dir, `${getNamespace()}.json`);
}
