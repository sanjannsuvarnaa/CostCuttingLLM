# tokenwise-mcp

A dual-purpose toolkit for cutting LLM token costs:

- **As a library** (`npm install tokenwise-mcp`) — drop these functions into
  your own agent loops, RAG pipelines, or scripts.
- **As an MCP server** — register it with Claude Code / Claude Desktop / any
  MCP-compatible client and call the tools directly from chat.

## What it does

Compresses prompts, summarizes conversation history, retrieves only relevant
document chunks, and — the headline feature — plans **Anthropic prompt-cache
breakpoints** (`cache_control`) for system prompts, tool definitions, and
stable conversation prefixes. In a typical multi-turn agent loop, that alone
cuts input-token cost by **50–65%**, with RAG-style chunking saving **70–90%**
on top of that.

## Benchmarks

Real output from `node benchmarks/*.mjs` (see [`benchmarks/`](./benchmarks)):

| Scenario | Script | Result |
|---|---|---|
| 10-turn agent loop (system prompt + 16 tool defs + growing history), `claude-3-5-sonnet` | `agent-loop.mjs` | **61.9% cost reduction** ($0.0994 → $0.0379 over 10 turns) |
| RAG retrieval over a 9,000-token multi-topic doc, top-3 chunks for a query | `rag-chunking.mjs` | **93.1% token reduction** (9001 → 617 tokens) |
| 9-message conversation condensed to a 3-message summary | `conversation-summary.mjs` | **28.9% token reduction** (481 → 342 tokens) |

Run them yourself:
```bash
npm run build
node benchmarks/agent-loop.mjs
node benchmarks/rag-chunking.mjs
node benchmarks/conversation-summary.mjs
```

## Tools / functions

| Name | What it does | Typical savings |
|------|-------------|-----------------|
| `compress_prompt` | Strips filler phrases, shortens verbose wording | 10–30% |
| `summarize_context` | Compresses old messages, keeps recent 2 verbatim | 20–40% |
| `chunk_document` | Returns only relevant chunks of a large doc | 70–90% |
| `estimate_tokens` | Counts tokens + estimates cost for any model | — |
| `optimize_system_prompt` | Converts prose instructions to concise bullets | 15–40% |
| `cache_context` | Stores reusable context so you don't re-send it | 100% on repeats |
| `plan_prompt_caching` | Places Anthropic `cache_control` breakpoints on system/tools/messages | 50–65% in agent loops |
| `get_stats` | Token-savings stats: this session, today, last 7 days, all-time (persisted) | — |
| `activate_license` | Activate a license key, or check trial/license status | — |
| `set_proactive_mode` | Save the user's yes/no answer on automatic tool use (see [Proactive mode](#proactive-mode)) | — |

## Installation

```bash
npm install tokenwise-mcp
```

Requires Node.js 18+.

## Use as a library

```ts
import {
  compressPrompt,
  summarizeContext,
  chunkDocument,
  estimateTokens,
  planPromptCaching,
  planCacheBreakpoints,
  countTokens,
} from "tokenwise-mcp";

// Compress a verbose prompt
const { compressed, tokensSaved } = compressPrompt(myPrompt, "high");

// Retrieve only the chunks relevant to a query
const { chunks } = chunkDocument(bigDoc, "authentication flow", 3, 500);

// Plan prompt-cache breakpoints for an agent loop request
const plan = planCacheBreakpoints({
  system: systemPrompt,
  tools: toolDefinitions,
  messages: conversation,
  model: "claude-3-5-sonnet",
});
console.log(plan.estimatedSavingsPercent, plan.pricingExact, plan.notes);

// Apply the returned `system`/`tools`/`messages` directly in your
// Anthropic SDK request — they're already annotated with cache_control.
```

## Add to Claude Code (MCP server)

```bash
npm install -g tokenwise-mcp
claude mcp add tokenwise tokenwise-mcp
```

Or run it on demand with `npx` (no global install):
```bash
claude mcp add tokenwise -- npx -y tokenwise-mcp
```

