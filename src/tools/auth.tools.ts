import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TokenManager } from "../auth/token-manager.js";
import { generateLoginUrl, generateState } from "../auth/oauth-flow.js";
import type { PaytmClient } from "../client/pm-client.js";
import type { CallbackServer } from "../auth/callback-server.js";
import { z } from "zod";

/**
 * Register auth tools: paytm_login, paytm_set_tokens, paytm_auth_status
 */
export function registerAuthTools(
  server: McpServer,
  tokenManager: TokenManager,
  client: PaytmClient,
  apiKey: string,
  apiSecret: string,
  callbackServer: CallbackServer,
): void {
  server.tool(
    "paytm_login",
    "Generate Paytm Money login URL for OAuth authentication",
    { state: z.string().optional() },
    async () => {
      // If already authenticated, return early
      if (tokenManager.isAuthenticated()) {
        const state = tokenManager.getState();
        if (state.expiresAt === null || Date.now() < state.expiresAt) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Already authenticated. Use paytm_auth_status to check session details.",
              },
            ],
          };
        }
      }

      // Generate CSRF state
      const csrfState = generateState(apiSecret);
      const url = generateLoginUrl(apiKey, csrfState);

      // Try to start callback server
      try {
        await callbackServer.start(csrfState);
        return {
          content: [
            {
              type: "text" as const,
              text: `Open this URL to login:\n${url}\n\nA local callback server is running — authentication will complete automatically when you log in.`,
            },
          ],
        };
      } catch {
        // Port busy (EADDRINUSE) — fall back to manual flow
        return {
          content: [
            {
              type: "text" as const,
              text: `Open this URL to login:\n${url}\n\nAutomatic callback failed (port busy). After login, copy the 'requestToken' from the redirect URL and call paytm_set_tokens with it.`,
            },
          ],
        };
      }
    },
  );

  server.tool(
    "paytm_set_tokens",
    "Set authentication tokens (exchange request_token or provide tokens directly)",
    {
      request_token: z.string().min(1).optional(),
      access_token: z.string().min(1).optional(),
      public_access_token: z.string().min(1).optional(),
      read_access_token: z.string().min(1).optional(),
    },
    async ({ request_token, access_token, public_access_token, read_access_token }) => {
      const hasRequestToken = !!request_token;
      const hasManualTokens = !!(access_token || public_access_token || read_access_token);

      if (!hasRequestToken && !hasManualTokens) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Provide either request_token or at least one of access_token, public_access_token, read_access_token.",
            },
          ],
          isError: true,
        };
      }

      if (hasRequestToken && hasManualTokens) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Provide either request_token OR manual tokens, not both.",
            },
          ],
          isError: true,
        };
      }

      try {
        if (hasRequestToken) {
          const response = await client.exchangeToken(apiKey, apiSecret, request_token!);
          tokenManager.setTokens({
            accessToken: response.access_token,
            publicAccessToken: response.public_access_token,
            readAccessToken: response.read_access_token,
          });
          return {
            content: [
              { type: "text" as const, text: "Authentication successful. All 3 tokens stored." },
            ],
          };
        } else {
          tokenManager.setTokens({
            accessToken: access_token,
            publicAccessToken: public_access_token,
            readAccessToken: read_access_token,
          });
          return {
            content: [{ type: "text" as const, text: "Manual tokens stored successfully." }],
          };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "paytm_auth_status",
    "Check authentication status and callback server state",
    {},
    async () => {
      const authenticated = tokenManager.isAuthenticated();
      const state = tokenManager.getState();
      const cbRunning = callbackServer.isRunning();

      const status: Record<string, unknown> = {
        authenticated,
        callback_server_running: cbRunning,
      };

      if (authenticated && state.expiresAt !== null) {
        status.expires_at = new Date(state.expiresAt).toISOString();
        status.expires_in_minutes = Math.max(0, Math.round((state.expiresAt - Date.now()) / 60000));
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(status, null, 2) }],
      };
    },
  );
}
