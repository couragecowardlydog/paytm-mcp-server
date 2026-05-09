# Paytm Money MCP Server

[![CI](https://github.com/couragecowardlydog/paytm-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/couragecowardlydog/paytm-mcp-server/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/paytm-money-mcp.svg)](https://www.npmjs.com/package/paytm-money-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)


MCP (Model Context Protocol) server for Paytm Money, providing portfolio and market data tools for VS Code Copilot Chat.

## Phase 1 Scope — Read-Only Tools

| # | Tool | Description | Auth Required |
|---|------|-------------|---------------|
| 1 | `paytm_login` | Generate Paytm Money OAuth login URL | No |
| 2 | `paytm_set_tokens` | Exchange request_token or set JWT tokens manually | No |
| 3 | `paytm_get_holdings` | Fetch portfolio holdings (stocks, qty, cost, LTP, P&L) | Yes |
| 4 | `paytm_get_positions` | Fetch open/closed positions for the day | Yes |
| 5 | `paytm_get_user_details` | Fetch user profile (name, email, PAN, broker) | Yes |
| 6 | `paytm_get_funds` | Fetch funds summary (balance, margin, collateral) | Yes |
| 7 | `paytm_get_order_book` | Fetch order book for the day | Yes |

All tools are annotated with `readOnlyHint: true`.

## Architecture

- **Transport**: stdio (JSON-RPC over stdin/stdout)
- **Token management**: In-memory only — no disk persistence
- **HTTP client**: axios → Paytm Money REST API (`https://developer.paytmmoney.com`)
- **Validation**: Zod schemas for all tool inputs
- **Error handling**: Structured error responses with retry (1 retry for 5xx, Retry-After for 429)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env with your Paytm Money API credentials
```

| Variable | Required | Description |
|----------|----------|-------------|
| `PAYTM_API_KEY` | Yes | Paytm Money API key |
| `PAYTM_API_SECRET` | Yes | Paytm Money API secret |
| `PAYTM_EXCLUDED_TOOLS` | No | Comma-separated tool names to disable |

### 3. Build

```bash
npm run build
```

### 4. Configure in VS Code

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "paytm-money": {
      "type": "stdio",
      "command": "node",
      "args": ["<path-to>/paytm-mcp-server/dist/index.js"],
      "env": {
        "PAYTM_API_KEY": "${env:PAYTM_API_KEY}",
        "PAYTM_API_SECRET": "${env:PAYTM_API_SECRET}"
      }
    }
  }
}
```

## Usage Flow

1. Call `paytm_login` → get OAuth URL → open in browser → login → copy `request_token` from callback
2. Call `paytm_set_tokens` with `{ "request_token": "<token>" }` → exchanges for JWT tokens
3. Call any authenticated tool (`paytm_get_holdings`, etc.)

Tokens are valid until 15:30 IST (market close). After expiry, re-login is required.

## Security

- **No disk persistence** — tokens are held in-memory only, lost on server restart
- **Secrets via env vars** — API key and secret are never hardcoded
- **No stdout logging of secrets** — stdio transport requires clean stdout (JSON-RPC only)

## Development

```bash
npm run dev      # Run with tsx (hot reload)
npm run test     # Run tests
npm run test:watch  # Watch mode
```

## Paytm Money API Reference

Base URL: `https://developer.paytmmoney.com`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/accounts/v2/gettoken` | Exchange request_token for JWTs |
| GET | `/holdings/v1/get-user-holdings-data` | Portfolio holdings |
| GET | `/data/v1/position` | Open/closed positions |
| GET | `/accounts/v1/getuser/details` | User profile |
| GET | `/accounts/v1/funds/summary` | Funds and margin |
| GET | `/orders/v1/user/orders` | Order book |
