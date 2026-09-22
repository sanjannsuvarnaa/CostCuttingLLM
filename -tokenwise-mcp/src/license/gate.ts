import { getLicenseInfo } from "./license.js";
import { getTrialStatus, TRIAL_DAYS } from "./trial.js";

/** TODO: replace with your real purchase link before distributing. */
export const PURCHASE_URL = "https://your-store.example/tokenwise-mcp";

/**
 * Temporary beta switch: while false, expired trials are NOT blocked — everything
 * stays free while we collect feedback. The trial/license machinery (and
 * `activate_license`) keeps working underneath so flipping this to true later
 * turns enforcement back on without further changes.
 */
const ENFORCE_LICENSE = false;

export interface AccessStatus {
  allowed: boolean;
  licensed: boolean;
  message: string;
}

/** Perpetual license, or active trial -> allowed. Expired trial with no license -> blocked (if enforced). */
export function checkAccess(): AccessStatus {
  const license = getLicenseInfo();
  if (license) {
    return { allowed: true, licensed: true, message: `Licensed to ${license.email} (${license.tier}).` };
  }

  const trial = getTrialStatus();
  if (!trial.expired) {
    const warning = ENFORCE_LICENSE && trial.daysRemaining <= 3
      ? ` Trial ends in ${trial.daysRemaining} day(s) — purchase at ${PURCHASE_URL} to keep using tokenwise-mcp.`
      : "";
    return { allowed: true, licensed: false, message: `Trial active: ${trial.daysRemaining}/${TRIAL_DAYS} day(s) remaining.${warning}` };
  }

  if (!ENFORCE_LICENSE) {
    return {
      allowed: true,
      licensed: false,
      message: `Free during beta — all features unlocked while we gather feedback. Purchase anytime at ${PURCHASE_URL}.`,
    };
  }

  return {
    allowed: false,
    licensed: false,
    message:
      `Your ${TRIAL_DAYS}-day trial has ended. Purchase a license at ${PURCHASE_URL}, then activate it by ` +
      `calling the "activate_license" tool with your key, or by setting TOKENWISE_LICENSE_KEY, or by ` +
      `saving the key to ~/.tokenwise/license.key.`,
  };
}
