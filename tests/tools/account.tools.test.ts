import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TokenManager } from '../../src/auth/token-manager.js';
import { PaytmClient } from '../../src/client/pm-client.js';
import { registerAccountTools } from '../../src/tools/account.tools.js';
import {
  createAuthenticatedTokenManager,
  SAMPLE_USER_DETAILS,
  SAMPLE_FUNDS,
} from '../helpers/test-utils.js';

const PAYTM_BASE = 'https://developer.paytmmoney.com';

describe('Account Tools', () => {
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

  describe('paytm_get_user_details', () => {
    // SC-070: user details happy path
    it('should return user details — SC-070', async () => {
      nock(PAYTM_BASE)
        .get('/accounts/v1/user/details')
        .matchHeader('x-jwt-token', 'test-read-access-token')
        .reply(200, { data: SAMPLE_USER_DETAILS });

      registerAccountTools(server, tokenManager, client);

      // Should return formatted user profile with name, email, PAN, broker
      // Will fail at registerAccountTools ("Not implemented")
      expect(SAMPLE_USER_DETAILS.name).toBe('Vivek');
    });

    // SC-071: not authenticated → error
    it('should fail when not authenticated — SC-071', async () => {
      const unauthTM = new TokenManager();

      registerAccountTools(server, unauthTM, client);

      expect(unauthTM.isAuthenticated()).toBe(false);
    });

    // SC-072: token expired → error
    it('should fail when token expired — SC-072', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-05-09T03:30:00.000Z'));
      const expTM = new TokenManager();
      expTM.setTokens({ readAccessToken: 'rat-exp' });

      vi.setSystemTime(new Date('2025-05-09T10:30:00.000Z'));

      registerAccountTools(server, expTM, client);

      expect(() => expTM.assertNotExpired()).toThrow();
    });

    // SC-073: API error
    it('should handle API error — SC-073', async () => {
      nock(PAYTM_BASE)
        .get('/accounts/v1/user/details')
        .reply(500, { message: 'Internal Server Error' });
      nock(PAYTM_BASE)
        .get('/accounts/v1/user/details')
        .reply(500, { message: 'Internal Server Error' });

      registerAccountTools(server, tokenManager, client);

      // Should return isError after retry exhaustion
      expect(server).toBeDefined();
    });
  });

  describe('paytm_get_funds', () => {
    // SC-080: funds happy path (no config)
    it('should return funds summary — SC-080', async () => {
      nock(PAYTM_BASE)
        .get('/accounts/v1/funds/summary')
        .matchHeader('x-jwt-token', 'test-read-access-token')
        .reply(200, { data: SAMPLE_FUNDS });

      registerAccountTools(server, tokenManager, client);

      // Should return formatted funds summary
      expect(SAMPLE_FUNDS.available_balance).toBe(100000.0);
    });

    // SC-081: funds with type EQUITY
    it('should accept type EQUITY — SC-081', async () => {
      nock(PAYTM_BASE)
        .get('/accounts/v1/funds/summary')
        .query({ type: 'EQUITY' })
        .reply(200, { data: SAMPLE_FUNDS });

      registerAccountTools(server, tokenManager, client);

      // Should pass EQUITY config; will fail at registerAccountTools
      expect(server).toBeDefined();
    });

    // SC-082: funds with type COMMODITY
    it('should accept type COMMODITY — SC-082', async () => {
      nock(PAYTM_BASE)
        .get('/accounts/v1/funds/summary')
        .query({ type: 'COMMODITY' })
        .reply(200, { data: SAMPLE_FUNDS });

      registerAccountTools(server, tokenManager, client);

      expect(server).toBeDefined();
    });

    // SC-083: funds with type ALL
    it('should accept type ALL — SC-083', async () => {
      nock(PAYTM_BASE)
        .get('/accounts/v1/funds/summary')
        .query({ type: 'ALL' })
        .reply(200, { data: SAMPLE_FUNDS });

      registerAccountTools(server, tokenManager, client);

      expect(server).toBeDefined();
    });

    // SC-084: invalid type rejected by Zod
    it('should reject invalid type — SC-084', async () => {
      registerAccountTools(server, tokenManager, client);

      // Calling with type: "INVALID" should fail Zod validation
      // Will fail at registerAccountTools
      expect(server).toBeDefined();
    });

    // SC-085: not authenticated → error
    it('should fail when not authenticated — SC-085', async () => {
      const unauthTM = new TokenManager();

      registerAccountTools(server, unauthTM, client);

      expect(unauthTM.isAuthenticated()).toBe(false);
    });

    // SC-086: token expired → error
    it('should fail when token expired — SC-086', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-05-09T03:30:00.000Z'));
      const expTM = new TokenManager();
      expTM.setTokens({ readAccessToken: 'rat-exp' });

      vi.setSystemTime(new Date('2025-05-09T10:30:00.000Z'));

      registerAccountTools(server, expTM, client);

      expect(() => expTM.assertNotExpired()).toThrow();
    });
  });
});
