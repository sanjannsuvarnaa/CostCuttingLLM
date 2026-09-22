/** Lightweight TF-IDF + keyword relevance scoring (no external embedding API needed) */

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/\b[a-z]{2,}\b/g) ?? [];
}

function tf(terms: string[], word: string): number {
  const count = terms.filter(t => t === word).length;
  return count / (terms.length || 1);
}

function idf(chunks: string[][], word: string): number {
  const docsWithWord = chunks.filter(c => c.includes(word)).length;
  return Math.log((chunks.length + 1) / (docsWithWord + 1)) + 1;
}

export function scoreChunks(chunks: string[], query: string): number[] {
  const queryTerms = new Set(tokenize(query));
  const tokenizedChunks = chunks.map(tokenize);

  return tokenizedChunks.map(terms => {
    let score = 0;
    for (const word of queryTerms) {
      score += tf(terms, word) * idf(tokenizedChunks, word);
    }
    return score;
  });
}
