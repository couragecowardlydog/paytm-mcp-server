import crypto from "node:crypto";
import { PAYTM_LOGIN_URL } from "../types/schemas.js";

/**
 * Generate the Paytm Money OAuth login URL.
 */
export function generateLoginUrl(apiKey: string, state?: string): string {
  const url = new URL(PAYTM_LOGIN_URL);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("state", state ?? "copilot-mcp");
  return url.toString();
}

/**
 * Generate a CSRF state token: nonce:hmac(nonce, apiSecret)
 */
export function generateState(apiSecret: string): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const hmac = crypto.createHmac("sha256", apiSecret).update(nonce).digest("hex");
  return `${nonce}:${hmac}`;
}

/**
 * Validate a CSRF state token using constant-time comparison.
 */
export function validateState(state: string, apiSecret: string): boolean {
  const parts = state.split(":");
  if (parts.length !== 2) return false;
  const [nonce, signature] = parts;
  if (!nonce || !signature) return false;
  const expected = crypto.createHmac("sha256", apiSecret).update(nonce).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
