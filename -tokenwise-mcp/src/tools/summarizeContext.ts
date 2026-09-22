import { countMessages, countTokens } from "../utils/tokenCounter.js";
import { compress } from "../utils/textCompressor.js";
import { scoreChunks } from "../utils/embeddingMatcher.js";

type Message = { role: string; content: string };

/** Condense a message down to its first couple of sentences after high compression */
function condense(content: string): string {
  const compressed = compress(content, "high");
  const sentences = compressed.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  return sentences.slice(0, 2).join(" ") || compressed;
}

export function summarizeContext(messages: Message[], maxTokens: number) {
  const originalTokens = countMessages(messages);

  if (messages.length <= 2) {
    return { summarizedMessages: messages, tokensSaved: 0 };
  }

  // Keep last 2 verbatim
  const recent = messages.slice(-2);
  const older = messages.slice(0, -2);
  const recentText = recent.map(m => m.content).join(" ");

  // Condense each older message into a compact one-line summary
  let lines = older.map(m => `${m.role}: ${condense(m.content)}`);

  // Evict the least relevant lines (vs. the recent conversation) while over budget
  const budgetForSummary = Math.max(maxTokens - countMessages(recent), 50);
  while (lines.length > 1) {
    const summaryContent = `[Context summary]\n${lines.join("\n")}`;
    if (countTokens(summaryContent) <= budgetForSummary) break;
    const scores = scoreChunks(lines, recentText);
    const worst = scores.reduce((minIdx, s, idx) => (s < scores[minIdx] ? idx : minIdx), 0);
    lines.splice(worst, 1);
  }

  let summaryContent = `[Context summary]\n${lines.join("\n")}`;

  // Last resort: hard truncate if even a single condensed line is too big
  while (countTokens(summaryContent) > budgetForSummary && summaryContent.length > 50) {
    summaryContent = summaryContent.slice(0, Math.floor(summaryContent.length * 0.8));
  }

  const summary: Message = { role: "system", content: summaryContent };
  const summarizedMessages = [summary, ...recent];
  const newTokens = countMessages(summarizedMessages);

  return {
    summarizedMessages,
    tokensSaved: Math.max(0, originalTokens - newTokens),
  };
}
