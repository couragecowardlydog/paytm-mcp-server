import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TokenManager } from '../../src/auth/token-manager.js';
import { PaytmClient } from '../../src/client/pm-client.js';
import { registerMarketTools } from '../../src/tools/market.tools.js';
import {
  createAuthenticatedTokenManager,
  SAMPLE_LIVE_PRICE_LTP,
  SAMPLE_LIVE_PRICE_FULL,
  SAMPLE_LIVE_PRICE_QUOTE,
  SAMPLE_SEARCH_RESULTS,
} from '../helpers/test-utils.js';

const PAYTM_BASE = 'https://developer.paytmmoney.com';

describe('Market Tools', () => {
  let server: McpServer;
  let tokenManager: TokenManager;
  let client: PaytmClient;

  beforeEach(() => {
    server = new McpServer({ name: 'test-server', version: '1.0.0' });
    tokenManager = createAuthenticatedTokenManager();
    client = new PaytmClient(PAYTM_BASE);
  });

  afterEach(() => {
    nock.cleanAll();
    vi.useRealTimers();
  });

  // =========================================================================
  // paytm_get_live_price
  // =========================================================================
  describe('paytm_get_live_price', () => {
    describe('happy path', () => {
      // SC-310: LTP mode single instrument
      it('should return LTP for single instrument — SC-310', async () => {
        const scope = nock(PAYTM_BASE)
          .get('/data/v1/price/live')
          .matchHeader('x-jwt-token', 'test-public-access-token')
          .reply(200, { data: SAMPLE_LIVE_PRICE_LTP });

        registerMarketTools(server, tokenManager, client);

        const pref = [{ exchange: 'NSE', mode: 'LTP', security_id: '14366' }];
        const result = await client.getLivePrice('test-public-access-token', 'LTP', pref);

        expect(result).toHaveProperty('data');
        expect((result as any).data).toHaveLength(1);
        expect((result as any).data[0]).toHaveProperty('last_price', 1520.50);
        expect(scope.isDone()).toBe(true);
      });

      // SC-311: FULL mode returns extended data
      it('should return FULL quote data — SC-311', async () => {
        const scope = nock(PAYTM_BASE)
          .get('/data/v1/price/live')
          .matchHeader('x-jwt-token', 'test-public-access-token')
          .reply(200, { data: SAMPLE_LIVE_PRICE_FULL });

        registerMarketTools(server, tokenManager, client);

        const pref = [{ exchange: 'NSE', mode: 'FULL', security_id: '14366' }];
        const result = await client.getLivePrice('test-public-access-token', 'FULL', pref);

        expect(result).toHaveProperty('data');
        const data = (result as any).data[0];
        expect(data).toHaveProperty('open');
        expect(data).toHaveProperty('high');
        expect(data).toHaveProperty('low');
        expect(data).toHaveProperty('close');
        expect(data).toHaveProperty('volume');
        expect(data).toHaveProperty('bid_price');
        expect(data).toHaveProperty('ask_price');
        expect(scope.isDone()).toBe(true);
      });

      // SC-312: QUOTE mode returns partial data
      it('should return QUOTE data — SC-312', async () => {
        const scope = nock(PAYTM_BASE)
          .get('/data/v1/price/live')
          .reply(200, { data: SAMPLE_LIVE_PRICE_QUOTE });

        registerMarketTools(server, tokenManager, client);

        const pref = [{ exchange: 'NSE', mode: 'QUOTE', security_id: '14366' }];
        const result = await client.getLivePrice('test-public-access-token', 'QUOTE', pref);

        expect(result).toHaveProperty('data');
        const data = (result as any).data[0];
        expect(data).toHaveProperty('last_price');
        expect(data).toHaveProperty('open');
        expect(scope.isDone()).toBe(true);
      });

      // SC-313: Multiple instruments
      it('should return prices for multiple instruments — SC-313', async () => {
        const multiData = [
          { security_id: '14366', last_price: 1520.50 },
          { security_id: '11536', last_price: 2550.00 },
          { security_id: '11915', last_price: 3450.00 },
        ];
        const scope = nock(PAYTM_BASE)
          .get('/data/v1/price/live')
          .reply(200, { data: multiData });

        registerMarketTools(server, tokenManager, client);

        const pref = [
          { exchange: 'NSE', mode: 'LTP', security_id: '14366' },
          { exchange: 'NSE', mode: 'LTP', security_id: '11536' },
          { exchange: 'BSE', mode: 'LTP', security_id: '11915' },
        ];
        const result = await client.getLivePrice('test-public-access-token', 'LTP', pref);

        expect(result).toHaveProperty('data');
        expect((result as any).data).toHaveLength(3);
        expect(scope.isDone()).toBe(true);
      });
    });

    describe('auth & token', () => {
      // SC-314: Uses public_access_token in header
      it('should use public_access_token in x-jwt-token header — SC-314', async () => {
        const scope = nock(PAYTM_BASE)
          .get('/data/v1/price/live')
          .matchHeader('x-jwt-token', 'test-public-access-token')
          .reply(200, { data: SAMPLE_LIVE_PRICE_LTP });

        registerMarketTools(server, tokenManager, client);

        const pref = [{ exchange: 'NSE', mode: 'LTP', security_id: '14366' }];
        const result = await client.getLivePrice('test-public-access-token', 'LTP', pref);

        expect(result).toHaveProperty('data');
        expect(scope.isDone()).toBe(true);
      });

      // SC-315: Fails without public_access_token
      it('should fail without public_access_token — SC-315', async () => {
        const noPublicTM = new TokenManager();
        noPublicTM.setTokens({ accessToken: 'at-only', readAccessToken: 'rat-only' });
        registerMarketTools(server, noPublicTM, client);

        expect(noPublicTM.getPublicToken()).toBeNull();

        const pref = [{ exchange: 'NSE', mode: 'LTP', security_id: '14366' }];
        await expect(
          client.getLivePrice('', 'LTP', pref),
        ).rejects.toThrow(/public_access_token.*required|[Nn]ot authenticated/);
      });

      // SC-316: Fails when not authenticated
      it('should fail when not authenticated — SC-316', async () => {
        const unauthTM = new TokenManager();
        registerMarketTools(server, unauthTM, client);

        const pref = [{ exchange: 'NSE', mode: 'LTP', security_id: '14366' }];
        await expect(
          client.getLivePrice('', 'LTP', pref),
        ).rejects.toThrow(/[Nn]ot authenticated/);
      });

      // SC-317: Fails when token expired
      it('should fail when token expired — SC-317', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-05-09T03:30:00.000Z'));
        const expTM = new TokenManager();
        expTM.setTokens({
          accessToken: 'at-exp',
          publicAccessToken: 'pat-exp',
          readAccessToken: 'rat-exp',
        });
        vi.setSystemTime(new Date('2025-05-09T10:30:00.000Z'));

        registerMarketTools(server, expTM, client);

        const pref = [{ exchange: 'NSE', mode: 'LTP', security_id: '14366' }];
        await expect(
          client.getLivePrice('pat-exp', 'LTP', pref),
        ).rejects.toThrow(/expired/);
      });
    });

    describe('validation', () => {
      // SC-318: Missing mode rejected
      it('should reject missing mode — SC-318', async () => {
        registerMarketTools(server, tokenManager, client);

        const pref = [{ exchange: 'NSE', mode: 'LTP', security_id: '14366' }];
        await expect(
          client.getLivePrice('test-public-access-token', '', pref),
        ).rejects.toThrow(/mode|required/i);
      });

      // SC-319: Invalid mode rejected
      it('should reject invalid mode — SC-319', async () => {
        registerMarketTools(server, tokenManager, client);

        const pref = [{ exchange: 'NSE', mode: 'INVALID', security_id: '14366' }];
        await expect(
          client.getLivePrice('test-public-access-token', 'INVALID', pref),
        ).rejects.toThrow(/mode|invalid|LTP|FULL|QUOTE/i);
      });

      // SC-320: Missing pref rejected
      it('should reject missing pref — SC-320', async () => {
        registerMarketTools(server, tokenManager, client);

        await expect(
          client.getLivePrice('test-public-access-token', 'LTP', []),
        ).rejects.toThrow(/pref|required|at least one/i);
      });

      // SC-321: Empty pref array rejected
      it('should reject empty pref array — SC-321', async () => {
        registerMarketTools(server, tokenManager, client);

        await expect(
          client.getLivePrice('test-public-access-token', 'LTP', []),
        ).rejects.toThrow(/pref|empty|at least one/i);
      });

      // SC-322: Invalid exchange in pref rejected
      it('should reject invalid exchange in pref — SC-322', async () => {
        registerMarketTools(server, tokenManager, client);

        const pref = [{ exchange: 'MCX', mode: 'LTP', security_id: '123' }];
        await expect(
          client.getLivePrice('test-public-access-token', 'LTP', pref),
        ).rejects.toThrow(/exchange|invalid|NSE|BSE/i);
      });
    });

    describe('API errors', () => {
      // SC-323: API 401
      it('should handle API 401 — SC-323', async () => {
        nock(PAYTM_BASE)
          .get('/data/v1/price/live')
          .reply(401, { message: 'Unauthorized' });

        registerMarketTools(server, tokenManager, client);

        const pref = [{ exchange: 'NSE', mode: 'LTP', security_id: '14366' }];
        await expect(
          client.getLivePrice('test-public-access-token', 'LTP', pref),
        ).rejects.toThrow();
      });

      // SC-324: API 500 with retry
      it('should retry on 5xx and succeed — SC-324', async () => {
        nock(PAYTM_BASE)
          .get('/data/v1/price/live')
          .reply(500, { message: 'Internal Server Error' });
        nock(PAYTM_BASE)
          .get('/data/v1/price/live')
          .reply(200, { data: SAMPLE_LIVE_PRICE_LTP });

        registerMarketTools(server, tokenManager, client);

        const pref = [{ exchange: 'NSE', mode: 'LTP', security_id: '14366' }];
        const result = await client.getLivePrice('test-public-access-token', 'LTP', pref);

        expect(result).toHaveProperty('data');
      });

      // SC-325: API 429 rate limit
      it('should handle 429 rate limit — SC-325', async () => {
        nock(PAYTM_BASE)
          .get('/data/v1/price/live')
          .reply(429, { message: 'Rate limited' }, { 'Retry-After': '1' });
        nock(PAYTM_BASE)
          .get('/data/v1/price/live')
          .reply(200, { data: SAMPLE_LIVE_PRICE_LTP });

        registerMarketTools(server, tokenManager, client);

        const pref = [{ exchange: 'NSE', mode: 'LTP', security_id: '14366' }];
        const result = await client.getLivePrice('test-public-access-token', 'LTP', pref);

        expect(result).toHaveProperty('data');
      });
    });
  });

  // =========================================================================
  // paytm_search_instruments
  // =========================================================================
  describe('paytm_search_instruments', () => {
    describe('happy path', () => {
      // SC-330: Search by symbol
      it('should search instruments by symbol — SC-330', async () => {
        const scope = nock(PAYTM_BASE)
          .get('/data/v1/scrips/get-security-master')
          .matchHeader('x-jwt-token', 'test-public-access-token')
          .reply(200, { data: SAMPLE_SEARCH_RESULTS });

        registerMarketTools(server, tokenManager, client);

        const result = await client.searchInstruments('test-public-access-token', 'INFY');

        expect(result).toHaveProperty('data');
        expect((result as any).data).toHaveLength(2);
        expect((result as any).data[0]).toHaveProperty('symbol', 'INFY');
        expect(scope.isDone()).toBe(true);
      });

      // SC-331: Search by company name
      it('should search instruments by company name — SC-331', async () => {
        const scope = nock(PAYTM_BASE)
          .get('/data/v1/scrips/get-security-master')
          .reply(200, { data: SAMPLE_SEARCH_RESULTS });

        registerMarketTools(server, tokenManager, client);

        const result = await client.searchInstruments('test-public-access-token', 'Infosys');

        expect(result).toHaveProperty('data');
        expect((result as any).data[0]).toHaveProperty('name', 'Infosys Limited');
        expect(scope.isDone()).toBe(true);
      });

      // SC-332: With exchange filter NSE
      it('should filter by exchange NSE — SC-332', async () => {
        const nseOnly = SAMPLE_SEARCH_RESULTS.filter((r) => r.exchange === 'NSE');
        const scope = nock(PAYTM_BASE)
          .get('/data/v1/scrips/get-security-master')
          .query((q) => q.exchange === 'NSE')
          .reply(200, { data: nseOnly });

        registerMarketTools(server, tokenManager, client);

        const result = await client.searchInstruments('test-public-access-token', 'RELIANCE', 'NSE');

        expect(result).toHaveProperty('data');
        expect((result as any).data.every((r: any) => r.exchange === 'NSE')).toBe(true);
        expect(scope.isDone()).toBe(true);
      });

      // SC-333: With exchange filter BSE
      it('should filter by exchange BSE — SC-333', async () => {
        const bseOnly = SAMPLE_SEARCH_RESULTS.filter((r) => r.exchange === 'BSE');
        const scope = nock(PAYTM_BASE)
          .get('/data/v1/scrips/get-security-master')
          .query((q) => q.exchange === 'BSE')
          .reply(200, { data: bseOnly });

        registerMarketTools(server, tokenManager, client);

        const result = await client.searchInstruments('test-public-access-token', 'TCS', 'BSE');

        expect(result).toHaveProperty('data');
        expect((result as any).data.every((r: any) => r.exchange === 'BSE')).toBe(true);
        expect(scope.isDone()).toBe(true);
      });

      // SC-334: Empty results
      it('should handle empty search results — SC-334', async () => {
        const scope = nock(PAYTM_BASE)
          .get('/data/v1/scrips/get-security-master')
          .reply(200, { data: [] });

        registerMarketTools(server, tokenManager, client);

        const result = await client.searchInstruments('test-public-access-token', 'ZZZZNONEXISTENT');

        expect(result).toHaveProperty('data');
        expect((result as any).data).toHaveLength(0);
        expect(scope.isDone()).toBe(true);
      });

      // SC-335: Case insensitive search
      it('should support case insensitive search — SC-335', async () => {
        const scope = nock(PAYTM_BASE)
          .get('/data/v1/scrips/get-security-master')
          .reply(200, { data: SAMPLE_SEARCH_RESULTS });

        registerMarketTools(server, tokenManager, client);

        const result = await client.searchInstruments('test-public-access-token', 'infy');

        expect(result).toHaveProperty('data');
        expect(scope.isDone()).toBe(true);
      });
    });

    describe('auth & token', () => {
      // SC-336: Uses public_access_token
      it('should use public_access_token — SC-336', async () => {
        const scope = nock(PAYTM_BASE)
          .get('/data/v1/scrips/get-security-master')
          .matchHeader('x-jwt-token', 'test-public-access-token')
          .reply(200, { data: SAMPLE_SEARCH_RESULTS });

        registerMarketTools(server, tokenManager, client);

        const result = await client.searchInstruments('test-public-access-token', 'INFY');

        expect(result).toHaveProperty('data');
        expect(scope.isDone()).toBe(true);
      });

      // SC-337: Fails without public_access_token
      it('should fail without public_access_token — SC-337', async () => {
        const noPublicTM = new TokenManager();
        noPublicTM.setTokens({ readAccessToken: 'rat-only' });
        registerMarketTools(server, noPublicTM, client);

        expect(noPublicTM.getPublicToken()).toBeNull();

        await expect(
          client.searchInstruments('', 'INFY'),
        ).rejects.toThrow(/public_access_token.*required|[Nn]ot authenticated/);
      });

      // SC-338: Fails when not authenticated
      it('should fail when not authenticated — SC-338', async () => {
        const unauthTM = new TokenManager();
        registerMarketTools(server, unauthTM, client);

        await expect(
          client.searchInstruments('', 'INFY'),
        ).rejects.toThrow(/[Nn]ot authenticated/);
      });

      // SC-339: Fails when token expired
      it('should fail when token expired — SC-339', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-05-09T03:30:00.000Z'));
        const expTM = new TokenManager();
        expTM.setTokens({
          accessToken: 'at-exp',
          publicAccessToken: 'pat-exp',
          readAccessToken: 'rat-exp',
        });
        vi.setSystemTime(new Date('2025-05-09T10:30:00.000Z'));

        registerMarketTools(server, expTM, client);

        await expect(
          client.searchInstruments('pat-exp', 'INFY'),
        ).rejects.toThrow(/expired/);
      });
    });

    describe('validation', () => {
      // SC-340: Missing query rejected
      it('should reject missing query — SC-340', async () => {
        registerMarketTools(server, tokenManager, client);

        await expect(
          client.searchInstruments('test-public-access-token', ''),
        ).rejects.toThrow(/query|required|empty/i);
      });

      // SC-341: Empty query string rejected
      it('should reject empty query string — SC-341', async () => {
        registerMarketTools(server, tokenManager, client);

        await expect(
          client.searchInstruments('test-public-access-token', ''),
        ).rejects.toThrow(/query|required|empty/i);
      });

      // SC-342: Invalid exchange filter rejected
      it('should reject invalid exchange filter — SC-342', async () => {
        registerMarketTools(server, tokenManager, client);

        await expect(
          client.searchInstruments('test-public-access-token', 'INFY', 'MCX'),
        ).rejects.toThrow(/exchange|invalid|NSE|BSE/i);
      });
    });

    describe('API errors', () => {
      // SC-344: API error
      it('should handle API 500 error — SC-344', async () => {
        nock(PAYTM_BASE)
          .get('/data/v1/scrips/get-security-master')
          .reply(500, { message: 'Internal Server Error' });
        nock(PAYTM_BASE)
          .get('/data/v1/scrips/get-security-master')
          .reply(500, { message: 'Internal Server Error' });

        registerMarketTools(server, tokenManager, client);

        await expect(
          client.searchInstruments('test-public-access-token', 'INFY'),
        ).rejects.toThrow();
      });
    });
  });
});
