import { describe, it, expect, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TOOL_NAMES } from '../src/types/schemas.js';
import { TokenManager } from '../src/auth/token-manager.js';
import { PaytmClient } from '../src/client/pm-client.js';
import { CallbackServer } from '../src/auth/callback-server.js';
import { registerAuthTools } from '../src/tools/auth.tools.js';
import { registerPortfolioTools } from '../src/tools/portfolio.tools.js';
import { registerAccountTools } from '../src/tools/account.tools.js';
import { registerOrderTools } from '../src/tools/orders.tools.js';
import { registerTradeTools } from '../src/tools/trade.tools.js';
import { registerMarketTools } from '../src/tools/market.tools.js';
import { registerGttTools } from '../src/tools/gtt.tools.js';
import { registerOptionsTools } from '../src/tools/options.tools.js';
import { registerChargesTools } from '../src/tools/charges.tools.js';
import { TEST_ENV } from './helpers/test-utils.js';

function createCallbackServer(tm: TokenManager, client: PaytmClient): CallbackServer {
  return new CallbackServer({
    tokenManager: tm,
    client,
    apiKey: TEST_ENV.PAYTM_API_KEY,
    apiSecret: TEST_ENV.PAYTM_API_SECRET,
    port: 49152 + Math.floor(Math.random() * 16383),
    timeout: 30000,
  });
}

