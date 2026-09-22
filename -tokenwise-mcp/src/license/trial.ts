import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { getBaseDir } from "../utils/paths.js";

export const TRIAL_DAYS = 14;

const TRIAL_FILE = join(getBaseDir(), "trial.json");
const DAY_MS = 1000 * 60 * 60 * 24;

export interface TrialStatus {
  startedAt: string;
  daysRemaining: number;
  expired: boolean;
}

/** First-run timestamp, recorded once on first call and reused thereafter. */
function getOrCreateStart(): string {
  if (existsSync(TRIAL_FILE)) {
    try {
      const data = JSON.parse(readFileSync(TRIAL_FILE, "utf8"));
      if (typeof data.startedAt === "string") return data.startedAt;
    } catch { /* fall through and re-create */ }
  }
  const startedAt = new Date().toISOString();
  writeFileSync(TRIAL_FILE, JSON.stringify({ startedAt }, null, 2), "utf8");
  return startedAt;
}

export function getTrialStatus(): TrialStatus {
  const startedAt = getOrCreateStart();
  const elapsedDays = (Date.now() - new Date(startedAt).getTime()) / DAY_MS;
  return {
    startedAt,
    daysRemaining: Math.max(0, Math.ceil(TRIAL_DAYS - elapsedDays)),
    expired: elapsedDays >= TRIAL_DAYS,
  };
}
