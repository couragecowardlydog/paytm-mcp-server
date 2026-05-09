import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TokenManager } from '../../src/auth/token-manager.js';
import { PaytmClient } from '../../src/client/pm-client.js';
import { registerGttTools } from '../../src/tools/gtt.tools.js';
import {
  createAuthenticatedTokenManager,
  SAMPLE_GTT_CREATE_RESPONSE,
  SAMPLE_GTT_GET_RESPONSE,
  SAMPLE_GTT_UPDATE_RESPONSE,
  SAMPLE_GTT_DELETE_RESPONSE,
  SAMPLE_GTT_AGGREGATE_RESPONSE,
  VALID_CREATE_GTT_INPUT,
  VALID_UPDATE_GTT_INPUT,
} from '../helpers/test-utils.js';

const PAYTM_BASE = 'https://developer.paytmmoney.com';

describe('GTT Tools', () => {
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
  // paytm_create_gtt
  // =========================================================================
  describe('paytm_create_gtt', () => {
    describe('happy path', () => {
      // SC-410: Create SINGLE GTT limit buy order (happy path)
      it('should create SINGLE GTT limit buy order — SC-410', async () => {
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/gtt/create', (body: Record<string, unknown>) =>
            body.trigger_type === 'SINGLE' && body.transaction_type === 'B' && body.order_type === 'LMT' && body.price === 1400.00,
          )
          .matchHeader('x-jwt-token', 'test-access-token')
          .reply(200, SAMPLE_GTT_CREATE_RESPONSE);

        registerGttTools(server, tokenManager, client);

        const result = await client.createGtt('test-access-token', VALID_CREATE_GTT_INPUT);

        expect(result).toHaveProperty('id', 12345);
        expect(result).toHaveProperty('status', 'NEW_ACTIVE');
        expect(scope.isDone()).toBe(true);
      });

      // SC-411: Create SINGLE GTT market sell order
      it('should create SINGLE GTT market sell order — SC-411', async () => {
        const mktInput = {
          ...VALID_CREATE_GTT_INPUT,
          transaction_type: 'S',
          order_type: 'MKT',
          set_price: 1600.00,
          price: undefined,
        };
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/gtt/create', (body: Record<string, unknown>) =>
            body.transaction_type === 'S' && body.order_type === 'MKT',
          )
          .matchHeader('x-jwt-token', 'test-access-token')
          .reply(200, { id: 1002, status: 'NEW_ACTIVE' });

        registerGttTools(server, tokenManager, client);

        const result = await client.createGtt('test-access-token', mktInput);

        expect(result).toHaveProperty('id', 1002);
        expect(scope.isDone()).toBe(true);
      });

      // SC-412: Create TWO_LEG GTT order (happy path)
      it('should create TWO_LEG GTT order — SC-412', async () => {
        const twoLegInput = {
          ...VALID_CREATE_GTT_INPUT,
          exchange: 'BSE',
          security_id: '12345',
          trigger_type: 'TWO_LEG',
          secondary_set_price: 1600.00,
          secondary_transaction_type: 'S',
          secondary_order_type: 'LMT',
          secondary_quantity: 10,
          secondary_price: 1600.00,
        };
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/gtt/create', (body: Record<string, unknown>) =>
            body.trigger_type === 'TWO_LEG' &&
            body.secondary_set_price === 1600.00 &&
            body.secondary_transaction_type === 'S',
          )
          .matchHeader('x-jwt-token', 'test-access-token')
          .reply(200, { id: 1003, status: 'NEW_ACTIVE' });

        registerGttTools(server, tokenManager, client);

        const result = await client.createGtt('test-access-token', twoLegInput);

        expect(result).toHaveProperty('id', 1003);
        expect(result).toHaveProperty('status', 'NEW_ACTIVE');
        expect(scope.isDone()).toBe(true);
      });

      // SC-413: Create SINGLE GTT on BSE exchange
      it('should create SINGLE GTT on BSE exchange — SC-413', async () => {
        const bseInput = { ...VALID_CREATE_GTT_INPUT, exchange: 'BSE', security_id: '12345' };
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/gtt/create', (body: Record<string, unknown>) => body.exchange === 'BSE')
          .matchHeader('x-jwt-token', 'test-access-token')
          .reply(200, SAMPLE_GTT_CREATE_RESPONSE);

        registerGttTools(server, tokenManager, client);

        const result = await client.createGtt('test-access-token', bseInput);

        expect(result).toHaveProperty('id');
        expect(scope.isDone()).toBe(true);
      });
    });

    describe('auth & token', () => {
      // SC-414: Create GTT requires access_token
      it('should use access_token in x-jwt-token header — SC-414', async () => {
        const scope = nock(PAYTM_BASE)
          .post('/orders/v1/gtt/create')
          .matchHeader('x-jwt-token', 'test-access-token')
          .reply(200, SAMPLE_GTT_CREATE_RESPONSE);

        registerGttTools(server, tokenManager, client);

        const result = await client.createGtt('test-access-token', VALID_CREATE_GTT_INPUT);

        expect(result).toHaveProperty('id');
        expect(scope.isDone()).toBe(true);
      });

      // SC-415: Create GTT fails when not authenticated
      it('should fail when not authenticated — SC-415', async () => {
        const unauthTM = new TokenManager();
        registerGttTools(server, unauthTM, client);

        await expect(
          client.createGtt('', VALID_CREATE_GTT_INPUT),
        ).rejects.toThrow(/[Nn]ot authenticated/);
      });

      // SC-416: Create GTT fails when session expired
      it('should fail when session expired — SC-416', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-05-09T03:30:00.000Z'));
        const expTM = new TokenManager();
        expTM.setTokens({
          accessToken: 'at-exp',
          readAccessToken: 'rat-exp',
          publicAccessToken: 'pat-exp',
        });
        vi.setSystemTime(new Date('2025-05-09T10:30:00.000Z'));

        registerGttTools(server, expTM, client);

        await expect(
          client.createGtt('at-exp', VALID_CREATE_GTT_INPUT),
        ).rejects.toThrow(/expired/);
      });
    });

    describe('validation — required fields', () => {
      // SC-420: Missing segment rejected
      it('should reject missing segment — SC-420', async () => {
        registerGttTools(server, tokenManager, client);
        const { segment, ...noSegment } = VALID_CREATE_GTT_INPUT;

        await expect(
          client.createGtt('test-access-token', noSegment),
        ).rejects.toThrow(/segment|required/i);
      });

      // SC-421: Missing exchange rejected
      it('should reject missing exchange — SC-421', async () => {
        registerGttTools(server, tokenManager, client);
        const { exchange, ...noExchange } = VALID_CREATE_GTT_INPUT;

        await expect(
          client.createGtt('test-access-token', noExchange),
        ).rejects.toThrow(/exchange|required/i);
      });

      // SC-422: Missing security_id rejected
      it('should reject missing security_id — SC-422', async () => {
        registerGttTools(server, tokenManager, client);
        const { security_id, ...noSecurityId } = VALID_CREATE_GTT_INPUT;

        await expect(
          client.createGtt('test-access-token', noSecurityId),
        ).rejects.toThrow(/security_id|required/i);
      });

      // SC-423: Missing trigger_type rejected
      it('should reject missing trigger_type — SC-423', async () => {
        registerGttTools(server, tokenManager, client);
        const { trigger_type, ...noTriggerType } = VALID_CREATE_GTT_INPUT;

        await expect(
          client.createGtt('test-access-token', noTriggerType),
        ).rejects.toThrow(/trigger_type|required/i);
      });
    });

    describe('validation — invalid enum values', () => {
      // SC-424: Invalid exchange value
      it('should reject invalid exchange value — SC-424', async () => {
        registerGttTools(server, tokenManager, client);

        await expect(
          client.createGtt('test-access-token', { ...VALID_CREATE_GTT_INPUT, exchange: 'MCX' }),
        ).rejects.toThrow(/exchange|invalid|NSE|BSE/i);
      });

      // SC-425: Invalid transaction_type
      it('should reject invalid transaction_type — SC-425', async () => {
        registerGttTools(server, tokenManager, client);

        await expect(
          client.createGtt('test-access-token', { ...VALID_CREATE_GTT_INPUT, transaction_type: 'X' }),
        ).rejects.toThrow(/transaction_type|invalid|"B"|"S"/i);
      });

      // SC-426: Invalid order_type
      it('should reject invalid order_type — SC-426', async () => {
        registerGttTools(server, tokenManager, client);

        await expect(
          client.createGtt('test-access-token', { ...VALID_CREATE_GTT_INPUT, order_type: 'IOC' }),
        ).rejects.toThrow(/order_type|invalid/i);
      });

      // SC-427: Invalid trigger_type
      it('should reject invalid trigger_type — SC-427', async () => {
        registerGttTools(server, tokenManager, client);

        await expect(
          client.createGtt('test-access-token', { ...VALID_CREATE_GTT_INPUT, trigger_type: 'MULTI' }),
        ).rejects.toThrow(/trigger_type|invalid/i);
      });
    });

    describe('validation — boundary cases', () => {
      // SC-428: Quantity zero rejected
      it('should reject quantity zero — SC-428', async () => {
        registerGttTools(server, tokenManager, client);

        await expect(
          client.createGtt('test-access-token', { ...VALID_CREATE_GTT_INPUT, quantity: 0 }),
        ).rejects.toThrow(/quantity|must be.*> ?0|positive/i);
      });

      // SC-429: Negative quantity rejected
      it('should reject negative quantity — SC-429', async () => {
        registerGttTools(server, tokenManager, client);

        await expect(
          client.createGtt('test-access-token', { ...VALID_CREATE_GTT_INPUT, quantity: -5 }),
        ).rejects.toThrow(/quantity|must be.*> ?0|positive/i);
      });

      // SC-430: LMT order without price rejected
      it('should reject LMT order without price — SC-430', async () => {
        registerGttTools(server, tokenManager, client);
        const { price, ...noPriceInput } = VALID_CREATE_GTT_INPUT;

        await expect(
          client.createGtt('test-access-token', { ...noPriceInput, order_type: 'LMT' }),
        ).rejects.toThrow(/price.*required|LMT/i);
      });
    });

    describe('validation — TWO_LEG required fields', () => {
      const twoLegBase = {
        ...VALID_CREATE_GTT_INPUT,
        trigger_type: 'TWO_LEG',
      };

      // SC-431: TWO_LEG without secondary_set_price
      it('should reject TWO_LEG without secondary_set_price — SC-431', async () => {
        registerGttTools(server, tokenManager, client);

        await expect(
          client.createGtt('test-access-token', {
            ...twoLegBase,
            secondary_transaction_type: 'S',
            secondary_order_type: 'LMT',
            secondary_quantity: 10,
            secondary_price: 1600.00,
          }),
        ).rejects.toThrow(/secondary_set_price|secondary.*required|TWO_LEG/i);
      });

      // SC-432: TWO_LEG without secondary_transaction_type
      it('should reject TWO_LEG without secondary_transaction_type — SC-432', async () => {
        registerGttTools(server, tokenManager, client);

        await expect(
          client.createGtt('test-access-token', {
            ...twoLegBase,
            secondary_set_price: 1600.00,
            secondary_order_type: 'LMT',
            secondary_quantity: 10,
            secondary_price: 1600.00,
          }),
        ).rejects.toThrow(/secondary_transaction_type|secondary.*required|TWO_LEG/i);
      });

      // SC-433: TWO_LEG without secondary_quantity
      it('should reject TWO_LEG without secondary_quantity — SC-433', async () => {
        registerGttTools(server, tokenManager, client);

        await expect(
          client.createGtt('test-access-token', {
            ...twoLegBase,
            secondary_set_price: 1600.00,
            secondary_transaction_type: 'S',
            secondary_order_type: 'LMT',
            secondary_price: 1600.00,
          }),
        ).rejects.toThrow(/secondary_quantity|secondary.*required|TWO_LEG/i);
      });

      // SC-434: TWO_LEG LMT without secondary_price
      it('should reject TWO_LEG LMT without secondary_price — SC-434', async () => {
        registerGttTools(server, tokenManager, client);

        await expect(
          client.createGtt('test-access-token', {
            ...twoLegBase,
            secondary_set_price: 1600.00,
            secondary_transaction_type: 'S',
            secondary_order_type: 'LMT',
            secondary_quantity: 10,
          }),
        ).rejects.toThrow(/secondary_price.*required|LMT/i);
      });
    });

    describe('API errors', () => {
      // SC-435: API 400 error
      it('should handle API 400 — SC-435', async () => {
        nock(PAYTM_BASE)
          .post('/orders/v1/gtt/create')
          .reply(400, { message: 'Invalid security' });

        registerGttTools(server, tokenManager, client);

        await expect(
          client.createGtt('test-access-token', VALID_CREATE_GTT_INPUT),
        ).rejects.toThrow(/Invalid security|400/);
      });

      // SC-436: API 500 with retry
      it('should retry on 5xx and fail after exhaustion — SC-436', async () => {
        nock(PAYTM_BASE)
          .post('/orders/v1/gtt/create')
          .reply(500, { message: 'Internal Server Error' });
        nock(PAYTM_BASE)
          .post('/orders/v1/gtt/create')
          .reply(500, { message: 'Internal Server Error' });

        registerGttTools(server, tokenManager, client);

        await expect(
          client.createGtt('test-access-token', VALID_CREATE_GTT_INPUT),
        ).rejects.toThrow();
      });

      it('should retry on 5xx and succeed — SC-436b', async () => {
        nock(PAYTM_BASE)
          .post('/orders/v1/gtt/create')
          .reply(500, { message: 'Internal Server Error' });
        nock(PAYTM_BASE)
          .post('/orders/v1/gtt/create')
          .reply(200, SAMPLE_GTT_CREATE_RESPONSE);

        registerGttTools(server, tokenManager, client);

        const result = await client.createGtt('test-access-token', VALID_CREATE_GTT_INPUT);

        expect(result).toHaveProperty('id');
      });

      it('should handle 429 rate limit', async () => {
        nock(PAYTM_BASE)
          .post('/orders/v1/gtt/create')
          .reply(429, { message: 'Rate limited' }, { 'Retry-After': '1' });
        nock(PAYTM_BASE)
          .post('/orders/v1/gtt/create')
          .reply(200, SAMPLE_GTT_CREATE_RESPONSE);

        registerGttTools(server, tokenManager, client);

        const result = await client.createGtt('test-access-token', VALID_CREATE_GTT_INPUT);

        expect(result).toHaveProperty('id');
      });
    });
  });

  // =========================================================================
  // paytm_get_gtt
  // =========================================================================
  describe('paytm_get_gtt', () => {
    describe('happy path', () => {
      // SC-440: Get GTT order by ID
      it('should get GTT order by ID — SC-440', async () => {
        const scope = nock(PAYTM_BASE)
          .get('/orders/v1/gtt/12345')
          .matchHeader('x-jwt-token', 'test-access-token')
          .reply(200, SAMPLE_GTT_GET_RESPONSE);

        registerGttTools(server, tokenManager, client);

        const result = await client.getGtt('test-access-token', 12345);

        expect(result).toHaveProperty('id', 12345);
        expect(result).toHaveProperty('status', 'NEW_ACTIVE');
        expect(result).toHaveProperty('security_id', '14366');
        expect(result).toHaveProperty('set_price', 1400);
        expect(result).toHaveProperty('quantity', 10);
        expect(result).toHaveProperty('trigger_type', 'SINGLE');
        expect(scope.isDone()).toBe(true);
      });
    });

    describe('auth & token', () => {
      // SC-441: Get GTT requires access_token
      it('should use access_token in header — SC-441', async () => {
        const scope = nock(PAYTM_BASE)
          .get('/orders/v1/gtt/12345')
          .matchHeader('x-jwt-token', 'test-access-token')
          .reply(200, SAMPLE_GTT_GET_RESPONSE);

        registerGttTools(server, tokenManager, client);

        const result = await client.getGtt('test-access-token', 12345);

        expect(result).toHaveProperty('id');
        expect(scope.isDone()).toBe(true);
      });

      // SC-442: Get GTT fails when not authenticated
      it('should fail when not authenticated — SC-442', async () => {
        const unauthTM = new TokenManager();
        registerGttTools(server, unauthTM, client);

        await expect(
          client.getGtt('', 12345),
        ).rejects.toThrow(/[Nn]ot authenticated/);
      });

      // SC-443: Get GTT fails when session expired
      it('should fail when session expired — SC-443', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-05-09T03:30:00.000Z'));
        const expTM = new TokenManager();
        expTM.setTokens({
          accessToken: 'at-exp',
          readAccessToken: 'rat-exp',
          publicAccessToken: 'pat-exp',
        });
        vi.setSystemTime(new Date('2025-05-09T10:30:00.000Z'));

        registerGttTools(server, expTM, client);

        await expect(
          client.getGtt('at-exp', 12345),
        ).rejects.toThrow(/expired/);
      });
    });

    describe('validation & errors', () => {
      // SC-444: GTT not found (404)
      it('should handle GTT not found (404) — SC-444', async () => {
        nock(PAYTM_BASE)
          .get('/orders/v1/gtt/999999')
          .reply(404, { message: 'GTT order not found' });

        registerGttTools(server, tokenManager, client);

        await expect(
          client.getGtt('test-access-token', 999999),
        ).rejects.toThrow(/GTT order not found|404/);
      });

      // SC-445: Missing id
      it('should reject missing id — SC-445', async () => {
        registerGttTools(server, tokenManager, client);

        await expect(
          client.getGtt('test-access-token', undefined as unknown as number),
        ).rejects.toThrow(/id|required/i);
      });

      // SC-446: Invalid id type
      it('should reject invalid id type — SC-446', async () => {
        registerGttTools(server, tokenManager, client);

        await expect(
          client.getGtt('test-access-token', 'abc' as unknown as number),
        ).rejects.toThrow(/id|type|number/i);
      });
    });
  });

  // =========================================================================
  // paytm_update_gtt
  // =========================================================================
  describe('paytm_update_gtt', () => {
    describe('happy path', () => {
      // SC-450: Update GTT trigger price
      it('should update GTT trigger price — SC-450', async () => {
        const scope = nock(PAYTM_BASE)
          .put('/orders/v1/gtt/update', (body: Record<string, unknown>) =>
            body.id === 12345 && body.set_price === 1350.00,
          )
          .matchHeader('x-jwt-token', 'test-access-token')
          .reply(200, SAMPLE_GTT_UPDATE_RESPONSE);

        registerGttTools(server, tokenManager, client);

        const result = await client.updateGtt('test-access-token', VALID_UPDATE_GTT_INPUT);

        expect(result).toHaveProperty('id', 12345);
        expect(result).toHaveProperty('status', 'NEW_ACTIVE');
        expect(scope.isDone()).toBe(true);
      });

      // SC-451: Update GTT quantity
      it('should update GTT quantity — SC-451', async () => {
        const updateQtyInput = { ...VALID_UPDATE_GTT_INPUT, quantity: 20 };
        const scope = nock(PAYTM_BASE)
          .put('/orders/v1/gtt/update', (body: Record<string, unknown>) => body.quantity === 20)
          .reply(200, SAMPLE_GTT_UPDATE_RESPONSE);

        registerGttTools(server, tokenManager, client);

        const result = await client.updateGtt('test-access-token', updateQtyInput);

        expect(result).toHaveProperty('id');
        expect(scope.isDone()).toBe(true);
      });

      // SC-452: Update TWO_LEG GTT with secondary fields
      it('should update TWO_LEG GTT with secondary fields — SC-452', async () => {
        const twoLegUpdate = {
          ...VALID_UPDATE_GTT_INPUT,
          trigger_type: 'TWO_LEG',
          secondary_set_price: 1600.00,
          secondary_transaction_type: 'S',
          secondary_order_type: 'LMT',
          secondary_quantity: 10,
          secondary_price: 1600.00,
        };
        const scope = nock(PAYTM_BASE)
          .put('/orders/v1/gtt/update', (body: Record<string, unknown>) =>
            body.trigger_type === 'TWO_LEG' && body.secondary_set_price === 1600.00,
          )
          .reply(200, SAMPLE_GTT_UPDATE_RESPONSE);

        registerGttTools(server, tokenManager, client);

        const result = await client.updateGtt('test-access-token', twoLegUpdate);

        expect(result).toHaveProperty('id');
        expect(scope.isDone()).toBe(true);
      });
    });

    describe('auth & token', () => {
      // SC-453: Update GTT requires access_token
      it('should use access_token in header — SC-453', async () => {
        const scope = nock(PAYTM_BASE)
          .put('/orders/v1/gtt/update')
          .matchHeader('x-jwt-token', 'test-access-token')
          .reply(200, SAMPLE_GTT_UPDATE_RESPONSE);

        registerGttTools(server, tokenManager, client);

        const result = await client.updateGtt('test-access-token', VALID_UPDATE_GTT_INPUT);

        expect(result).toHaveProperty('id');
        expect(scope.isDone()).toBe(true);
      });

      // SC-454: Update GTT fails when not authenticated
      it('should fail when not authenticated — SC-454', async () => {
        const unauthTM = new TokenManager();
        registerGttTools(server, unauthTM, client);

        await expect(
          client.updateGtt('', VALID_UPDATE_GTT_INPUT),
        ).rejects.toThrow(/[Nn]ot authenticated/);
      });

      // SC-455: Update GTT fails when session expired
      it('should fail when session expired — SC-455', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-05-09T03:30:00.000Z'));
        const expTM = new TokenManager();
        expTM.setTokens({
          accessToken: 'at-exp',
          readAccessToken: 'rat-exp',
          publicAccessToken: 'pat-exp',
        });
        vi.setSystemTime(new Date('2025-05-09T10:30:00.000Z'));

        registerGttTools(server, expTM, client);

        await expect(
          client.updateGtt('at-exp', VALID_UPDATE_GTT_INPUT),
        ).rejects.toThrow(/expired/);
      });
    });

    describe('validation & errors', () => {
      // SC-456: Missing id
      it('should reject missing id — SC-456', async () => {
        registerGttTools(server, tokenManager, client);
        const { id, ...noId } = VALID_UPDATE_GTT_INPUT;

        await expect(
          client.updateGtt('test-access-token', noId),
        ).rejects.toThrow(/id|required/i);
      });

      // SC-457: Non-existent id (404)
      it('should handle non-existent GTT (404) — SC-457', async () => {
        nock(PAYTM_BASE)
          .put('/orders/v1/gtt/update')
          .reply(404, { message: 'GTT order not found' });

        registerGttTools(server, tokenManager, client);

        await expect(
          client.updateGtt('test-access-token', { ...VALID_UPDATE_GTT_INPUT, id: 999999 }),
        ).rejects.toThrow(/GTT order not found|404/);
      });

      // SC-458: Quantity <= 0
      it('should reject quantity zero — SC-458', async () => {
        registerGttTools(server, tokenManager, client);

        await expect(
          client.updateGtt('test-access-token', { ...VALID_UPDATE_GTT_INPUT, quantity: 0 }),
        ).rejects.toThrow(/quantity|must be.*> ?0|positive/i);
      });

      // SC-459: LMT without price
      it('should reject LMT without price — SC-459', async () => {
        registerGttTools(server, tokenManager, client);
        const { price, ...noPriceInput } = VALID_UPDATE_GTT_INPUT;

        await expect(
          client.updateGtt('test-access-token', { ...noPriceInput, order_type: 'LMT' }),
        ).rejects.toThrow(/price.*required|LMT/i);
      });

      // SC-460: API 500 with retry
      it('should retry on 5xx — SC-460', async () => {
        nock(PAYTM_BASE)
          .put('/orders/v1/gtt/update')
          .reply(500, { message: 'Internal Server Error' });
        nock(PAYTM_BASE)
          .put('/orders/v1/gtt/update')
          .reply(200, SAMPLE_GTT_UPDATE_RESPONSE);

        registerGttTools(server, tokenManager, client);

        const result = await client.updateGtt('test-access-token', VALID_UPDATE_GTT_INPUT);

        expect(result).toHaveProperty('id');
      });
    });
  });

  // =========================================================================
  // paytm_delete_gtt
  // =========================================================================
  describe('paytm_delete_gtt', () => {
    describe('happy path', () => {
      // SC-470: Delete GTT order
      it('should delete GTT order — SC-470', async () => {
        const scope = nock(PAYTM_BASE)
          .delete('/orders/v1/gtt/12345')
          .matchHeader('x-jwt-token', 'test-access-token')
          .reply(200, SAMPLE_GTT_DELETE_RESPONSE);

        registerGttTools(server, tokenManager, client);

        const result = await client.deleteGtt('test-access-token', 12345);

        expect(result).toHaveProperty('message', 'GTT order deleted successfully');
        expect(scope.isDone()).toBe(true);
      });
    });

    describe('auth & token', () => {
      // SC-471: Delete GTT requires access_token
      it('should use access_token in header — SC-471', async () => {
        const scope = nock(PAYTM_BASE)
          .delete('/orders/v1/gtt/12345')
          .matchHeader('x-jwt-token', 'test-access-token')
          .reply(200, SAMPLE_GTT_DELETE_RESPONSE);

        registerGttTools(server, tokenManager, client);

        const result = await client.deleteGtt('test-access-token', 12345);

        expect(result).toHaveProperty('message');
        expect(scope.isDone()).toBe(true);
      });

      // SC-472: Delete GTT fails when not authenticated
      it('should fail when not authenticated — SC-472', async () => {
        const unauthTM = new TokenManager();
        registerGttTools(server, unauthTM, client);

        await expect(
          client.deleteGtt('', 12345),
        ).rejects.toThrow(/[Nn]ot authenticated/);
      });

      // SC-473: Delete GTT fails when session expired
      it('should fail when session expired — SC-473', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-05-09T03:30:00.000Z'));
        const expTM = new TokenManager();
        expTM.setTokens({
          accessToken: 'at-exp',
          readAccessToken: 'rat-exp',
          publicAccessToken: 'pat-exp',
        });
        vi.setSystemTime(new Date('2025-05-09T10:30:00.000Z'));

        registerGttTools(server, expTM, client);

        await expect(
          client.deleteGtt('at-exp', 12345),
        ).rejects.toThrow(/expired/);
      });
    });

    describe('validation & errors', () => {
      // SC-474: GTT not found (404)
      it('should handle GTT not found (404) — SC-474', async () => {
        nock(PAYTM_BASE)
          .delete('/orders/v1/gtt/999999')
          .reply(404, { message: 'GTT order not found' });

        registerGttTools(server, tokenManager, client);

        await expect(
          client.deleteGtt('test-access-token', 999999),
        ).rejects.toThrow(/GTT order not found|404/);
      });

      // SC-475: Already-deleted GTT
      it('should handle already-deleted GTT — SC-475', async () => {
        nock(PAYTM_BASE)
          .delete('/orders/v1/gtt/12345')
          .reply(400, { message: 'GTT order already deleted' });

        registerGttTools(server, tokenManager, client);

        await expect(
          client.deleteGtt('test-access-token', 12345),
        ).rejects.toThrow(/GTT order already deleted|400/);
      });

      // SC-476: Missing id
      it('should reject missing id — SC-476', async () => {
        registerGttTools(server, tokenManager, client);

        await expect(
          client.deleteGtt('test-access-token', undefined as unknown as number),
        ).rejects.toThrow(/id|required/i);
      });

      // SC-477: API 500 with retry
      it('should retry on 5xx — SC-477', async () => {
        nock(PAYTM_BASE)
          .delete('/orders/v1/gtt/12345')
          .reply(500, { message: 'Internal Server Error' });
        nock(PAYTM_BASE)
          .delete('/orders/v1/gtt/12345')
          .reply(200, SAMPLE_GTT_DELETE_RESPONSE);

        registerGttTools(server, tokenManager, client);

        const result = await client.deleteGtt('test-access-token', 12345);

        expect(result).toHaveProperty('message');
      });
    });
  });

  // =========================================================================
  // paytm_get_gtt_aggregate
  // =========================================================================
  describe('paytm_get_gtt_aggregate', () => {
    describe('happy path', () => {
      // SC-480: Get GTT aggregate data
      it('should get GTT aggregate data — SC-480', async () => {
        const scope = nock(PAYTM_BASE)
          .get('/orders/v1/gtt/aggregate')
          .matchHeader('x-jwt-token', 'test-access-token')
          .reply(200, SAMPLE_GTT_AGGREGATE_RESPONSE);

        registerGttTools(server, tokenManager, client);

        const result = await client.getGttAggregate('test-access-token');

        expect(result).toHaveProperty('active', 3);
        expect(result).toHaveProperty('triggered', 1);
        expect(result).toHaveProperty('expired', 2);
        expect(result).toHaveProperty('total', 6);
        expect(scope.isDone()).toBe(true);
      });

      // SC-481: No GTTs exist
      it('should handle empty GTT aggregate — SC-481', async () => {
        const scope = nock(PAYTM_BASE)
          .get('/orders/v1/gtt/aggregate')
          .reply(200, { active: 0, triggered: 0, expired: 0, total: 0 });

        registerGttTools(server, tokenManager, client);

        const result = await client.getGttAggregate('test-access-token');

        expect(result).toHaveProperty('active', 0);
        expect(result).toHaveProperty('triggered', 0);
        expect(result).toHaveProperty('expired', 0);
        expect(result).toHaveProperty('total', 0);
        expect(scope.isDone()).toBe(true);
      });
    });

    describe('auth & token', () => {
      // SC-482: Get GTT aggregate requires access_token
      it('should use access_token in header — SC-482', async () => {
        const scope = nock(PAYTM_BASE)
          .get('/orders/v1/gtt/aggregate')
          .matchHeader('x-jwt-token', 'test-access-token')
          .reply(200, SAMPLE_GTT_AGGREGATE_RESPONSE);

        registerGttTools(server, tokenManager, client);

        const result = await client.getGttAggregate('test-access-token');

        expect(result).toHaveProperty('active');
        expect(scope.isDone()).toBe(true);
      });

      // SC-483: Get GTT aggregate fails when not authenticated
      it('should fail when not authenticated — SC-483', async () => {
        const unauthTM = new TokenManager();
        registerGttTools(server, unauthTM, client);

        await expect(
          client.getGttAggregate(''),
        ).rejects.toThrow(/[Nn]ot authenticated/);
      });

      // SC-484: Get GTT aggregate fails when session expired
      it('should fail when session expired — SC-484', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-05-09T03:30:00.000Z'));
        const expTM = new TokenManager();
        expTM.setTokens({
          accessToken: 'at-exp',
          readAccessToken: 'rat-exp',
          publicAccessToken: 'pat-exp',
        });
        vi.setSystemTime(new Date('2025-05-09T10:30:00.000Z'));

        registerGttTools(server, expTM, client);

        await expect(
          client.getGttAggregate('at-exp'),
        ).rejects.toThrow(/expired/);
      });
    });
  });
});
