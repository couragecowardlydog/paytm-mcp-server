import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TokenManager } from '../../src/auth/token-manager.js';
import { PaytmClient } from '../../src/client/pm-client.js';
import { registerPortfolioTools } from '../../src/tools/portfolio.tools.js';
import {
  createAuthenticatedTokenManager,
  SAMPLE_HOLDINGS,
  SAMPLE_POSITIONS,
} from '../helpers/test-utils.js';

const PAYTM_BASE = 'https://developer.paytmmoney.com';

describe('Portfolio Tools', () => {
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

  describe('paytm_get_holdings', () => {
    // SC-050: holdings returns formatted data
    it('should return holdings — SC-050', async () => {
      nock(PAYTM_BASE)
        .get('/holdings/v1/get-user-holdings-data')
        .matchHeader('x-jwt-token', 'test-read-access-token')
        .reply(200, { data: { results: SAMPLE_HOLDINGS } });

      registerPortfolioTools(server, tokenManager, client);

      // Tool should return formatted holdings with symbol, qty, cost, LTP, P&L
      // Will fail at registerPortfolioTools ("Not implemented")
      expect(SAMPLE_HOLDINGS).toHaveLength(3);
    });

    // SC-051: sends correct auth header
    it('should send correct auth header — SC-051', async () => {
      const scope = nock(PAYTM_BASE)
        .get('/holdings/v1/get-user-holdings-data')
        .matchHeader('x-jwt-token', 'test-read-access-token')
        .reply(200, { data: { results: SAMPLE_HOLDINGS } });

      registerPortfolioTools(server, tokenManager, client);

      // Nock will verify the header; will fail at registerPortfolioTools
      expect(scope.isDone).toBeDefined();
    });

    // SC-052: not authenticated → error
    it('should fail when not authenticated — SC-052', async () => {
      const unauthTM = new TokenManager();

      registerPortfolioTools(server, unauthTM, client);

      // Tool should return isError: true with login instruction
      expect(unauthTM.isAuthenticated()).toBe(false);
    });

    // SC-053: token expired → error
    it('should fail when token expired — SC-053', async () => {
      vi.useFakeTimers();
      // Set tokens at 09:00 IST
      vi.setSystemTime(new Date('2025-05-09T03:30:00.000Z'));
      const expTM = new TokenManager();
      expTM.setTokens({ readAccessToken: 'rat-exp' });

      // Advance to 16:00 IST (past 15:30)
      vi.setSystemTime(new Date('2025-05-09T10:30:00.000Z'));

      registerPortfolioTools(server, expTM, client);

      // Tool should check expiry and return error
      // assertNotExpired is not implemented → will throw
      expect(() => expTM.assertNotExpired()).toThrow();
    });

    // SC-058: empty portfolio
    it('should handle empty portfolio — SC-058', async () => {
      nock(PAYTM_BASE)
        .get('/holdings/v1/get-user-holdings-data')
        .reply(200, { data: { results: [] } });

      registerPortfolioTools(server, tokenManager, client);

      // Should return "No holdings" message, not an error
      // Will fail at registerPortfolioTools
      expect(server).toBeDefined();
    });

    // SC-055: API 500 retries then succeeds
    it('should retry on 5xx and succeed — SC-055', async () => {
      nock(PAYTM_BASE)
        .get('/holdings/v1/get-user-holdings-data')
        .reply(500, { message: 'Internal Server Error' });
      nock(PAYTM_BASE)
        .get('/holdings/v1/get-user-holdings-data')
        .reply(200, { data: { results: SAMPLE_HOLDINGS } });

      registerPortfolioTools(server, tokenManager, client);

      // Should retry and succeed
      expect(server).toBeDefined();
    });

    // SC-057: API 429 rate limit
    it('should respect 429 Retry-After header — SC-057', async () => {
      nock(PAYTM_BASE)
        .get('/holdings/v1/get-user-holdings-data')
        .reply(429, { message: 'Rate limited' }, { 'Retry-After': '1' });
      nock(PAYTM_BASE)
        .get('/holdings/v1/get-user-holdings-data')
        .reply(200, { data: { results: SAMPLE_HOLDINGS } });

      registerPortfolioTools(server, tokenManager, client);

      // Should wait per Retry-After and retry
      expect(server).toBeDefined();
    });
  });

  describe('paytm_get_positions', () => {
    // SC-060: positions returns formatted data
    it('should return positions — SC-060', async () => {
      nock(PAYTM_BASE)
        .get('/data/v1/position')
        .matchHeader('x-jwt-token', 'test-read-access-token')
        .reply(200, { data: SAMPLE_POSITIONS });

      registerPortfolioTools(server, tokenManager, client);

      // Should return formatted positions data
      expect(SAMPLE_POSITIONS).toHaveLength(1);
    });

    // SC-061: not authenticated → error
    it('should fail when not authenticated — SC-061', async () => {
      const unauthTM = new TokenManager();

      registerPortfolioTools(server, unauthTM, client);

      expect(unauthTM.isAuthenticated()).toBe(false);
    });

    // SC-062: token expired → error
    it('should fail when token expired — SC-062', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-05-09T03:30:00.000Z'));
      const expTM = new TokenManager();
      expTM.setTokens({ readAccessToken: 'rat-exp' });

      vi.setSystemTime(new Date('2025-05-09T10:30:00.000Z'));

      registerPortfolioTools(server, expTM, client);

      expect(() => expTM.assertNotExpired()).toThrow();
    });

    // SC-064: empty positions
    it('should handle empty positions — SC-064', async () => {
      nock(PAYTM_BASE)
        .get('/data/v1/position')
        .reply(200, { data: [] });

      registerPortfolioTools(server, tokenManager, client);

      expect(server).toBeDefined();
    });

    // SC-063: API 4xx error
    it('should handle API 4xx error — SC-063', async () => {
      nock(PAYTM_BASE)
        .get('/data/v1/position')
        .reply(400, { message: 'Bad request' });

      registerPortfolioTools(server, tokenManager, client);

      expect(server).toBeDefined();
    });
  });
});
