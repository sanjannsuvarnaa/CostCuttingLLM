import { compressPrompt } from "./dist/tools/compressPrompt.js";
import { summarizeContext } from "./dist/tools/summarizeContext.js";
import { chunkDocument } from "./dist/tools/chunkDocument.js";
import { estimateTokens } from "./dist/tools/estimateTokens.js";
import { optimizeSystemPrompt } from "./dist/tools/optimizeSystemPrompt.js";
import { cacheContext } from "./dist/tools/cacheContext.js";
import { planPromptCaching } from "./dist/tools/planPromptCaching.js";

function section(name) {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`  ${name}`);
  console.log("=".repeat(50));
}

// 1. compress_prompt
section("1. compress_prompt");
const cp = compressPrompt(
  "Sure! I'd be happy to help. In order to solve this, due to the fact that we need to process data, please be advised that it is important to note that you should use the correct method.",
  "high"
);
console.log("Original:  ", cp.original);
console.log("Compressed:", cp.compressed);
console.log(`Saved: ${cp.tokensSaved} tokens (${cp.percentSaved}%)`);

// 2. summarize_context
section("2. summarize_context");
const sc = summarizeContext([
  { role: "user",      content: "Can you explain how React hooks work in detail?" },
  { role: "assistant", content: "React hooks are functions that let you use state and lifecycle features in functional components. useState returns a stateful value and a setter. useEffect runs side effects after render." },
  { role: "user",      content: "What about useCallback?" },
  { role: "assistant", content: "useCallback memoizes a function so it keeps the same reference between renders unless its dependencies change." },
], 500);
console.log("Messages in:", 4, "→ out:", sc.summarizedMessages.length);
console.log("Tokens saved:", sc.tokensSaved);
sc.summarizedMessages.forEach(m => console.log(`  [${m.role}]: ${m.content.slice(0, 80)}...`));

// 3. chunk_document
section("3. chunk_document");
const doc = `
Authentication is the process of verifying identity. JWT tokens are stateless and self-contained.
OAuth 2.0 provides delegated authorization. OpenID Connect adds identity on top of OAuth.
Passwords should be hashed with bcrypt or argon2. Never store plain text passwords.
Rate limiting protects APIs from abuse. Use exponential backoff for retries.
Database indexes speed up queries. Use EXPLAIN ANALYZE to debug slow queries.
Redis is great for caching frequently accessed data. Set appropriate TTLs.
`.repeat(6);
const cd = chunkDocument(doc, "authentication JWT tokens", 2, 100);
console.log(`Total chunks: ${cd.totalChunks}, returned: ${cd.returnedChunks}, saved: ${cd.tokensSaved} tokens`);
cd.chunks.forEach((c, i) => console.log(`  Chunk ${i + 1}: ${c.slice(0, 80)}...`));

// 4. estimate_tokens
section("4. estimate_tokens");
const models = ["gpt-4o", "claude-3-5-sonnet", "gpt-3.5-turbo"];
const sampleText = "Explain the difference between authentication and authorization in a REST API context.";
for (const model of models) {
  const et = estimateTokens(sampleText, model);
  console.log(`  ${model}: ${et.tokenCount} tokens → $${et.estimatedCostUSD}`);
}

// 5. optimize_system_prompt
section("5. optimize_system_prompt");
const osp = optimizeSystemPrompt(
  `You are a helpful assistant. It is important to note that you should always respond in a concise manner. Please be advised that you must never share private user data. As previously mentioned, you should use markdown formatting for code. In order to provide the best experience, you should ask clarifying questions when the request is ambiguous.`
);
console.log("Original: ", osp.original);
console.log("Optimized:", osp.optimized);
console.log(`Saved: ${osp.tokensSaved} tokens`);

// 6. cache_context
section("6. cache_context");
cacheContext("set", "test-key", "Always use TypeScript. No any types. Prefer const.");
const got = cacheContext("get", "test-key");
const listed = cacheContext("list", "");
console.log("Set → get:", got.data);
console.log("Keys in cache:", listed.keys);
cacheContext("delete", "test-key");
console.log("After delete:", cacheContext("list", "").keys);

// 7. plan_prompt_caching
section("7. plan_prompt_caching");
const longSystemPrompt = `You are a senior software engineering assistant embedded in a CLI coding tool. `.repeat(75);
const toolDefs = Array.from({ length: 8 }, (_, i) => ({
  name: `tool_${i}`,
  description: `Performs operation ${i} on the codebase, including reading, writing, and analyzing files.`.repeat(5),
  input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } } },
}));
const convoMessages = [
  { role: "user", content: "Here is the full contents of the repo README and config files for context. ".repeat(70) },
  { role: "assistant", content: "Got it, I've reviewed the project structure and configuration." },
  { role: "user", content: "Now please add a new endpoint to the API." },
];
const ppc = planPromptCaching(convoMessages, longSystemPrompt, toolDefs, "claude-3-5-sonnet");
console.log(`Breakpoints used: ${ppc.breakpointsUsed}`);
console.log(`Cached tokens: ${ppc.cachedTokens} / ${ppc.totalTokens} total`);
console.log(`Estimated savings on cache hit: ${ppc.estimatedSavingsPercent}%`);
console.log(`Cost per turn — without caching: $${ppc.costPerTurnUSD.withoutCaching}, with caching: $${ppc.costPerTurnUSD.withCaching}`);
ppc.notes.forEach(n => console.log(`  - ${n}`));

console.log("\n✅ All 7 tools working.\n");