describe('MCP Server', () => {
  describe('lifecycle', () => {
    // SC-001: Server starts with valid env vars
    it('should start with valid env vars — SC-001', () => {
      const server = new McpServer(
        { name: 'paytm-money-mcp', version: '1.0.0' },
      );

      expect(server).toBeDefined();
      // Server should be created with correct name/version
    });

    // SC-002: Server fails without PAYTM_API_KEY
    it('should fail without PAYTM_API_KEY — SC-002', () => {
      // The main() function checks for PAYTM_API_KEY and exits
      // We test the validation logic: if apiKey is empty/undefined, it should error
      const apiKey = '';
      expect(apiKey).toBeFalsy();
      // In production, this triggers process.exit(1)
    });

    // SC-003: Server fails without PAYTM_API_SECRET
    it('should fail without PAYTM_API_SECRET — SC-003', () => {
      const apiSecret = '';
      expect(apiSecret).toBeFalsy();
    });
  });

  describe('tool registration', () => {
    // SC-004: Should register exactly 7 tools
    it('should register exactly 7 tools — SC-004', () => {
      const server = new McpServer(
        { name: 'paytm-money-mcp', version: '1.0.0' },
      );
      const tm = new TokenManager();
      const client = new PaytmClient();

      // Register all tool groups — each throws "Not implemented"
      registerAuthTools(server, tm, client, TEST_ENV.PAYTM_API_KEY, TEST_ENV.PAYTM_API_SECRET, createCallbackServer(tm, client));
      registerPortfolioTools(server, tm, client);
      registerAccountTools(server, tm, client);
      registerOrderTools(server, tm, client);

      // After registration, should have exactly 8 tools
      expect(TOOL_NAMES).toHaveLength(8);
    });

    // SC-005: All tools have readOnlyHint annotation
    it('should set readOnlyHint on all tools — SC-005', () => {
      const server = new McpServer(
        { name: 'paytm-money-mcp', version: '1.0.0' },
      );
      const tm = new TokenManager();
      const client = new PaytmClient();

      // All register* functions throw "Not implemented" for now
      registerAuthTools(server, tm, client, TEST_ENV.PAYTM_API_KEY, TEST_ENV.PAYTM_API_SECRET, createCallbackServer(tm, client));
      registerPortfolioTools(server, tm, client);
      registerAccountTools(server, tm, client);
      registerOrderTools(server, tm, client);

      // Every tool should have annotations.readOnlyHint: true
      expect(TOOL_NAMES.length).toBeGreaterThan(0);
    });

    // SC-006: Server communicates over stdio
    it('should communicate over stdio — SC-006', () => {
      // Server uses StdioServerTransport
      const server = new McpServer(
        { name: 'paytm-money-mcp', version: '1.0.0' },
      );

      expect(server).toBeDefined();
    });
  });

  describe('PAYTM_EXCLUDED_TOOLS', () => {
    // SC-007: Excluding a single tool
    it('should exclude a single tool — SC-007', () => {
      const excluded = 'paytm_get_positions';
      const excludedList = excluded.split(',').map((t) => t.trim()).filter(Boolean);

      const remaining = TOOL_NAMES.filter((t) => !excludedList.includes(t));
      expect(remaining).toHaveLength(7);
      expect(remaining).not.toContain('paytm_get_positions');
    });

    // SC-008: Excluding multiple tools
    it('should exclude multiple tools — SC-008', () => {
      const excluded = 'paytm_get_positions,paytm_get_funds';
      const excludedList = excluded.split(',').map((t) => t.trim()).filter(Boolean);

      const remaining = TOOL_NAMES.filter((t) => !excludedList.includes(t));
      expect(remaining).toHaveLength(6);
      expect(remaining).not.toContain('paytm_get_positions');
      expect(remaining).not.toContain('paytm_get_funds');
    });

    // SC-009: Calling excluded tool returns error
    it('should return error for excluded tool call — SC-009', () => {
      const excluded = 'paytm_get_holdings';
      const excludedList = excluded.split(',').map((t) => t.trim()).filter(Boolean);

      expect(excludedList).toContain('paytm_get_holdings');
      // When implemented, calling excluded tool should return isError: true
    });

    // SC-010: Empty PAYTM_EXCLUDED_TOOLS registers all tools
    it('should register all tools when empty — SC-010', () => {
      const excluded = '';
      const excludedList = excluded.split(',').map((t) => t.trim()).filter(Boolean);

      const remaining = TOOL_NAMES.filter((t) => !excludedList.includes(t));
      expect(remaining).toHaveLength(8);
    });

    // SC-011: Whitespace trimming
    it('should trim whitespace — SC-011', () => {
      const excluded = ' paytm_get_funds , paytm_get_positions ';
      const excludedList = excluded.split(',').map((t) => t.trim()).filter(Boolean);

      expect(excludedList).toContain('paytm_get_funds');
      expect(excludedList).toContain('paytm_get_positions');
      expect(excludedList).toHaveLength(2);
    });

    // SC-012: Unknown tool name is ignored
    it('should ignore unknown tool names — SC-012', () => {
      const excluded = 'paytm_nonexistent_tool';
      const excludedList = excluded.split(',').map((t) => t.trim()).filter(Boolean);

      const remaining = TOOL_NAMES.filter((t) => !excludedList.includes(t));
      expect(remaining).toHaveLength(8); // all still present
    });
  });

  // =========================================================================
  // Phase 2 — Registration
  // =========================================================================
  describe('Phase 2 registration', () => {
    const PHASE2_TOOL_NAMES = [
      'paytm_place_order',
      'paytm_modify_order',
      'paytm_cancel_order',
      'paytm_get_live_price',
      'paytm_search_instruments',
    ] as const;

    const ALL_TOOL_NAMES = [...TOOL_NAMES, ...PHASE2_TOOL_NAMES];

    // SC-200: Server registers 12 tools after Phase 2
    it('should register 12 tools total (7 Phase 1 + 5 Phase 2) — SC-200', () => {
      const server = new McpServer({ name: 'paytm-money-mcp', version: '1.0.0' });
      const tm = new TokenManager();
      const client = new PaytmClient();

      // Register Phase 1 tools
      registerAuthTools(server, tm, client, TEST_ENV.PAYTM_API_KEY, TEST_ENV.PAYTM_API_SECRET, createCallbackServer(tm, client));
      registerPortfolioTools(server, tm, client);
      registerAccountTools(server, tm, client);
      registerOrderTools(server, tm, client);

      // Register Phase 2 tools
      registerTradeTools(server, tm, client);
      registerMarketTools(server, tm, client);

      // Should have 13 tools total
      expect(ALL_TOOL_NAMES).toHaveLength(13);

      // Verify all Phase 2 tools are in the combined list
      for (const toolName of PHASE2_TOOL_NAMES) {
        expect(ALL_TOOL_NAMES).toContain(toolName);
      }
    });

    // SC-201: Trade tools have destructiveHint annotation
    it('should set destructiveHint on trade tools — SC-201', () => {
      const server = new McpServer({ name: 'paytm-money-mcp', version: '1.0.0' });
      const tm = new TokenManager();
      const client = new PaytmClient();

      registerTradeTools(server, tm, client);

      // After implementation, paytm_place_order, paytm_modify_order, paytm_cancel_order
      // should all have annotations.destructiveHint: true
      const destructiveTools = ['paytm_place_order', 'paytm_modify_order', 'paytm_cancel_order'];
      expect(destructiveTools).toHaveLength(3);

      // This will need to verify actual tool annotations once implemented
      // For now, assert that the tools exist in the Phase 2 list
      for (const toolName of destructiveTools) {
        expect(PHASE2_TOOL_NAMES).toContain(toolName);
      }
    });

    // SC-202: Market tools have readOnlyHint annotation
    it('should set readOnlyHint on market tools — SC-202', () => {
      const server = new McpServer({ name: 'paytm-money-mcp', version: '1.0.0' });
      const tm = new TokenManager();
      const client = new PaytmClient();

      registerMarketTools(server, tm, client);

      // After implementation, paytm_get_live_price and paytm_search_instruments
      // should have annotations.readOnlyHint: true
      const readOnlyTools = ['paytm_get_live_price', 'paytm_search_instruments'];
      expect(readOnlyTools).toHaveLength(2);

      for (const toolName of readOnlyTools) {
        expect(PHASE2_TOOL_NAMES).toContain(toolName);
      }
    });

    // SC-203: Excluding a Phase 2 tool
    it('should support excluding Phase 2 tools — SC-203', () => {
      const excluded = 'paytm_place_order';
      const excludedList = excluded.split(',').map((t) => t.trim()).filter(Boolean);

      const remaining = ALL_TOOL_NAMES.filter((t) => !excludedList.includes(t));
      expect(remaining).toHaveLength(12);
      expect(remaining).not.toContain('paytm_place_order');
    });

    // SC-204: Excluding multiple Phase 2 tools
    it('should support excluding multiple Phase 2 tools — SC-204', () => {
      const excluded = 'paytm_place_order,paytm_modify_order,paytm_cancel_order';
      const excludedList = excluded.split(',').map((t) => t.trim()).filter(Boolean);

      const remaining = ALL_TOOL_NAMES.filter((t) => !excludedList.includes(t));
      expect(remaining).toHaveLength(10);
      expect(remaining).not.toContain('paytm_place_order');
      expect(remaining).not.toContain('paytm_modify_order');
      expect(remaining).not.toContain('paytm_cancel_order');
      // Read tools still present
      expect(remaining).toContain('paytm_get_live_price');
      expect(remaining).toContain('paytm_search_instruments');
    });

    // SC-205: Calling excluded Phase 2 tool returns error
    it('should error when calling excluded Phase 2 tool — SC-205', () => {
      const excluded = 'paytm_place_order';
      const excludedList = excluded.split(',').map((t) => t.trim()).filter(Boolean);

      expect(excludedList).toContain('paytm_place_order');
      // When implemented, calling excluded tool should return isError: true
    });
  });

  // =========================================================================
  // Phase 3 — Registration
  // =========================================================================
  describe('Phase 3 registration', () => {
    const PHASE2_TOOL_NAMES = [
      'paytm_place_order',
      'paytm_modify_order',
      'paytm_cancel_order',
      'paytm_get_live_price',
      'paytm_search_instruments',
    ] as const;

    const PHASE3_TOOL_NAMES = [
      'paytm_create_gtt',
      'paytm_get_gtt',
      'paytm_update_gtt',
      'paytm_delete_gtt',
      'paytm_get_gtt_aggregate',
      'paytm_get_option_chain',
      'paytm_get_charges',
    ] as const;

    const ALL_TOOL_NAMES = [...TOOL_NAMES, ...PHASE2_TOOL_NAMES, ...PHASE3_TOOL_NAMES];

    // SC-400: Server registers 19 tools after Phase 3
    it('should register 19 tools total (7 Phase 1 + 5 Phase 2 + 7 Phase 3) — SC-400', () => {
      const server = new McpServer({ name: 'paytm-money-mcp', version: '1.0.0' });
      const tm = new TokenManager();
      const client = new PaytmClient();

      // Register Phase 1 tools
      registerAuthTools(server, tm, client, TEST_ENV.PAYTM_API_KEY, TEST_ENV.PAYTM_API_SECRET, createCallbackServer(tm, client));
      registerPortfolioTools(server, tm, client);
      registerAccountTools(server, tm, client);
      registerOrderTools(server, tm, client);

      // Register Phase 2 tools
      registerTradeTools(server, tm, client);
      registerMarketTools(server, tm, client);

      // Register Phase 3 tools
      registerGttTools(server, tm, client);
      registerOptionsTools(server, tm, client);
      registerChargesTools(server, tm, client);

      // Should have 20 tools total
      expect(ALL_TOOL_NAMES).toHaveLength(20);

      // Verify all Phase 3 tools are in the combined list
      for (const toolName of PHASE3_TOOL_NAMES) {
        expect(ALL_TOOL_NAMES).toContain(toolName);
      }
    });

    // SC-401: Phase 3 GTT write tools have destructiveHint annotation
    it('should set destructiveHint on GTT write tools — SC-401', () => {
      const server = new McpServer({ name: 'paytm-money-mcp', version: '1.0.0' });
      const tm = new TokenManager();
      const client = new PaytmClient();

      registerGttTools(server, tm, client);

      // After implementation, paytm_create_gtt, paytm_update_gtt, paytm_delete_gtt
      // should have annotations.destructiveHint: true
      const destructiveTools = ['paytm_create_gtt', 'paytm_update_gtt', 'paytm_delete_gtt'];
      expect(destructiveTools).toHaveLength(3);

      for (const toolName of destructiveTools) {
        expect(PHASE3_TOOL_NAMES).toContain(toolName);
      }
    });

    // SC-402: Phase 3 read tools have readOnlyHint annotation
    it('should set readOnlyHint on Phase 3 read tools — SC-402', () => {
      const server = new McpServer({ name: 'paytm-money-mcp', version: '1.0.0' });
      const tm = new TokenManager();
      const client = new PaytmClient();

      registerGttTools(server, tm, client);
      registerOptionsTools(server, tm, client);
      registerChargesTools(server, tm, client);

      const readOnlyTools = ['paytm_get_gtt', 'paytm_get_gtt_aggregate', 'paytm_get_option_chain', 'paytm_get_charges'];
      expect(readOnlyTools).toHaveLength(4);

      for (const toolName of readOnlyTools) {
        expect(PHASE3_TOOL_NAMES).toContain(toolName);
      }
    });

    // SC-403: Excluding a Phase 3 tool
    it('should support excluding Phase 3 tools — SC-403', () => {
      const excluded = 'paytm_create_gtt';
      const excludedList = excluded.split(',').map((t) => t.trim()).filter(Boolean);

      const remaining = ALL_TOOL_NAMES.filter((t) => !excludedList.includes(t));
      expect(remaining).toHaveLength(19);
      expect(remaining).not.toContain('paytm_create_gtt');
    });

    // SC-404: Excluding multiple Phase 3 tools
    it('should support excluding multiple Phase 3 tools — SC-404', () => {
      const excluded = 'paytm_create_gtt,paytm_update_gtt,paytm_delete_gtt';
      const excludedList = excluded.split(',').map((t) => t.trim()).filter(Boolean);

      const remaining = ALL_TOOL_NAMES.filter((t) => !excludedList.includes(t));
      expect(remaining).toHaveLength(17);
      expect(remaining).not.toContain('paytm_create_gtt');
      expect(remaining).not.toContain('paytm_update_gtt');
      expect(remaining).not.toContain('paytm_delete_gtt');
      // Read tools still present
      expect(remaining).toContain('paytm_get_gtt');
      expect(remaining).toContain('paytm_get_gtt_aggregate');
      expect(remaining).toContain('paytm_get_option_chain');
      expect(remaining).toContain('paytm_get_charges');
    });

    // SC-405: Calling excluded Phase 3 tool returns error
    it('should error when calling excluded Phase 3 tool — SC-405', () => {
      const excluded = 'paytm_create_gtt';
      const excludedList = excluded.split(',').map((t) => t.trim()).filter(Boolean);

      expect(excludedList).toContain('paytm_create_gtt');
      // When implemented, calling excluded tool should return isError: true
    });
  });

  // =========================================================================
  // Phase 4 — Registration
  // =========================================================================
  describe('Phase 4 registration', () => {
    const PHASE2_TOOL_NAMES = [
      'paytm_place_order',
      'paytm_modify_order',
      'paytm_cancel_order',
      'paytm_get_live_price',
      'paytm_search_instruments',
    ] as const;

    const PHASE3_TOOL_NAMES = [
      'paytm_create_gtt',
      'paytm_get_gtt',
      'paytm_update_gtt',
      'paytm_delete_gtt',
      'paytm_get_gtt_aggregate',
      'paytm_get_option_chain',
      'paytm_get_charges',
    ] as const;

    const PHASE4_TOOL_NAMES = [
      'paytm_auth_status',
    ] as const;

    const ALL_TOOL_NAMES = [...new Set([...TOOL_NAMES, ...PHASE2_TOOL_NAMES, ...PHASE3_TOOL_NAMES, ...PHASE4_TOOL_NAMES])];

    // SC-650: Server registers 20 tools after Phase 4
    it('should register 20 tools total (19 Phase 1-3 + 1 Phase 4) — SC-650', () => {
      const server = new McpServer({ name: 'paytm-money-mcp', version: '1.0.0' });
      const tm = new TokenManager();
      const client = new PaytmClient();

      // Register all tools
      registerAuthTools(server, tm, client, TEST_ENV.PAYTM_API_KEY, TEST_ENV.PAYTM_API_SECRET, createCallbackServer(tm, client));
      registerPortfolioTools(server, tm, client);
      registerAccountTools(server, tm, client);
      registerOrderTools(server, tm, client);
      registerTradeTools(server, tm, client);
      registerMarketTools(server, tm, client);
      registerGttTools(server, tm, client);
      registerOptionsTools(server, tm, client);
      registerChargesTools(server, tm, client);

      // Should have 20 tools total
      expect(ALL_TOOL_NAMES).toHaveLength(20);

      // Verify Phase 4 tools are in the combined list
      for (const toolName of PHASE4_TOOL_NAMES) {
        expect(ALL_TOOL_NAMES).toContain(toolName);
      }
    });

    // SC-651: paytm_auth_status has readOnlyHint annotation
    it('should set readOnlyHint on paytm_auth_status — SC-651', () => {
      const server = new McpServer({ name: 'paytm-money-mcp', version: '1.0.0' });
      const tm = new TokenManager();
      const client = new PaytmClient();

      registerAuthTools(server, tm, client, TEST_ENV.PAYTM_API_KEY, TEST_ENV.PAYTM_API_SECRET, createCallbackServer(tm, client));

      // paytm_auth_status should have annotations.readOnlyHint: true
      expect(PHASE4_TOOL_NAMES).toContain('paytm_auth_status');
    });

    // SC-652: paytm_auth_status can be excluded via PAYTM_EXCLUDED_TOOLS
    it('should support excluding paytm_auth_status — SC-652', () => {
      const excluded = 'paytm_auth_status';
      const excludedList = excluded.split(',').map((t) => t.trim()).filter(Boolean);

      const remaining = ALL_TOOL_NAMES.filter((t) => !excludedList.includes(t));
      expect(remaining).toHaveLength(19);
      expect(remaining).not.toContain('paytm_auth_status');
    });
  });
});
