/**
 * Shared test utilities for Paytm Money MCP Server tests.
 */

import { TokenManager } from '../../src/auth/token-manager.js';
import { PaytmClient } from '../../src/client/pm-client.js';

/**
 * Create a TokenManager pre-loaded with test tokens.
 */
export function createAuthenticatedTokenManager(): TokenManager {
  const tm = new TokenManager();
  tm.setTokens({
    accessToken: 'test-access-token',
    publicAccessToken: 'test-public-access-token',
    readAccessToken: 'test-read-access-token',
  });
  return tm;
}

/**
 * Create a PaytmClient pointed at a test base URL.
 */
export function createTestClient(baseURL: string): PaytmClient {
  return new PaytmClient(baseURL);
}

/**
 * Test environment variables.
 */
export const TEST_ENV = {
  PAYTM_API_KEY: 'test-api-key',
  PAYTM_API_SECRET: 'test-api-secret',
} as const;

// --- Sample Response Fixtures ---

export const SAMPLE_TOKEN_RESPONSE = {
  access_token: 'at-test-123',
  public_access_token: 'pat-test-123',
  read_access_token: 'rat-test-123',
};

export const SAMPLE_HOLDINGS = [
  {
    nse_symbol: 'RELIANCE',
    bse_symbol: 'RELIANCE',
    display_name: 'Reliance Industries',
    quantity: '10',
    cost_price: '2400.00',
    last_traded_price: '2550.50',
    sector: 'Energy',
    mcap_type: 'Large',
    isin_code: 'INE002A01018',
    exchange: 'NSE',
  },
  {
    nse_symbol: 'TCS',
    bse_symbol: 'TCS',
    display_name: 'Tata Consultancy Services',
    quantity: '5',
    cost_price: '3200.00',
    last_traded_price: '3450.00',
    sector: 'IT',
    mcap_type: 'Large',
    isin_code: 'INE467B01029',
    exchange: 'NSE',
  },
  {
    nse_symbol: 'HDFCBANK',
    bse_symbol: 'HDFCBANK',
    display_name: 'HDFC Bank',
    quantity: '20',
    cost_price: '1600.00',
    last_traded_price: '1580.00',
    sector: 'Banking',
    mcap_type: 'Large',
    isin_code: 'INE040A01034',
    exchange: 'NSE',
  },
];

export const SAMPLE_POSITIONS = [
  {
    symbol: 'INFY',
    exchange: 'NSE',
    quantity: 15,
    buy_avg: 1500.0,
    ltp: 1520.0,
    pnl: 300.0,
  },
];

export const SAMPLE_USER_DETAILS = {
  name: 'Vivek',
  email: 'v@example.com',
  pan: 'ABCDE1234F',
  broker: 'PAYTM',
};

export const SAMPLE_FUNDS = {
  available_balance: 100000.0,
  utilized_amount: 50000.0,
  collateral: 0,
  total: 150000.0,
};

export const SAMPLE_ORDERS = [
  {
    order_no: 'ORD001',
    symbol: 'RELIANCE',
    exchange: 'NSE',
    order_type: 'LIMIT',
    transaction_type: 'BUY',
    quantity: 10,
    price: 2400.0,
    status: 'COMPLETE',
  },
  {
    order_no: 'ORD002',
    symbol: 'TCS',
    exchange: 'NSE',
    order_type: 'MARKET',
    transaction_type: 'SELL',
    quantity: 5,
    price: 3450.0,
    status: 'PENDING',
  },
];

// --- Phase 2 Fixtures ---

export const SAMPLE_PLACE_ORDER_RESPONSE = {
  order_no: '220509000001',
  status: 'SUCCESS',
  message: 'Order placed successfully',
};

export const SAMPLE_MODIFY_ORDER_RESPONSE = {
  order_no: '220509000001',
  status: 'SUCCESS',
  message: 'Order modified successfully',
};

export const SAMPLE_CANCEL_ORDER_RESPONSE = {
  order_no: '220509000001',
  status: 'SUCCESS',
  message: 'Order cancelled successfully',
};

export const SAMPLE_LIVE_PRICE_LTP = [
  { security_id: '14366', last_price: 1520.50 },
];

export const SAMPLE_LIVE_PRICE_FULL = [
  {
    security_id: '14366',
    last_price: 1520.50,
    open: 1510.00,
    high: 1530.00,
    low: 1505.00,
    close: 1515.00,
    volume: 1250000,
    bid_price: 1520.00,
    ask_price: 1521.00,
  },
];

export const SAMPLE_LIVE_PRICE_QUOTE = [
  {
    security_id: '14366',
    last_price: 1520.50,
    open: 1510.00,
    high: 1530.00,
    low: 1505.00,
    close: 1515.00,
  },
];

