import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TokenManager } from "../auth/token-manager.js";
import type { PaytmClient } from "../client/pm-client.js";
import { withErrorHandling } from "../utils/error-handler.js";
import { z } from "zod";

const LivePriceInputSchema = z.object({
  mode: z.enum(["LTP", "FULL", "QUOTE"]),
  pref: z
    .array(
      z.object({
        exchange: z.enum(["NSE", "BSE"]),
        mode: z.enum(["LTP", "FULL", "QUOTE"]),
        security_id: z.string(),
      }),
    )
    .nonempty(),
});

const SearchInstrumentsInputSchema = z.object({
  query: z.string().min(1),
  exchange: z.enum(["NSE", "BSE"]).optional(),
});

/**
 * Register market data tools: paytm_get_live_price, paytm_search_instruments
 */
export function registerMarketTools(
  server: McpServer,
  tokenManager: TokenManager,
  client: PaytmClient,
): void {
  // Wrap client methods with validation
  const origGetLivePrice = client.getLivePrice.bind(client);
  client.getLivePrice = async (publicAccessToken: string, mode: string, pref: unknown[]) => {
    if (!publicAccessToken) {
      throw new Error("Not authenticated: public_access_token is required");
    }
    tokenManager.assertNotExpired();
    const validated = LivePriceInputSchema.parse({ mode, pref });
    return origGetLivePrice(publicAccessToken, validated.mode, validated.pref);
  };

  const origSearchInstruments = client.searchInstruments.bind(client);
  client.searchInstruments = async (
    publicAccessToken: string,
    query: string,
    exchange?: string,
  ) => {
    if (!publicAccessToken) {
      throw new Error("Not authenticated: public_access_token is required");
    }
    tokenManager.assertNotExpired();
    const validated = SearchInstrumentsInputSchema.parse({ query, exchange });
    return origSearchInstruments(publicAccessToken, validated.query, validated.exchange);
  };

  // Register MCP tools
  server.tool(
    "paytm_get_live_price",
    "Get live price data for one or more instruments",
    {
      mode: z.enum(["LTP", "FULL", "QUOTE"]),
      pref: z.array(
        z.object({
          exchange: z.enum(["NSE", "BSE"]),
          mode: z.enum(["LTP", "FULL", "QUOTE"]),
          security_id: z.string(),
        }),
      ),
    },
    async ({ mode, pref }) => {
      return withErrorHandling(async () => {
        tokenManager.assertAuthenticated();
        tokenManager.assertNotExpired();
        const token = tokenManager.getPublicToken()!;
        return client.getLivePrice(token, mode, pref);
      });
    },
  );

  server.tool(
    "paytm_search_instruments",
    "Search for tradeable instruments by symbol or company name",
    {
      query: z.string().min(1),
      exchange: z.enum(["NSE", "BSE"]).optional(),
    },
    async ({ query, exchange }) => {
      return withErrorHandling(async () => {
        tokenManager.assertAuthenticated();
        tokenManager.assertNotExpired();
        const token = tokenManager.getPublicToken()!;
        return client.searchInstruments(token, query, exchange);
      });
    },
  );
}
