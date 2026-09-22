import { readFileSync, writeFileSync, existsSync } from "fs";
import { getNamespacedFile } from "../utils/paths.js";

function load(): Record<string, string> {
  const cacheFile = getNamespacedFile("cache");
  if (existsSync(cacheFile)) {
    try { return JSON.parse(readFileSync(cacheFile, "utf8")); } catch { return {}; }
  }
  return {};
}

function save(data: Record<string, string>): void {
  writeFileSync(getNamespacedFile("cache"), JSON.stringify(data, null, 2), "utf8");
}

export function cacheContext(
  action: "set" | "get" | "list" | "delete",
  key: string,
  value?: string
): { success: boolean; data?: string; keys?: string[] } {
  const cache = load();

  switch (action) {
    case "set": {
      if (!value) return { success: false };
      cache[key] = value;
      save(cache);
      return { success: true };
    }
    case "get": {
      return cache[key] !== undefined
        ? { success: true, data: cache[key] }
        : { success: false };
    }
    case "list": {
      return { success: true, keys: Object.keys(cache) };
    }
    case "delete": {
      if (!(key in cache)) return { success: false };
      delete cache[key];
      save(cache);
      return { success: true };
    }
    default:
      return { success: false };
  }
}
