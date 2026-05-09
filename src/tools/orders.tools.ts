import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TokenManager } from "../auth/token-manager.js";
import type { PaytmClient } from "../client/pm-client.js";
import { withErrorHandling } from "../utils/error-handler.js";

/**
 * Register order tools: paytm_get_order_book
 */
export function registerOrderTools(
  server: McpServer,
  tokenManager: TokenManager,
  client: PaytmClient,
): void {
  server.tool("paytm_get_order_book", "Get order book with all orders", {}, async () => {
    return withErrorHandling(async () => {
      tokenManager.assertAuthenticated();
      tokenManager.assertNotExpired();
      const token = tokenManager.getReadToken()!;
      const orders = await client.getOrderBook(token);
      if (orders.length === 0) return "No orders found.";
      return JSON.stringify(orders, null, 2);
    });
  });
}
