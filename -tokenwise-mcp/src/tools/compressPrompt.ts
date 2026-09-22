import { countTokens } from "../utils/tokenCounter.js";
import { compress, Aggressiveness } from "../utils/textCompressor.js";

export function compressPrompt(prompt: string, aggressiveness: Aggressiveness = "medium") {
  const original = prompt;
  const compressed = compress(prompt, aggressiveness);
  const originalTokens = countTokens(original);
  const compressedTokens = countTokens(compressed);
  const tokensSaved = originalTokens - compressedTokens;
  return {
    original,
    compressed,
    tokensSaved,
    percentSaved: originalTokens > 0 ? Math.round((tokensSaved / originalTokens) * 100) : 0,
  };
}
