import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TokenManager } from '../../src/auth/token-manager.js';
import { PaytmClient } from '../../src/client/pm-client.js';
import { registerTradeTools } from '../../src/tools/trade.tools.js';
import {
  createAuthenticatedTokenManager,
  SAMPLE_PLACE_ORDER_RESPONSE,
  SAMPLE_MODIFY_ORDER_RESPONSE,
  SAMPLE_CANCEL_ORDER_RESPONSE,
  VALID_PLACE_ORDER_INPUT,
  VALID_MODIFY_ORDER_INPUT,
  VALID_CANCEL_ORDER_INPUT,
} from '../helpers/test-utils.js';

const PAYTM_BASE = 'https://developer.paytmmoney.com';

describe('Trade Tools', () => {
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
  // paytm_place_order
  // =========================================================================
  describe('paytm_place_order', () => {
    describe('happy path', () => {
      // SC-210: Place limit buy order — regular (happy path)
      it('should place limit buy order on NSE — SC-210', async () => {
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/place/regular', (body: Record<string, unknown>) =>
            body.txn_type === 'B' && body.exchange === 'NSE' && body.order_type === 'LMT' && body.price === 1500.50,
          )
          .matchHeader('x-jwt-token', 'test-access-token')
          .reply(200, SAMPLE_PLACE_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.placeOrder('test-access-token', VALID_PLACE_ORDER_INPUT);

        expect(result).toHaveProperty('order_no', '220509000001');
        expect(result).toHaveProperty('status', 'SUCCESS');
        expect(scope.isDone()).toBe(true);
      });

      // SC-211: Place market buy order — regular
      it('should place market buy order — SC-211', async () => {
        const marketInput = { ...VALID_PLACE_ORDER_INPUT, product: 'I', order_type: 'MKT', price: undefined };
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/place/regular')
          .matchHeader('x-jwt-token', 'test-access-token')
          .reply(200, SAMPLE_PLACE_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.placeOrder('test-access-token', marketInput);

        expect(result).toHaveProperty('order_no');
        expect(scope.isDone()).toBe(true);
      });

      // SC-212: Place sell order — regular CNC
      it('should place sell order — SC-212', async () => {
        const sellInput = { ...VALID_PLACE_ORDER_INPUT, txn_type: 'S', price: 1600.00 };
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/place/regular', (body: Record<string, unknown>) => body.txn_type === 'S')
          .matchHeader('x-jwt-token', 'test-access-token')
          .reply(200, SAMPLE_PLACE_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.placeOrder('test-access-token', sellInput);

        expect(result).toHaveProperty('order_no');
        expect(scope.isDone()).toBe(true);
      });

      // SC-213: Place SL order with trigger price
      it('should place SL order with trigger price — SC-213', async () => {
        const slInput = {
          ...VALID_PLACE_ORDER_INPUT,
          product: 'I',
          order_type: 'SL',
          price: 1500.00,
          trigger_price: 1495.00,
        };
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/place/regular', (body: Record<string, unknown>) =>
            body.order_type === 'SL' && body.trigger_price === 1495.00,
          )
          .reply(200, SAMPLE_PLACE_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.placeOrder('test-access-token', slInput);

        expect(result).toHaveProperty('order_no');
        expect(scope.isDone()).toBe(true);
      });

      // SC-214: Place SLM order with trigger price
      it('should place SLM order with trigger price — SC-214', async () => {
        const slmInput = {
          ...VALID_PLACE_ORDER_INPUT,
          txn_type: 'S',
          exchange: 'BSE',
          product: 'C',
          security_id: '12345',
          quantity: 20,
          order_type: 'SLM',
          price: undefined,
          trigger_price: 800.00,
        };
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/place/regular', (body: Record<string, unknown>) =>
            body.order_type === 'SLM' && body.trigger_price === 800.00,
          )
          .reply(200, SAMPLE_PLACE_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.placeOrder('test-access-token', slmInput);

        expect(result).toHaveProperty('order_no');
        expect(scope.isDone()).toBe(true);
      });

      // SC-215: Place IOC validity order
      it('should place IOC validity order — SC-215', async () => {
        const iocInput = {
          ...VALID_PLACE_ORDER_INPUT,
          product: 'I',
          quantity: 100,
          validity: 'IOC',
          order_type: 'MKT',
          price: undefined,
        };
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/place/regular', (body: Record<string, unknown>) => body.validity === 'IOC')
          .reply(200, SAMPLE_PLACE_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.placeOrder('test-access-token', iocInput);

        expect(result).toHaveProperty('order_no');
        expect(scope.isDone()).toBe(true);
      });

      // SC-216: Default source is "N" when not provided
      it('should default source to "N" — SC-216', async () => {
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/place/regular', (body: Record<string, unknown>) => body.source === 'N')
          .reply(200, SAMPLE_PLACE_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.placeOrder('test-access-token', VALID_PLACE_ORDER_INPUT);

        expect(result).toHaveProperty('order_no');
        expect(scope.isDone()).toBe(true);
      });
    });

    describe('order type routing', () => {
      // SC-220: Regular order (product C) routes to /orders/v1/place/regular
      it('should route CNC to /orders/v1/place/regular — SC-220', async () => {
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/place/regular')
          .matchHeader('x-jwt-token', 'test-access-token')
          .reply(200, SAMPLE_PLACE_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.placeOrder('test-access-token', { ...VALID_PLACE_ORDER_INPUT, product: 'C' });

        expect(result).toHaveProperty('order_no');
        expect(scope.isDone()).toBe(true);
      });

      // SC-221: Regular order (product I/MIS) routes to /orders/v1/place/regular
      it('should route MIS to /orders/v1/place/regular — SC-221', async () => {
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/place/regular')
          .reply(200, SAMPLE_PLACE_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.placeOrder('test-access-token', { ...VALID_PLACE_ORDER_INPUT, product: 'I' });

        expect(result).toHaveProperty('order_no');
        expect(scope.isDone()).toBe(true);
      });

      // SC-222: Cover order routes to /orders/v1/place/cover
      it('should route cover order to /orders/v1/place/cover — SC-222', async () => {
        const coverInput = {
          ...VALID_PLACE_ORDER_INPUT,
          product: 'V',
          order_type: 'MKT',
          price: undefined,
          sl_price: 1480.00,
        };
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/place/cover', (body: Record<string, unknown>) =>
            body.product === 'V' && body.sl_price === 1480.00,
          )
          .reply(200, SAMPLE_PLACE_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.placeOrder('test-access-token', coverInput);

        expect(result).toHaveProperty('order_no');
        expect(scope.isDone()).toBe(true);
      });

      // SC-223: Bracket order routes to /orders/v1/place/bracket
      it('should route bracket order to /orders/v1/place/bracket — SC-223', async () => {
        const bracketInput = {
          ...VALID_PLACE_ORDER_INPUT,
          product: 'B',
          sl_price: 1480.00,
          tp_price: 1550.00,
        };
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/place/bracket', (body: Record<string, unknown>) =>
            body.product === 'B' && body.sl_price === 1480.00 && body.tp_price === 1550.00,
          )
          .reply(200, SAMPLE_PLACE_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.placeOrder('test-access-token', bracketInput);

        expect(result).toHaveProperty('order_no');
        expect(scope.isDone()).toBe(true);
      });

      // SC-224: BSE exchange is sent correctly
      it('should send BSE exchange correctly — SC-224', async () => {
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/place/regular', (body: Record<string, unknown>) => body.exchange === 'BSE')
          .reply(200, SAMPLE_PLACE_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.placeOrder('test-access-token', { ...VALID_PLACE_ORDER_INPUT, exchange: 'BSE' });

        expect(result).toHaveProperty('order_no');
        expect(scope.isDone()).toBe(true);
      });
    });

    describe('auth & token', () => {
      // SC-230: Place order sends access_token in x-jwt-token header
      it('should use access_token in x-jwt-token header — SC-230', async () => {
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/place/regular')
          .matchHeader('x-jwt-token', 'test-access-token')
          .reply(200, SAMPLE_PLACE_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.placeOrder('test-access-token', VALID_PLACE_ORDER_INPUT);

        expect(result).toHaveProperty('order_no');
        expect(scope.isDone()).toBe(true);
      });

      // SC-231: Fails when only read_access_token set (no access_token)
      it('should fail when only read_access_token set — SC-231', async () => {
        const readOnlyTM = new TokenManager();
        readOnlyTM.setTokens({ readAccessToken: 'rat-only' });
        registerTradeTools(server, readOnlyTM, client);

        expect(readOnlyTM.isAuthenticated()).toBe(true);
        expect(readOnlyTM.getAccessToken()).toBeNull();

        // Tool should require access_token for write operations
        await expect(
          client.placeOrder('', VALID_PLACE_ORDER_INPUT),
        ).rejects.toThrow(/access_token.*required|[Nn]ot authenticated/);
      });

      // SC-232: Fails when no tokens set
      it('should fail when not authenticated — SC-232', async () => {
        const unauthTM = new TokenManager();
        registerTradeTools(server, unauthTM, client);

        await expect(
          client.placeOrder('', VALID_PLACE_ORDER_INPUT),
        ).rejects.toThrow(/[Nn]ot authenticated/);
      });

      // SC-233: Fails when token expired
      it('should fail when token expired — SC-233', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-05-09T03:30:00.000Z'));
        const expTM = new TokenManager();
        expTM.setTokens({
          accessToken: 'at-exp',
          readAccessToken: 'rat-exp',
          publicAccessToken: 'pat-exp',
        });

        vi.setSystemTime(new Date('2025-05-09T10:30:00.000Z'));

        registerTradeTools(server, expTM, client);

        expect(() => expTM.assertNotExpired()).toThrow();

        await expect(
          client.placeOrder('at-exp', VALID_PLACE_ORDER_INPUT),
        ).rejects.toThrow(/expired/);
      });
    });

    describe('validation — required fields', () => {
      // SC-240: Missing txn_type rejected
      it('should reject missing txn_type — SC-240', async () => {
        registerTradeTools(server, tokenManager, client);
        const { txn_type, ...noTxnType } = VALID_PLACE_ORDER_INPUT;

        await expect(
          client.placeOrder('test-access-token', noTxnType),
        ).rejects.toThrow(/txn_type|required/i);
      });

      // SC-241: Missing exchange rejected
      it('should reject missing exchange — SC-241', async () => {
        registerTradeTools(server, tokenManager, client);
        const { exchange, ...noExchange } = VALID_PLACE_ORDER_INPUT;

        await expect(
          client.placeOrder('test-access-token', noExchange),
        ).rejects.toThrow(/exchange|required/i);
      });

      // SC-242: Missing security_id rejected
      it('should reject missing security_id — SC-242', async () => {
        registerTradeTools(server, tokenManager, client);
        const { security_id, ...noSecurityId } = VALID_PLACE_ORDER_INPUT;

        await expect(
          client.placeOrder('test-access-token', noSecurityId),
        ).rejects.toThrow(/security_id|required/i);
      });

      // SC-243: Missing quantity rejected
      it('should reject missing quantity — SC-243', async () => {
        registerTradeTools(server, tokenManager, client);
        const { quantity, ...noQuantity } = VALID_PLACE_ORDER_INPUT;

        await expect(
          client.placeOrder('test-access-token', noQuantity),
        ).rejects.toThrow(/quantity|required/i);
      });

      // SC-244: Missing order_type rejected
      it('should reject missing order_type — SC-244', async () => {
        registerTradeTools(server, tokenManager, client);
        const { order_type, ...noOrderType } = VALID_PLACE_ORDER_INPUT;

        await expect(
          client.placeOrder('test-access-token', noOrderType),
        ).rejects.toThrow(/order_type|required/i);
      });
    });

    describe('validation — invalid enum values', () => {
      // SC-245: Invalid txn_type rejected
      it('should reject invalid txn_type — SC-245', async () => {
        registerTradeTools(server, tokenManager, client);

        await expect(
          client.placeOrder('test-access-token', { ...VALID_PLACE_ORDER_INPUT, txn_type: 'X' }),
        ).rejects.toThrow(/txn_type|invalid|"B"|"S"/i);
      });

      // SC-246: Invalid exchange rejected
      it('should reject invalid exchange — SC-246', async () => {
        registerTradeTools(server, tokenManager, client);

        await expect(
          client.placeOrder('test-access-token', { ...VALID_PLACE_ORDER_INPUT, exchange: 'MCX' }),
        ).rejects.toThrow(/exchange|invalid|"NSE"|"BSE"/i);
      });

      // SC-247: Invalid product rejected
      it('should reject invalid product — SC-247', async () => {
        registerTradeTools(server, tokenManager, client);

        await expect(
          client.placeOrder('test-access-token', { ...VALID_PLACE_ORDER_INPUT, product: 'Z' }),
        ).rejects.toThrow(/product|invalid/i);
      });

      // SC-248: Invalid order_type rejected
      it('should reject invalid order_type — SC-248', async () => {
        registerTradeTools(server, tokenManager, client);

        await expect(
          client.placeOrder('test-access-token', { ...VALID_PLACE_ORDER_INPUT, order_type: 'FOK' }),
        ).rejects.toThrow(/order_type|invalid/i);
      });

      // SC-249: Invalid validity rejected
      it('should reject invalid validity — SC-249', async () => {
        registerTradeTools(server, tokenManager, client);

        await expect(
          client.placeOrder('test-access-token', { ...VALID_PLACE_ORDER_INPUT, validity: 'GTC' }),
        ).rejects.toThrow(/validity|invalid/i);
      });
    });

    describe('validation — boundary cases', () => {
      // SC-250: Quantity zero rejected
      it('should reject quantity zero — SC-250', async () => {
        registerTradeTools(server, tokenManager, client);

        await expect(
          client.placeOrder('test-access-token', { ...VALID_PLACE_ORDER_INPUT, quantity: 0 }),
        ).rejects.toThrow(/quantity|must be.*> ?0|positive/i);
      });

      // SC-251: Negative quantity rejected
      it('should reject negative quantity — SC-251', async () => {
        registerTradeTools(server, tokenManager, client);

        await expect(
          client.placeOrder('test-access-token', { ...VALID_PLACE_ORDER_INPUT, quantity: -5 }),
        ).rejects.toThrow(/quantity|must be.*> ?0|positive/i);
      });

      // SC-252: Negative price rejected
      it('should reject negative price — SC-252', async () => {
        registerTradeTools(server, tokenManager, client);

        await expect(
          client.placeOrder('test-access-token', { ...VALID_PLACE_ORDER_INPUT, price: -100 }),
        ).rejects.toThrow(/price|must be.*> ?0|positive/i);
      });

      // SC-253: LMT order without price rejected
      it('should reject LMT order without price — SC-253', async () => {
        registerTradeTools(server, tokenManager, client);
        const { price, ...noPriceInput } = VALID_PLACE_ORDER_INPUT;

        await expect(
          client.placeOrder('test-access-token', { ...noPriceInput, order_type: 'LMT' }),
        ).rejects.toThrow(/price.*required|LMT/i);
      });

      // SC-254: SL order without trigger_price rejected
      it('should reject SL order without trigger_price — SC-254', async () => {
        registerTradeTools(server, tokenManager, client);

        await expect(
          client.placeOrder('test-access-token', {
            ...VALID_PLACE_ORDER_INPUT,
            order_type: 'SL',
            price: 1500.00,
            // no trigger_price
          }),
        ).rejects.toThrow(/trigger_price.*required|SL/i);
      });

      // SC-255: SLM order without trigger_price rejected
      it('should reject SLM order without trigger_price — SC-255', async () => {
        registerTradeTools(server, tokenManager, client);

        await expect(
          client.placeOrder('test-access-token', {
            ...VALID_PLACE_ORDER_INPUT,
            order_type: 'SLM',
            price: undefined,
            // no trigger_price
          }),
        ).rejects.toThrow(/trigger_price.*required|SLM/i);
      });

      // SC-256: MKT order ignores price field
      it('should allow MKT order with price field — SC-256', async () => {
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/place/regular')
          .reply(200, SAMPLE_PLACE_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.placeOrder('test-access-token', {
          ...VALID_PLACE_ORDER_INPUT,
          order_type: 'MKT',
          price: 1500,
        });

        expect(result).toHaveProperty('order_no');
        expect(scope.isDone()).toBe(true);
      });

      // SC-257: Fractional quantity rejected
      it('should reject fractional quantity — SC-257', async () => {
        registerTradeTools(server, tokenManager, client);

        await expect(
          client.placeOrder('test-access-token', { ...VALID_PLACE_ORDER_INPUT, quantity: 1.5 }),
        ).rejects.toThrow(/quantity|integer|whole/i);
      });
    });

    describe('API errors', () => {
      // SC-260: API returns 401 unauthorized
      it('should handle API 401 — SC-260', async () => {
        nock(PAYTM_BASE)
          .post('/orders/v1/place/regular')
          .reply(401, { message: 'Unauthorized' });

        registerTradeTools(server, tokenManager, client);

        await expect(
          client.placeOrder('test-access-token', VALID_PLACE_ORDER_INPUT),
        ).rejects.toThrow();
      });

      // SC-261: API returns 400 with rejection reason
      it('should passthrough API 400 error message — SC-261', async () => {
        nock(PAYTM_BASE)
          .post('/orders/v1/place/regular')
          .reply(400, { message: 'Insufficient funds' });

        registerTradeTools(server, tokenManager, client);

        await expect(
          client.placeOrder('test-access-token', VALID_PLACE_ORDER_INPUT),
        ).rejects.toThrow(/Insufficient funds|400/);
      });

      // SC-262: API 500 retries then succeeds
      it('should retry on 5xx and succeed — SC-262', async () => {
        nock(PAYTM_BASE)
          .post('/orders/v1/place/regular')
          .reply(500, { message: 'Internal Server Error' });
        nock(PAYTM_BASE)
          .post('/orders/v1/place/regular')
          .reply(200, SAMPLE_PLACE_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.placeOrder('test-access-token', VALID_PLACE_ORDER_INPUT);

        expect(result).toHaveProperty('order_no');
      });

      // SC-263: API 500 twice — retry exhausted
      it('should fail after retry exhaustion on 5xx — SC-263', async () => {
        nock(PAYTM_BASE)
          .post('/orders/v1/place/regular')
          .reply(500, { message: 'Internal Server Error' });
        nock(PAYTM_BASE)
          .post('/orders/v1/place/regular')
          .reply(500, { message: 'Internal Server Error' });

        registerTradeTools(server, tokenManager, client);

        await expect(
          client.placeOrder('test-access-token', VALID_PLACE_ORDER_INPUT),
        ).rejects.toThrow();
      });

      // SC-264: API 429 rate limit
      it('should handle 429 rate limit — SC-264', async () => {
        nock(PAYTM_BASE)
          .post('/orders/v1/place/regular')
          .reply(429, { message: 'Rate limited' }, { 'Retry-After': '2' });
        nock(PAYTM_BASE)
          .post('/orders/v1/place/regular')
          .reply(200, SAMPLE_PLACE_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.placeOrder('test-access-token', VALID_PLACE_ORDER_INPUT);

        expect(result).toHaveProperty('order_no');
      });

      // SC-265: Network timeout
      it('should handle network timeout — SC-265', async () => {
        nock(PAYTM_BASE)
          .post('/orders/v1/place/regular')
          .delayConnection(15_000)
          .reply(200, SAMPLE_PLACE_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        await expect(
          client.placeOrder('test-access-token', VALID_PLACE_ORDER_INPUT),
        ).rejects.toThrow(/timeout|ECONNABORTED/i);
      });

      // SC-266: Market closed
      it('should handle market closed error — SC-266', async () => {
        nock(PAYTM_BASE)
          .post('/orders/v1/place/regular')
          .reply(400, { message: 'Market is closed' });

        registerTradeTools(server, tokenManager, client);

        await expect(
          client.placeOrder('test-access-token', VALID_PLACE_ORDER_INPUT),
        ).rejects.toThrow(/Market is closed|400/);
      });
    });
  });

  // =========================================================================
  // paytm_modify_order
  // =========================================================================
  describe('paytm_modify_order', () => {
    describe('happy path', () => {
      // SC-270: Modify order — change quantity
      it('should modify order quantity — SC-270', async () => {
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/modify/regular', (body: Record<string, unknown>) =>
            body.order_no === 'ORD-001' && body.quantity === 20,
          )
          .matchHeader('x-jwt-token', 'test-access-token')
          .reply(200, SAMPLE_MODIFY_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.modifyOrder('test-access-token', VALID_MODIFY_ORDER_INPUT);

        expect(result).toHaveProperty('order_no', '220509000001');
        expect(result).toHaveProperty('status', 'SUCCESS');
        expect(scope.isDone()).toBe(true);
      });

      // SC-271: Modify order — change price
      it('should modify order price — SC-271', async () => {
        const modifyPriceInput = { ...VALID_MODIFY_ORDER_INPUT, price: 1520.00 };
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/modify/regular', (body: Record<string, unknown>) => body.price === 1520.00)
          .reply(200, SAMPLE_MODIFY_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.modifyOrder('test-access-token', modifyPriceInput);

        expect(result).toHaveProperty('status', 'SUCCESS');
        expect(scope.isDone()).toBe(true);
      });

      // SC-272: Modify order — change order type
      it('should modify order type from LMT to MKT — SC-272', async () => {
        const modifyTypeInput = { ...VALID_MODIFY_ORDER_INPUT, order_type: 'MKT', price: undefined };
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/modify/regular')
          .reply(200, SAMPLE_MODIFY_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.modifyOrder('test-access-token', modifyTypeInput);

        expect(result).toHaveProperty('status', 'SUCCESS');
        expect(scope.isDone()).toBe(true);
      });
    });

    describe('routing', () => {
      // SC-273: Modify regular order routes to /orders/v1/modify/regular
      it('should route regular modify to /orders/v1/modify/regular — SC-273', async () => {
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/modify/regular')
          .reply(200, SAMPLE_MODIFY_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.modifyOrder('test-access-token', { ...VALID_MODIFY_ORDER_INPUT, product: 'C' });

        expect(result).toHaveProperty('order_no');
        expect(scope.isDone()).toBe(true);
      });

      // SC-274: Modify cover order routes to /orders/v1/modify/cover
      it('should route cover modify to /orders/v1/modify/cover — SC-274', async () => {
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/modify/cover')
          .reply(200, SAMPLE_MODIFY_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.modifyOrder('test-access-token', { ...VALID_MODIFY_ORDER_INPUT, product: 'V' });

        expect(result).toHaveProperty('order_no');
        expect(scope.isDone()).toBe(true);
      });

      // SC-275: Modify bracket order routes to /orders/v1/modify/bracket
      it('should route bracket modify to /orders/v1/modify/bracket — SC-275', async () => {
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/modify/bracket', (body: Record<string, unknown>) => body.group_id === 1)
          .reply(200, SAMPLE_MODIFY_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.modifyOrder('test-access-token', {
          ...VALID_MODIFY_ORDER_INPUT,
          product: 'B',
          group_id: 1,
        });

        expect(result).toHaveProperty('order_no');
        expect(scope.isDone()).toBe(true);
      });
    });

    describe('auth & validation', () => {
      // SC-276: Modify order uses access_token in header
      it('should use access_token in x-jwt-token header — SC-276', async () => {
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/modify/regular')
          .matchHeader('x-jwt-token', 'test-access-token')
          .reply(200, SAMPLE_MODIFY_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.modifyOrder('test-access-token', VALID_MODIFY_ORDER_INPUT);

        expect(result).toHaveProperty('order_no');
        expect(scope.isDone()).toBe(true);
      });

      // SC-277: Modify order fails without access_token
      it('should fail without access_token — SC-277', async () => {
        const readOnlyTM = new TokenManager();
        readOnlyTM.setTokens({ readAccessToken: 'rat-only' });
        registerTradeTools(server, readOnlyTM, client);

        await expect(
          client.modifyOrder('', VALID_MODIFY_ORDER_INPUT),
        ).rejects.toThrow(/access_token.*required|[Nn]ot authenticated/);
      });

      // SC-278: Modify order fails when not authenticated
      it('should fail when not authenticated — SC-278', async () => {
        const unauthTM = new TokenManager();
        registerTradeTools(server, unauthTM, client);

        await expect(
          client.modifyOrder('', VALID_MODIFY_ORDER_INPUT),
        ).rejects.toThrow(/[Nn]ot authenticated/);
      });

      // SC-279: Modify order fails when token expired
      it('should fail when token expired — SC-279', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-05-09T03:30:00.000Z'));
        const expTM = new TokenManager();
        expTM.setTokens({ accessToken: 'at-exp', readAccessToken: 'rat-exp' });
        vi.setSystemTime(new Date('2025-05-09T10:30:00.000Z'));

        registerTradeTools(server, expTM, client);

        await expect(
          client.modifyOrder('at-exp', VALID_MODIFY_ORDER_INPUT),
        ).rejects.toThrow(/expired/);
      });

      // SC-280: Missing order_no rejected
      it('should reject missing order_no — SC-280', async () => {
        registerTradeTools(server, tokenManager, client);
        const { order_no, ...noOrderNo } = VALID_MODIFY_ORDER_INPUT;

        await expect(
          client.modifyOrder('test-access-token', noOrderNo),
        ).rejects.toThrow(/order_no|required/i);
      });

      // SC-281: Missing serial_no rejected
      it('should reject missing serial_no — SC-281', async () => {
        registerTradeTools(server, tokenManager, client);
        const { serial_no, ...noSerialNo } = VALID_MODIFY_ORDER_INPUT;

        await expect(
          client.modifyOrder('test-access-token', noSerialNo),
        ).rejects.toThrow(/serial_no|required/i);
      });
    });

    describe('API errors', () => {
      // SC-283: API returns 400 "Order not found"
      it('should handle order not found — SC-283', async () => {
        nock(PAYTM_BASE)
          .post('/orders/v1/modify/regular')
          .reply(400, { message: 'Order not found' });

        registerTradeTools(server, tokenManager, client);

        await expect(
          client.modifyOrder('test-access-token', { ...VALID_MODIFY_ORDER_INPUT, order_no: 'FAKE-999' }),
        ).rejects.toThrow(/Order not found|400/);
      });

      // SC-284: API returns 400 "Order already executed"
      it('should handle already executed order — SC-284', async () => {
        nock(PAYTM_BASE)
          .post('/orders/v1/modify/regular')
          .reply(400, { message: 'Cannot modify executed order' });

        registerTradeTools(server, tokenManager, client);

        await expect(
          client.modifyOrder('test-access-token', VALID_MODIFY_ORDER_INPUT),
        ).rejects.toThrow(/Cannot modify executed order|400/);
      });

      // SC-285: API 500 with retry
      it('should retry on 5xx and succeed — SC-285', async () => {
        nock(PAYTM_BASE)
          .post('/orders/v1/modify/regular')
          .reply(500, { message: 'Internal Server Error' });
        nock(PAYTM_BASE)
          .post('/orders/v1/modify/regular')
          .reply(200, SAMPLE_MODIFY_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.modifyOrder('test-access-token', VALID_MODIFY_ORDER_INPUT);

        expect(result).toHaveProperty('order_no');
      });

      // SC-286: API 429 rate limit
      it('should handle 429 rate limit — SC-286', async () => {
        nock(PAYTM_BASE)
          .post('/orders/v1/modify/regular')
          .reply(429, { message: 'Rate limited' }, { 'Retry-After': '1' });
        nock(PAYTM_BASE)
          .post('/orders/v1/modify/regular')
          .reply(200, SAMPLE_MODIFY_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.modifyOrder('test-access-token', VALID_MODIFY_ORDER_INPUT);

        expect(result).toHaveProperty('order_no');
      });
    });
  });

  // =========================================================================
  // paytm_cancel_order
  // =========================================================================
  describe('paytm_cancel_order', () => {
    describe('happy path', () => {
      // SC-290: Cancel regular order — happy path
      it('should cancel regular order — SC-290', async () => {
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/cancel/regular', (body: Record<string, unknown>) =>
            body.order_no === 'ORD-001' && body.serial_no === 1,
          )
          .matchHeader('x-jwt-token', 'test-access-token')
          .reply(200, SAMPLE_CANCEL_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.cancelOrder('test-access-token', VALID_CANCEL_ORDER_INPUT);

        expect(result).toHaveProperty('order_no', '220509000001');
        expect(result).toHaveProperty('status', 'SUCCESS');
        expect(scope.isDone()).toBe(true);
      });

      // SC-291: Cancel MIS order
      it('should cancel MIS order — SC-291', async () => {
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/cancel/regular')
          .reply(200, SAMPLE_CANCEL_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.cancelOrder('test-access-token', {
          ...VALID_CANCEL_ORDER_INPUT,
          product: 'I',
        });

        expect(result).toHaveProperty('status', 'SUCCESS');
        expect(scope.isDone()).toBe(true);
      });
    });

    describe('routing', () => {
      // SC-292: Cancel regular routes to /orders/v1/cancel/regular
      it('should route regular cancel to /orders/v1/cancel/regular — SC-292', async () => {
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/cancel/regular')
          .reply(200, SAMPLE_CANCEL_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.cancelOrder('test-access-token', { ...VALID_CANCEL_ORDER_INPUT, product: 'C' });

        expect(result).toHaveProperty('order_no');
        expect(scope.isDone()).toBe(true);
      });

      // SC-293: Cancel cover routes to /orders/v1/cancel/cover
      it('should route cover cancel to /orders/v1/cancel/cover — SC-293', async () => {
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/cancel/cover')
          .reply(200, SAMPLE_CANCEL_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.cancelOrder('test-access-token', { ...VALID_CANCEL_ORDER_INPUT, product: 'V' });

        expect(result).toHaveProperty('order_no');
        expect(scope.isDone()).toBe(true);
      });

      // SC-294: Cancel bracket routes to /orders/v1/cancel/bracket
      it('should route bracket cancel to /orders/v1/cancel/bracket — SC-294', async () => {
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/cancel/bracket', (body: Record<string, unknown>) => body.group_id === 1)
          .reply(200, SAMPLE_CANCEL_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.cancelOrder('test-access-token', {
          ...VALID_CANCEL_ORDER_INPUT,
          product: 'B',
          group_id: 1,
        });

        expect(result).toHaveProperty('order_no');
        expect(scope.isDone()).toBe(true);
      });
    });

    describe('auth & validation', () => {
      // SC-295: Cancel order uses access_token in header
      it('should use access_token in x-jwt-token header — SC-295', async () => {
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/cancel/regular')
          .matchHeader('x-jwt-token', 'test-access-token')
          .reply(200, SAMPLE_CANCEL_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.cancelOrder('test-access-token', VALID_CANCEL_ORDER_INPUT);

        expect(result).toHaveProperty('order_no');
        expect(scope.isDone()).toBe(true);
      });

      // SC-296: Cancel order fails without access_token
      it('should fail without access_token — SC-296', async () => {
        const readOnlyTM = new TokenManager();
        readOnlyTM.setTokens({ readAccessToken: 'rat-only' });
        registerTradeTools(server, readOnlyTM, client);

        await expect(
          client.cancelOrder('', VALID_CANCEL_ORDER_INPUT),
        ).rejects.toThrow(/access_token.*required|[Nn]ot authenticated/);
      });

      // SC-297: Cancel order fails when not authenticated
      it('should fail when not authenticated — SC-297', async () => {
        const unauthTM = new TokenManager();
        registerTradeTools(server, unauthTM, client);

        await expect(
          client.cancelOrder('', VALID_CANCEL_ORDER_INPUT),
        ).rejects.toThrow(/[Nn]ot authenticated/);
      });

      // SC-298: Cancel order fails when token expired
      it('should fail when token expired — SC-298', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-05-09T03:30:00.000Z'));
        const expTM = new TokenManager();
        expTM.setTokens({ accessToken: 'at-exp', readAccessToken: 'rat-exp' });
        vi.setSystemTime(new Date('2025-05-09T10:30:00.000Z'));

        registerTradeTools(server, expTM, client);

        await expect(
          client.cancelOrder('at-exp', VALID_CANCEL_ORDER_INPUT),
        ).rejects.toThrow(/expired/);
      });

      // SC-299: Missing order_no rejected
      it('should reject missing order_no — SC-299', async () => {
        registerTradeTools(server, tokenManager, client);
        const { order_no, ...noOrderNo } = VALID_CANCEL_ORDER_INPUT;

        await expect(
          client.cancelOrder('test-access-token', noOrderNo),
        ).rejects.toThrow(/order_no|required/i);
      });

      // SC-300: Missing serial_no rejected
      it('should reject missing serial_no — SC-300', async () => {
        registerTradeTools(server, tokenManager, client);
        const { serial_no, ...noSerialNo } = VALID_CANCEL_ORDER_INPUT;

        await expect(
          client.cancelOrder('test-access-token', noSerialNo),
        ).rejects.toThrow(/serial_no|required/i);
      });

      // SC-301: Missing product rejected
      it('should reject missing product — SC-301', async () => {
        registerTradeTools(server, tokenManager, client);
        const { product, ...noProduct } = VALID_CANCEL_ORDER_INPUT;

        await expect(
          client.cancelOrder('test-access-token', noProduct),
        ).rejects.toThrow(/product|required/i);
      });
    });

    describe('API errors', () => {
      // SC-303: Already cancelled
      it('should handle already cancelled order — SC-303', async () => {
        nock(PAYTM_BASE)
          .post('/orders/v1/cancel/regular')
          .reply(400, { message: 'Order already cancelled' });

        registerTradeTools(server, tokenManager, client);

        await expect(
          client.cancelOrder('test-access-token', VALID_CANCEL_ORDER_INPUT),
        ).rejects.toThrow(/Order already cancelled|400/);
      });

      // SC-304: Already executed
      it('should handle already executed order — SC-304', async () => {
        nock(PAYTM_BASE)
          .post('/orders/v1/cancel/regular')
          .reply(400, { message: 'Cannot cancel executed order' });

        registerTradeTools(server, tokenManager, client);

        await expect(
          client.cancelOrder('test-access-token', VALID_CANCEL_ORDER_INPUT),
        ).rejects.toThrow(/Cannot cancel executed order|400/);
      });

      // SC-305: Order not found
      it('should handle order not found — SC-305', async () => {
        nock(PAYTM_BASE)
          .post('/orders/v1/cancel/regular')
          .reply(400, { message: 'Order not found' });

        registerTradeTools(server, tokenManager, client);

        await expect(
          client.cancelOrder('test-access-token', VALID_CANCEL_ORDER_INPUT),
        ).rejects.toThrow(/Order not found|400/);
      });

      // SC-306: API 500 with retry
      it('should retry on 5xx and succeed — SC-306', async () => {
        nock(PAYTM_BASE)
          .post('/orders/v1/cancel/regular')
          .reply(500, { message: 'Internal Server Error' });
        nock(PAYTM_BASE)
          .post('/orders/v1/cancel/regular')
          .reply(200, SAMPLE_CANCEL_ORDER_RESPONSE);

        registerTradeTools(server, tokenManager, client);

        const result = await client.cancelOrder('test-access-token', VALID_CANCEL_ORDER_INPUT);

        expect(result).toHaveProperty('order_no');
      });

      // SC-307: Network error
      it('should handle network error — SC-307', async () => {
        nock(PAYTM_BASE)
          .post('/orders/v1/cancel/regular')
          .replyWithError('connect ECONNREFUSED 127.0.0.1:443');

        registerTradeTools(server, tokenManager, client);

        await expect(
          client.cancelOrder('test-access-token', VALID_CANCEL_ORDER_INPUT),
        ).rejects.toThrow();
      });
    });
  });
});
