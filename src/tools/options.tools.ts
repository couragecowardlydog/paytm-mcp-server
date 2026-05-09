import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TokenManager } from "../auth/token-manager.js";
import type { PaytmClient } from "../client/pm-client.js";
import { withErrorHandling } from "../utils/error-handler.js";
import { z } from "zod";

const OptionChainSchema = z.object({
  type: z.enum(["CE", "PE", "BOTH"]),
  underlying: z.string(),
  expiry: z.string(),
});

/**
 * Register options tools: paytm_get_option_chain
 */
export function registerOptionsTools(
  server: McpServer,
  tokenManager: TokenManager,
  client: PaytmClient,
): void {
  const origGetOptionChain = client.getOptionChain.bind(client);
  client.getOptionChain = async (publicAccessToken: string, params: Record<string, unknown>) => {
    if (!publicAccessToken) {
      throw new Error("Not authenticated: public_access_token is required");
    }
    tokenManager.assertNotExpired();
    const validated = OptionChainSchema.parse(params);
    return origGetOptionChain(publicAccessToken, validated);
  };

  server.tool(
    "paytm_get_option_chain",
    "Get option chain data for an underlying instrument",
    {
      type: z.enum(["CE", "PE", "BOTH"]),
      underlying: z.string(),
      expiry: z.string(),
    },
    async (params) => {
      return withErrorHandling(async () => {
        tokenManager.assertAuthenticated();
        tokenManager.assertNotExpired();
        const token = tokenManager.getPublicToken()!;
        return client.getOptionChain(token, params);
      });
    },
  );
}
