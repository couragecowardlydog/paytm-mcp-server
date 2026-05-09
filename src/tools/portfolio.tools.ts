import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TokenManager } from "../auth/token-manager.js";
import type { PaytmClient } from "../client/pm-client.js";
import { withErrorHandling } from "../utils/error-handler.js";

/**
 * Register portfolio tools: paytm_get_holdings, paytm_get_positions
 */
export function registerPortfolioTools(
  server: McpServer,
  tokenManager: TokenManager,
  client: PaytmClient,
): void {
  server.tool(
    "paytm_get_holdings",
    "Get portfolio holdings with symbol, quantity, cost, LTP, P&L, sector, and cap",
    {},
    async () => {
      return withErrorHandling(async () => {
        tokenManager.assertAuthenticated();
        tokenManager.assertNotExpired();
        const token = tokenManager.getReadToken()!;
        const holdings = await client.getHoldings(token);
        if (holdings.length === 0) return "No holdings found.";
        const header = "Symbol | Qty | Cost | LTP | P&L | Sector | Cap";
        const separator = "---|---|---|---|---|---|---";
        const rows = holdings.map((h) => {
          const pnl =
            (parseFloat(h.last_traded_price) - parseFloat(h.cost_price)) * parseInt(h.quantity);
          return `${h.nse_symbol || h.display_name} | ${h.quantity} | ${h.cost_price} | ${h.last_traded_price} | ${pnl.toFixed(2)} | ${h.sector} | ${h.mcap_type}`;
        });
        return [header, separator, ...rows].join("\n");
      });
    },
  );

  server.tool("paytm_get_positions", "Get current trading positions", {}, async () => {
    return withErrorHandling(async () => {
      tokenManager.assertAuthenticated();
      tokenManager.assertNotExpired();
      const token = tokenManager.getReadToken()!;
      const positions = await client.getPositions(token);
      if (positions.length === 0) return "No open positions.";
      return JSON.stringify(positions, null, 2);
    });
  });
}