export const SAMPLE_SEARCH_RESULTS = [
  {
    security_id: '14366',
    symbol: 'INFY',
    name: 'Infosys Limited',
    exchange: 'NSE',
    segment: 'E',
  },
  {
    security_id: '14367',
    symbol: 'INFY',
    name: 'Infosys Limited',
    exchange: 'BSE',
    segment: 'E',
  },
];

export const VALID_PLACE_ORDER_INPUT = {
  txn_type: 'B',
  exchange: 'NSE',
  segment: 'E',
  product: 'C',
  security_id: '14366',
  quantity: 10,
  validity: 'DAY',
  order_type: 'LMT',
  price: 1500.50,
};

export const VALID_MODIFY_ORDER_INPUT = {
  order_no: 'ORD-001',
  txn_type: 'B',
  exchange: 'NSE',
  segment: 'E',
  product: 'C',
  security_id: '14366',
  quantity: 20,
  validity: 'DAY',
  order_type: 'LMT',
  price: 1510.00,
  serial_no: 1,
};

export const VALID_CANCEL_ORDER_INPUT = {
  order_no: 'ORD-001',
  serial_no: 1,
  product: 'C',
};

// --- Phase 3 Fixtures ---

export const SAMPLE_GTT_CREATE_RESPONSE = {
  id: 12345,
  status: 'NEW_ACTIVE',
  message: 'GTT created successfully',
};

export const SAMPLE_GTT_GET_RESPONSE = {
  id: 12345,
  status: 'NEW_ACTIVE',
  segment: 'E',
  exchange: 'NSE',
  security_id: '14366',
  product_type: 'C',
  set_price: 1400.00,
  transaction_type: 'B',
  order_type: 'LMT',
  quantity: 10,
  price: 1400.00,
  trigger_type: 'SINGLE',
  created_at: '2026-05-09T10:00:00.000Z',
};

export const SAMPLE_GTT_UPDATE_RESPONSE = {
  id: 12345,
  status: 'NEW_ACTIVE',
  message: 'GTT updated successfully',
};

export const SAMPLE_GTT_DELETE_RESPONSE = {
  message: 'GTT order deleted successfully',
};

export const SAMPLE_GTT_AGGREGATE_RESPONSE = {
  active: 3,
  triggered: 1,
  expired: 2,
  total: 6,
};

export const SAMPLE_OPTION_CHAIN_RESPONSE = {
  data: [
    {
      strike_price: 24000,
      ce_last_price: 350.50,
      ce_oi: 1250000,
      ce_volume: 85000,
      ce_iv: 18.5,
      ce_delta: 0.65,
      ce_theta: -12.5,
      ce_gamma: 0.0025,
      pe_last_price: 180.25,
      pe_oi: 980000,
      pe_volume: 62000,
      pe_iv: 19.2,
      pe_delta: -0.35,
      pe_theta: -10.8,
      pe_gamma: 0.0022,
    },
    {
      strike_price: 24500,
      ce_last_price: 150.00,
      ce_oi: 1100000,
      ce_volume: 70000,
      ce_iv: 17.8,
      ce_delta: 0.45,
      ce_theta: -11.0,
      ce_gamma: 0.0030,
      pe_last_price: 400.75,
      pe_oi: 1400000,
      pe_volume: 90000,
      pe_iv: 20.1,
      pe_delta: -0.55,
      pe_theta: -13.2,
      pe_gamma: 0.0028,
    },
  ],
};

export const SAMPLE_CHARGES_RESPONSE = {
  brokerage: 20.00,
  stt: 1.25,
  exchange_charges: 0.50,
  gst: 3.60,
  stamp_duty: 0.15,
  total: 25.50,
};

export const VALID_CREATE_GTT_INPUT = {
  segment: 'E',
  exchange: 'NSE',
  security_id: '14366',
  product_type: 'C',
  set_price: 1400.00,
  transaction_type: 'B',
  order_type: 'LMT',
  quantity: 10,
  price: 1400.00,
  trigger_type: 'SINGLE',
};

export const VALID_UPDATE_GTT_INPUT = {
  id: 12345,
  segment: 'E',
  exchange: 'NSE',
  security_id: '14366',
  product_type: 'C',
  set_price: 1350.00,
  transaction_type: 'B',
  order_type: 'LMT',
  quantity: 10,
  price: 1350.00,
  trigger_type: 'SINGLE',
};

export const VALID_OPTION_CHAIN_INPUT = {
  type: 'CE',
  underlying: '14366',
  expiry: '2026-05-29',
};

export const VALID_CHARGES_INPUT = {
  segment: 'E',
  exchange: 'NSE',
  txn_type: 'B',
  qty: 10,
  price: 1500.00,
  product: 'C',
};
