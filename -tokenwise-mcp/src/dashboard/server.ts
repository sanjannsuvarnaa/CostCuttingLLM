#!/usr/bin/env node
import { createServer } from "http";
import { getUsage } from "../utils/usageStore.js";
import { getNamespace } from "../utils/paths.js";
import { renderDashboardHtml, renderLockedHtml } from "./html.js";
import { checkAccess, PURCHASE_URL } from "../license/gate.js";

const PORT = Number(process.env.TOKENWISE_DASHBOARD_PORT) || 4317;
const DAYS = 30;

const server = createServer((req, res) => {
  const url = req.url ?? "/";
  const access = checkAccess();

  if (url === "/api/usage") {
    if (!access.allowed) {
      res.writeHead(402, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: access.message, purchaseUrl: PURCHASE_URL }));
      return;
    }
    const usage = getUsage(DAYS);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ namespace: getNamespace(), ...usage }));
    return;
  }

  if (url === "/" || url === "/index.html") {
    if (!access.allowed) {
      res.writeHead(402, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderLockedHtml(access.message, PURCHASE_URL));
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderDashboardHtml());
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`tokenwise dashboard running at http://localhost:${PORT} (namespace: ${getNamespace()})\n`);
});
