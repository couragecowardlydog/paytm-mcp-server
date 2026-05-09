import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { PaytmClient } from '../../src/client/pm-client.js';
import {
  SAMPLE_TOKEN_RESPONSE,
  SAMPLE_HOLDINGS,
  SAMPLE_POSITIONS,
  SAMPLE_USER_DETAILS,
  SAMPLE_FUNDS,
  SAMPLE_ORDERS,
  SAMPLE_PLACE_ORDER_RESPONSE,
  SAMPLE_MODIFY_ORDER_RESPONSE,
  SAMPLE_CANCEL_ORDER_RESPONSE,
  SAMPLE_LIVE_PRICE_LTP,
  SAMPLE_LIVE_PRICE_FULL,
  SAMPLE_SEARCH_RESULTS,
  VALID_PLACE_ORDER_INPUT,
  VALID_MODIFY_ORDER_INPUT,
  VALID_CANCEL_ORDER_INPUT,
  SAMPLE_GTT_CREATE_RESPONSE,
  SAMPLE_GTT_GET_RESPONSE,
  SAMPLE_GTT_UPDATE_RESPONSE,
  SAMPLE_GTT_DELETE_RESPONSE,
  SAMPLE_GTT_AGGREGATE_RESPONSE,
  SAMPLE_OPTION_CHAIN_RESPONSE,
  SAMPLE_CHARGES_RESPONSE,
  VALID_CREATE_GTT_INPUT,
  VALID_UPDATE_GTT_INPUT,
  VALID_OPTION_CHAIN_INPUT,
  VALID_CHARGES_INPUT,
} from '../helpers/test-utils.js';

const PAYTM_BASE = 'https://developer.paytmmoney.com';

