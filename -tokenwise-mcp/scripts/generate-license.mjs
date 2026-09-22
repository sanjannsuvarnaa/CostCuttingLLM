#!/usr/bin/env node
/**
 * Seller-side tool: mints a perpetual, offline-verifiable license key.
 * Run this after a sale comes in (e.g. from a Gumroad/Stripe notification)
 * and send the resulting key to the customer.
 *
 * Usage:
 *   node scripts/generate-license.mjs --email customer@example.com [--tier pro] [--private-key keys/private.pem]
 */
import { sign, createPrivateKey } from "crypto";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

function b64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const email = arg("email");
const tier = arg("tier", "pro");
const privateKeyPath = arg("private-key", join(process.cwd(), "keys/private.pem"));

if (!email) {
  console.error("Usage: node scripts/generate-license.mjs --email customer@example.com [--tier pro] [--private-key keys/private.pem]");
  process.exit(1);
}

if (!existsSync(privateKeyPath)) {
  console.error(`Private key not found at ${privateKeyPath}.`);
  console.error("Run 'npm run license:keygen' first (one-time setup).");
  process.exit(1);
}

const privateKey = createPrivateKey(readFileSync(privateKeyPath, "utf8"));

const payload = { email, tier, issuedAt: new Date().toISOString().slice(0, 10) };
const payloadBytes = Buffer.from(JSON.stringify(payload), "utf8");
const signature = sign(null, payloadBytes, privateKey);

const key = `TRMCP-${b64url(payloadBytes)}.${b64url(signature)}`;

console.log(key);
