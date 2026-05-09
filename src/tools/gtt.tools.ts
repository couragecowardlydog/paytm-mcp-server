import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TokenManager } from "../auth/token-manager.js";
import type { PaytmClient } from "../client/pm-client.js";
import { withErrorHandling } from "../utils/error-handler.js";
import { z } from "zod";

const CreateGttSchema = z
  .object({
    segment: z.enum(["E"]),
    exchange: z.enum(["NSE", "BSE"]),
    security_id: z.string(),
    product_type: z.string(),
    set_price: z.number(),
    transaction_type: z.enum(["B", "S"]),
    order_type: z.enum(["LMT", "MKT"]),
    quantity: z.number().int().positive(),
    price: z.number().positive().optional(),
    trigger_type: z.enum(["SINGLE", "TWO_LEG"]),
    secondary_set_price: z.number().optional(),
    secondary_transaction_type: z.enum(["B", "S"]).optional(),
    secondary_order_type: z.enum(["LMT", "MKT"]).optional(),
    secondary_quantity: z.number().int().positive().optional(),
    secondary_price: z.number().positive().optional(),
  })
  .refine(
    (data) => {
      if (data.order_type === "LMT" && data.price === undefined) return false;
      return true;
    },
    { message: "price is required for LMT order type" },
  )
  .refine(
    (data) => {
      if (data.trigger_type === "TWO_LEG") {
        if (data.secondary_set_price === undefined) return false;
        if (data.secondary_transaction_type === undefined) return false;
        if (data.secondary_quantity === undefined) return false;
        if (data.secondary_order_type === "LMT" && data.secondary_price === undefined) return false;
      }
      return true;
    },
    {
      message:
        "secondary_set_price, secondary_transaction_type, secondary_quantity are required for TWO_LEG trigger type, and secondary_price is required when secondary_order_type is LMT",
    },
  );

const UpdateGttSchema = z
  .object({
    id: z.number(),
    segment: z.enum(["E"]),
    exchange: z.enum(["NSE", "BSE"]),
    security_id: z.string(),
    product_type: z.string(),
    set_price: z.number(),
    transaction_type: z.enum(["B", "S"]),
    order_type: z.enum(["LMT", "MKT"]),
    quantity: z.number().int().positive(),
    price: z.number().positive().optional(),
    trigger_type: z.enum(["SINGLE", "TWO_LEG"]),
    secondary_set_price: z.number().optional(),
    secondary_transaction_type: z.enum(["B", "S"]).optional(),
    secondary_order_type: z.enum(["LMT", "MKT"]).optional(),
    secondary_quantity: z.number().int().positive().optional(),
    secondary_price: z.number().positive().optional(),
  })
  .refine(
    (data) => {
      if (data.order_type === "LMT" && data.price === undefined) return false;
      return true;
    },
    { message: "price is required for LMT order type" },
  )
  .refine(
    (data) => {
      if (data.trigger_type === "TWO_LEG") {
        if (data.secondary_set_price === undefined) return false;
        if (data.secondary_transaction_type === undefined) return false;
        if (data.secondary_quantity === undefined) return false;
        if (data.secondary_order_type === "LMT" && data.secondary_price === undefined) return false;
      }
      return true;
    },
    {
      message:
        "secondary_set_price, secondary_transaction_type, secondary_quantity are required for TWO_LEG trigger type, and secondary_price is required when secondary_order_type is LMT",
    },
  );

const GetGttSchema = z.object({
  id: z.number(),
});

const DeleteGttSchema = z.object({
  id: z.number(),
});

/**
 * Register GTT tools: paytm_create_gtt, paytm_get_gtt, paytm_update_gtt, paytm_delete_gtt, paytm_get_gtt_aggregate
 */
