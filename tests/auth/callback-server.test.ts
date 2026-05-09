import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';
import net from 'node:net';
import nock from 'nock';
import { CallbackServer } from '../../src/auth/callback-server.js';
import { TokenManager } from '../../src/auth/token-manager.js';
import { PaytmClient } from '../../src/client/pm-client.js';
import { generateState } from '../../src/auth/oauth-flow.js';
import { TEST_ENV, SAMPLE_TOKEN_RESPONSE } from '../helpers/test-utils.js';

/**
 * Helper: make an HTTP GET request to localhost and return status + body.
 */
function httpGet(port: number, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: 'GET' },
      (res) => {
        let body = '';
        res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

/**
 * Helper: make an HTTP POST request to localhost.
 */
function httpPost(port: number, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: 'POST' },
      (res) => {
        let body = '';
        res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

/**
 * Helper: get a random high port (49152+).
 */
function getRandomPort(): number {
  return 49152 + Math.floor(Math.random() * 16383);
}

/**
 * Helper: bind a dummy server to a port (for EADDRINUSE tests).
 */
function occupyPort(port: number): Promise<net.Server> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(port, '127.0.0.1', () => resolve(srv));
  });
}

describe('CallbackServer', () => {
  let tokenManager: TokenManager;
  let client: PaytmClient;
  let callbackServer: CallbackServer;
  let testPort: number;

  beforeEach(() => {
    tokenManager = new TokenManager();
    client = new PaytmClient();
    testPort = getRandomPort();
    callbackServer = new CallbackServer({
      tokenManager,
      client,
      apiKey: TEST_ENV.PAYTM_API_KEY,
      apiSecret: TEST_ENV.PAYTM_API_SECRET,
      port: testPort,
      timeout: 30000,
    });
  });

  afterEach(async () => {
    await callbackServer.stop();
    nock.cleanAll();
  });

  // =========================================================================
  // Lifecycle — SC-600 to SC-608
  // =========================================================================
  describe('Lifecycle', () => {
    // SC-600: CallbackServer starts and binds to 127.0.0.1
    it('should start and bind to 127.0.0.1 — SC-600', async () => {
      const state = generateState(TEST_ENV.PAYTM_API_SECRET);
      await callbackServer.start(state);

      expect(callbackServer.isRunning()).toBe(true);
      expect(callbackServer.getPort()).toBe(testPort);
    });

    // SC-601: CallbackServer starts on custom port
    it('should start on custom port — SC-601', async () => {
      const customPort = getRandomPort();
      const customServer = new CallbackServer({
        tokenManager,
        client,
        apiKey: TEST_ENV.PAYTM_API_KEY,
        apiSecret: TEST_ENV.PAYTM_API_SECRET,
        port: customPort,
        timeout: 30000,
      });

      const state = generateState(TEST_ENV.PAYTM_API_SECRET);
      await customServer.start(state);

      expect(customServer.isRunning()).toBe(true);
      expect(customServer.getPort()).toBe(customPort);

      await customServer.stop();
    });

    // SC-602: stop() shuts down the server
    it('should stop and release port — SC-602', async () => {
      const state = generateState(TEST_ENV.PAYTM_API_SECRET);
      await callbackServer.start(state);
      expect(callbackServer.isRunning()).toBe(true);

      await callbackServer.stop();
      expect(callbackServer.isRunning()).toBe(false);
    });

    // SC-603: stop() is idempotent
    it('should not throw when stop() called on non-running server — SC-603', async () => {
      expect(callbackServer.isRunning()).toBe(false);
      await expect(callbackServer.stop()).resolves.not.toThrow();
      expect(callbackServer.isRunning()).toBe(false);
    });

    // SC-604: EADDRINUSE when port is busy
    it('should reject start when port is busy — SC-604', async () => {
      const busyServer = await occupyPort(testPort);
      try {
        const state = generateState(TEST_ENV.PAYTM_API_SECRET);
        await expect(callbackServer.start(state)).rejects.toThrow(/EADDRINUSE|address already in use/i);
        expect(callbackServer.isRunning()).toBe(false);
      } finally {
        busyServer.close();
      }
    });

    // SC-605: Single instance — start() while running stops previous
    it('should stop previous and restart when start() called while running — SC-605', async () => {
      const state1 = generateState(TEST_ENV.PAYTM_API_SECRET);
      await callbackServer.start(state1);
      expect(callbackServer.isRunning()).toBe(true);

      const state2 = generateState(TEST_ENV.PAYTM_API_SECRET);
      await callbackServer.start(state2);
      expect(callbackServer.isRunning()).toBe(true);
    });

    // SC-606: Auto-shutdown after timeout
    it('should auto-stop after timeout — SC-606', async () => {
      vi.useFakeTimers();

      const shortTimeoutServer = new CallbackServer({
        tokenManager,
        client,
        apiKey: TEST_ENV.PAYTM_API_KEY,
        apiSecret: TEST_ENV.PAYTM_API_SECRET,
        port: testPort,
        timeout: 5000,
      });

      const state = generateState(TEST_ENV.PAYTM_API_SECRET);
      await shortTimeoutServer.start(state);
      expect(shortTimeoutServer.isRunning()).toBe(true);

      const authPromise = shortTimeoutServer.waitForAuth();

      // Advance time past the timeout
      vi.advanceTimersByTime(5001);

      await expect(authPromise).rejects.toThrow(/timeout/i);
      expect(shortTimeoutServer.isRunning()).toBe(false);

      vi.useRealTimers();
    });

    // SC-607: Custom timeout from config
    it('should use custom timeout from config — SC-607', async () => {
      vi.useFakeTimers();

      const customTimeoutServer = new CallbackServer({
        tokenManager,
        client,
        apiKey: TEST_ENV.PAYTM_API_KEY,
        apiSecret: TEST_ENV.PAYTM_API_SECRET,
        port: testPort,
        timeout: 10000,
      });

      const state = generateState(TEST_ENV.PAYTM_API_SECRET);
      await customTimeoutServer.start(state);

      const authPromise = customTimeoutServer.waitForAuth();

      // At 5 seconds, should still be running
      vi.advanceTimersByTime(5000);
      expect(customTimeoutServer.isRunning()).toBe(true);

      // At 10+ seconds, should timeout
      vi.advanceTimersByTime(5001);
      await expect(authPromise).rejects.toThrow(/timeout/i);

      vi.useRealTimers();
    });

    // SC-608: No stdout writes
    it('should not write to process.stdout — SC-608', async () => {
      const stdoutSpy = vi.spyOn(process.stdout, 'write');

      const state = generateState(TEST_ENV.PAYTM_API_SECRET);
      await callbackServer.start(state);

      // Make a request to trigger handler
      try {
        await httpGet(testPort, '/auth/paytm/callback?requestToken=test&state=invalid');
      } catch {
        // ignore connection errors
      }

      // Filter out vitest's own stdout writes by checking for our content
      const ourWrites = stdoutSpy.mock.calls.filter((call) => {
        const content = String(call[0]);
        return content.includes('postback') || content.includes('callback') || content.includes('token');
      });

      expect(ourWrites).toHaveLength(0);
      stdoutSpy.mockRestore();
    });
  });

  // =========================================================================
  // Callback Happy Path — SC-610 to SC-612
  // =========================================================================
  describe('Callback Happy Path', () => {
    // SC-610: Valid callback exchanges requestToken and returns success HTML
    it('should exchange requestToken and return success HTML — SC-610', async () => {
      nock('https://developer.paytmmoney.com')
        .post('/accounts/v2/gettoken', {
          api_key: TEST_ENV.PAYTM_API_KEY,
          api_secret_key: TEST_ENV.PAYTM_API_SECRET,
          request_token: 'valid-req-token',
        })
        .reply(200, SAMPLE_TOKEN_RESPONSE);

      const state = generateState(TEST_ENV.PAYTM_API_SECRET);
      await callbackServer.start(state);

      const authPromise = callbackServer.waitForAuth();

      const response = await httpGet(testPort, `/auth/paytm/callback?requestToken=valid-req-token&state=${encodeURIComponent(state)}`);

      expect(response.status).toBe(200);
      expect(response.body).toContain('Login Successful');
      expect(tokenManager.isAuthenticated()).toBe(true);

      const result = await authPromise;
      expect(result).toBe(true);
    });

    // SC-611: Valid callback stores all 3 tokens
    it('should store all 3 tokens after valid callback — SC-611', async () => {
      nock('https://developer.paytmmoney.com')
        .post('/accounts/v2/gettoken')
        .reply(200, {
          access_token: 'at-1',
          public_access_token: 'pat-1',
          read_access_token: 'rat-1',
        });

      const state = generateState(TEST_ENV.PAYTM_API_SECRET);
      await callbackServer.start(state);

      const authPromise = callbackServer.waitForAuth();
      await httpGet(testPort, `/auth/paytm/callback?requestToken=valid-req-token&state=${encodeURIComponent(state)}`);
      await authPromise;

      expect(tokenManager.getAccessToken()).toBe('at-1');
      expect(tokenManager.getPublicToken()).toBe('pat-1');
      expect(tokenManager.getReadToken()).toBe('rat-1');
    });

    // SC-612: Callback returns error HTML when token exchange fails
    it('should return error HTML when token exchange fails — SC-612', async () => {
      nock('https://developer.paytmmoney.com')
        .post('/accounts/v2/gettoken')
        .reply(401, { message: 'Invalid request token' });

      const state = generateState(TEST_ENV.PAYTM_API_SECRET);
      await callbackServer.start(state);

      const response = await httpGet(testPort, `/auth/paytm/callback?requestToken=bad-token&state=${encodeURIComponent(state)}`);

      expect(response.status).toBe(500);
      expect(response.body).toContain('❌');
      expect(tokenManager.isAuthenticated()).toBe(false);
    });
  });

  // =========================================================================
  // CSRF / State Validation — SC-620 to SC-625
  // =========================================================================
  describe('CSRF / State Validation', () => {
    // SC-620: Rejects tampered HMAC
    it('should reject request with tampered HMAC — SC-620', async () => {
      const state = generateState(TEST_ENV.PAYTM_API_SECRET);
      await callbackServer.start(state);

      const [nonce] = state.split(':');
      const tamperedState = `${nonce}:tampered-hmac-value`;

      const response = await httpGet(testPort, `/auth/paytm/callback?requestToken=token&state=${encodeURIComponent(tamperedState)}`);

      expect(response.status).toBe(403);
      expect(response.body).toContain('❌');
      expect(tokenManager.isAuthenticated()).toBe(false);
    });

    // SC-621: Rejects missing state parameter
    it('should reject request with missing state — SC-621', async () => {
      const state = generateState(TEST_ENV.PAYTM_API_SECRET);
      await callbackServer.start(state);

      const response = await httpGet(testPort, '/auth/paytm/callback?requestToken=token');

      expect(response.status).toBe(403);
      expect(tokenManager.isAuthenticated()).toBe(false);
    });

    // SC-622: Rejects empty state parameter
    it('should reject request with empty state — SC-622', async () => {
      const state = generateState(TEST_ENV.PAYTM_API_SECRET);
      await callbackServer.start(state);

      const response = await httpGet(testPort, '/auth/paytm/callback?requestToken=token&state=');

      expect(response.status).toBe(403);
      expect(tokenManager.isAuthenticated()).toBe(false);
    });

    // SC-623: Rejects missing requestToken
    it('should reject request with missing requestToken — SC-623', async () => {
      const state = generateState(TEST_ENV.PAYTM_API_SECRET);
      await callbackServer.start(state);

      const response = await httpGet(testPort, `/auth/paytm/callback?state=${encodeURIComponent(state)}`);

      expect(response.status).toBe(400);
      expect(tokenManager.isAuthenticated()).toBe(false);
    });

    // SC-624: Unknown route returns 404
    it('should return 404 for unknown routes — SC-624', async () => {
      const state = generateState(TEST_ENV.PAYTM_API_SECRET);
      await callbackServer.start(state);

      const response = await httpGet(testPort, '/unknown-path');

      expect(response.status).toBe(404);
    });

    // SC-625: POST to callback route is rejected
    it('should reject POST to callback route — SC-625', async () => {
      const state = generateState(TEST_ENV.PAYTM_API_SECRET);
      await callbackServer.start(state);

      const response = await httpPost(testPort, `/auth/paytm/callback?requestToken=token&state=${encodeURIComponent(state)}`);

      expect(response.status).toBe(404);
      expect(tokenManager.isAuthenticated()).toBe(false);
    });
  });
});
