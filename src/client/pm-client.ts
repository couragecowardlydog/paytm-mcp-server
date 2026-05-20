import axios, { type AxiosInstance, type AxiosResponse } from "axios";
import { PAYTM_BASE_URL } from "../types/schemas.js";
import type {
  PaytmTokenResponse,
  PaytmHolding,
  PaytmPosition,
  PaytmUserDetails,
  PaytmFundsSummary,
  PaytmOrder,
} from "../types/schemas.js";

/**
 * HTTP client for Paytm Money REST API.
 */
export class PaytmClient {
  private client: AxiosInstance;

  constructor(baseURL: string = PAYTM_BASE_URL) {
    this.client = axios.create({
      baseURL,
      timeout: 3_000,
      headers: { "Content-Type": "application/json" },
    });
  }

  async exchangeToken(
    apiKey: string,
    apiSecret: string,
    requestToken: string,
  ): Promise<PaytmTokenResponse> {
    return this.withRetry(() =>
      this.client
        .post("/accounts/v2/gettoken", {
          api_key: apiKey,
          api_secret_key: apiSecret,
          request_token: requestToken,
        })
        .then((res: AxiosResponse) => res.data),
    );
  }

  async getHoldings(readAccessToken: string): Promise<PaytmHolding[]> {
    return this.withRetry(() =>
      this.client
        .get("/holdings/v1/get-user-holdings-data", {
          headers: { "x-jwt-token": readAccessToken },
        })
        .then((res: AxiosResponse) => res.data.data.results),
    );
  }

  async getPositions(readAccessToken: string): Promise<PaytmPosition[]> {
    return this.withRetry(() =>
      this.client
        .get("/orders/v1/position", {
          headers: { "x-jwt-token": readAccessToken },
        })
        .then((res: AxiosResponse) => res.data.data),
    );
  }

  async getUserDetails(readAccessToken: string): Promise<PaytmUserDetails> {
    return this.withRetry(() =>
      this.client
        .get("/accounts/v1/user/details", {
          headers: { "x-jwt-token": readAccessToken },
        })
        .then((res: AxiosResponse) => res.data.data),
    );
  }

  async getFundsSummary(
    readAccessToken: string,
    config?: { type?: string },
  ): Promise<PaytmFundsSummary> {
    const params: Record<string, string> = {};
    if (config?.type) {
      params.type = config.type;
    }
    return this.withRetry(() =>
      this.client
        .get("/accounts/v1/funds/summary", {
          headers: { "x-jwt-token": readAccessToken },
          params,
        })
        .then((res: AxiosResponse) => res.data.data),
    );
  }

  async getOrderBook(readAccessToken: string): Promise<PaytmOrder[]> {
    return this.withRetry(() =>
      this.client
        .get("/orders/v1/user/orders", {
          headers: { "x-jwt-token": readAccessToken },
        })
        .then((res: AxiosResponse) => res.data.data),
    );
  }

  // --- Phase 2: Trade, Market Data, Search ---

  async placeOrder(accessToken: string, params: Record<string, unknown>): Promise<unknown> {
    const type = this.orderEndpointType(params.product as string);
    return this.withRetry(() =>
      this.client
        .post(`/orders/v1/place/${type}`, params, {
          headers: { "x-jwt-token": accessToken },
        })
        .then((res: AxiosResponse) => res.data),
    );
  }

  async modifyOrder(accessToken: string, params: Record<string, unknown>): Promise<unknown> {
    const type = this.orderEndpointType(params.product as string);
    return this.withRetry(() =>
      this.client
        .post(`/orders/v1/modify/${type}`, params, {
          headers: { "x-jwt-token": accessToken },
        })
        .then((res: AxiosResponse) => res.data),
    );
  }

