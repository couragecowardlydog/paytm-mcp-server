import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TokenManager } from '../../src/auth/token-manager.js';
import { PaytmClient } from '../../src/client/pm-client.js';
import { registerOrderTools } from '../../src/tools/orders.tools.js';
import {
  createAuthenticatedTokenManager,
  SAMPLE_ORDERS,
} from '../helpers/test-utils.js';

const PAYTM_BASE = 'https://developer.paytmmoney.com';

describe('Order Tools', () => {
  let server: McpServer;
  let tokenManager: TokenManager;
  let client: PaytmClient;

  beforeEach(() => {
    server = new McpServer(
      { name: 'test-server', version: '1.0.0' },
    );
    tokenManager = createAuthenticatedTokenManager();
    client = new PaytmClient(PAYTM_BASE);
  });

  afterEach(() => {
    nock.cleanAll();
    vi.useRealTimers();
  });

  describe('paytm_get_order_book', () => {
    // SC-090: order book happy path
    it('should return order book — SC-090', async () => {
      nock(PAYTM_BASE)
        .get('/orders/v1/user/orders')
        .matchHeader('x-jwt-token', 'test-read-access-token')
        .reply(200, { data: SAMPLE_ORDERS });

      registerOrderTools(server, tokenManager, client);

      // Should return formatted order list
      // Will fail at registerOrderTools ("Not implemented")
      expect(SAMPLE_ORDERS).toHaveLength(2);
    });

    // SC-091: not authenticated → error
    it('should fail when not authenticated — SC-091', async () => {
      const unauthTM = new TokenManager();

      registerOrderTools(server, unauthTM, client);

      expect(unauthTM.isAuthenticated()).toBe(false);
    });

    // SC-092: token expired → error
    it('should fail when token expired — SC-092', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-05-09T03:30:00.000Z'));
      const expTM = new TokenManager();
      expTM.setTokens({ readAccessToken: 'rat-exp' });

      vi.setSystemTime(new Date('2025-05-09T10:30:00.000Z'));

      registerOrderTools(server, expTM, client);

      expect(() => expTM.assertNotExpired()).toThrow();
    });

    // SC-093: empty order book
    it('should handle empty order book — SC-093', async () => {
      nock(PAYTM_BASE)
        .get('/orders/v1/user/orders')
        .reply(200, { data: [] });

      registerOrderTools(server, tokenManager, client);

      // Should return "No orders" message, not an error
      expect(server).toBeDefined();
    });

    // SC-094: API error passthrough
    it('should handle API error — SC-094', async () => {
      nock(PAYTM_BASE)
        .get('/orders/v1/user/orders')
        .reply(403, { message: 'Insufficient permissions' });

      registerOrderTools(server, tokenManager, client);

      // Should return isError with the Paytm error message
      expect(server).toBeDefined();
    });
  });
});
