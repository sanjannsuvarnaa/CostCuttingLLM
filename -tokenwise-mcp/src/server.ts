#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { compressPrompt } from "./tools/compressPrompt.js";
import { summarizeContext } from "./tools/summarizeContext.js";
import { chunkDocument } from "./tools/chunkDocument.js";
import { estimateTokens } from "./tools/estimateTokens.js";
import { optimizeSystemPrompt } from "./tools/optimizeSystemPrompt.js";
import { cacheContext } from "./tools/cacheContext.js";
import { planPromptCaching } from "./tools/planPromptCaching.js";
import { setProactiveMode } from "./tools/setProactiveMode.js";
import { smartTokenOptimizer } from "./tools/smartTokenOptimizer.js";
import { recordUsage, getUsage, todayKey } from "./utils/usageStore.js";
import { getNamespace } from "./utils/paths.js";
import { checkAccess } from "./license/gate.js";
import { activateLicenseKey } from "./license/license.js";
import { runSetup, runUninstall } from "./cliSetup.js";

const server = new Server(
  { name: "tokenwise-mcp", version: "1.2.0" },
  { capabilities: { tools: {} } }
);

// Cumulative stats for this process; daily/all-time stats are persisted via usageStore.
const stats = { totalTokensSaved: 0, callCount: 0 };
function trackSavings(toolName: string, tokensSaved: number) {
  stats.totalTokensSaved += tokensSaved;
  stats.callCount++;
  recordUsage(toolName, tokensSaved);
  process.stderr.write(`[${toolName}] saved ${tokensSaved} tokens | cumulative: ${stats.totalTokensSaved}\n`);
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "compress_prompt",
      description: "Compress a prompt to reduce token usage by removing filler phrases and verbose wording.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "The prompt text to compress" },
          aggressiveness: { type: "string", enum: ["low", "medium", "high"], default: "medium" },
        },
        required: ["prompt"],
      },
    },
    {
      name: "summarize_context",
      description: "Summarize conversation history, keeping recent messages verbatim and compressing older ones.",
      inputSchema: {
        type: "object",
        properties: {
          messages: {
            type: "array",
            items: {
              type: "object",
              properties: {
                role: { type: "string" },
                content: { type: "string" },
              },
              required: ["role", "content"],
            },
          },
          maxTokens: { type: "number", default: 4000 },
        },
        required: ["messages"],
      },
    },
    {
      name: "chunk_document",
      description: "Split a document into chunks and return only the most relevant ones for a query.",
      inputSchema: {
        type: "object",
        properties: {
          document: { type: "string" },
          query: { type: "string" },
          maxChunks: { type: "number", default: 3 },
          chunkSize: { type: "number", default: 500 },
        },
        required: ["document", "query"],
      },
    },
    {
      name: "estimate_tokens",
      description: "Count tokens in text and estimate cost for a given model.",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string" },
          model: { type: "string", default: "gpt-4o" },
        },
        required: ["text"],
      },
    },
    {
      name: "optimize_system_prompt",
      description: "Shorten a system prompt by converting verbose prose into concise bullet directives.",
      inputSchema: {
        type: "object",
        properties: {
          systemPrompt: { type: "string" },
        },
        required: ["systemPrompt"],
      },
    },
    {
      name: "cache_context",
      description: "Store or retrieve reusable context snippets locally to avoid re-sending boilerplate.",
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["set", "get", "list", "delete"] },
          key: { type: "string" },
          value: { type: "string" },
        },
        required: ["action", "key"],
      },
    },
    {
      name: "plan_prompt_caching",
      description: "Analyze a system prompt, tool definitions, and message history, and place Anthropic prompt-cache breakpoints (cache_control) at the optimal positions to maximize savings on repeated/agent-loop calls.",
      inputSchema: {
        type: "object",
        properties: {
          system: { type: "string", description: "The system prompt text" },
          tools: { type: "array", description: "Tool definitions that will be sent with the request", items: {} },
          messages: {
            type: "array",
            items: {
              type: "object",
              properties: {
                role: { type: "string" },
                content: { type: "string" },
              },
              required: ["role", "content"],
            },
          },
          model: { type: "string", default: "claude-3-5-sonnet" },
        },
        required: ["messages"],
      },
    },
    {
      name: "get_stats",
      description: "Get token savings stats: this session, today, the last 7 days, and all-time totals (persisted to disk).",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "activate_license",
      description: "Activate a tokenwise-mcp license key, or check current license/trial status if no key is given.",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string", description: "License key (starts with TRMCP-). Omit to check current status." },
        },
      },
    },
    {
      name: "set_proactive_mode",
      description: "Record the user's one-time decision about whether Claude should use tokenwise tools proactively (without being asked) in this and future sessions. Call once after asking the user; the choice is persisted and remembered across sessions.",
      inputSchema: {
        type: "object",
        properties: {
          enabled: { type: "boolean", description: "true to enable proactive/automatic tool use, false to require explicit requests." },
        },
        required: ["enabled"],
      },
    },
        {
      name: "smart_token_optimizer",
      description:
        "Automatically optimize an LLM request to fit within a specified token budget.",
      inputSchema: {
        type: "object",
        properties: {
          systemPrompt: {
            type: "string",
            description: "The system prompt used by the LLM.",
          },
          messages: {
            type: "array",
            description: "Conversation history.",
            items: {
              type: "object",
              properties: {
                role: { type: "string" },
                content: { type: "string" },
              },
              required: ["role", "content"],
            },
          },
          document: {
            type: "string",
            description: "Document or retrieved context.",
          },
          query: {
            type: "string",
            description: "Current user query.",
          },
          maxTokens: {
            type: "number",
            description: "Maximum allowed input token budget.",
          },
        },
        required: [
          "systemPrompt",
          "messages",
          "document",
          "query",
          "maxTokens",
        ],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name !== "activate_license" && name !== "set_proactive_mode") {
    const access = checkAccess();
    if (!access.allowed) {
      return {
        content: [{ type: "text", text: `Error: ${access.message}` }],
        isError: true,
      };
    }
  }

  try {
    let result: unknown;

    switch (name) {
      case "compress_prompt": {
        const { prompt, aggressiveness = "medium" } = args as { prompt: string; aggressiveness?: "low" | "medium" | "high" };
        result = compressPrompt(prompt, aggressiveness);
        trackSavings("compress_prompt", (result as { tokensSaved: number }).tokensSaved);
        break;
      }
      case "summarize_context": {
        const { messages, maxTokens = 4000 } = args as { messages: Array<{ role: string; content: string }>; maxTokens?: number };
        result = summarizeContext(messages, maxTokens);
        trackSavings("summarize_context", (result as { tokensSaved: number }).tokensSaved);
        break;
      }
      case "chunk_document": {
        const { document, query, maxChunks = 3, chunkSize = 500 } = args as { document: string; query: string; maxChunks?: number; chunkSize?: number };
        result = chunkDocument(document, query, maxChunks, chunkSize);
        trackSavings("chunk_document", (result as { tokensSaved: number }).tokensSaved);
        break;
      }
      case "estimate_tokens": {
        const { text, model = "gpt-4o" } = args as { text: string; model?: string };
        result = estimateTokens(text, model);
        break;
      }
      case "optimize_system_prompt": {
        const { systemPrompt } = args as { systemPrompt: string };
        result = optimizeSystemPrompt(systemPrompt);
        trackSavings("optimize_system_prompt", (result as { tokensSaved: number }).tokensSaved);
        break;
      }
            case "smart_token_optimizer": {
        const {
          systemPrompt,
          messages,
          document,
          query,
          maxTokens,
        } = args as {
          systemPrompt: string;
          messages: Array<{ role: string; content: string }>;
          document: string;
          query: string;
          maxTokens: number;
        };

        result = smartTokenOptimizer(
          systemPrompt,
          messages,
          document,
          query,
          maxTokens
        );

        trackSavings(
          "smart_token_optimizer",
          (result as { tokensSaved: number }).tokensSaved
        );

        break;
      }
      case "cache_context": {
        const { action, key, value } = args as { action: "set" | "get" | "list" | "delete"; key: string; value?: string };
        result = cacheContext(action, key, value);
        break;
      }
      case "plan_prompt_caching": {
        const { system, tools, messages, model = "claude-3-5-sonnet" } = args as {
          system?: string; tools?: unknown[]; messages: Array<{ role: string; content: string }>; model?: string;
        };
        result = planPromptCaching(messages, system, tools, model);
        trackSavings("plan_prompt_caching", (result as { cachedTokens: number }).cachedTokens);
        break;
      }
      case "get_stats": {
        const usage = getUsage(7);
        const today = usage.days.find(d => d.date === todayKey())
          ?? { date: todayKey(), totalCalls: 0, totalTokensSaved: 0, tools: {} };
        result = {
          session: { totalTokensSaved: stats.totalTokensSaved, callCount: stats.callCount },
          today,
          last7Days: usage.days,
          allTime: usage.allTime,
          namespace: getNamespace(),
          license: checkAccess(),
          dashboard: "Run `npm run dashboard` (or `node dist/dashboard/server.js`) to view daily usage charts.",
        };
        break;
      }
      case "activate_license": {
        const { key } = args as { key?: string };
        if (!key) {
          result = checkAccess();
          break;
        }
        const info = activateLicenseKey(key);
        result = info
          ? { success: true, message: `Activated for ${info.email} (${info.tier}).` }
          : { success: false, message: "Invalid license key." };
        break;
      }
      case "set_proactive_mode": {
        const { enabled } = args as { enabled: boolean };
        result = setProactiveMode(enabled);
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function main() {
  const access = checkAccess();
  process.stderr.write(`[license] ${access.message}\n`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("tokenwise-mcp server running on stdio\n");
}

if (process.argv[2] === "setup" || process.argv[2] === "uninstall") {
  try {
    if (process.argv[2] === "setup") runSetup();
    else runUninstall();
    process.exit(0);
  } catch (err) {
    process.stderr.write(`Fatal: ${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
  }
} else {
  main().catch((err) => {
    process.stderr.write(`Fatal: ${err}\n`);
    process.exit(1);
  });
}
