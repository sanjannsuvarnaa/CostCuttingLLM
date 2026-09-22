import { get_encoding, type Tiktoken } from "tiktoken";

let cl100k: Tiktoken | null = null;
let o200k: Tiktoken | null = null;

function getCl100k(): Tiktoken {
  return (cl100k ??= get_encoding("cl100k_base"));
}

function getO200k(): Tiktoken {
  return (o200k ??= get_encoding("o200k_base"));
}

/** Default token count (cl100k_base) — used for internal before/after comparisons. */
export function countTokens(text: string): number {
  return getCl100k().encode(text).length;
}

export function countMessages(messages: Array<{ role: string; content: string }>): number {
  // 4 tokens overhead per message (role + formatting)
  return messages.reduce((sum, m) => sum + countTokens(m.content) + 4, 0) + 2;
}

export interface TokenCountResult {
  count: number;
  /** False if this is an approximation (no public exact tokenizer for the model family). */
  exact: boolean;
  encoding: string;
}

/**
 * Count tokens using the tokenizer for the given model family, for
 * user-facing cost estimates:
 *  - gpt-4o / gpt-5 / o-series -> o200k_base (exact)
 *  - gpt-4 / gpt-3.5           -> cl100k_base (exact)
 *  - Claude, Gemini, other     -> cl100k_base as an approximation. Anthropic
 *    doesn't publish an offline tokenizer for Claude 3+; for exact counts use
 *    the Messages API `count_tokens` endpoint.
 */
export function countTokensForModel(text: string, model?: string): TokenCountResult {
  const m = (model ?? "").toLowerCase();
  if (/gpt-4o|gpt-5|^o1|^o3|^o4|chatgpt-4o/.test(m)) {
    return { count: getO200k().encode(text).length, exact: true, encoding: "o200k_base" };
  }
  if (/gpt-4|gpt-3\.5|text-davinci/.test(m)) {
    return { count: getCl100k().encode(text).length, exact: true, encoding: "cl100k_base" };
  }
  return { count: getCl100k().encode(text).length, exact: false, encoding: "cl100k_base (approximate)" };
}
