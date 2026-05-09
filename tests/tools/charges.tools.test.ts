import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TokenManager } from '../../src/auth/token-manager.js';
import { PaytmClient } from '../../src/client/pm-client.js';
import { registerChargesTools } from '../../src/tools/charges.tools.js';
import {
  createAuthenticatedTokenManager,
  SAMPLE_CHARGES_RESPONSE,
  VALID_CHARGES_INPUT,
} from '../helpers/test-utils.js';

const PAYTM_BASE = 'https://developer.paytmmoney.com';

describe('Charges Tools', () => {
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
  // paytm_get_charges
  // =========================================================================
  describe('paytm_get_charges', () => {
    describe('happy path', () => {
      // SC-505: Get charges for equity buy order
      it('should get charges for equity buy order — SC-505', async () => {
        const scope = nock(PAYTM_BASE)
          .post('/charges/v1/charges-info', (body: Record<string, unknown>) =>
            body.txn_type === 'B' && body.segment === 'E' && body.exchange === 'NSE',
          )
          .matchHeader('x-jwt-token', 'test-read-access-token')
          .reply(200, SAMPLE_CHARGES_RESPONSE);

        registerChargesTools(server, tokenManager, client);

        const result = await client.getCharges('test-read-access-token', VALID_CHARGES_INPUT);

        expect(result).toHaveProperty('brokerage', 20.00);
        expect(result).toHaveProperty('stt', 1.25);
        expect(result).toHaveProperty('exchange_charges', 0.50);
        expect(result).toHaveProperty('gst', 3.60);
        expect(result).toHaveProperty('stamp_duty', 0.15);
        expect(result).toHaveProperty('total', 25.50);
        expect(scope.isDone()).toBe(true);
      });

      // SC-506: Get charges for equity sell order
      it('should get charges for equity sell order — SC-506', async () => {
        const sellInput = { ...VALID_CHARGES_INPUT, txn_type: 'S' };
        const scope = nock(PAYTM_BASE)
          .post('/charges/v1/charges-info', (body: Record<string, unknown>) => body.txn_type === 'S')
          .matchHeader('x-jwt-token', 'test-read-access-token')
          .reply(200, { ...SAMPLE_CHARGES_RESPONSE, stt: 2.50, total: 26.75 });

        registerChargesTools(server, tokenManager, client);

        const result = await client.getCharges('test-read-access-token', sellInput);

        expect(result).toHaveProperty('brokerage');
        expect(result).toHaveProperty('total');
        expect(scope.isDone()).toBe(true);
      });

      // SC-507: Get charges for MIS product
      it('should get charges for MIS product — SC-507', async () => {
        const misInput = { ...VALID_CHARGES_INPUT, product: 'I' };
        const scope = nock(PAYTM_BASE)
          .post('/charges/v1/charges-info', (body: Record<string, unknown>) => body.product === 'I')
          .matchHeader('x-jwt-token', 'test-read-access-token')
          .reply(200, SAMPLE_CHARGES_RESPONSE);

        registerChargesTools(server, tokenManager, client);

        const result = await client.getCharges('test-read-access-token', misInput);

        expect(result).toHaveProperty('brokerage');
        expect(scope.isDone()).toBe(true);
      });

      // SC-508: Get charges on BSE exchange
      it('should get charges on BSE exchange — SC-508', async () => {
        const bseInput = { ...VALID_CHARGES_INPUT, exchange: 'BSE' };
        const scope = nock(PAYTM_BASE)
          .post('/charges/v1/charges-info', (body: Record<string, unknown>) => body.exchange === 'BSE')
          .matchHeader('x-jwt-token', 'test-read-access-token')
          .reply(200, SAMPLE_CHARGES_RESPONSE);

        registerChargesTools(server, tokenManager, client);

        const result = await client.getCharges('test-read-access-token', bseInput);

        expect(result).toHaveProperty('brokerage');
        expect(scope.isDone()).toBe(true);
      });
    });

    describe('auth & token', () => {
      // SC-509: Get charges requires read_access_token
      it('should use read_access_token in header — SC-509', async () => {
        const scope = nock(PAYTM_BASE)
          .post('/charges/v1/charges-info')
          .matchHeader('x-jwt-token', 'test-read-access-token')
          .reply(200, SAMPLE_CHARGES_RESPONSE);

        registerChargesTools(server, tokenManager, client);

        const result = await client.getCharges('test-read-access-token', VALID_CHARGES_INPUT);

        expect(result).toHaveProperty('brokerage');
        expect(scope.isDone()).toBe(true);
      });

      // SC-510: Get charges fails when not authenticated
      it('should fail when not authenticated — SC-510', async () => {
        const unauthTM = new TokenManager();
        registerChargesTools(server, unauthTM, client);

        await expect(
          client.getCharges('', VALID_CHARGES_INPUT),
        ).rejects.toThrow(/[Nn]ot authenticated/);
      });

      // SC-511: Get charges fails when session expired
      it('should fail when session expired — SC-511', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-05-09T03:30:00.000Z'));
        const expTM = new TokenManager();
        expTM.setTokens({
          accessToken: 'at-exp',
          publicAccessToken: 'pat-exp',
          readAccessToken: 'rat-exp',
        });
        vi.setSystemTime(new Date('2025-05-09T10:30:00.000Z'));

        registerChargesTools(server, expTM, client);

        await expect(
          client.getCharges('rat-exp', VALID_CHARGES_INPUT),
        ).rejects.toThrow(/expired/);
      });
    });

    describe('validation', () => {
      // SC-512: Quantity zero rejected
      it('should reject quantity zero — SC-512', async () => {
        registerChargesTools(server, tokenManager, client);

        await expect(
          client.getCharges('test-read-access-token', { ...VALID_CHARGES_INPUT, qty: 0 }),
        ).rejects.toThrow(/qty|quantity|must be.*> ?0|positive/i);
      });

      // SC-513: Negative quantity rejected
      it('should reject negative quantity — SC-513', async () => {
        registerChargesTools(server, tokenManager, client);

        await expect(
          client.getCharges('test-read-access-token', { ...VALID_CHARGES_INPUT, qty: -5 }),
        ).rejects.toThrow(/qty|quantity|must be.*> ?0|positive/i);
      });

      // SC-514: Price zero rejected
      it('should reject price zero — SC-514', async () => {
        registerChargesTools(server, tokenManager, client);

        await expect(
          client.getCharges('test-read-access-token', { ...VALID_CHARGES_INPUT, price: 0 }),
        ).rejects.toThrow(/price|must be.*> ?0|positive/i);
      });

      // SC-515: Missing segment rejected
      it('should reject missing segment — SC-515', async () => {
        registerChargesTools(server, tokenManager, client);
        const { segment, ...noSegment } = VALID_CHARGES_INPUT;

        await expect(
          client.getCharges('test-read-access-token', noSegment),
        ).rejects.toThrow(/segment|required/i);
      });

      // SC-516: Invalid txn_type rejected
      it('should reject invalid txn_type — SC-516', async () => {
        registerChargesTools(server, tokenManager, client);

        await expect(
          client.getCharges('test-read-access-token', { ...VALID_CHARGES_INPUT, txn_type: 'X' }),
        ).rejects.toThrow(/txn_type|invalid|"B"|"S"/i);
      });

      // SC-517: Invalid product rejected
      it('should reject invalid product — SC-517', async () => {
        registerChargesTools(server, tokenManager, client);

        await expect(
          client.getCharges('test-read-access-token', { ...VALID_CHARGES_INPUT, product: 'X' }),
        ).rejects.toThrow(/product|invalid/i);
      });
    });

    describe('API errors', () => {
      // SC-518: API 500 with retry
      it('should retry on 5xx and fail after exhaustion — SC-518', async () => {
        nock(PAYTM_BASE)
          .post('/charges/v1/charges-info')
          .reply(500, { message: 'Internal Server Error' });
        nock(PAYTM_BASE)
          .post('/charges/v1/charges-info')
          .reply(500, { message: 'Internal Server Error' });

        registerChargesTools(server, tokenManager, client);

        await expect(
          client.getCharges('test-read-access-token', VALID_CHARGES_INPUT),
        ).rejects.toThrow();
      });

      it('should retry on 5xx and succeed — SC-518b', async () => {
        nock(PAYTM_BASE)
          .post('/charges/v1/charges-info')
          .reply(500, { message: 'Internal Server Error' });
        nock(PAYTM_BASE)
          .post('/charges/v1/charges-info')
          .reply(200, SAMPLE_CHARGES_RESPONSE);

        registerChargesTools(server, tokenManager, client);

        const result = await client.getCharges('test-read-access-token', VALID_CHARGES_INPUT);

        expect(result).toHaveProperty('brokerage');
      });

      it('should handle 429 rate limit', async () => {
        nock(PAYTM_BASE)
          .post('/charges/v1/charges-info')
          .reply(429, { message: 'Rate limited' }, { 'Retry-After': '1' });
        nock(PAYTM_BASE)
          .post('/charges/v1/charges-info')
          .reply(200, SAMPLE_CHARGES_RESPONSE);

        registerChargesTools(server, tokenManager, client);

        const result = await client.getCharges('test-read-access-token', VALID_CHARGES_INPUT);

        expect(result).toHaveProperty('brokerage');
      });
    });
  });
});
