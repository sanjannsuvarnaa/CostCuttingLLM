import { countTokensForModel } from "./tokenCounter.js";
import {
  getPricing,
  getCacheMinTokens,
  CACHE_READ_MULTIPLIER,
  MAX_CACHE_BREAKPOINTS,
} from "./pricing.js";

export type Message = { role: string; content: string };

interface CacheControlBlock {
  type: "text";
  text: string;
  cache_control: { type: "ephemeral" };
}

export interface PlanCacheInput {
  system?: string;
  tools?: unknown[];
  messages: Message[];
  model?: string;
}

export interface PlanCacheResult {
  system?: string | CacheControlBlock[];
  tools?: unknown[];
  messages: Array<{ role: string; content: string | CacheControlBlock[] }>;
  breakpointsUsed: number;
  cachedTokens: number;
  totalTokens: number;
  estimatedSavingsPercent: number;
  costPerTurnUSD: { withoutCaching: number; withCaching: number };
  /** False if token counts are approximate (no public exact tokenizer for this model family). */
  tokenCountExact: boolean;
  /** False if pricing was estimated from a same-family tier rather than confirmed for this exact model. */
  pricingExact: boolean;
  notes: string[];
}

function asCacheBlock(text: string): CacheControlBlock[] {
  return [{ type: "text", text, cache_control: { type: "ephemeral" } }];
}

/**
 * Decide where to place Anthropic `cache_control` breakpoints (system prompt,
 * tool definitions, stable message-history prefix) to maximize cache reuse on
 * repeated/agent-loop calls, and estimate the resulting cost savings.
 */
export function planCacheBreakpoints(input: PlanCacheInput): PlanCacheResult {
  const model = input.model ?? "claude-3-5-sonnet";
  const minTokens = getCacheMinTokens(model);
  const { pricing, exact: pricingExact, note: pricingNote } = getPricing(model);
  const tok = (text: string) => countTokensForModel(text, model);
  const notes: string[] = [];

  let budget = MAX_CACHE_BREAKPOINTS;
  let cachedTokens = 0;
  let tokenCountExact = true;

  // 1. System prompt
  let system: PlanCacheResult["system"] = input.system;
  if (input.system) {
    const { count: sysTokens, exact } = tok(input.system);
    tokenCountExact = tokenCountExact && exact;
    if (sysTokens >= minTokens && budget > 0) {
      system = asCacheBlock(input.system);
      cachedTokens += sysTokens;
      budget--;
      notes.push(`System prompt (${sysTokens} tokens) marked cacheable.`);
    } else {
      notes.push(`System prompt (${sysTokens} tokens) is below the ${minTokens}-token cache minimum for ${model}; left uncached.`);
    }
  }

  // 2. Tool definitions
  let tools: PlanCacheResult["tools"] = input.tools;
  if (input.tools && input.tools.length > 0) {
    const toolsArr = input.tools;
    const { count: toolsTokens, exact: toolsExact } = tok(JSON.stringify(toolsArr));
    tokenCountExact = tokenCountExact && toolsExact;
    if (toolsTokens >= minTokens && budget > 0) {
      tools = toolsArr.map((t, i) =>
        i === toolsArr.length - 1
          ? { ...(t as Record<string, unknown>), cache_control: { type: "ephemeral" as const } }
          : t
      );
      cachedTokens += toolsTokens;
      budget--;
      notes.push(`Tool definitions (${toolsTokens} tokens) marked cacheable on the last tool.`);
    } else {
      notes.push(`Tool definitions (${toolsTokens} tokens) are below the ${minTokens}-token cache minimum; left uncached.`);
    }
  }

  // 3. Largest stable message-history prefix (everything but the last message)
  const messages: PlanCacheResult["messages"] = input.messages.map(m => ({ ...m }));
  if (messages.length > 1 && budget > 0) {
    let prefixTokens = 0;
    let cutIndex = -1;
    for (let i = 0; i < messages.length - 1; i++) {
      const { count, exact } = tok(input.messages[i].content);
      tokenCountExact = tokenCountExact && exact;
      prefixTokens += count;
      if (prefixTokens >= minTokens) cutIndex = i;
    }
    if (cutIndex >= 0) {
      messages[cutIndex] = {
        ...messages[cutIndex],
        content: asCacheBlock(input.messages[cutIndex].content),
      };
      // re-measure the exact prefix up to and including cutIndex
      let exactPrefixTokens = 0;
      for (let i = 0; i <= cutIndex; i++) exactPrefixTokens += tok(input.messages[i].content).count;
      cachedTokens += exactPrefixTokens;
      budget--;
      notes.push(`Messages 0-${cutIndex} (${exactPrefixTokens} tokens) marked as a cacheable stable prefix.`);
    } else {
      notes.push(`Conversation history is below the ${minTokens}-token cache minimum; left uncached.`);
    }
  }

  const totalTokens =
    (input.system ? tok(input.system).count : 0) +
    (input.tools ? tok(JSON.stringify(input.tools)).count : 0) +
    input.messages.reduce((sum, m) => sum + tok(m.content).count, 0);

  const estimatedSavingsPercent = totalTokens > 0
    ? Math.round((cachedTokens * (1 - CACHE_READ_MULTIPLIER) / totalTokens) * 100)
    : 0;

  const withoutCaching = totalTokens * pricing.input;
  const withCaching = (cachedTokens * CACHE_READ_MULTIPLIER + (totalTokens - cachedTokens)) * pricing.input;

  if (cachedTokens === 0) {
    notes.push("Nothing met the cache-eligibility threshold — this request is too small to benefit from prompt caching.");
  } else {
    notes.push(`On a cache hit (a repeat call within the TTL), ~${estimatedSavingsPercent}% of input tokens cost only ${Math.round(CACHE_READ_MULTIPLIER * 100)}% of the normal price.`);
  }

  if (!tokenCountExact) {
    notes.push(`Token counts for "${model}" are approximate (no public exact tokenizer for this model family).`);
  }
  if (pricingNote) {
    notes.push(pricingNote);
  }

  return {
    system,
    tools,
    messages,
    breakpointsUsed: MAX_CACHE_BREAKPOINTS - budget,
    cachedTokens,
    totalTokens,
    estimatedSavingsPercent,
    costPerTurnUSD: {
      withoutCaching: parseFloat(withoutCaching.toFixed(6)),
      withCaching: parseFloat(withCaching.toFixed(6)),
    },
    tokenCountExact,
    pricingExact,
    notes,
  };
}
