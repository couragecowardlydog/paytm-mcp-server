import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TokenManager } from "../auth/token-manager.js";
import type { PaytmClient } from "../client/pm-client.js";
import { withErrorHandling } from "../utils/error-handler.js";
import { z } from "zod";

const ChargesSchema = z.object({
  segment: z.enum(["E"]),
  exchange: z.enum(["NSE", "BSE"]),
  txn_type: z.enum(["B", "S"]),
  qty: z.number().positive(),
  price: z.number().positive(),
  product: z.enum(["C", "I"]),
});

/**
 * Register charges tools: paytm_get_charges
 */
export function registerChargesTools(
  server: McpServer,
  tokenManager: TokenManager,
  client: PaytmClient,
): void {
  const origGetCharges = client.getCharges.bind(client);
  client.getCharges = async (readAccessToken: string, params: Record<string, unknown>) => {
    if (!readAccessToken) {
      throw new Error("Not authenticated: read_access_token is required");
    }
    tokenManager.assertNotExpired();
    const validated = ChargesSchema.parse(params);
    return origGetCharges(readAccessToken, validated);
  };

  server.tool(
    "paytm_get_charges",
    "Get estimated charges for an equity trade",
    {
      segment: z.enum(["E"]),
      exchange: z.enum(["NSE", "BSE"]),
      txn_type: z.enum(["B", "S"]),
      qty: z.number().positive(),
      price: z.number().positive(),
      product: z.enum(["C", "I"]),
    },
    async (params) => {
      return withErrorHandling(async () => {
        tokenManager.assertAuthenticated();
        tokenManager.assertNotExpired();
        const token = tokenManager.getReadToken()!;
        return client.getCharges(token, params);
      });
    },
  );
}
