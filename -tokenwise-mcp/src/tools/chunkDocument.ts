import { countTokens } from "../utils/tokenCounter.js";
import { scoreChunks } from "../utils/embeddingMatcher.js";

/**
 * Split a document into complete sentences.
 */
function splitIntoSentences(document: string): string[] {
  return document
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 0);
}

/**
 * Create chunks using complete sentences.
 *
 * A chunk will never intentionally cut a sentence
 * in the middle.
 */
function createSentenceChunks(
  sentences: string[],
  chunkSize: number
): string[] {
  const chunks: string[] = [];

  let currentSentences: string[] = [];
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = countTokens(sentence);

    /*
     * If adding this sentence would exceed the
     * chunk size, save the current chunk first.
     */
    if (
      currentSentences.length > 0 &&
      currentTokens + sentenceTokens > chunkSize
    ) {
      chunks.push(
        currentSentences.join(" ")
      );

      currentSentences = [];
      currentTokens = 0;
    }

    /*
     * Add the complete sentence.
     */
    currentSentences.push(sentence);
    currentTokens += sentenceTokens;
  }

  /*
   * Add the final chunk.
   */
  if (currentSentences.length > 0) {
    chunks.push(
      currentSentences.join(" ")
    );
  }

  return chunks;
}

export function chunkDocument(
  document: string,
  query: string,
  maxChunks: number = 3,
  chunkSize: number = 500
) {
  /*
   * Empty document.
   */
  if (!document.trim()) {
    return {
      chunks: [],
      totalChunks: 0,
      returnedChunks: 0,
      tokensSaved: 0,
    };
  }

  /*
   * STEP 1:
   * Split document into complete sentences.
   */
  const sentences =
    splitIntoSentences(document);

  /*
   * STEP 2:
   * Group complete sentences into chunks.
   */
  const chunks =
    createSentenceChunks(
      sentences,
      chunkSize
    );

  /*
   * STEP 3:
   * Score chunks according to the query.
   */
  const scores =
    scoreChunks(
      chunks,
      query
    );

  /*
   * STEP 4:
   * Select the most relevant chunks.
   *
   * We restore the original document order
   * after relevance ranking.
   */
  const ranked = scores
    .map((score, index) => ({
      score,
      index,
    }))
    .sort(
      (a, b) =>
        b.score - a.score
    )
    .slice(0, maxChunks)
    .sort(
      (a, b) =>
        a.index - b.index
    )
    .map(
      ({ index }) =>
        chunks[index]
    );

  /*
   * STEP 5:
   * Calculate token savings.
   */
  const totalTokens =
    countTokens(document);

  const returnedTokens =
    ranked.reduce(
      (sum, chunk) =>
        sum + countTokens(chunk),
      0
    );

  return {
    chunks: ranked,
    totalChunks: chunks.length,
    returnedChunks: ranked.length,
    tokensSaved:
      Math.max(
        0,
        totalTokens -
          returnedTokens
      ),
  };
}