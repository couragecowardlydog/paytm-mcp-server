import http from "node:http";
import type { TokenManager } from "./token-manager.js";
import type { PaytmClient } from "../client/pm-client.js";
import { validateState } from "./oauth-flow.js";

const SUCCESS_HTML = `<!DOCTYPE html>
<html><body>
<h1>✅ Login Successful</h1>
<p>You can close this tab and return to your AI assistant.</p>
<script>setTimeout(() => window.close(), 2000);</script>
</body></html>`;

function errorHtml(message: string): string {
  return `<!DOCTYPE html>
<html><body>
<h1>❌ Login Failed</h1>
<p>${message}</p>
</body></html>`;
}

interface CallbackServerConfig {
  tokenManager: TokenManager;
  client: PaytmClient;
  apiKey: string;
  apiSecret: string;
  port?: number;
  timeout?: number;
}

export class CallbackServer {
  private server: http.Server | null = null;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private authResolve: ((value: boolean) => void) | null = null;
  private authReject: ((reason: Error) => void) | null = null;
  private readonly tokenManager: TokenManager;
  private readonly client: PaytmClient;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly port: number;
  private readonly timeout: number;
  private expectedState: string = "";

  constructor(config: CallbackServerConfig) {
    this.tokenManager = config.tokenManager;
    this.client = config.client;
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.port = config.port ?? 18628;
    this.timeout = config.timeout ?? 300000;
  }

  async start(expectedState: string): Promise<void> {
    // Single instance: stop previous if running
    if (this.server) {
      await this.stop();
    }

    this.expectedState = expectedState;

    return new Promise<void>((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on("error", (err) => {
        this.server = null;
        reject(err);
      });

      this.server.listen(this.port, "127.0.0.1", () => {
        this.startTimeout();
        resolve();
      });
    });
  }

  waitForAuth(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this.authResolve = resolve;
      this.authReject = reject;
    });
  }

  async stop(): Promise<void> {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }

    if (!this.server) return;

    return new Promise<void>((resolve) => {
      this.server!.close(() => {
        this.server = null;
        resolve();
      });
    });
  }

  isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }

  getPort(): number {
    return this.port;
  }

  private startTimeout(): void {
    this.timeoutHandle = setTimeout(() => {
      if (this.authReject) {
        this.authReject(new Error("OAuth callback timeout — no callback received"));
      }
      this.stop();
    }, this.timeout);
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${this.port}`);

    // Only handle GET /auth/paytm/callback
    if (url.pathname !== "/auth/paytm/callback" || req.method !== "GET") {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end(errorHtml("Not found"));
      return;
    }

    const state = url.searchParams.get("state") ?? "";
    const requestToken = url.searchParams.get("requestToken") ?? "";

    // Validate CSRF state
    if (!state || !validateState(state, this.apiSecret)) {
      res.writeHead(403, { "Content-Type": "text/html" });
      res.end(errorHtml("Invalid or missing state parameter (CSRF validation failed)"));
      return;
    }

    // Check requestToken
    if (!requestToken) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(errorHtml("Missing requestToken parameter"));
      return;
    }

    // Exchange token
    this.client
      .exchangeToken(this.apiKey, this.apiSecret, requestToken)
      .then((tokens) => {
        this.tokenManager.setTokens({
          accessToken: tokens.access_token,
          publicAccessToken: tokens.public_access_token,
          readAccessToken: tokens.read_access_token,
        });

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(SUCCESS_HTML);

        if (this.authResolve) {
          this.authResolve(true);
        }

        // Schedule stop after 1 second to let response flush
        setTimeout(() => this.stop(), 1000);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Token exchange failed";
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end(errorHtml(message));
      });
  }
}
