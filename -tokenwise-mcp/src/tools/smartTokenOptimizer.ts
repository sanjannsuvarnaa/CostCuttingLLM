import { countTokens, countMessages } from "../utils/tokenCounter.js";
import { summarizeContext } from "./summarizeContext.js";
import { chunkDocument } from "./chunkDocument.js";
import { optimizeSystemPrompt } from "./optimizeSystemPrompt.js";

type Message = {
  role: string;
  content: string;
};

/**
 * Calculate the total number of input tokens.
 */
function calculateTokens(
  systemPrompt: string,
  messages: Message[],
  document: string,
  query: string
): number {
  return (
    countTokens(systemPrompt) +
    countMessages(messages) +
    countTokens(document) +
    countTokens(query)
  );
}

/**
 * Trim text approximately to a token budget.
 *
 * This function is used only as a final fallback.
 */
function trimTextToTokens(
  text: string,
  maxTokens: number
): string {
  if (!text || maxTokens <= 0) {
    return "";
  }

  if (countTokens(text) <= maxTokens) {
    return text;
  }

  const words = text.split(/\s+/);

  let low = 0;
  let high = words.length;
  let best = "";

  while (low <= high) {
    const mid = Math.floor(
      (low + high) / 2
    );

    const candidate = words
      .slice(0, mid)
      .join(" ");

    if (countTokens(candidate) <= maxTokens) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

/**
 * Preserve the latest user message.
 *
 * The latest user message is important because it
 * represents the current user request.
 */
function preserveLatestUserMessage(
  messages: Message[]
): Message[] {
  if (messages.length === 0) {
    return [];
  }

  const latestUserIndex = messages
    .map((message, index) =>
      message.role === "user"
        ? index
        : -1
    )
    .filter(index => index !== -1)
    .pop();

  if (latestUserIndex === undefined) {
    return messages.slice(-1);
  }

  return [
    messages[latestUserIndex],
  ];
}

/**
 * Trim a document while preserving complete sentences.
 *
 * This prevents important sentences from being
 * cut in the middle during token optimization.
 */
function trimDocumentBySentences(
  document: string,
  maxTokens: number
): string {
  if (!document || maxTokens <= 0) {
    return "";
  }

  if (countTokens(document) <= maxTokens) {
    return document;
  }

  const sentences = document
    .split(/(?<=[.!?])\s+/)
    .filter(
      sentence =>
        sentence.trim().length > 0
    );

  const selectedSentences: string[] = [];

  let usedTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens =
      countTokens(sentence);

    if (
      usedTokens + sentenceTokens <=
      maxTokens
    ) {
      selectedSentences.push(
        sentence.trim()
      );

      usedTokens += sentenceTokens;
    }
  }

  return selectedSentences.join(" ");
}

export function smartTokenOptimizer(
  systemPrompt: string,
  messages: Message[],
  document: string,
  query: string,
  maxTokens: number
) {
  /*
   * Validate token budget.
   */
  if (maxTokens <= 0) {
    return {
      success: false,
      message:
        "Token budget must be greater than 0.",
    };
  }

  /*
   * Calculate original token usage.
   */
  const originalTokens =
    calculateTokens(
      systemPrompt,
      messages,
      document,
      query
    );

  /*
   * If already within budget,
   * no optimization is required.
   */
  if (originalTokens <= maxTokens) {
    return {
      success: true,
      originalTokens,
      finalTokens: originalTokens,
      maxTokens,
      tokensSaved: 0,
      percentSaved: 0,
      techniquesApplied: [],
      optimizationSteps: [],
      optimizedSystemPrompt:
        systemPrompt,
      optimizedMessages:
        messages,
      optimizedDocument:
        document,
      query,
      message:
        "Request is already within the token budget.",
    };
  }

  /*
   * Create working copies.
   */
  let optimizedSystemPrompt =
    systemPrompt;

  let optimizedMessages =
    messages;

  let optimizedDocument =
    document;

  const techniquesApplied: string[] = [];

  const optimizationSteps: string[] = [];

  /*
   * ==================================================
   * STEP 1: SYSTEM PROMPT OPTIMIZATION
   * ==================================================
   */

  const systemResult =
    optimizeSystemPrompt(
      optimizedSystemPrompt
    );

  if (
    countTokens(
      systemResult.optimized
    ) <
    countTokens(
      optimizedSystemPrompt
    )
  ) {
    const before =
      countTokens(
        optimizedSystemPrompt
      );

    const after =
      countTokens(
        systemResult.optimized
      );

    optimizedSystemPrompt =
      systemResult.optimized;

    techniquesApplied.push(
      "System Prompt Optimization"
    );

    optimizationSteps.push(
      `System prompt: ${before} → ${after} tokens`
    );
  }

  let currentTokens =
    calculateTokens(
      optimizedSystemPrompt,
      optimizedMessages,
      optimizedDocument,
      query
    );

  /*
   * ==================================================
   * STEP 2: CONVERSATION SUMMARIZATION
   * ==================================================
   */

  if (
    currentTokens > maxTokens &&
    optimizedMessages.length > 2
  ) {
    const before =
      countMessages(
        optimizedMessages
      );

    const fixedTokens =
      countTokens(
        optimizedSystemPrompt
      ) +
      countTokens(
        optimizedDocument
      ) +
      countTokens(query);

    const messageBudget =
      Math.max(
        20,
        maxTokens -
          fixedTokens
      );

    const result =
      summarizeContext(
        optimizedMessages,
        messageBudget
      );

    if (
      countMessages(
        result.summarizedMessages
      ) < before
    ) {
      optimizedMessages =
        result.summarizedMessages;

      const after =
        countMessages(
          optimizedMessages
        );

      techniquesApplied.push(
        "Conversation Summarization"
      );

      optimizationSteps.push(
        `Conversation: ${before} → ${after} tokens`
      );
    }

    currentTokens =
      calculateTokens(
        optimizedSystemPrompt,
        optimizedMessages,
        optimizedDocument,
        query
      );
  }

  /*
   * ==================================================
   * STEP 3: DOCUMENT CHUNKING AND RETRIEVAL
   * ==================================================
   */

  if (
    currentTokens > maxTokens &&
    optimizedDocument.length > 0
  ) {
    const before =
      countTokens(
        optimizedDocument
      );

    const remainingForDocument =
      maxTokens -
      countTokens(
        optimizedSystemPrompt
      ) -
      countMessages(
        optimizedMessages
      ) -
      countTokens(query);

    if (
      remainingForDocument > 10
    ) {
      const chunkSize =
        Math.min(
          500,
          Math.max(
            20,
            remainingForDocument
          )
        );

      const result =
        chunkDocument(
          optimizedDocument,
          query,
          2,
          chunkSize
        );

      const candidateDocument =
        result.chunks.join(
          "\n\n"
        );

      const after =
        countTokens(
          candidateDocument
        );

      if (after < before) {
        optimizedDocument =
          candidateDocument;

        techniquesApplied.push(
          "Document Chunking & Retrieval"
        );

        optimizationSteps.push(
          `Document: ${before} → ${after} tokens`
        );
      }
    }

    currentTokens =
      calculateTokens(
        optimizedSystemPrompt,
        optimizedMessages,
        optimizedDocument,
        query
      );
  }

  /*
   * ==================================================
   * STEP 4: QUALITY-AWARE TOKEN TRIMMING
   * ==================================================
   *
   * Only used if the request is still above
   * the requested token budget.
   */

  if (
    currentTokens > maxTokens
  ) {
    techniquesApplied.push(
      "Quality-Aware Token Trimming"
    );

    /*
     * ----------------------------------------------
     * STEP 4A: Trim document first
     * ----------------------------------------------
     *
     * Important:
     * Preserve complete sentences instead of
     * cutting the document in the middle.
     */

    const fixedWithoutDocument =
      countTokens(
        optimizedSystemPrompt
      ) +
      countMessages(
        optimizedMessages
      ) +
      countTokens(query);

    const documentBudget =
      maxTokens -
      fixedWithoutDocument;

    if (
      documentBudget > 0
    ) {
      const before =
        countTokens(
          optimizedDocument
        );

      optimizedDocument =
        trimDocumentBySentences(
          optimizedDocument,
          documentBudget
        );

      const after =
        countTokens(
          optimizedDocument
        );

      if (after < before) {
        optimizationSteps.push(
          `Document trimming: ${before} → ${after} tokens`
        );
      }
    } else {
      optimizedDocument = "";
    }

    currentTokens =
      calculateTokens(
        optimizedSystemPrompt,
        optimizedMessages,
        optimizedDocument,
        query
      );

    /*
     * ----------------------------------------------
     * STEP 4B: Reduce conversation
     * ----------------------------------------------
     *
     * Preserve the latest user message.
     */

    if (
      currentTokens > maxTokens
    ) {
      const latestUser =
        preserveLatestUserMessage(
          optimizedMessages
        );

      const before =
        countMessages(
          optimizedMessages
        );

      const fixedWithoutMessages =
        countTokens(
          optimizedSystemPrompt
        ) +
        countTokens(
          optimizedDocument
        ) +
        countTokens(query);

      const messageBudget =
        maxTokens -
        fixedWithoutMessages;

      if (
        messageBudget > 0
      ) {
        const latestUserTokens =
          countMessages(
            latestUser
          );

        if (
          latestUserTokens <=
          messageBudget
        ) {
          optimizedMessages =
            latestUser;
        } else {
          /*
           * The latest user message itself is
           * larger than the available budget.
           */
          const latest =
            latestUser[0];

          optimizedMessages = [
            {
              role:
                latest.role,

              content:
                trimTextToTokens(
                  latest.content,
                  Math.max(
                    1,
                    messageBudget
                  )
                ),
            },
          ];
        }
      } else {
        optimizedMessages = [];
      }

      const after =
        countMessages(
          optimizedMessages
        );

      if (after < before) {
        optimizationSteps.push(
          `Conversation trimming: ${before} → ${after} tokens`
        );
      }
    }

    currentTokens =
      calculateTokens(
        optimizedSystemPrompt,
        optimizedMessages,
        optimizedDocument,
        query
      );

    /*
     * ----------------------------------------------
     * STEP 4C: Trim system prompt last
     * ----------------------------------------------
     */

    if (
      currentTokens > maxTokens
    ) {
      const fixedWithoutSystem =
        countMessages(
          optimizedMessages
        ) +
        countTokens(
          optimizedDocument
        ) +
        countTokens(query);

      const systemBudget =
        maxTokens -
        fixedWithoutSystem;

      const before =
        countTokens(
          optimizedSystemPrompt
        );

      if (
        systemBudget > 0
      ) {
        optimizedSystemPrompt =
          trimTextToTokens(
            optimizedSystemPrompt,
            systemBudget
          );
      } else {
        optimizedSystemPrompt = "";
      }

      const after =
        countTokens(
          optimizedSystemPrompt
        );

      if (after < before) {
        optimizationSteps.push(
          `System prompt trimming: ${before} → ${after} tokens`
        );
      }
    }
  }

  /*
   * ==================================================
   * FINAL TOKEN CALCULATION
   * ==================================================
   */

  const finalTokens =
    calculateTokens(
      optimizedSystemPrompt,
      optimizedMessages,
      optimizedDocument,
      query
    );

  const tokensSaved =
    Math.max(
      0,
      originalTokens -
        finalTokens
    );

  const percentSaved =
    originalTokens > 0
      ? Math.round(
          (tokensSaved /
            originalTokens) *
            100
        )
      : 0;

  /*
   * ==================================================
   * RETURN RESULT
   * ==================================================
   */

  return {
    success:
      finalTokens <= maxTokens,

    originalTokens,

    finalTokens,

    maxTokens,

    tokensSaved,

    percentSaved,

    techniquesApplied,

    optimizationSteps,

    optimizedSystemPrompt,

    optimizedMessages,

    optimizedDocument,

    query,

    message:
      finalTokens <= maxTokens
        ? "Request successfully optimized within the token budget."
        : "Available optimizations were applied, but the request is still above the token budget.",
  };
}