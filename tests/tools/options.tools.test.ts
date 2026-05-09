import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TokenManager } from '../../src/auth/token-manager.js';
import { PaytmClient } from '../../src/client/pm-client.js';
import { registerOptionsTools } from '../../src/tools/options.tools.js';
import {
  createAuthenticatedTokenManager,
  SAMPLE_OPTION_CHAIN_RESPONSE,
  VALID_OPTION_CHAIN_INPUT,
} from '../helpers/test-utils.js';

const PAYTM_BASE = 'https://developer.paytmmoney.com';

describe('Options Tools', () => {
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
  // paytm_get_option_chain
  // =========================================================================
  describe('paytm_get_option_chain', () => {
    describe('happy path', () => {
      // SC-490: Get option chain for calls (CE)
      it('should get option chain for CE — SC-490', async () => {
        const scope = nock(PAYTM_BASE)
          .get('/fno/v1/option-chain')
          .matchHeader('x-jwt-token', 'test-public-access-token')
          .reply(200, SAMPLE_OPTION_CHAIN_RESPONSE);

        registerOptionsTools(server, tokenManager, client);

        const result = await client.getOptionChain('test-public-access-token', VALID_OPTION_CHAIN_INPUT);

        expect(result).toHaveProperty('data');
        expect((result as any).data).toHaveLength(2);
        expect((result as any).data[0]).toHaveProperty('strike_price', 24000);
        expect((result as any).data[0]).toHaveProperty('ce_last_price');
        expect((result as any).data[0]).toHaveProperty('ce_oi');
        expect(scope.isDone()).toBe(true);
      });

      // SC-491: Get option chain for puts (PE)
      it('should get option chain for PE — SC-491', async () => {
        const scope = nock(PAYTM_BASE)
          .get('/fno/v1/option-chain')
          .matchHeader('x-jwt-token', 'test-public-access-token')
          .reply(200, SAMPLE_OPTION_CHAIN_RESPONSE);

        registerOptionsTools(server, tokenManager, client);

        const result = await client.getOptionChain('test-public-access-token', { ...VALID_OPTION_CHAIN_INPUT, type: 'PE' });

        expect(result).toHaveProperty('data');
        expect((result as any).data[0]).toHaveProperty('pe_last_price');
        expect((result as any).data[0]).toHaveProperty('pe_oi');
        expect(scope.isDone()).toBe(true);
      });

      // SC-492: Get option chain for both (BOTH)
      it('should get option chain for BOTH — SC-492', async () => {
        const scope = nock(PAYTM_BASE)
          .get('/fno/v1/option-chain')
          .matchHeader('x-jwt-token', 'test-public-access-token')
          .reply(200, SAMPLE_OPTION_CHAIN_RESPONSE);

        registerOptionsTools(server, tokenManager, client);

        const result = await client.getOptionChain('test-public-access-token', { ...VALID_OPTION_CHAIN_INPUT, type: 'BOTH' });

        expect(result).toHaveProperty('data');
        expect((result as any).data[0]).toHaveProperty('ce_last_price');
        expect((result as any).data[0]).toHaveProperty('pe_last_price');
        expect(scope.isDone()).toBe(true);
      });
    });

    describe('auth & token', () => {
      // SC-493: Get option chain requires public_access_token
      it('should use public_access_token in header — SC-493', async () => {
        const scope = nock(PAYTM_BASE)
          .get('/fno/v1/option-chain')
          .matchHeader('x-jwt-token', 'test-public-access-token')
          .reply(200, SAMPLE_OPTION_CHAIN_RESPONSE);

        registerOptionsTools(server, tokenManager, client);

        const result = await client.getOptionChain('test-public-access-token', VALID_OPTION_CHAIN_INPUT);

        expect(result).toHaveProperty('data');
        expect(scope.isDone()).toBe(true);
      });

      // SC-494: Get option chain fails when not authenticated
      it('should fail when not authenticated — SC-494', async () => {
        const unauthTM = new TokenManager();
        registerOptionsTools(server, unauthTM, client);

        await expect(
          client.getOptionChain('', VALID_OPTION_CHAIN_INPUT),
        ).rejects.toThrow(/[Nn]ot authenticated/);
      });

      // SC-495: Get option chain fails when session expired
      it('should fail when session expired — SC-495', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-05-09T03:30:00.000Z'));
        const expTM = new TokenManager();
        expTM.setTokens({
          accessToken: 'at-exp',
          publicAccessToken: 'pat-exp',
          readAccessToken: 'rat-exp',
        });
        vi.setSystemTime(new Date('2025-05-09T10:30:00.000Z'));

        registerOptionsTools(server, expTM, client);

        await expect(
          client.getOptionChain('pat-exp', VALID_OPTION_CHAIN_INPUT),
        ).rejects.toThrow(/expired/);
      });
    });

    describe('validation', () => {
      // SC-496: Missing type rejected
      it('should reject missing type — SC-496', async () => {
        registerOptionsTools(server, tokenManager, client);
        const { type, ...noType } = VALID_OPTION_CHAIN_INPUT;

        await expect(
          client.getOptionChain('test-public-access-token', noType),
        ).rejects.toThrow(/type|required/i);
      });

      // SC-497: Invalid type rejected
      it('should reject invalid type — SC-497', async () => {
        registerOptionsTools(server, tokenManager, client);

        await expect(
          client.getOptionChain('test-public-access-token', { ...VALID_OPTION_CHAIN_INPUT, type: 'FUT' }),
        ).rejects.toThrow(/type|invalid|CE|PE|BOTH/i);
      });

      // SC-498: Missing underlying rejected
      it('should reject missing underlying — SC-498', async () => {
        registerOptionsTools(server, tokenManager, client);
        const { underlying, ...noUnderlying } = VALID_OPTION_CHAIN_INPUT;

        await expect(
          client.getOptionChain('test-public-access-token', noUnderlying),
        ).rejects.toThrow(/underlying|required/i);
      });

      // SC-499: Missing expiry rejected
      it('should reject missing expiry — SC-499', async () => {
        registerOptionsTools(server, tokenManager, client);
        const { expiry, ...noExpiry } = VALID_OPTION_CHAIN_INPUT;

        await expect(
          client.getOptionChain('test-public-access-token', noExpiry),
        ).rejects.toThrow(/expiry|required/i);
      });
    });

    describe('API errors', () => {
      // SC-500: API 400 — invalid underlying
      it('should handle API 400 — SC-500', async () => {
        nock(PAYTM_BASE)
          .get('/fno/v1/option-chain')
          .reply(400, { message: 'Invalid underlying' });

        registerOptionsTools(server, tokenManager, client);

        await expect(
          client.getOptionChain('test-public-access-token', { ...VALID_OPTION_CHAIN_INPUT, underlying: 'INVALID' }),
        ).rejects.toThrow(/Invalid underlying|400/);
      });

      // SC-501: API 500 with retry
      it('should retry on 5xx and fail after exhaustion — SC-501', async () => {
        nock(PAYTM_BASE)
          .get('/fno/v1/option-chain')
          .reply(500, { message: 'Internal Server Error' });
        nock(PAYTM_BASE)
          .get('/fno/v1/option-chain')
          .reply(500, { message: 'Internal Server Error' });

        registerOptionsTools(server, tokenManager, client);

        await expect(
          client.getOptionChain('test-public-access-token', VALID_OPTION_CHAIN_INPUT),
        ).rejects.toThrow();
      });

      it('should retry on 5xx and succeed — SC-501b', async () => {
        nock(PAYTM_BASE)
          .get('/fno/v1/option-chain')
          .reply(500, { message: 'Internal Server Error' });
        nock(PAYTM_BASE)
          .get('/fno/v1/option-chain')
          .reply(200, SAMPLE_OPTION_CHAIN_RESPONSE);

        registerOptionsTools(server, tokenManager, client);

        const result = await client.getOptionChain('test-public-access-token', VALID_OPTION_CHAIN_INPUT);

        expect(result).toHaveProperty('data');
      });

      it('should handle 429 rate limit', async () => {
        nock(PAYTM_BASE)
          .get('/fno/v1/option-chain')
          .reply(429, { message: 'Rate limited' }, { 'Retry-After': '1' });
        nock(PAYTM_BASE)
          .get('/fno/v1/option-chain')
          .reply(200, SAMPLE_OPTION_CHAIN_RESPONSE);

        registerOptionsTools(server, tokenManager, client);

        const result = await client.getOptionChain('test-public-access-token', VALID_OPTION_CHAIN_INPUT);

        expect(result).toHaveProperty('data');
      });
    });
  });
});