  async cancelOrder(accessToken: string, params: Record<string, unknown>): Promise<unknown> {
    const type = this.orderEndpointType(params.product as string);
    return this.withRetry(() =>
      this.client
        .post(`/orders/v1/cancel/${type}`, params, {
          headers: { "x-jwt-token": accessToken },
        })
        .then((res: AxiosResponse) => res.data),
    );
  }

  async getLivePrice(readAccessToken: string, mode: string, pref: unknown[]): Promise<unknown> {
    const prefStr = (pref as Array<{ exchange: string; mode: string; security_id: string }>)
      .map((p) => `${p.exchange}:${p.security_id}:${p.mode}`)
      .join(",");
    return this.withRetry(() =>
      this.client
        .get(`/data/v1/price/live?mode=${mode}&pref=${prefStr}`, {
          headers: { "x-jwt-token": readAccessToken },
        })
        .then((res: AxiosResponse) => res.data),
    );
  }

  async searchInstruments(
    publicAccessToken: string,
    query: string,
    exchange?: string,
  ): Promise<unknown> {
    const params: Record<string, string> = {};
    if (exchange) params.exchange = exchange;
    return this.withRetry(() =>
      this.client
        .get(`/data/v1/scrips/${query}`, {
          headers: { "x-jwt-token": publicAccessToken },
          params,
        })
        .then((res: AxiosResponse) => res.data),
    );
  }

  // --- Phase 3: GTT, Option Chain, Charges ---

  async createGtt(accessToken: string, params: Record<string, unknown>): Promise<unknown> {
    return this.withRetry(() =>
      this.client
        .post("/gtt/v1/gtt", params, {
          headers: { "x-jwt-token": accessToken },
        })
        .then((res: AxiosResponse) => res.data),
    );
  }

  async getGtt(accessToken: string, id: number): Promise<unknown> {
    return this.withRetry(() =>
      this.client
        .get(`/gtt/v1/gtt/${id}`, {
          headers: { "x-jwt-token": accessToken },
        })
        .then((res: AxiosResponse) => res.data),
    );
  }

  async updateGtt(accessToken: string, params: Record<string, unknown>): Promise<unknown> {
    return this.withRetry(() =>
      this.client
        .put("/gtt/v1/gtt", params, {
          headers: { "x-jwt-token": accessToken },
        })
        .then((res: AxiosResponse) => res.data),
    );
  }

  async deleteGtt(accessToken: string, id: number): Promise<unknown> {
    return this.withRetry(() =>
      this.client
        .delete(`/gtt/v1/gtt/${id}`, {
          headers: { "x-jwt-token": accessToken },
        })
        .then((res: AxiosResponse) => res.data),
    );
  }

  async getGttAggregate(accessToken: string): Promise<unknown> {
    return this.withRetry(() =>
      this.client
        .get("/gtt/v1/gtt/aggregate", {
          headers: { "x-jwt-token": accessToken },
        })
        .then((res: AxiosResponse) => res.data),
    );
  }

  async getOptionChain(
    publicAccessToken: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    return this.withRetry(() =>
      this.client
        .get("/fno/v1/option-chain", {
          headers: { "x-jwt-token": publicAccessToken },
          params,
        })
        .then((res: AxiosResponse) => res.data),
    );
  }

  async getCharges(readAccessToken: string, params: Record<string, unknown>): Promise<unknown> {
    return this.withRetry(() =>
      this.client
        .post("/accounts/v1/charges/info", params, {
          headers: { "x-jwt-token": readAccessToken },
        })
        .then((res: AxiosResponse) => res.data),
    );
  }

  private orderEndpointType(product: string): string {
    switch (product) {
      case "V":
        return "cover";
      case "B":
        return "bracket";
      default:
        return "regular";
    }
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;

        if (status === 429) {
          const retryAfter = parseInt(error.response?.headers?.["retry-after"] ?? "1", 10);
          await this.delay(retryAfter * 1000);
          return fn();
        }

        if (status && status >= 500) {
          await this.delay(1000);
          return fn();
        }
      }
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
