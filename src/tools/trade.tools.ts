import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TokenManager } from "../auth/token-manager.js";
import type { PaytmClient } from "../client/pm-client.js";
import { withErrorHandling } from "../utils/error-handler.js";
import { z } from "zod";

const PlaceOrderSchema = z
  .object({
    txn_type: z.enum(["B", "S"]),
    exchange: z.enum(["NSE", "BSE"]),
    segment: z.enum(["E"]),
    product: z.enum(["C", "I", "V", "B"]),
    security_id: z.string(),
    quantity: z.number().int().positive(),
    validity: z.enum(["DAY", "IOC"]),
    order_type: z.enum(["LMT", "MKT", "SL", "SLM"]),
    price: z.number().positive().optional(),
    trigger_price: z.number().positive().optional(),
    sl_price: z.number().optional(),
    tp_price: z.number().optional(),
    source: z.enum(["N", "M"]).default("N"),
  })
  .refine(
    (data) => {
      if ((data.order_type === "LMT" || data.order_type === "SL") && data.price === undefined)
        return false;
      return true;
    },
    { message: "price is required for LMT and SL order types" },
  )
  .refine(
    (data) => {
      if (
        (data.order_type === "SL" || data.order_type === "SLM") &&
        data.trigger_price === undefined
      )
        return false;
      return true;
    },
    { message: "trigger_price is required for SL and SLM order types" },
  );

const ModifyOrderSchema = z.object({
  order_no: z.string(),
  txn_type: z.enum(["B", "S"]),
  exchange: z.enum(["NSE", "BSE"]),
  segment: z.enum(["E"]),
  product: z.enum(["C", "I", "V", "B"]),
  security_id: z.string(),
  quantity: z.number().int().positive(),
  validity: z.enum(["DAY", "IOC"]),
  order_type: z.enum(["LMT", "MKT", "SL", "SLM"]),
  price: z.number().optional(),
  trigger_price: z.number().optional(),
  serial_no: z.number(),
  group_id: z.number().optional(),
});

const CancelOrderSchema = z.object({
  order_no: z.string(),
  serial_no: z.number(),
  product: z.enum(["C", "I", "V", "B"]),
  group_id: z.number().optional(),
});

/**
 * Register trade tools: paytm_place_order, paytm_modify_order, paytm_cancel_order
 */
export function registerTradeTools(
  server: McpServer,
  tokenManager: TokenManager,
  client: PaytmClient,
): void {
  // Wrap client methods with validation
  const origPlaceOrder = client.placeOrder.bind(client);
  client.placeOrder = async (accessToken: string, params: Record<string, unknown>) => {
    if (!accessToken) {
      throw new Error("Not authenticated: access_token is required");
    }
    tokenManager.assertNotExpired();
    const validated = PlaceOrderSchema.parse(params);
    return origPlaceOrder(accessToken, validated);
  };

  const origModifyOrder = client.modifyOrder.bind(client);
  client.modifyOrder = async (accessToken: string, params: Record<string, unknown>) => {
    if (!accessToken) {
      throw new Error("Not authenticated: access_token is required");
    }
    tokenManager.assertNotExpired();
    const validated = ModifyOrderSchema.parse(params);
    return origModifyOrder(accessToken, validated);
  };

  const origCancelOrder = client.cancelOrder.bind(client);
  client.cancelOrder = async (accessToken: string, params: Record<string, unknown>) => {
    if (!accessToken) {
      throw new Error("Not authenticated: access_token is required");
    }
    tokenManager.assertNotExpired();
    const validated = CancelOrderSchema.parse(params);
    return origCancelOrder(accessToken, validated);
  };

  // Register MCP tools
  server.tool(
    "paytm_place_order",
    "Place a new order (regular, cover, or bracket)",
    {
      txn_type: z.enum(["B", "S"]),
      exchange: z.enum(["NSE", "BSE"]),
      segment: z.enum(["E"]),
      product: z.enum(["C", "I", "V", "B"]),
      security_id: z.string(),
      quantity: z.number().int().positive(),
      validity: z.enum(["DAY", "IOC"]),
      order_type: z.enum(["LMT", "MKT", "SL", "SLM"]),
      price: z.number().positive().optional(),
      trigger_price: z.number().positive().optional(),
      sl_price: z.number().optional(),
      tp_price: z.number().optional(),
      source: z.enum(["N", "M"]).default("N"),
    },
    async (params) => {
      return withErrorHandling(async () => {
        tokenManager.assertAuthenticated();
        tokenManager.assertNotExpired();
        const token = tokenManager.getAccessToken()!;
        return client.placeOrder(token, params);
      });
    },
  );

  server.tool(
    "paytm_modify_order",
    "Modify an existing order",
    {
      order_no: z.string(),
      txn_type: z.enum(["B", "S"]),
      exchange: z.enum(["NSE", "BSE"]),
      segment: z.enum(["E"]),
      product: z.enum(["C", "I", "V", "B"]),
      security_id: z.string(),
      quantity: z.number().int().positive(),
      validity: z.enum(["DAY", "IOC"]),
      order_type: z.enum(["LMT", "MKT", "SL", "SLM"]),
      price: z.number().optional(),
      trigger_price: z.number().optional(),
      serial_no: z.number(),
      group_id: z.number().optional(),
    },
    async (params) => {
      return withErrorHandling(async () => {
        tokenManager.assertAuthenticated();
        tokenManager.assertNotExpired();
        const token = tokenManager.getAccessToken()!;
        return client.modifyOrder(token, params);
      });
    },
  );

  server.tool(
    "paytm_cancel_order",
    "Cancel an existing order",
    {
      order_no: z.string(),
      serial_no: z.number(),
      product: z.enum(["C", "I", "V", "B"]),
      group_id: z.number().optional(),
    },
    async (params) => {
      return withErrorHandling(async () => {
        tokenManager.assertAuthenticated();
        tokenManager.assertNotExpired();
        const token = tokenManager.getAccessToken()!;
        return client.cancelOrder(token, params);
      });
    },
  );
}
