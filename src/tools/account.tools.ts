import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TokenManager } from "../auth/token-manager.js";
import type { PaytmClient } from "../client/pm-client.js";
import { withErrorHandling } from "../utils/error-handler.js";
import { z } from "zod";

/**
 * Register account tools: paytm_get_user_details, paytm_get_funds
 */
export function registerAccountTools(
  server: McpServer,
  tokenManager: TokenManager,
  client: PaytmClient,
): void {
  server.tool(
    "paytm_get_user_details",
    "Get user profile details (name, email, PAN, broker)",
    {},
    async () => {
      return withErrorHandling(async () => {
        tokenManager.assertAuthenticated();
        tokenManager.assertNotExpired();
        const token = tokenManager.getReadToken()!;
        const details = await client.getUserDetails(token);
        return JSON.stringify(details, null, 2);
      });
    },
  );

  server.tool(
    "paytm_get_funds",
    "Get funds summary (available balance, utilized, collateral, total)",
    {
      config: z
        .object({
          type: z.enum(["ALL", "EQUITY", "COMMODITY"]),
        })
        .optional(),
    },
    async ({ config }) => {
      return withErrorHandling(async () => {
        tokenManager.assertAuthenticated();
        tokenManager.assertNotExpired();
        const token = tokenManager.getReadToken()!;
        const funds = await client.getFundsSummary(token, config);
        return JSON.stringify(funds, null, 2);
      });
    },
  );
}
