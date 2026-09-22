import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getBaseDir } from "./paths.js";

export interface ModelPricing {
  /** USD per input token */
  input: number;
  /** USD per output token */
  output: number;
}

export interface PricingResult {
  pricing: ModelPricing;
  /** The model key pricing was resolved from. */
  resolvedModel: string;
  /** True if this is confirmed pricing for the exact model; false if estimated from a family/tier fallback. */
  exact: boolean;
  /** Present when `exact` is false, or pricing came from a user override. */
  note?: string;
}

/**
 * Pricing data last verified on this date. Provider prices change over time —
 * for models released after this date, `getPricing` falls back to the
 * closest known tier and flags the result as inexact. To pin exact current
 * prices (e.g. for newer model IDs), add entries to
 * ~/.tokenwise/pricing-overrides.json, e.g.:
 *   { "claude-sonnet-4-6": { "input": 0.000003, "output": 0.000015 } }
 */
export const PRICING_AS_OF = "2025-08-01";

/** Confirmed per-token USD pricing for specific model IDs. */
const EXACT_PRICING: Record<string, ModelPricing> = {
  "gpt-4o":          { input: 0.0000025,  output: 0.00001    },
  "gpt-4o-mini":     { input: 0.00000015, output: 0.0000006  },
  "gpt-4-turbo":     { input: 0.00001,    output: 0.00003    },
  "gpt-4":           { input: 0.00003,    output: 0.00006    },
  "gpt-3.5-turbo":   { input: 0.0000005,  output: 0.0000015  },
  "claude-3-5-sonnet": { input: 0.000003,   output: 0.000015   },
  "claude-3-7-sonnet": { input: 0.000003,   output: 0.000015   },
  "claude-3-5-haiku":  { input: 0.0000008,  output: 0.000004   },
  "claude-3-opus":     { input: 0.000015,   output: 0.000075   },
  "claude-3-haiku":    { input: 0.00000025, output: 0.00000125 },
};

/**
 * Family/tier fallback for model IDs not in EXACT_PRICING (new dated
 * snapshots, version bumps, aliases). Matched in order against the
 * lowercased model string.
 */
const FAMILY_FALLBACK: Array<{ match: RegExp; pricing: ModelPricing; tier: string }> = [
  { match: /claude.*opus/,         pricing: EXACT_PRICING["claude-3-opus"],     tier: "claude-3-opus" },
  { match: /claude.*haiku/,        pricing: EXACT_PRICING["claude-3-5-haiku"],  tier: "claude-3-5-haiku" },
  { match: /claude/,               pricing: EXACT_PRICING["claude-3-5-sonnet"], tier: "claude-3-5-sonnet" },
  { match: /gpt-4o-mini/,          pricing: EXACT_PRICING["gpt-4o-mini"],       tier: "gpt-4o-mini" },
  { match: /gpt-4o|gpt-5|^o[134]/, pricing: EXACT_PRICING["gpt-4o"],            tier: "gpt-4o" },
  { match: /gpt-4/,                pricing: EXACT_PRICING["gpt-4-turbo"],       tier: "gpt-4-turbo" },
  { match: /gpt-3\.5/,             pricing: EXACT_PRICING["gpt-3.5-turbo"],     tier: "gpt-3.5-turbo" },
];

export const DEFAULT_PRICING_KEY = "gpt-4o";

let overridesCache: Record<string, ModelPricing> | null = null;

/** User-supplied pricing overrides from ~/.tokenwise/pricing-overrides.json, if present. */
function loadOverrides(): Record<string, ModelPricing> {
  if (overridesCache) return overridesCache;
  let overrides: Record<string, ModelPricing> = {};
  try {
    const path = join(getBaseDir(), "pricing-overrides.json");
    if (existsSync(path)) {
      overrides = JSON.parse(readFileSync(path, "utf8"));
    }
  } catch {
    // Malformed overrides file: ignore and fall back to built-in pricing.
  }
  overridesCache = overrides;
  return overrides;
}

/**
 * Resolve USD per-token pricing for a model. Checks user overrides first,
 * then confirmed pricing, then falls back to a same-family tier and marks
 * the result `exact: false` with a note pointing at the override file.
 */
export function getPricing(model: string): PricingResult {
  const key = model.toLowerCase();
  const overrides = loadOverrides();

  if (overrides[key]) {
    return { pricing: overrides[key], resolvedModel: key, exact: true, note: "from ~/.tokenwise/pricing-overrides.json" };
  }
  if (EXACT_PRICING[key]) {
    return { pricing: EXACT_PRICING[key], resolvedModel: key, exact: true };
  }
  for (const { match, pricing, tier } of FAMILY_FALLBACK) {
    if (match.test(key)) {
      return {
        pricing,
        resolvedModel: key,
        exact: false,
        note: `No confirmed pricing for "${model}"; using ${tier} rates (current as of ${PRICING_AS_OF}). ` +
          `Add an entry to ~/.tokenwise/pricing-overrides.json for exact rates.`,
      };
    }
  }
  return {
    pricing: EXACT_PRICING[DEFAULT_PRICING_KEY],
    resolvedModel: DEFAULT_PRICING_KEY,
    exact: false,
    note: `Unrecognized model "${model}"; falling back to ${DEFAULT_PRICING_KEY} rates (current as of ${PRICING_AS_OF}). ` +
      `Add an entry to ~/.tokenwise/pricing-overrides.json for exact rates.`,
  };
}

/**
 * Anthropic prompt-caching cost multipliers, relative to the base input price.
 * https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
 */
export const CACHE_WRITE_MULTIPLIER_5M = 1.25;
export const CACHE_WRITE_MULTIPLIER_1H = 2.0;
export const CACHE_READ_MULTIPLIER = 0.1;

/** Minimum cacheable prefix size in tokens. */
export const CACHE_MIN_TOKENS_DEFAULT = 1024;
export const CACHE_MIN_TOKENS_HAIKU = 2048;

export function getCacheMinTokens(model?: string): number {
  return model && /haiku/i.test(model) ? CACHE_MIN_TOKENS_HAIKU : CACHE_MIN_TOKENS_DEFAULT;
}

/** Anthropic allows at most 4 cache_control breakpoints per request. */
export const MAX_CACHE_BREAKPOINTS = 4;
