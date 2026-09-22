import { readFileSync, writeFileSync, existsSync } from "fs";
import { getNamespacedFile } from "./paths.js";

export interface ProactivePrefs {
  enabled: boolean;
  decidedAt: string;
}

function file(): string {
  return getNamespacedFile("proactive");
}

/** null means the user has never been asked yet. */
export function getProactivePreference(): ProactivePrefs | null {
  const path = file();
  if (!existsSync(path)) return null;
  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    if (typeof data.enabled === "boolean") return data as ProactivePrefs;
  } catch { /* fall through and treat as unset */ }
  return null;
}

export function setProactivePreference(enabled: boolean): ProactivePrefs {
  const prefs: ProactivePrefs = { enabled, decidedAt: new Date().toISOString() };
  writeFileSync(file(), JSON.stringify(prefs, null, 2), "utf8");
  return prefs;
}
