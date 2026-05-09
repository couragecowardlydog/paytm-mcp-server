import { z } from "zod";

// --- Error Types ---

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

// --- Token State ---

export interface TokenState {
  accessToken: string | null;
  publicAccessToken: string | null;
  readAccessToken: string | null;
  expiresAt: number | null;
  lastRefreshed: Date | null;
}

// --- Paytm API Constants ---

export const PAYTM_BASE_URL = "https://developer.paytmmoney.com";

export const PAYTM_LOGIN_URL = "https://login.paytmmoney.com/merchant-login";

// --- Zod Schemas ---

export const LoginInputSchema = z.object({
  state: z.string().optional(),
});

export const SetTokensInputSchema = z.object({
  request_token: z.string().min(1).optional(),
  access_token: z.string().min(1).optional(),
  public_access_token: z.string().min(1).optional(),
  read_access_token: z.string().min(1).optional(),
});

export const GetFundsInputSchema = z.object({
  config: z
    .object({
      type: z.enum(["ALL", "EQUITY", "COMMODITY"]),
    })
    .optional(),
});

export const EmptyInputSchema = z.object({});

// --- Paytm API Response Types ---

export interface PaytmTokenResponse {
  access_token: string;
  public_access_token: string;
  read_access_token: string;
}

export interface PaytmHolding {
  nse_symbol: string;
  bse_symbol: string;
  display_name: string;
  quantity: string;
  cost_price: string;
  last_traded_price: string;
  sector: string;
  mcap_type: string;
  isin_code: string;
  exchange: string;
  remaining_quantity: string;
  utilized_quantity: string;
  xirr: string;
  cagr: string;
  segment: string;
  pc: number;
  [key: string]: unknown;
}

export interface PaytmPosition {
  [key: string]: unknown;
}

export interface PaytmUserDetails {
  name: string;
  email: string;
  pan: string;
  broker: string;
  [key: string]: unknown;
}

export interface PaytmFundsSummary {
  [key: string]: unknown;
}

export interface PaytmOrder {
  [key: string]: unknown;
}

// --- Tool Names ---

export const TOOL_NAMES = [
  "paytm_login",
  "paytm_set_tokens",
  "paytm_auth_status",
  "paytm_get_holdings",
  "paytm_get_positions",
  "paytm_get_user_details",
  "paytm_get_funds",
  "paytm_get_order_book",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];