describe('PaytmClient', () => {
  let client: PaytmClient;

  beforeEach(() => {
    client = new PaytmClient(PAYTM_BASE);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('exchangeToken', () => {
    it('should POST correct payload to /accounts/v2/gettoken', async () => {
      const scope = nock(PAYTM_BASE)
        .post('/accounts/v2/gettoken', {
          api_key: 'key1',
          api_secret_key: 'secret1',
          request_token: 'rt-abc',
        })
        .matchHeader('content-type', /application\/json/)
        .reply(200, SAMPLE_TOKEN_RESPONSE);

      const result = await client.exchangeToken('key1', 'secret1', 'rt-abc');

      expect(result.access_token).toBe('at-test-123');
      expect(result.public_access_token).toBe('pat-test-123');
      expect(result.read_access_token).toBe('rat-test-123');
      expect(scope.isDone()).toBe(true);
    });

    it('should return all 3 tokens on success', async () => {
      nock(PAYTM_BASE)
        .post('/accounts/v2/gettoken')
        .reply(200, SAMPLE_TOKEN_RESPONSE);

      const result = await client.exchangeToken('k', 's', 'rt');

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('public_access_token');
      expect(result).toHaveProperty('read_access_token');
    });

    it('should throw on 401 invalid token', async () => {
      nock(PAYTM_BASE)
        .post('/accounts/v2/gettoken')
        .reply(401, { message: 'Invalid request token' });

      await expect(client.exchangeToken('k', 's', 'bad')).rejects.toThrow();
    });

    it('should retry once on 5xx', async () => {
      nock(PAYTM_BASE)
        .post('/accounts/v2/gettoken')
        .reply(500, { message: 'Internal Server Error' });
      nock(PAYTM_BASE)
        .post('/accounts/v2/gettoken')
        .reply(200, SAMPLE_TOKEN_RESPONSE);

      const result = await client.exchangeToken('k', 's', 'rt');

      expect(result.access_token).toBe('at-test-123');
    });

    it('should throw after retry exhaustion', async () => {
      nock(PAYTM_BASE)
        .post('/accounts/v2/gettoken')
        .reply(502, { message: 'Bad Gateway' });
      nock(PAYTM_BASE)
        .post('/accounts/v2/gettoken')
        .reply(502, { message: 'Bad Gateway' });

      await expect(client.exchangeToken('k', 's', 'rt')).rejects.toThrow();
    });

    it('should handle network error', async () => {
      nock(PAYTM_BASE)
        .post('/accounts/v2/gettoken')
        .replyWithError('connect ECONNREFUSED 127.0.0.1:443');

      await expect(client.exchangeToken('k', 's', 'rt')).rejects.toThrow();
    });

    it('should handle timeout', async () => {
      nock(PAYTM_BASE)
        .post('/accounts/v2/gettoken')
        .delayConnection(15_000)
        .reply(200, SAMPLE_TOKEN_RESPONSE);

      await expect(client.exchangeToken('k', 's', 'rt')).rejects.toThrow();
    });
  });

  describe('getHoldings', () => {
    it('should GET with x-jwt-token header', async () => {
      const scope = nock(PAYTM_BASE)
        .get('/holdings/v1/get-user-holdings-data')
        .matchHeader('x-jwt-token', 'rat-xyz')
        .reply(200, { data: { results: SAMPLE_HOLDINGS } });

      const result = await client.getHoldings('rat-xyz');

      expect(result).toEqual(SAMPLE_HOLDINGS);
      expect(scope.isDone()).toBe(true);
    });

    it('should return parsed holdings array', async () => {
      nock(PAYTM_BASE)
        .get('/holdings/v1/get-user-holdings-data')
        .reply(200, { data: { results: SAMPLE_HOLDINGS } });

      const result = await client.getHoldings('rat');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('nse_symbol', 'RELIANCE');
    });

    it('should retry on 5xx', async () => {
      nock(PAYTM_BASE)
        .get('/holdings/v1/get-user-holdings-data')
        .reply(500, { message: 'Server Error' });
      nock(PAYTM_BASE)
        .get('/holdings/v1/get-user-holdings-data')
        .reply(200, { data: { results: SAMPLE_HOLDINGS } });

      const result = await client.getHoldings('rat');

      expect(result).toHaveLength(3);
    });

    it('should respect 429 Retry-After header', async () => {
      nock(PAYTM_BASE)
        .get('/holdings/v1/get-user-holdings-data')
        .reply(429, { message: 'Rate limited' }, { 'Retry-After': '1' });
      nock(PAYTM_BASE)
        .get('/holdings/v1/get-user-holdings-data')
        .reply(200, { data: { results: SAMPLE_HOLDINGS } });

      const result = await client.getHoldings('rat');

      expect(result).toHaveLength(3);
    });
  });

  describe('getPositions', () => {
    it('should GET /data/v1/position', async () => {
      const scope = nock(PAYTM_BASE)
        .get('/data/v1/position')
        .matchHeader('x-jwt-token', 'rat-pos')
        .reply(200, { data: SAMPLE_POSITIONS });

      const result = await client.getPositions('rat-pos');

      expect(scope.isDone()).toBe(true);
      expect(result).toEqual(SAMPLE_POSITIONS);
    });

    it('should return positions data', async () => {
      nock(PAYTM_BASE)
        .get('/data/v1/position')
        .reply(200, { data: SAMPLE_POSITIONS });

      const result = await client.getPositions('rat');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
    });
  });

  describe('getUserDetails', () => {
    it('should GET /accounts/v1/user/details', async () => {
      const scope = nock(PAYTM_BASE)
        .get('/accounts/v1/user/details')
        .matchHeader('x-jwt-token', 'rat-user')
        .reply(200, { data: SAMPLE_USER_DETAILS });

      const result = await client.getUserDetails('rat-user');

      expect(scope.isDone()).toBe(true);
      expect(result).toEqual(SAMPLE_USER_DETAILS);
    });

    it('should return user profile', async () => {
      nock(PAYTM_BASE)
        .get('/accounts/v1/user/details')
        .reply(200, { data: SAMPLE_USER_DETAILS });

      const result = await client.getUserDetails('rat');

      expect(result).toHaveProperty('name', 'Vivek');
      expect(result).toHaveProperty('email', 'v@example.com');
      expect(result).toHaveProperty('pan', 'ABCDE1234F');
    });
  });

  describe('getFundsSummary', () => {
    it('should GET /accounts/v1/funds/summary', async () => {
      const scope = nock(PAYTM_BASE)
        .get('/accounts/v1/funds/summary')
        .matchHeader('x-jwt-token', 'rat-funds')
        .reply(200, { data: SAMPLE_FUNDS });

      const result = await client.getFundsSummary('rat-funds');

      expect(scope.isDone()).toBe(true);
      expect(result).toEqual(SAMPLE_FUNDS);
    });

    it('should pass config type parameter', async () => {
      const scope = nock(PAYTM_BASE)
        .get('/accounts/v1/funds/summary')
        .query({ type: 'EQUITY' })
        .reply(200, { data: SAMPLE_FUNDS });

      const result = await client.getFundsSummary('rat', { type: 'EQUITY' });

      expect(scope.isDone()).toBe(true);
      expect(result).toEqual(SAMPLE_FUNDS);
    });
  });

  describe('getOrderBook', () => {
    it('should GET /orders/v1/user/orders', async () => {
      const scope = nock(PAYTM_BASE)
        .get('/orders/v1/user/orders')
        .matchHeader('x-jwt-token', 'rat-orders')
        .reply(200, { data: SAMPLE_ORDERS });

      const result = await client.getOrderBook('rat-orders');

      expect(scope.isDone()).toBe(true);
      expect(result).toEqual(SAMPLE_ORDERS);
    });

    it('should return orders array', async () => {
      nock(PAYTM_BASE)
        .get('/orders/v1/user/orders')
        .reply(200, { data: SAMPLE_ORDERS });

      const result = await client.getOrderBook('rat');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });
  });

  // =========================================================================
  // Phase 2 Client Methods
  // =========================================================================

  describe('placeOrder', () => {
    // SC-345: placeOrder sends POST with correct body and auth header
    it('should POST to /orders/v1/place/regular with correct body — SC-345', async () => {
      const scope = nock(PAYTM_BASE)
        .post('/orders/v1/place/regular', (body: Record<string, unknown>) =>
          body.txn_type === 'B' &&
          body.exchange === 'NSE' &&
          body.security_id === '14366' &&
          body.quantity === 10,
        )
        .matchHeader('x-jwt-token', 'at-write')
        .matchHeader('content-type', /application\/json/)
        .reply(200, SAMPLE_PLACE_ORDER_RESPONSE);

      const result = await client.placeOrder('at-write', VALID_PLACE_ORDER_INPUT);

      expect(result).toHaveProperty('order_no', '220509000001');
      expect(result).toHaveProperty('status', 'SUCCESS');
      expect(scope.isDone()).toBe(true);
    });

    it('should route cover order to /orders/v1/place/cover', async () => {
      const scope = nock(PAYTM_BASE)
        .post('/orders/v1/place/cover')
        .matchHeader('x-jwt-token', 'at-write')
        .reply(200, SAMPLE_PLACE_ORDER_RESPONSE);

      const coverInput = { ...VALID_PLACE_ORDER_INPUT, product: 'V', sl_price: 1480.00 };
      const result = await client.placeOrder('at-write', coverInput);

      expect(result).toHaveProperty('order_no');
      expect(scope.isDone()).toBe(true);
    });

    it('should route bracket order to /orders/v1/place/bracket', async () => {
      const scope = nock(PAYTM_BASE)
        .post('/orders/v1/place/bracket')
        .matchHeader('x-jwt-token', 'at-write')
        .reply(200, SAMPLE_PLACE_ORDER_RESPONSE);

      const bracketInput = { ...VALID_PLACE_ORDER_INPUT, product: 'B', sl_price: 1480.00, tp_price: 1550.00 };
      const result = await client.placeOrder('at-write', bracketInput);

      expect(result).toHaveProperty('order_no');
      expect(scope.isDone()).toBe(true);
    });

    it('should retry on 5xx', async () => {
      nock(PAYTM_BASE)
        .post('/orders/v1/place/regular')
        .reply(500, { message: 'Server Error' });
      nock(PAYTM_BASE)
        .post('/orders/v1/place/regular')
        .reply(200, SAMPLE_PLACE_ORDER_RESPONSE);

      const result = await client.placeOrder('at-write', VALID_PLACE_ORDER_INPUT);

      expect(result).toHaveProperty('order_no');
    });

    it('should handle 429 with Retry-After', async () => {
      nock(PAYTM_BASE)
        .post('/orders/v1/place/regular')
        .reply(429, { message: 'Rate limited' }, { 'Retry-After': '1' });
      nock(PAYTM_BASE)
        .post('/orders/v1/place/regular')
        .reply(200, SAMPLE_PLACE_ORDER_RESPONSE);

      const result = await client.placeOrder('at-write', VALID_PLACE_ORDER_INPUT);

      expect(result).toHaveProperty('order_no');
    });

    it('should throw on 4xx error', async () => {
      nock(PAYTM_BASE)
        .post('/orders/v1/place/regular')
        .reply(400, { message: 'Insufficient funds' });

      await expect(client.placeOrder('at-write', VALID_PLACE_ORDER_INPUT)).rejects.toThrow();
    });
  });

  describe('modifyOrder', () => {
    // SC-346: modifyOrder sends POST with correct body
    it('should POST to /orders/v1/modify/regular with correct body — SC-346', async () => {
      const scope = nock(PAYTM_BASE)
        .post('/orders/v1/modify/regular', (body: Record<string, unknown>) =>
          body.order_no === 'ORD-001' && body.serial_no === 1,
        )
        .matchHeader('x-jwt-token', 'at-write')
        .reply(200, SAMPLE_MODIFY_ORDER_RESPONSE);

      const result = await client.modifyOrder('at-write', VALID_MODIFY_ORDER_INPUT);

      expect(result).toHaveProperty('order_no', '220509000001');
      expect(result).toHaveProperty('status', 'SUCCESS');
      expect(scope.isDone()).toBe(true);
    });

    it('should route cover modify to /orders/v1/modify/cover', async () => {
      const scope = nock(PAYTM_BASE)
        .post('/orders/v1/modify/cover')
        .reply(200, SAMPLE_MODIFY_ORDER_RESPONSE);

      const result = await client.modifyOrder('at-write', { ...VALID_MODIFY_ORDER_INPUT, product: 'V' });

      expect(result).toHaveProperty('order_no');
      expect(scope.isDone()).toBe(true);
    });

    it('should route bracket modify to /orders/v1/modify/bracket', async () => {
      const scope = nock(PAYTM_BASE)
        .post('/orders/v1/modify/bracket')
        .reply(200, SAMPLE_MODIFY_ORDER_RESPONSE);

      const result = await client.modifyOrder('at-write', { ...VALID_MODIFY_ORDER_INPUT, product: 'B', group_id: 1 });

      expect(result).toHaveProperty('order_no');
      expect(scope.isDone()).toBe(true);
    });

    it('should retry on 5xx — SC-350', async () => {
      nock(PAYTM_BASE)
        .post('/orders/v1/modify/regular')
        .reply(500, { message: 'Server Error' });
      nock(PAYTM_BASE)
        .post('/orders/v1/modify/regular')
        .reply(200, SAMPLE_MODIFY_ORDER_RESPONSE);

      const result = await client.modifyOrder('at-write', VALID_MODIFY_ORDER_INPUT);

      expect(result).toHaveProperty('order_no');
    });
  });

  describe('cancelOrder', () => {
    // SC-347: cancelOrder sends POST with correct body
    it('should POST to /orders/v1/cancel/regular with correct body — SC-347', async () => {
      const scope = nock(PAYTM_BASE)
        .post('/orders/v1/cancel/regular', (body: Record<string, unknown>) =>
          body.order_no === 'ORD-001' && body.serial_no === 1 && body.product === 'C',
        )
        .matchHeader('x-jwt-token', 'at-write')
        .reply(200, SAMPLE_CANCEL_ORDER_RESPONSE);

      const result = await client.cancelOrder('at-write', VALID_CANCEL_ORDER_INPUT);

      expect(result).toHaveProperty('order_no', '220509000001');
      expect(result).toHaveProperty('status', 'SUCCESS');
      expect(scope.isDone()).toBe(true);
    });

    it('should route cover cancel to /orders/v1/cancel/cover', async () => {
      const scope = nock(PAYTM_BASE)
        .post('/orders/v1/cancel/cover')
        .reply(200, SAMPLE_CANCEL_ORDER_RESPONSE);

      const result = await client.cancelOrder('at-write', { ...VALID_CANCEL_ORDER_INPUT, product: 'V' });

      expect(result).toHaveProperty('order_no');
      expect(scope.isDone()).toBe(true);
    });

    it('should route bracket cancel to /orders/v1/cancel/bracket', async () => {
      const scope = nock(PAYTM_BASE)
        .post('/orders/v1/cancel/bracket')
        .reply(200, SAMPLE_CANCEL_ORDER_RESPONSE);

      const result = await client.cancelOrder('at-write', { ...VALID_CANCEL_ORDER_INPUT, product: 'B', group_id: 1 });

      expect(result).toHaveProperty('order_no');
      expect(scope.isDone()).toBe(true);
    });

    it('should retry on 5xx', async () => {
      nock(PAYTM_BASE)
        .post('/orders/v1/cancel/regular')
        .reply(500, { message: 'Server Error' });
      nock(PAYTM_BASE)
        .post('/orders/v1/cancel/regular')
        .reply(200, SAMPLE_CANCEL_ORDER_RESPONSE);

      const result = await client.cancelOrder('at-write', VALID_CANCEL_ORDER_INPUT);

      expect(result).toHaveProperty('order_no');
    });
  });

  describe('getLivePrice', () => {
    // SC-348: getLivePrice sends GET with correct params and public token
    it('should GET /data/v1/price/live with public token — SC-348', async () => {
      const scope = nock(PAYTM_BASE)
        .get('/data/v1/price/live')
        .matchHeader('x-jwt-token', 'pat-public')
        .reply(200, { data: SAMPLE_LIVE_PRICE_LTP });

      const pref = [{ exchange: 'NSE', mode: 'LTP', security_id: '14366' }];
      const result = await client.getLivePrice('pat-public', 'LTP', pref);

      expect(result).toHaveProperty('data');
      expect((result as any).data).toHaveLength(1);
      expect((result as any).data[0]).toHaveProperty('last_price', 1520.50);
      expect(scope.isDone()).toBe(true);
    });

    it('should return FULL mode data', async () => {
      const scope = nock(PAYTM_BASE)
        .get('/data/v1/price/live')
        .reply(200, { data: SAMPLE_LIVE_PRICE_FULL });

      const pref = [{ exchange: 'NSE', mode: 'FULL', security_id: '14366' }];
      const result = await client.getLivePrice('pat-public', 'FULL', pref);

      expect(result).toHaveProperty('data');
      expect((result as any).data[0]).toHaveProperty('volume');
      expect(scope.isDone()).toBe(true);
    });

    it('should retry on 5xx — SC-351', async () => {
      nock(PAYTM_BASE)
        .get('/data/v1/price/live')
        .reply(500, { message: 'Server Error' });
      nock(PAYTM_BASE)
        .get('/data/v1/price/live')
        .reply(200, { data: SAMPLE_LIVE_PRICE_LTP });

      const pref = [{ exchange: 'NSE', mode: 'LTP', security_id: '14366' }];
      const result = await client.getLivePrice('pat-public', 'LTP', pref);

      expect(result).toHaveProperty('data');
    });

    it('should handle 429 with Retry-After — SC-351', async () => {
      nock(PAYTM_BASE)
        .get('/data/v1/price/live')
        .reply(429, { message: 'Rate limited' }, { 'Retry-After': '1' });
      nock(PAYTM_BASE)
        .get('/data/v1/price/live')
        .reply(200, { data: SAMPLE_LIVE_PRICE_LTP });

      const pref = [{ exchange: 'NSE', mode: 'LTP', security_id: '14366' }];
      const result = await client.getLivePrice('pat-public', 'LTP', pref);

      expect(result).toHaveProperty('data');
    });
  });

  describe('searchInstruments', () => {
    // SC-349: getSecurityMaster / searchInstruments sends GET with public token
    it('should GET /data/v1/scrips/get-security-master with public token — SC-349', async () => {
      const scope = nock(PAYTM_BASE)
        .get('/data/v1/scrips/get-security-master')
        .matchHeader('x-jwt-token', 'pat-search')
        .reply(200, { data: SAMPLE_SEARCH_RESULTS });

      const result = await client.searchInstruments('pat-search', 'INFY');

      expect(result).toHaveProperty('data');
      expect((result as any).data).toHaveLength(2);
      expect((result as any).data[0]).toHaveProperty('symbol', 'INFY');
      expect(scope.isDone()).toBe(true);
    });

    it('should pass exchange filter as query param', async () => {
      const scope = nock(PAYTM_BASE)
        .get('/data/v1/scrips/get-security-master')
        .query((q) => q.exchange === 'NSE')
        .reply(200, { data: SAMPLE_SEARCH_RESULTS.filter((r) => r.exchange === 'NSE') });

      const result = await client.searchInstruments('pat-search', 'INFY', 'NSE');

      expect(result).toHaveProperty('data');
      expect(scope.isDone()).toBe(true);
    });

    it('should retry on 5xx', async () => {
      nock(PAYTM_BASE)
        .get('/data/v1/scrips/get-security-master')
        .reply(500, { message: 'Server Error' });
      nock(PAYTM_BASE)
        .get('/data/v1/scrips/get-security-master')
        .reply(200, { data: SAMPLE_SEARCH_RESULTS });

      const result = await client.searchInstruments('pat-search', 'INFY');

      expect(result).toHaveProperty('data');
    });
  });

  // =========================================================================
  // Phase 3 Client Methods
  // =========================================================================

  describe('createGtt', () => {
    // SC-520: createGtt sends POST to /orders/v1/gtt/create with access_token
    it('should POST to /orders/v1/gtt/create with access_token — SC-520', async () => {
      const scope = nock(PAYTM_BASE)
        .post('/orders/v1/gtt/create', (body: Record<string, unknown>) =>
          body.trigger_type === 'SINGLE' &&
          body.security_id === '14366' &&
          body.quantity === 10,
        )
        .matchHeader('x-jwt-token', 'at-write')
        .matchHeader('content-type', /application\/json/)
        .reply(200, SAMPLE_GTT_CREATE_RESPONSE);

      const result = await client.createGtt('at-write', VALID_CREATE_GTT_INPUT);

      expect(result).toHaveProperty('id', 12345);
      expect(result).toHaveProperty('status', 'NEW_ACTIVE');
      expect(scope.isDone()).toBe(true);
    });

    it('should retry on 5xx — SC-527a', async () => {
      nock(PAYTM_BASE)
        .post('/orders/v1/gtt/create')
        .reply(500, { message: 'Server Error' });
      nock(PAYTM_BASE)
        .post('/orders/v1/gtt/create')
        .reply(200, SAMPLE_GTT_CREATE_RESPONSE);

      const result = await client.createGtt('at-write', VALID_CREATE_GTT_INPUT);

      expect(result).toHaveProperty('id');
    });

    it('should handle 429 with Retry-After — SC-528a', async () => {
      nock(PAYTM_BASE)
        .post('/orders/v1/gtt/create')
        .reply(429, { message: 'Rate limited' }, { 'Retry-After': '1' });
      nock(PAYTM_BASE)
        .post('/orders/v1/gtt/create')
        .reply(200, SAMPLE_GTT_CREATE_RESPONSE);

      const result = await client.createGtt('at-write', VALID_CREATE_GTT_INPUT);

      expect(result).toHaveProperty('id');
    });

    it('should throw on 4xx error', async () => {
      nock(PAYTM_BASE)
        .post('/orders/v1/gtt/create')
        .reply(400, { message: 'Invalid security' });

      await expect(client.createGtt('at-write', VALID_CREATE_GTT_INPUT)).rejects.toThrow();
    });
  });

  describe('getGtt', () => {
    // SC-521: getGtt sends GET to /orders/v1/gtt/{id} with access_token
    it('should GET /orders/v1/gtt/1001 with access_token — SC-521', async () => {
      const scope = nock(PAYTM_BASE)
        .get('/orders/v1/gtt/1001')
        .matchHeader('x-jwt-token', 'at-read')
        .reply(200, SAMPLE_GTT_GET_RESPONSE);

      const result = await client.getGtt('at-read', 1001);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('status');
      expect(scope.isDone()).toBe(true);
    });

    it('should retry on 5xx — SC-527b', async () => {
      nock(PAYTM_BASE)
        .get('/orders/v1/gtt/1001')
        .reply(500, { message: 'Server Error' });
      nock(PAYTM_BASE)
        .get('/orders/v1/gtt/1001')
        .reply(200, SAMPLE_GTT_GET_RESPONSE);

      const result = await client.getGtt('at-read', 1001);

      expect(result).toHaveProperty('id');
    });

    it('should throw on 404', async () => {
      nock(PAYTM_BASE)
        .get('/orders/v1/gtt/999999')
        .reply(404, { message: 'GTT order not found' });

      await expect(client.getGtt('at-read', 999999)).rejects.toThrow();
    });
  });

  describe('updateGtt', () => {
    // SC-522: updateGtt sends PUT to /orders/v1/gtt/update with access_token
    it('should PUT to /orders/v1/gtt/update with access_token — SC-522', async () => {
      const scope = nock(PAYTM_BASE)
        .put('/orders/v1/gtt/update', (body: Record<string, unknown>) =>
          body.id === 12345 && body.set_price === 1350.00,
        )
        .matchHeader('x-jwt-token', 'at-write')
        .reply(200, SAMPLE_GTT_UPDATE_RESPONSE);

      const result = await client.updateGtt('at-write', VALID_UPDATE_GTT_INPUT);

      expect(result).toHaveProperty('id', 12345);
      expect(result).toHaveProperty('status', 'NEW_ACTIVE');
      expect(scope.isDone()).toBe(true);
    });

    it('should retry on 5xx — SC-527c', async () => {
      nock(PAYTM_BASE)
        .put('/orders/v1/gtt/update')
        .reply(500, { message: 'Server Error' });
      nock(PAYTM_BASE)
        .put('/orders/v1/gtt/update')
        .reply(200, SAMPLE_GTT_UPDATE_RESPONSE);

      const result = await client.updateGtt('at-write', VALID_UPDATE_GTT_INPUT);

      expect(result).toHaveProperty('id');
    });

    it('should throw on 404', async () => {
      nock(PAYTM_BASE)
        .put('/orders/v1/gtt/update')
        .reply(404, { message: 'GTT order not found' });

      await expect(client.updateGtt('at-write', VALID_UPDATE_GTT_INPUT)).rejects.toThrow();
    });
  });

  describe('deleteGtt', () => {
    // SC-523: deleteGtt sends DELETE to /orders/v1/gtt/{id} with access_token
    it('should DELETE /orders/v1/gtt/1001 with access_token — SC-523', async () => {
      const scope = nock(PAYTM_BASE)
        .delete('/orders/v1/gtt/1001')
        .matchHeader('x-jwt-token', 'at-write')
        .reply(200, SAMPLE_GTT_DELETE_RESPONSE);

      const result = await client.deleteGtt('at-write', 1001);

      expect(result).toHaveProperty('message', 'GTT order deleted successfully');
      expect(scope.isDone()).toBe(true);
    });

    it('should retry on 5xx — SC-527d', async () => {
      nock(PAYTM_BASE)
        .delete('/orders/v1/gtt/1001')
        .reply(500, { message: 'Server Error' });
      nock(PAYTM_BASE)
        .delete('/orders/v1/gtt/1001')
        .reply(200, SAMPLE_GTT_DELETE_RESPONSE);

      const result = await client.deleteGtt('at-write', 1001);

      expect(result).toHaveProperty('message');
    });

    it('should throw on 404', async () => {
      nock(PAYTM_BASE)
        .delete('/orders/v1/gtt/999999')
        .reply(404, { message: 'GTT order not found' });

      await expect(client.deleteGtt('at-write', 999999)).rejects.toThrow();
    });
  });

  describe('getGttAggregate', () => {
    // SC-524: getGttAggregate sends GET to /orders/v1/gtt/aggregate with access_token
    it('should GET /orders/v1/gtt/aggregate with access_token — SC-524', async () => {
      const scope = nock(PAYTM_BASE)
        .get('/orders/v1/gtt/aggregate')
        .matchHeader('x-jwt-token', 'at-read')
        .reply(200, SAMPLE_GTT_AGGREGATE_RESPONSE);

      const result = await client.getGttAggregate('at-read');

      expect(result).toHaveProperty('active', 3);
      expect(result).toHaveProperty('triggered', 1);
      expect(result).toHaveProperty('expired', 2);
      expect(result).toHaveProperty('total', 6);
      expect(scope.isDone()).toBe(true);
    });

    it('should retry on 5xx — SC-527e', async () => {
      nock(PAYTM_BASE)
        .get('/orders/v1/gtt/aggregate')
        .reply(500, { message: 'Server Error' });
      nock(PAYTM_BASE)
        .get('/orders/v1/gtt/aggregate')
        .reply(200, SAMPLE_GTT_AGGREGATE_RESPONSE);

      const result = await client.getGttAggregate('at-read');

      expect(result).toHaveProperty('active');
    });
  });

  describe('getOptionChain', () => {
    // SC-525: getOptionChain sends GET to /fno/v1/option-chain with public_access_token
    it('should GET /fno/v1/option-chain with public token — SC-525', async () => {
      const scope = nock(PAYTM_BASE)
        .get('/fno/v1/option-chain')
        .matchHeader('x-jwt-token', 'pat-public')
        .reply(200, SAMPLE_OPTION_CHAIN_RESPONSE);

      const result = await client.getOptionChain('pat-public', VALID_OPTION_CHAIN_INPUT);

      expect(result).toHaveProperty('data');
      expect((result as any).data).toHaveLength(2);
      expect((result as any).data[0]).toHaveProperty('strike_price', 24000);
      expect(scope.isDone()).toBe(true);
    });

    it('should retry on 5xx — SC-527f', async () => {
      nock(PAYTM_BASE)
        .get('/fno/v1/option-chain')
        .reply(500, { message: 'Server Error' });
      nock(PAYTM_BASE)
        .get('/fno/v1/option-chain')
        .reply(200, SAMPLE_OPTION_CHAIN_RESPONSE);

      const result = await client.getOptionChain('pat-public', VALID_OPTION_CHAIN_INPUT);

      expect(result).toHaveProperty('data');
    });

    it('should handle 429 with Retry-After — SC-528b', async () => {
      nock(PAYTM_BASE)
        .get('/fno/v1/option-chain')
        .reply(429, { message: 'Rate limited' }, { 'Retry-After': '1' });
      nock(PAYTM_BASE)
        .get('/fno/v1/option-chain')
        .reply(200, SAMPLE_OPTION_CHAIN_RESPONSE);

      const result = await client.getOptionChain('pat-public', VALID_OPTION_CHAIN_INPUT);

      expect(result).toHaveProperty('data');
    });
  });

  describe('getCharges', () => {
    // SC-526: getCharges sends POST to /charges/v1/charges-info with read_access_token
    it('should POST to /charges/v1/charges-info with read token — SC-526', async () => {
      const scope = nock(PAYTM_BASE)
        .post('/charges/v1/charges-info', (body: Record<string, unknown>) =>
          body.txn_type === 'B' && body.qty === 10 && body.price === 1500.00,
        )
        .matchHeader('x-jwt-token', 'rat-read')
        .matchHeader('content-type', /application\/json/)
        .reply(200, SAMPLE_CHARGES_RESPONSE);

      const result = await client.getCharges('rat-read', VALID_CHARGES_INPUT);

      expect(result).toHaveProperty('brokerage', 20.00);
      expect(result).toHaveProperty('total', 25.50);
      expect(scope.isDone()).toBe(true);
    });

    it('should retry on 5xx — SC-527g', async () => {
      nock(PAYTM_BASE)
        .post('/charges/v1/charges-info')
        .reply(500, { message: 'Server Error' });
      nock(PAYTM_BASE)
        .post('/charges/v1/charges-info')
        .reply(200, SAMPLE_CHARGES_RESPONSE);

      const result = await client.getCharges('rat-read', VALID_CHARGES_INPUT);

      expect(result).toHaveProperty('brokerage');
    });

    it('should handle 429 with Retry-After — SC-528c', async () => {
      nock(PAYTM_BASE)
        .post('/charges/v1/charges-info')
        .reply(429, { message: 'Rate limited' }, { 'Retry-After': '1' });
      nock(PAYTM_BASE)
        .post('/charges/v1/charges-info')
        .reply(200, SAMPLE_CHARGES_RESPONSE);

      const result = await client.getCharges('rat-read', VALID_CHARGES_INPUT);

      expect(result).toHaveProperty('brokerage');
    });

    it('should throw on 4xx error', async () => {
      nock(PAYTM_BASE)
        .post('/charges/v1/charges-info')
        .reply(400, { message: 'Bad request' });

      await expect(client.getCharges('rat-read', VALID_CHARGES_INPUT)).rejects.toThrow();
    });
  });
});
