/**
 * tokenwise-mcp library entrypoint.
 *
 * Use these helpers directly in your own agent loops, RAG pipelines, or
 * scripts to cut LLM token costs — no MCP server required. The same logic
 * also powers the MCP server (see `dist/server.js` / `bin/tokenwise-mcp`).
 */

export { compressPrompt } from "./tools/compressPrompt.js";
export { summarizeContext } from "./tools/summarizeContext.js";
export { chunkDocument } from "./tools/chunkDocument.js";
export { estimateTokens } from "./tools/estimateTokens.js";
export { optimizeSystemPrompt } from "./tools/optimizeSystemPrompt.js";
export { cacheContext } from "./tools/cacheContext.js";
export { planPromptCaching } from "./tools/planPromptCaching.js";

export {
  planCacheBreakpoints,
  type Message,
  type PlanCacheInput,
  type PlanCacheResult,
} from "./utils/promptCache.js";

export {
  countTokens,
  countMessages,
  countTokensForModel,
  type TokenCountResult,
} from "./utils/tokenCounter.js";
export { compress, type Aggressiveness } from "./utils/textCompressor.js";
export { scoreChunks } from "./utils/embeddingMatcher.js";

export {
  getPricing,
  PRICING_AS_OF,
  DEFAULT_PRICING_KEY,
  getCacheMinTokens,
  CACHE_WRITE_MULTIPLIER_5M,
  CACHE_WRITE_MULTIPLIER_1H,
  CACHE_READ_MULTIPLIER,
  CACHE_MIN_TOKENS_DEFAULT,
  CACHE_MIN_TOKENS_HAIKU,
  MAX_CACHE_BREAKPOINTS,
  type ModelPricing,
  type PricingResult,
} from "./utils/pricing.js";
