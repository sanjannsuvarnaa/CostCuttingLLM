import { countTokensForModel } from "../utils/tokenCounter.js";
import { getPricing } from "../utils/pricing.js";

export function estimateTokens(text: string, model: string = "gpt-4o") {
  const { count, exact: tokenCountExact, encoding } = countTokensForModel(text, model);
  const { pricing, exact: pricingExact, note } = getPricing(model);

  return {
    tokenCount: count,
    tokenCountExact,
    tokenizer: encoding,
    estimatedCostUSD: parseFloat((count * pricing.input).toFixed(6)),
    model,
    pricingExact,
    ...(note ? { pricingNote: note } : {}),
  };
}
