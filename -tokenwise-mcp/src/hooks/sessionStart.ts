#!/usr/bin/env node
import { getProactivePreference } from "../utils/proactivePrefs.js";

const ASK_TEXT = `The tokenwise MCP server (chunk_document, cache_context, estimate_tokens, compress_prompt, \
summarize_context, optimize_system_prompt, plan_prompt_caching, get_stats) is connected. The user has not yet \
decided whether tokenwise tools should be used proactively (without being asked each time).

Ask the user once, early in this conversation: "Would you like me to proactively use the tokenwise tools (e.g. \
chunking large docs instead of reading them whole, estimating token cost before pasting large text, caching \
repeated context) to reduce token usage automatically, without you having to ask each time?"

After they answer, call the set_proactive_mode tool with enabled set to true or false accordingly. This is a \
one-time setup choice: it is saved and will not be asked again. The user can change their mind later by asking \
to turn proactive tokenwise usage on or off, which should also call set_proactive_mode.`;

const ON_TEXT = `Proactive tokenwise mode is ON (the user opted in previously). Use the tokenwise MCP tools \
automatically when they would help, without waiting to be asked:
- chunk_document: before reading a large file/doc just to answer a specific question, chunk it and read only \
the relevant chunks instead of the whole file.
- cache_context: if the user repeats the same project rules, persona, or boilerplate, store it once and \
retrieve it later instead of asking them to re-paste it.
- estimate_tokens: before pulling very large text (logs, dumps, whole files) into context, estimate the cost \
first and warn if it's large.
- get_stats: when asked how much has been saved, report the cumulative totals.
compress_prompt / optimize_system_prompt mainly help external pipelines, not this session.
The user can say "stop using tokenwise automatically" to turn this off (call set_proactive_mode with \
enabled: false).`;

const OFF_TEXT = `tokenwise MCP tools are available but the user opted out of proactive/automatic use. Only \
call them when explicitly asked. They can turn on automatic use later by asking; if they do, call \
set_proactive_mode with enabled: true.`;

function main() {
  const pref = getProactivePreference();
  const additionalContext = pref === null ? ASK_TEXT : pref.enabled ? ON_TEXT : OFF_TEXT;

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext,
    },
  }));
}

main();