Or add manually to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tokenwise": {
      "command": "tokenwise-mcp"
    }
  }
}
```

## Proactive mode

By default the assistant only calls tokenwise tools when you ask it to. Run
this once after installing to opt into automatic use instead:

```bash
npx tokenwise-mcp setup
```

This merges a `SessionStart` hook into `~/.claude/settings.json` (it won't
touch unrelated settings, and running it again is a no-op if already
installed). Restart Claude Code, or open `/hooks` once, for it to take
effect.

After that, the next time you start a session Claude will ask once whether
it should use tokenwise tools automatically (chunking large docs, caching
repeated context, warning before pasting huge text, etc.) instead of waiting
to be asked. Your answer is saved to `~/.tokenwise/proactive/` and is not
asked again — to change your mind later, just tell Claude to turn proactive
tokenwise usage on or off.

If you'd rather skip all of this, don't run `setup`: the tools remain
available and Claude will only call them on request, exactly as before.

### Disabling proactive mode

There are two levels of "off," depending on how much you want to undo:

- **Just pause it, keep the hook installed** — tell Claude something like
  *"stop using tokenwise automatically"* in conversation. It calls
  `set_proactive_mode` with `enabled: false`, which is saved immediately:
  future sessions will see tools are available but won't use them unless
  asked, and you won't be asked the yes/no question again. Re-enable any
  time by asking Claude to turn it back on.
- **Remove the hook entirely** — run:
  ```bash
  npx tokenwise-mcp uninstall
  ```
  This deletes the `SessionStart` hook entry from `~/.claude/settings.json`
  (leaving every other setting untouched) and restores the original
  explicit-only behavior. Restart Claude Code, or open `/hooks` once, for it
  to take effect. Your earlier yes/no answer stays saved in
  `~/.tokenwise/proactive/`; delete that file too if you want a future
  `setup` to ask the question again from scratch.

## Example usage

### compress_prompt
```json
{
  "tool": "compress_prompt",
  "arguments": {
    "prompt": "Sure! I'd be happy to help. In order to solve this, due to the fact that we need to...",
    "aggressiveness": "high"
  }
}
```
Output:
```json
{
  "original": "Sure! I'd be happy to help. In order to...",
  "compressed": "to solve this, because we need to...",
  "tokensSaved": 12,
  "percentSaved": 28
}
```

### summarize_context
```json
{
  "tool": "summarize_context",
  "arguments": {
    "messages": [
      {"role": "user", "content": "...long earlier message..."},
      {"role": "assistant", "content": "...long response..."},
      {"role": "user", "content": "What about performance?"},
      {"role": "assistant", "content": "Performance depends on..."}
    ],
    "maxTokens": 2000
  }
}
```

### chunk_document
```json
{
  "tool": "chunk_document",
  "arguments": {
    "document": "...10,000 word document...",
    "query": "authentication flow",
    "maxChunks": 3,
    "chunkSize": 500
  }
}
```

### estimate_tokens
```json
{
  "tool": "estimate_tokens",
  "arguments": {
    "text": "Your prompt here",
    "model": "claude-3-5-sonnet"
  }
}
```
Output:
```json
{
  "tokenCount": 14,
  "tokenCountExact": false,
  "tokenizer": "cl100k_base (approximate)",
  "estimatedCostUSD": 0.000042,
  "model": "claude-3-5-sonnet",
  "pricingExact": true
}
```
- `tokenCountExact` is `true` for OpenAI models (uses the matching `tiktoken`
  encoding) and `false` for Claude/other models, where Anthropic doesn't
  publish an offline tokenizer — counts are a `cl100k_base`-based
  approximation. For exact Claude counts, use the Messages API
  `count_tokens` endpoint.
- `pricingExact` is `false` when the model wasn't in the built-in pricing
  table and a same-family tier was used instead — a `pricingNote` field
  explains the fallback. See [Pricing data](#pricing-data) below.

### optimize_system_prompt
```json
{
  "tool": "optimize_system_prompt",
  "arguments": {
    "systemPrompt": "You are a helpful assistant. It is important to note that you should always be concise. Please be advised that you must not share private data..."
  }
}
```

### cache_context
```json
{ "tool": "cache_context", "arguments": { "action": "set", "key": "project-rules", "value": "Always use TypeScript. No any types." } }
{ "tool": "cache_context", "arguments": { "action": "get", "key": "project-rules" } }
{ "tool": "cache_context", "arguments": { "action": "list", "key": "" } }
{ "tool": "cache_context", "arguments": { "action": "delete", "key": "project-rules" } }
```

Cache persists at `~/.tokenwise/cache/<namespace>.json` (see
[Multi-user / namespacing](#multi-user--namespacing)).

### plan_prompt_caching
```json
{
  "tool": "plan_prompt_caching",
  "arguments": {
    "system": "...your 1000+ token system prompt...",
    "tools": [ { "name": "read_file", "description": "...", "input_schema": {} } ],
    "messages": [
      {"role": "user", "content": "...large repo context dump..."},
      {"role": "assistant", "content": "Got it, reviewed the project."},
      {"role": "user", "content": "Now add a new endpoint to the API."}
    ],
    "model": "claude-3-5-sonnet"
  }
}
```
Output:
```json
{
  "breakpointsUsed": 2,
  "cachedTokens": 2114,
  "totalTokens": 3102,
  "estimatedSavingsPercent": 61,
  "costPerTurnUSD": { "withoutCaching": 0.009306, "withCaching": 0.003598 },
  "tokenCountExact": false,
  "pricingExact": true,
  "notes": [
    "System prompt (1051 tokens) marked cacheable.",
    "Tool definitions (978 tokens) are below the 1024-token cache minimum; left uncached.",
    "Messages 0-1 (1063 tokens) marked as a cacheable stable prefix.",
    "On a cache hit (a repeat call within the TTL), ~61% of input tokens cost only 10% of the normal price.",
    "Token counts for \"claude-3-5-sonnet\" are approximate (no public exact tokenizer for this model family)."
  ]
}
```
The returned `system`/`tools`/`messages` are annotated with `cache_control`
blocks ready to send to the Anthropic API as-is.

### get_stats
```json
{ "tool": "get_stats", "arguments": {} }
```
Output:
```json
{
  "session": { "totalTokensSaved": 13, "callCount": 1 },
  "today": { "date": "2026-06-15", "totalCalls": 1, "totalTokensSaved": 13, "tools": { "compress_prompt": { "calls": 1, "tokensSaved": 13 } } },
  "last7Days": [ { "date": "2026-06-15", "totalCalls": 1, "totalTokensSaved": 13, "tools": { "...": "..." } } ],
  "allTime": { "totalCalls": 1, "totalTokensSaved": 13 },
  "namespace": "default",
  "license": { "allowed": true, "licensed": false, "message": "Trial active: 14/14 day(s) remaining." },
  "dashboard": "Run `npm run dashboard` (or `node dist/dashboard/server.js`) to view daily usage charts."
}
```
`session` is in-memory for this process; `today`/`last7Days`/`allTime` are
persisted to `~/.tokenwise/usage/<namespace>.json` so they survive
restarts.

### activate_license
```json
{ "tool": "activate_license", "arguments": {} }
```
With no `key`, returns the current trial/license status (same shape as the
`license` field above). To activate a purchased key:
```json
{ "tool": "activate_license", "arguments": { "key": "TRMCP-...." } }
```
Output:
```json
{ "success": true, "message": "Activated for alice@example.com (pro)." }
```
The key is saved to `~/.tokenwise/license.key` and reused on future runs.

## Dashboard

View daily token-savings as a chart:
```bash
tokenwise-dashboard       # or: npx -y tokenwise-dashboard
```
Open http://localhost:4317.
Set `TOKENWISE_DASHBOARD_PORT` to change the port, and
`TOKENWISE_NAMESPACE` to view a different namespace's usage. The
dashboard is a small local HTTP server with no external dependencies — it
reads `~/.tokenwise/usage/<namespace>.json` and renders an SVG chart plus
a per-tool breakdown for today.

## Pricing data

Pricing in `src/utils/pricing.ts` is current as of `PRICING_AS_OF`
(2025-08-01). For model IDs released after that date, `getPricing` falls
back to the closest known tier (e.g. any `claude-*-sonnet-*` model uses
Claude 3.5 Sonnet rates) and marks the result `pricingExact: false` with a
`pricingNote` explaining the fallback.

To pin exact current prices without a code change, create
`~/.tokenwise/pricing-overrides.json`:
```json
{
  "claude-sonnet-4-6": { "input": 0.000003, "output": 0.000015 },
  "gpt-5":             { "input": 0.00000125, "output": 0.00001 }
}
```
Overrides are matched by exact (lowercased) model string and take priority
over both the built-in table and the family-tier fallback.

## Multi-user / namespacing

`cache_context` and usage stats (for `get_stats` / the dashboard) are stored
per-namespace under `~/.tokenwise/{cache,usage}/<namespace>.json`. The
namespace defaults to `"default"` and can be set via:
```bash
TOKENWISE_NAMESPACE=alice node dist/server.js
```
This keeps multiple users/sessions on the same host from sharing a cache or
usage history. It does not provide network-level isolation — for a hosted
multi-tenant deployment, set this per-session from your own auth layer and
ensure each user's MCP process gets a distinct value.

## Licensing

> **Currently in free beta** — license enforcement is temporarily disabled
> while we gather feedback, so all tools and the dashboard are unlocked
> regardless of trial status. The mechanics below remain active and will be
> enforced in a future release; nothing extra is required from you right now.

tokenwise-mcp is free to use for a **14-day trial** (all tools, starting
from first run — tracked in `~/.tokenwise/trial.json`). After the trial,
all tools (including the dashboard) require a valid license key.

Licenses are **perpetual and fully offline**: a signed token containing your
email and tier, verified locally against an embedded public key. No server,
no phone-home, no recurring fee.

**For users — activating a key:**
```json
{ "tool": "activate_license", "arguments": { "key": "TRMCP-...." } }
```
This verifies the key and saves it to `~/.tokenwise/license.key`.
Alternatively, set the `TOKENWISE_LICENSE_KEY` environment variable, or
write the key to that file directly. Use `activate_license` with no `key` to
check current trial/license status at any time (also shown in `get_stats` and
printed to stderr on server startup).

**For sellers — issuing keys:**
```bash
npm run license:keygen                                   # one-time: generates keys/private.pem + src/license/publicKey.ts
npm run license:generate -- --email buyer@example.com --tier pro
```
The second command prints a `TRMCP-...` key to send to the buyer. Keep
`keys/private.pem` secret and backed up (it's git-ignored) — anyone with it
can mint valid licenses. `src/license/publicKey.ts` is the corresponding
public key embedded in the published package, so existing installs can
verify keys signed with your private key.

## Development

```bash
npm run dev       # run the MCP server with ts-node (no build step)
npm run build     # compile to dist/
npm start         # run compiled MCP server (dist/server.js)
npm run dashboard # run the local usage dashboard (dist/dashboard/server.js)
node test.mjs     # run all 7 tool examples end-to-end
```
