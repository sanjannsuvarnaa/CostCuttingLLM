import { createPublicKey, verify } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { getBaseDir } from "../utils/paths.js";
import { PUBLIC_KEY_PEM } from "./publicKey.js";

export interface LicenseInfo {
  email: string;
  tier: string;
  issuedAt: string;
}

const LICENSE_FILE = join(getBaseDir(), "license.key");

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/** Verify a `TRMCP-<payload>.<signature>` key against the embedded public key. Returns null if invalid. */
export function verifyLicenseKey(key: string): LicenseInfo | null {
  const trimmed = key.trim();
  const body = trimmed.startsWith("TRMCP-") ? trimmed.slice("TRMCP-".length) : trimmed;
  const parts = body.split(".");
  if (parts.length !== 2) return null;

  try {
    const payloadBytes = b64urlDecode(parts[0]);
    const signature = b64urlDecode(parts[1]);
    const publicKey = createPublicKey(PUBLIC_KEY_PEM);
    if (!verify(null, payloadBytes, publicKey, signature)) return null;

    const payload = JSON.parse(payloadBytes.toString("utf8"));
    if (typeof payload.email !== "string" || typeof payload.tier !== "string") return null;
    return payload as LicenseInfo;
  } catch {
    return null;
  }
}

function readStoredKey(): string | undefined {
  if (process.env.TOKENWISE_LICENSE_KEY) return process.env.TOKENWISE_LICENSE_KEY;
  if (existsSync(LICENSE_FILE)) {
    try { return readFileSync(LICENSE_FILE, "utf8").trim(); } catch { /* ignore */ }
  }
  return undefined;
}

let cached: LicenseInfo | null | undefined;

/** Currently active license, if any (env var takes priority over ~/.tokenwise/license.key). */
export function getLicenseInfo(): LicenseInfo | null {
  if (cached !== undefined) return cached;
  const key = readStoredKey();
  cached = key ? verifyLicenseKey(key) : null;
  return cached;
}

/** Verify and persist a license key to ~/.tokenwise/license.key. Returns the decoded info, or null if invalid. */
export function activateLicenseKey(key: string): LicenseInfo | null {
  const info = verifyLicenseKey(key);
  if (!info) return null;
  writeFileSync(LICENSE_FILE, key.trim(), "utf8");
  cached = info;
  return info;
}
