import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TokenManager } from "./auth/token-manager.js";
import { PaytmClient } from "./client/pm-client.js";
import { CallbackServer } from "./auth/callback-server.js";
import { registerAuthTools } from "./tools/auth.tools.js";
import { registerPortfolioTools } from "./tools/portfolio.tools.js";
import { registerAccountTools } from "./tools/account.tools.js";
import { registerOrderTools } from "./tools/orders.tools.js";
import { registerTradeTools } from "./tools/trade.tools.js";
import { registerMarketTools } from "./tools/market.tools.js";
import { registerGttTools } from "./tools/gtt.tools.js";
import { registerOptionsTools } from "./tools/options.tools.js";
import { registerChargesTools } from "./tools/charges.tools.js";

async function main(): Promise<void> {
  const apiKey = process.env.PAYTM_API_KEY;
  const apiSecret = process.env.PAYTM_API_SECRET;

  if (!apiKey) {
    console.error("PAYTM_API_KEY is required");
    process.exit(1);
  }

  if (!apiSecret) {
    console.error("PAYTM_API_SECRET is required");
    process.exit(1);
  }

  const excludedTools = (process.env.PAYTM_EXCLUDED_TOOLS ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const server = new McpServer({ name: "paytm-money-mcp", version: "1.0.0" });

  const tokenManager = new TokenManager();
  const client = new PaytmClient();

  const callbackPort = parseInt(process.env.PAYTM_CALLBACK_PORT ?? "18628", 10);
  const callbackTimeout = parseInt(process.env.PAYTM_CALLBACK_TIMEOUT ?? "300000", 10);
  const callbackServer = new CallbackServer({
    tokenManager,
    client,
    apiKey,
    apiSecret,
    port: callbackPort,
    timeout: callbackTimeout,
  });

  // Register all tool groups
  registerAuthTools(server, tokenManager, client, apiKey, apiSecret, callbackServer);
  registerPortfolioTools(server, tokenManager, client);
  registerAccountTools(server, tokenManager, client);
  registerOrderTools(server, tokenManager, client);
  registerTradeTools(server, tokenManager, client);
  registerMarketTools(server, tokenManager, client);
  registerGttTools(server, tokenManager, client);
  registerOptionsTools(server, tokenManager, client);
  registerChargesTools(server, tokenManager, client);

  // Note: excludedTools filtering is handled at the PAYTM_EXCLUDED_TOOLS env var level
  // Tools listed in excludedTools are parsed but actual tool deregistration
  // would require tracking RegisteredTool refs (future enhancement)
  void excludedTools;

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
