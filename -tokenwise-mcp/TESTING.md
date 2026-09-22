# Beta Testing Guide

Thanks for trying **tokenwise-mcp**! It's currently in **free beta** —
every tool and the usage dashboard are fully unlocked, no license key needed
(see the "Licensing" section of README.md for details).

## 1. Install

```bash
npm install -g tokenwise-mcp
```

This installs the `tokenwise-mcp` (MCP server) and `tokenwise-dashboard`
commands. Requires Node.js 18+.

## 2. Add it to your MCP client

**Claude Code:**
```bash
claude mcp add tokenwise tokenwise-mcp
```

**Claude Desktop** — add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "tokenwise": {
      "command": "tokenwise-mcp"
    }
  }
}
```

Then restart your client.

### Optional: proactive mode

By default tools only run when you ask. To have Claude ask once (at session
start) whether it should use tokenwise tools automatically from then on:
```bash
npx tokenwise-mcp setup
```
Then restart Claude Code (or open `/hooks` once). See the "Proactive mode"
section of README.md for details.

## 3. Things to try

- `compress_prompt` — compress a verbose prompt and check the savings.
- `chunk_document` — paste a long doc + a question, see which chunks come back.
- `plan_prompt_caching` — feed it a system prompt + messages from a real
  agent loop and see the suggested cache breakpoints and savings estimate.
- `estimate_tokens` — check token counts/cost estimates for different models.
- `summarize_context` / `optimize_system_prompt` / `cache_context` — the
  remaining compression helpers.
- `get_stats` — see cumulative/daily savings (also shows trial/license status).
- `activate_license` — call with no arguments to see the current status
  message (no key needed during the beta).

## 4. Dashboard

```bash
tokenwise-dashboard
```
Open http://localhost:4317 to see a daily token-savings chart.

## 5. Feedback

Anything that breaks, feels confusing, or that you'd want to see added —
email **rohan2072001@gmail.com**. Useful details: which tool, the
input you gave it, and what you expected vs. what happened.