export function registerGttTools(
  server: McpServer,
  tokenManager: TokenManager,
  client: PaytmClient,
): void {
  const origCreateGtt = client.createGtt.bind(client);
  client.createGtt = async (accessToken: string, params: Record<string, unknown>) => {
    if (!accessToken) {
      throw new Error("Not authenticated: access_token is required");
    }
    tokenManager.assertNotExpired();
    const validated = CreateGttSchema.parse(params);
    return origCreateGtt(accessToken, validated);
  };

  const origGetGtt = client.getGtt.bind(client);
  client.getGtt = async (accessToken: string, id: number) => {
    if (!accessToken) {
      throw new Error("Not authenticated: access_token is required");
    }
    tokenManager.assertNotExpired();
    const validated = GetGttSchema.parse({ id });
    return origGetGtt(accessToken, validated.id);
  };

  const origUpdateGtt = client.updateGtt.bind(client);
  client.updateGtt = async (accessToken: string, params: Record<string, unknown>) => {
    if (!accessToken) {
      throw new Error("Not authenticated: access_token is required");
    }
    tokenManager.assertNotExpired();
    const validated = UpdateGttSchema.parse(params);
    return origUpdateGtt(accessToken, validated);
  };

  const origDeleteGtt = client.deleteGtt.bind(client);
  client.deleteGtt = async (accessToken: string, id: number) => {
    if (!accessToken) {
      throw new Error("Not authenticated: access_token is required");
    }
    tokenManager.assertNotExpired();
    const validated = DeleteGttSchema.parse({ id });
    return origDeleteGtt(accessToken, validated.id);
  };

  const origGetGttAggregate = client.getGttAggregate.bind(client);
  client.getGttAggregate = async (accessToken: string) => {
    if (!accessToken) {
      throw new Error("Not authenticated: access_token is required");
    }
    tokenManager.assertNotExpired();
    return origGetGttAggregate(accessToken);
  };

  server.tool(
    "paytm_create_gtt",
    "Create a new GTT (Good Till Triggered) order",
    {
      segment: z.enum(["E"]),
      exchange: z.enum(["NSE", "BSE"]),
      security_id: z.string(),
      product_type: z.string(),
      set_price: z.number(),
      transaction_type: z.enum(["B", "S"]),
      order_type: z.enum(["LMT", "MKT"]),
      quantity: z.number().int().positive(),
      price: z.number().positive().optional(),
      trigger_type: z.enum(["SINGLE", "TWO_LEG"]),
      secondary_set_price: z.number().optional(),
      secondary_transaction_type: z.enum(["B", "S"]).optional(),
      secondary_order_type: z.enum(["LMT", "MKT"]).optional(),
      secondary_quantity: z.number().int().positive().optional(),
      secondary_price: z.number().positive().optional(),
    },
    async (params) => {
      return withErrorHandling(async () => {
        tokenManager.assertAuthenticated();
        tokenManager.assertNotExpired();
        const token = tokenManager.getAccessToken()!;
        return client.createGtt(token, params);
      });
    },
  );

  server.tool(
    "paytm_get_gtt",
    "Get details of a GTT order by ID",
    {
      id: z.number(),
    },
    async ({ id }) => {
      return withErrorHandling(async () => {
        tokenManager.assertAuthenticated();
        tokenManager.assertNotExpired();
        const token = tokenManager.getAccessToken()!;
        return client.getGtt(token, id);
      });
    },
  );

  server.tool(
    "paytm_update_gtt",
    "Update an existing GTT order",
    {
      id: z.number(),
      segment: z.enum(["E"]),
      exchange: z.enum(["NSE", "BSE"]),
      security_id: z.string(),
      product_type: z.string(),
      set_price: z.number(),
      transaction_type: z.enum(["B", "S"]),
      order_type: z.enum(["LMT", "MKT"]),
      quantity: z.number().int().positive(),
      price: z.number().positive().optional(),
      trigger_type: z.enum(["SINGLE", "TWO_LEG"]),
      secondary_set_price: z.number().optional(),
      secondary_transaction_type: z.enum(["B", "S"]).optional(),
      secondary_order_type: z.enum(["LMT", "MKT"]).optional(),
      secondary_quantity: z.number().int().positive().optional(),
      secondary_price: z.number().positive().optional(),
    },
    async (params) => {
      return withErrorHandling(async () => {
        tokenManager.assertAuthenticated();
        tokenManager.assertNotExpired();
        const token = tokenManager.getAccessToken()!;
        return client.updateGtt(token, params);
      });
    },
  );

  server.tool(
    "paytm_delete_gtt",
    "Delete a GTT order by ID",
    {
      id: z.number(),
    },
    async ({ id }) => {
      return withErrorHandling(async () => {
        tokenManager.assertAuthenticated();
        tokenManager.assertNotExpired();
        const token = tokenManager.getAccessToken()!;
        return client.deleteGtt(token, id);
      });
    },
  );

  server.tool("paytm_get_gtt_aggregate", "Get aggregate GTT order statistics", {}, async () => {
    return withErrorHandling(async () => {
      tokenManager.assertAuthenticated();
      tokenManager.assertNotExpired();
      const token = tokenManager.getAccessToken()!;
      return client.getGttAggregate(token);
    });
  });
}
