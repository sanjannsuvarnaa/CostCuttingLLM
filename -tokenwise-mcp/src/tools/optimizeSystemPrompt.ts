import { countTokens } from "../utils/tokenCounter.js";
import { compress } from "../utils/textCompressor.js";

/** Convert prose paragraphs into tight bullet directives */
function paragraphsToBullets(text: string): string {
  return text
    .split(/\n{2,}/)
    .map(block => {
      const trimmed = block.trim();
      // Already a bullet or heading – keep as-is
      if (/^[-*•#]/.test(trimmed)) return trimmed;
      // Single short line – keep
      if (!trimmed.includes(". ") && trimmed.split("\n").length === 1) return trimmed;
      // Multi-sentence paragraph → bullet per sentence
      return trimmed
        .split(/(?<=[.!?])\s+/)
        .filter(s => s.trim().length > 0)
        .map(s => `- ${s.trim()}`)
        .join("\n");
    })
    .join("\n\n");
}

export function optimizeSystemPrompt(systemPrompt: string) {
  const original = systemPrompt;
  let optimized = compress(systemPrompt, "high");
  optimized = paragraphsToBullets(optimized);
  // Final whitespace cleanup
  optimized = optimized.replace(/\n{3,}/g, "\n\n").trim();

  const originalTokens = countTokens(original);
  const optimizedTokens = countTokens(optimized);

  return {
    original,
    optimized,
    tokensSaved: Math.max(0, originalTokens - optimizedTokens),
  };
}
