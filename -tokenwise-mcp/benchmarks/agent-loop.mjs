/**
 * Simulates a 10-turn agent loop where a static system prompt + tool
 * definitions are re-sent on every turn alongside a growing conversation
 * history, and compares the cost with vs. without Anthropic prompt caching
 * (cache_control breakpoints as planned by planCacheBreakpoints).
 */
import {
  countTokens,
  getPricing,
  CACHE_WRITE_MULTIPLIER_5M,
  CACHE_READ_MULTIPLIER,
  CACHE_MIN_TOKENS_DEFAULT,
} from "../dist/index.js";

const model = "claude-3-5-sonnet";
const price = getPricing(model).pricing.input;

const systemPrompt = (
  "You are a senior software engineering assistant embedded in a CLI coding tool. " +
  "Follow the project's existing conventions, write minimal diffs, prefer editing files " +
  "over creating new ones, and explain your reasoning briefly before making changes. " +
  "Always run the relevant tests after making a change and report any failures clearly. "
).repeat(25);

const tools = Array.from({ length: 16 }, (_, i) => ({
  name: `tool_${i}`,
  description:
    `Tool ${i} performs a specific operation on the codebase such as reading files, ` +
    `writing files, searching for patterns, running tests, or inspecting git history. ` +
    `It accepts structured JSON arguments and returns structured JSON results.`,
  input_schema: {
    type: "object",
    properties: { path: { type: "string" }, content: { type: "string" } },
  },
}));

const staticTokens = countTokens(systemPrompt) + countTokens(JSON.stringify(tools));

const TURN_GROWTH_TEXT = (
  "The user asks a follow-up question, and the assistant responds with an updated plan " +
  "that references the prior context and the files touched so far in this session. "
).repeat(5);
const turnTokens = countTokens(TURN_GROWTH_TEXT);

const TURNS = 10;

console.log("Agent-loop prompt-caching benchmark");
console.log("====================================");
console.log(`Model: ${model} ($${price}/input token)`);
console.log(`Static (system + tool defs) tokens: ${staticTokens} (cache-eligible: ${staticTokens >= CACHE_MIN_TOKENS_DEFAULT})`);
console.log(`Per-turn conversation growth: ~${turnTokens} tokens\n`);

console.log("Turn | History | Total In | Baseline $  | With Caching $");
console.log("-".repeat(60));

let baselineCost = 0;
let cachedCost = 0;
let historyTokens = 0;

for (let t = 1; t <= TURNS; t++) {
  const totalIn = staticTokens + historyTokens;
  const baseline = totalIn * price;

  // Turn 1: static portion is written to cache (1.25x). Turns 2+: cache hit (0.1x).
  const cached = t === 1
    ? (staticTokens * CACHE_WRITE_MULTIPLIER_5M + historyTokens) * price
    : (staticTokens * CACHE_READ_MULTIPLIER + historyTokens) * price;

  baselineCost += baseline;
  cachedCost += cached;

  console.log(
    `${String(t).padStart(4)} | ${String(historyTokens).padStart(7)} | ${String(totalIn).padStart(8)} | ` +
    `$${baseline.toFixed(6)} | $${cached.toFixed(6)}`
  );

  historyTokens += turnTokens;
}

const reduction = (1 - cachedCost / baselineCost) * 100;

console.log("-".repeat(60));
console.log(`Total cost over ${TURNS} turns without caching: $${baselineCost.toFixed(6)}`);
console.log(`Total cost over ${TURNS} turns with caching:    $${cachedCost.toFixed(6)}`);
console.log(`Reduction: ${reduction.toFixed(1)}%`);
