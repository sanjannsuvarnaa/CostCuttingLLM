import { planCacheBreakpoints, type Message } from "../utils/promptCache.js";

export function planPromptCaching(
  messages: Message[],
  system?: string,
  tools?: unknown[],
  model?: string
) {
  return planCacheBreakpoints({ system, tools, messages, model });
}
