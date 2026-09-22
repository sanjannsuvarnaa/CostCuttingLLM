import { readFileSync, writeFileSync, existsSync } from "fs";
import { getNamespacedFile } from "./paths.js";

export interface ToolUsage {
  calls: number;
  tokensSaved: number;
}

export interface DayUsage {
  totalCalls: number;
  totalTokensSaved: number;
  tools: Record<string, ToolUsage>;
}

export type UsageData = Record<string, DayUsage>;

export interface DaySummary extends DayUsage {
  date: string;
}

export interface UsageSummary {
  days: DaySummary[];
  allTime: { totalCalls: number; totalTokensSaved: number };
}

/** Local-date key (YYYY-MM-DD) so "daily" usage matches the user's calendar day. */
export function todayKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function load(): UsageData {
  const file = getNamespacedFile("usage");
  if (!existsSync(file)) return {};
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return {}; }
}

function save(data: UsageData): void {
  writeFileSync(getNamespacedFile("usage"), JSON.stringify(data, null, 2), "utf8");
}

/** Record one tool call against today's usage bucket. */
export function recordUsage(toolName: string, tokensSaved: number): void {
  const data = load();
  const key = todayKey();
  const day: DayUsage = data[key] ?? { totalCalls: 0, totalTokensSaved: 0, tools: {} };
  const saved = Math.max(0, tokensSaved);

  day.totalCalls += 1;
  day.totalTokensSaved += saved;

  const tool = day.tools[toolName] ?? { calls: 0, tokensSaved: 0 };
  tool.calls += 1;
  tool.tokensSaved += saved;
  day.tools[toolName] = tool;

  data[key] = day;
  save(data);
}

/** Daily usage for the last `days` calendar days that have any recorded activity, plus all-time totals. */
export function getUsage(days: number = 30): UsageSummary {
  const data = load();
  const dates = Object.keys(data).sort();
  const recent = dates.slice(-days);

  const allTime = dates.reduce(
    (acc, date) => ({
      totalCalls: acc.totalCalls + data[date].totalCalls,
      totalTokensSaved: acc.totalTokensSaved + data[date].totalTokensSaved,
    }),
    { totalCalls: 0, totalTokensSaved: 0 }
  );

  return {
    days: recent.map(date => ({ date, ...data[date] })),
    allTime,
  };
}
