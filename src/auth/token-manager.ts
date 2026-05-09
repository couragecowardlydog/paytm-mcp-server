import type { TokenState } from "../types/schemas.js";
import { AuthError } from "../types/schemas.js";

/**
 * In-memory token manager for Paytm Money API tokens.
 * Tokens are never persisted to disk.
 */
export class TokenManager {
  private state: TokenState = {
    accessToken: null,
    publicAccessToken: null,
    readAccessToken: null,
    expiresAt: null,
    lastRefreshed: null,
  };

  setTokens(tokens: {
    accessToken?: string;
    publicAccessToken?: string;
    readAccessToken?: string;
  }): void {
    if (tokens.accessToken) this.state.accessToken = tokens.accessToken;
    if (tokens.publicAccessToken) this.state.publicAccessToken = tokens.publicAccessToken;
    if (tokens.readAccessToken) this.state.readAccessToken = tokens.readAccessToken;
    this.state.expiresAt = this.calculateExpiry();
    this.state.lastRefreshed = new Date();
  }

  getAccessToken(): string | null {
    return this.state.accessToken;
  }

  getPublicToken(): string | null {
    return this.state.publicAccessToken;
  }

  getReadToken(): string | null {
    return this.state.readAccessToken;
  }

  isAuthenticated(): boolean {
    return this.state.readAccessToken !== null;
  }

  assertAuthenticated(): void {
    if (!this.isAuthenticated()) {
      throw new AuthError(
        "Not authenticated. Call paytm_login to get the login URL, then paytm_set_tokens with the request_token from the callback.",
      );
    }
  }

  assertNotExpired(): void {
    if (this.state.expiresAt !== null && Date.now() >= this.state.expiresAt) {
      throw new AuthError(
        "Session expired. Paytm Money tokens expire at 15:30 IST. Please re-authenticate.",
      );
    }
  }

  clear(): void {
    this.state = {
      accessToken: null,
      publicAccessToken: null,
      readAccessToken: null,
      expiresAt: null,
      lastRefreshed: null,
    };
  }

  getState(): Readonly<TokenState> {
    return { ...this.state };
  }

  private calculateExpiry(): number {
    const now = new Date();
    // 15:30 IST = 10:00 UTC
    const expiry = new Date(now);
    expiry.setUTCHours(10, 0, 0, 0);

    // If current time is past 15:30 IST (10:00 UTC), set expiry to next day
    if (now.getTime() >= expiry.getTime()) {
      expiry.setUTCDate(expiry.getUTCDate() + 1);
    }

    return expiry.getTime();
  }
}
