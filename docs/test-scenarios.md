# Paytm Money MCP Server — Phase 1 Test Scenarios

| Field                  | Value                                      |
|------------------------|--------------------------------------------|
| **Status**             | Approved for implementation                |
| **Approved By**        | QA                                         |
| **Implementation Ready** | Yes                                      |
| **Phase**              | Phase 1 — MVP (Read-Only, 7 Tools)         |
| **Test Philosophy**    | Social tests, real HTTP via nock/interceptors, no mocks of business logic |
| **Traces From**        | Phase 1 MVP spec (user-provided)           |

---

## Scenario Group: Server Lifecycle

### SC-001: Server starts with valid env vars
- **Given**: `PAYTM_API_KEY` and `PAYTM_API_SECRET` are set in environment
- **When**: The MCP server process is started via stdio transport
- **Then**: Server initializes without error, registers all 7 tools, and is ready to accept JSON-RPC messages
- **Priority**: P0

### SC-002: Server fails to start without PAYTM_API_KEY
- **Given**: `PAYTM_API_KEY` is not set (undefined or empty string)
- **When**: The MCP server process is started
- **Then**: Server exits with a non-zero exit code and logs a clear error message indicating `PAYTM_API_KEY` is required
- **Priority**: P0

### SC-003: Server fails to start without PAYTM_API_SECRET
- **Given**: `PAYTM_API_SECRET` is not set (undefined or empty string)
- **When**: The MCP server process is started
- **Then**: Server exits with a non-zero exit code and logs a clear error message indicating `PAYTM_API_SECRET` is required
- **Priority**: P0

### SC-004: Server registers exactly 7 tools
- **Given**: Server is started with valid env vars
- **When**: Client sends `tools/list` JSON-RPC request
- **Then**: Response contains exactly 7 tools: `paytm_login`, `paytm_set_tokens`, `paytm_get_holdings`, `paytm_get_positions`, `paytm_get_user_details`, `paytm_get_funds`, `paytm_get_order_book`
- **Priority**: P0

### SC-005: All tools have readOnlyHint annotation
- **Given**: Server is started
- **When**: Client sends `tools/list` JSON-RPC request
- **Then**: Every tool in the response has `annotations.readOnlyHint: true`
- **Priority**: P1

### SC-006: Server communicates over stdio (JSON-RPC)
- **Given**: Server is started
- **When**: Client sends a valid JSON-RPC `tools/list` request via stdin
- **Then**: Server responds with a valid JSON-RPC response on stdout; no non-JSON output is written to stdout
- **Priority**: P0

---

## Scenario Group: PAYTM_EXCLUDED_TOOLS

### SC-007: Excluding a single tool by env var
- **Given**: `PAYTM_EXCLUDED_TOOLS=paytm_get_positions` is set
- **When**: Server starts and client sends `tools/list`
- **Then**: Response contains 6 tools; `paytm_get_positions` is absent
- **Priority**: P1

### SC-008: Excluding multiple tools by env var
- **Given**: `PAYTM_EXCLUDED_TOOLS=paytm_get_positions,paytm_get_funds` is set
- **When**: Server starts and client sends `tools/list`
- **Then**: Response contains 5 tools; both excluded tools are absent
- **Priority**: P1

### SC-009: Calling an excluded tool returns error
- **Given**: `PAYTM_EXCLUDED_TOOLS=paytm_get_holdings` is set and server is started
- **When**: Client sends `tools/call` for `paytm_get_holdings`
- **Then**: Response has `isError: true` with a message indicating the tool is not available
- **Priority**: P1

### SC-010: Empty PAYTM_EXCLUDED_TOOLS registers all tools
- **Given**: `PAYTM_EXCLUDED_TOOLS=""` (empty string) is set
- **When**: Server starts and client sends `tools/list`
- **Then**: All 7 tools are registered
- **Priority**: P2

### SC-011: PAYTM_EXCLUDED_TOOLS with whitespace is trimmed
- **Given**: `PAYTM_EXCLUDED_TOOLS=" paytm_get_funds , paytm_get_positions "` (extra whitespace)
- **When**: Server starts and client sends `tools/list`
- **Then**: Both `paytm_get_funds` and `paytm_get_positions` are excluded (whitespace is trimmed)
- **Priority**: P2

### SC-012: Unknown tool name in PAYTM_EXCLUDED_TOOLS is ignored
- **Given**: `PAYTM_EXCLUDED_TOOLS=paytm_nonexistent_tool` is set
- **When**: Server starts and client sends `tools/list`
- **Then**: All 7 tools are registered; unknown name is silently ignored
- **Priority**: P2

---

## Scenario Group: Tool 1 — paytm_login

### SC-020: Login returns URL with API key and default state
- **Given**: Server is running with `PAYTM_API_KEY=test-key-123`
- **When**: Client calls `paytm_login` with no arguments
- **Then**: Response content contains a URL matching `https://login.paytmmoney.com/merchant-login?apiKey=test-key-123&state=<some-default>`; `isError` is false
- **Priority**: P0

### SC-021: Login returns URL with custom state parameter
- **Given**: Server is running with `PAYTM_API_KEY=test-key-123`
- **When**: Client calls `paytm_login` with `{ "state": "my-csrf-token" }`
- **Then**: Response URL contains `state=my-csrf-token`
- **Priority**: P1

### SC-022: Login works without authentication (no tokens needed)
- **Given**: Server is running, no tokens have been set
- **When**: Client calls `paytm_login`
- **Then**: Response succeeds (no auth error); returns login URL
- **Priority**: P0

### SC-023: Login URL-encodes special characters in state
- **Given**: Server is running
- **When**: Client calls `paytm_login` with `{ "state": "test&value=foo" }`
- **Then**: The `state` parameter in the URL is properly URL-encoded
- **Priority**: P2

---

## Scenario Group: Tool 2 — paytm_set_tokens

### SC-030: Exchange request_token for all 3 tokens (happy path)
- **Given**: Server is running; Paytm gettoken API (`POST /accounts/v2/gettoken`) will return `{ "access_token": "at-1", "public_access_token": "pat-1", "read_access_token": "rat-1" }`
- **When**: Client calls `paytm_set_tokens` with `{ "request_token": "valid-req-token" }`
- **Then**: Response indicates success; all 3 tokens are stored in-memory; subsequent authenticated tool calls succeed
- **Priority**: P0

### SC-031: Exchange request_token sends correct payload to Paytm
- **Given**: Server is running with `PAYTM_API_KEY=key1` and `PAYTM_API_SECRET=secret1`
- **When**: Client calls `paytm_set_tokens` with `{ "request_token": "rt-abc" }`
- **Then**: Server POSTs to `https://developer.paytmmoney.com/accounts/v2/gettoken` with body `{ api_key: "key1", api_secret_key: "secret1", request_token: "rt-abc" }` and `Content-Type: application/json`
- **Priority**: P0

### SC-032: Exchange request_token fails — invalid token
- **Given**: Server is running; Paytm gettoken API returns 401 `{ "message": "Invalid request token" }`
- **When**: Client calls `paytm_set_tokens` with `{ "request_token": "bad-token" }`
- **Then**: Response has `isError: true` with message containing the Paytm error; no tokens are stored
- **Priority**: P0

### SC-033: Set manual tokens directly
- **Given**: Server is running, no prior tokens set
- **When**: Client calls `paytm_set_tokens` with `{ "access_token": "at-manual", "public_access_token": "pat-manual", "read_access_token": "rat-manual" }`
- **Then**: Response indicates success; tokens are stored; subsequent `paytm_get_holdings` call succeeds using `rat-manual`
- **Priority**: P0

### SC-034: Set only read_access_token manually
- **Given**: Server is running
- **When**: Client calls `paytm_set_tokens` with `{ "read_access_token": "rat-only" }`
- **Then**: Response indicates success; `read_access_token` is stored; tools requiring read_access_token work
- **Priority**: P1

### SC-035: Validation error — neither request_token nor any JWT provided
- **Given**: Server is running
- **When**: Client calls `paytm_set_tokens` with `{}` (empty object)
- **Then**: Response has `isError: true` with validation error indicating either `request_token` or at least one token must be provided
- **Priority**: P0

### SC-036: Validation error — request_token combined with manual tokens
- **Given**: Server is running
- **When**: Client calls `paytm_set_tokens` with `{ "request_token": "rt", "access_token": "at" }`
- **Then**: Response has `isError: true` with validation error (mutually exclusive inputs)
- **Priority**: P1

### SC-037: Token exchange — network error
- **Given**: Server is running; Paytm gettoken API is unreachable (connection refused)
- **When**: Client calls `paytm_set_tokens` with `{ "request_token": "rt" }`
- **Then**: Response has `isError: true` with a friendly network error message (not a raw stack trace)
- **Priority**: P1

### SC-038: Token exchange — 5xx server error triggers retry
- **Given**: Server is running; Paytm gettoken API returns 500 on first call, then 200 with valid tokens on second call
- **When**: Client calls `paytm_set_tokens` with `{ "request_token": "rt" }`
- **Then**: Server retries after ~2s; response indicates success; tokens are stored
- **Priority**: P1

### SC-039: Token exchange — 5xx persists after retry
- **Given**: Server is running; Paytm gettoken API returns 500 on both attempts
- **When**: Client calls `paytm_set_tokens` with `{ "request_token": "rt" }`
- **Then**: Response has `isError: true` with server error message after retry exhaustion
- **Priority**: P1

### SC-040: New tokens overwrite previous tokens
- **Given**: Server has tokens set from a previous `paytm_set_tokens` call
- **When**: Client calls `paytm_set_tokens` with new manual tokens
- **Then**: Old tokens are replaced; subsequent calls use the new tokens
- **Priority**: P1

---

## Scenario Group: Tool 3 — paytm_get_holdings

### SC-050: Get holdings — happy path
- **Given**: Server is authenticated (read_access_token is set); Paytm holdings API returns holdings data with 3 stocks
- **When**: Client calls `paytm_get_holdings`
- **Then**: Response contains formatted holdings with symbol, qty, cost, LTP, P&L, sector, and cap for each stock; `isError` is false
- **Priority**: P0

### SC-051: Get holdings — sends correct auth header
- **Given**: Server has `read_access_token = "rat-xyz"` stored
- **When**: Client calls `paytm_get_holdings`
- **Then**: Server sends GET to `/holdings/v1/get-user-holdings-data` with header `x-jwt-token: rat-xyz`
- **Priority**: P0

### SC-052: Get holdings — not authenticated
- **Given**: Server is running, no tokens set
- **When**: Client calls `paytm_get_holdings`
- **Then**: Response has `isError: true` with message instructing user to call `paytm_login` and `paytm_set_tokens` first
- **Priority**: P0

### SC-053: Get holdings — token expired
- **Given**: Server has tokens set but they are past EOD expiry (simulated time past 15:30 IST)
- **When**: Client calls `paytm_get_holdings`
- **Then**: Response has `isError: true` with message indicating token expired, instructing re-login
- **Priority**: P0

### SC-054: Get holdings — API returns 401 unauthorized
- **Given**: Server has tokens set; Paytm API returns 401
- **When**: Client calls `paytm_get_holdings`
- **Then**: Response has `isError: true` with auth error message
- **Priority**: P1

### SC-055: Get holdings — API returns 500, retries once, then succeeds
- **Given**: Server is authenticated; Paytm API returns 500 first, then 200 with holdings data
- **When**: Client calls `paytm_get_holdings`
- **Then**: Response contains holdings data (retry succeeded)
- **Priority**: P1

### SC-056: Get holdings — API returns 500 twice (retry exhausted)
- **Given**: Server is authenticated; Paytm API returns 500 on both attempts
- **When**: Client calls `paytm_get_holdings`
- **Then**: Response has `isError: true` with server error message
- **Priority**: P1

### SC-057: Get holdings — API returns 429 rate limit
- **Given**: Server is authenticated; Paytm API returns 429 with `Retry-After: 1`
- **When**: Client calls `paytm_get_holdings`
- **Then**: Server waits per Retry-After header and retries; if second attempt succeeds, returns holdings; if 429 again, returns error
- **Priority**: P1

### SC-058: Get holdings — empty portfolio
- **Given**: Server is authenticated; Paytm API returns empty holdings array `{ data: { results: [] } }`
- **When**: Client calls `paytm_get_holdings`
- **Then**: Response indicates no holdings found (not an error, just empty)
- **Priority**: P1

### SC-059: Get holdings — network error
- **Given**: Server is authenticated; Paytm API is unreachable
- **When**: Client calls `paytm_get_holdings`
- **Then**: Response has `isError: true` with friendly network error message
- **Priority**: P1

---

## Scenario Group: Tool 4 — paytm_get_positions

### SC-060: Get positions — happy path
- **Given**: Server is authenticated; Paytm positions API returns position data
- **When**: Client calls `paytm_get_positions`
- **Then**: Response contains formatted positions data; `isError` is false
- **Priority**: P0

### SC-061: Get positions — not authenticated
- **Given**: No tokens set
- **When**: Client calls `paytm_get_positions`
- **Then**: Response has `isError: true` with auth error instructing to login
- **Priority**: P0

### SC-062: Get positions — token expired
- **Given**: Tokens set but expired (past 15:30 IST)
- **When**: Client calls `paytm_get_positions`
- **Then**: Response has `isError: true` with expiry message
- **Priority**: P0

### SC-063: Get positions — API 4xx error
- **Given**: Server is authenticated; API returns 400 with `{ "message": "Bad request" }`
- **When**: Client calls `paytm_get_positions`
- **Then**: Response has `isError: true` with Paytm's error message passed through
- **Priority**: P1

### SC-064: Get positions — empty positions
- **Given**: Server is authenticated; API returns empty positions
- **When**: Client calls `paytm_get_positions`
- **Then**: Response indicates no open positions (not an error)
- **Priority**: P1

---

## Scenario Group: Tool 5 — paytm_get_user_details

### SC-070: Get user details — happy path
- **Given**: Server is authenticated; Paytm user details API returns `{ name: "Vivek", email: "v@example.com", pan: "ABCDE1234F", broker: "PAYTM" }`
- **When**: Client calls `paytm_get_user_details`
- **Then**: Response contains formatted user profile with name, email, PAN, broker
- **Priority**: P0

### SC-071: Get user details — not authenticated
- **Given**: No tokens set
- **When**: Client calls `paytm_get_user_details`
- **Then**: Response has `isError: true` with auth error
- **Priority**: P0

### SC-072: Get user details — token expired
- **Given**: Tokens expired
- **When**: Client calls `paytm_get_user_details`
- **Then**: Response has `isError: true` with expiry message
- **Priority**: P0

### SC-073: Get user details — API error
- **Given**: Server is authenticated; API returns 500
- **When**: Client calls `paytm_get_user_details`
- **Then**: Response has `isError: true` after retry exhaustion
- **Priority**: P1

---

## Scenario Group: Tool 6 — paytm_get_funds

### SC-080: Get funds — happy path (no config)
- **Given**: Server is authenticated; Paytm funds API returns balance, used margin, and collateral data
- **When**: Client calls `paytm_get_funds` with no arguments
- **Then**: Response contains formatted funds summary; `isError` is false
- **Priority**: P0

### SC-081: Get funds — with type EQUITY
- **Given**: Server is authenticated
- **When**: Client calls `paytm_get_funds` with `{ "config": { "type": "EQUITY" } }`
- **Then**: API is called with the EQUITY config; response contains equity-specific funds
- **Priority**: P1

### SC-082: Get funds — with type COMMODITY
- **Given**: Server is authenticated
- **When**: Client calls `paytm_get_funds` with `{ "config": { "type": "COMMODITY" } }`
- **Then**: API is called with the COMMODITY config; response contains commodity-specific funds
- **Priority**: P1

### SC-083: Get funds — with type ALL
- **Given**: Server is authenticated
- **When**: Client calls `paytm_get_funds` with `{ "config": { "type": "ALL" } }`
- **Then**: Response contains combined funds summary
- **Priority**: P1

### SC-084: Get funds — invalid type rejected by Zod
- **Given**: Server is authenticated
- **When**: Client calls `paytm_get_funds` with `{ "config": { "type": "INVALID" } }`
- **Then**: Response has `isError: true` with Zod validation error indicating invalid enum value
- **Priority**: P1

### SC-085: Get funds — not authenticated
- **Given**: No tokens set
- **When**: Client calls `paytm_get_funds`
- **Then**: Response has `isError: true` with auth error
- **Priority**: P0

### SC-086: Get funds — token expired
- **Given**: Tokens expired
- **When**: Client calls `paytm_get_funds`
- **Then**: Response has `isError: true` with expiry message
- **Priority**: P0

---

## Scenario Group: Tool 7 — paytm_get_order_book

### SC-090: Get order book — happy path
- **Given**: Server is authenticated; Paytm order book API returns a list of orders
- **When**: Client calls `paytm_get_order_book`
- **Then**: Response contains formatted order list; `isError` is false
- **Priority**: P0

### SC-091: Get order book — not authenticated
- **Given**: No tokens set
- **When**: Client calls `paytm_get_order_book`
- **Then**: Response has `isError: true` with auth error
- **Priority**: P0

### SC-092: Get order book — token expired
- **Given**: Tokens expired
- **When**: Client calls `paytm_get_order_book`
- **Then**: Response has `isError: true` with expiry message
- **Priority**: P0

### SC-093: Get order book — empty order book
- **Given**: Server is authenticated; API returns empty orders array
- **When**: Client calls `paytm_get_order_book`
- **Then**: Response indicates no orders (not an error)
- **Priority**: P1

### SC-094: Get order book — API error passthrough
- **Given**: Server is authenticated; API returns 403 `{ "message": "Insufficient permissions" }`
- **When**: Client calls `paytm_get_order_book`
- **Then**: Response has `isError: true` with the Paytm error message
- **Priority**: P1

---

## Scenario Group: TokenManager

### SC-100: TokenManager starts with no tokens
- **Given**: Server just started, no `paytm_set_tokens` called
- **When**: `assertAuthenticated()` is checked
- **Then**: Throws AuthError with "not authenticated" message
- **Priority**: P0

### SC-101: TokenManager stores tokens after exchange
- **Given**: `paytm_set_tokens` called with valid request_token, API returns all 3 tokens
- **When**: `getReadToken()`, `getAccessToken()`, `getPublicToken()` are called
- **Then**: Each returns the corresponding token value
- **Priority**: P0

### SC-102: TokenManager stores tokens after manual set
- **Given**: `paytm_set_tokens` called with manual `access_token`, `read_access_token`, `public_access_token`
- **When**: `getReadToken()` is called
- **Then**: Returns the manually set `read_access_token`
- **Priority**: P0

### SC-103: assertNotExpired passes before 15:30 IST
- **Given**: Tokens were set today; current time is 14:00 IST
- **When**: `assertNotExpired()` is called
- **Then**: Does not throw; returns normally
- **Priority**: P0

### SC-104: assertNotExpired fails after 15:30 IST
- **Given**: Tokens were set today; current time is 15:31 IST (or later)
- **When**: `assertNotExpired()` is called
- **Then**: Throws AuthError with "token expired" message instructing re-login
- **Priority**: P0

### SC-105: Tokens set on a new day pass expiry check before 15:30
- **Given**: Old tokens expired yesterday; new tokens set today at 09:30 IST
- **When**: `assertNotExpired()` is called at 10:00 IST
- **Then**: Does not throw
- **Priority**: P1

### SC-106: exchangeRequestToken stores expiry metadata
- **Given**: Token exchange succeeds
- **When**: Tokens are stored
- **Then**: TokenManager records the token set time (used for EOD expiry check)
- **Priority**: P1

### SC-107: Partial manual tokens — only read_access_token
- **Given**: `paytm_set_tokens` called with only `read_access_token`
- **When**: `getAccessToken()` is called
- **Then**: Returns undefined/null (only read token was set)
- **Priority**: P2

### SC-108: Tokens are not persisted to disk
- **Given**: Tokens are set via `paytm_set_tokens`
- **When**: File system is inspected
- **Then**: No token data is written to any file on disk
- **Priority**: P1 (security)

---

## Scenario Group: Error Handling — Cross-Cutting

### SC-110: AuthError — not authenticated — message format
- **Given**: No tokens set
- **When**: Any authenticated tool is called (`paytm_get_holdings`, `paytm_get_positions`, etc.)
- **Then**: Response has `isError: true`; message text includes instructions to call `paytm_login` first, then `paytm_set_tokens`
- **Priority**: P0

### SC-111: AuthError — expired — message format
- **Given**: Tokens are expired
- **When**: Any authenticated tool is called
- **Then**: Response has `isError: true`; message instructs to re-login (tokens expire at EOD)
- **Priority**: P0

### SC-112: API 4xx — error message passthrough
- **Given**: Authenticated; API returns 400 with `{ "message": "Some Paytm error" }`
- **When**: Any tool calls the API
- **Then**: Response has `isError: true`; message contains "Some Paytm error"
- **Priority**: P1

### SC-113: API 5xx — retry once after 2 seconds
- **Given**: Authenticated; API returns 500 on first call
- **When**: Any tool calls the API
- **Then**: Server waits ~2 seconds and retries exactly once
- **Priority**: P1

### SC-114: API 5xx — retry exhausted
- **Given**: Authenticated; API returns 502 on both first and retry call
- **When**: Any tool calls the API
- **Then**: Response has `isError: true` with server error message after both attempts fail
- **Priority**: P1

### SC-115: Network error — connection refused
- **Given**: Authenticated; API host is unreachable
- **When**: Any tool calls the API
- **Then**: Response has `isError: true` with user-friendly message (e.g., "Unable to reach Paytm Money API"); no raw stack trace exposed
- **Priority**: P1

### SC-116: Network error — timeout
- **Given**: Authenticated; API does not respond within timeout
- **When**: Any tool calls the API
- **Then**: Response has `isError: true` with timeout message
- **Priority**: P1

### SC-117: Rate limit 429 — respects Retry-After header
- **Given**: Authenticated; API returns 429 with `Retry-After: 3`
- **When**: Any tool calls the API
- **Then**: Server waits 3 seconds (per header) and retries once; if retry succeeds, returns data
- **Priority**: P1

### SC-118: Rate limit 429 — retry also 429
- **Given**: Authenticated; API returns 429 on both attempts
- **When**: Any tool calls the API
- **Then**: Response has `isError: true` with rate limit message
- **Priority**: P1

### SC-119: Zod validation — extra unknown fields ignored
- **Given**: Server is running
- **When**: Client calls any tool with extra fields not in the schema (e.g., `paytm_login` with `{ "state": "x", "extra": "y" }`)
- **Then**: Extra fields are stripped; tool executes normally with valid fields
- **Priority**: P2

### SC-120: Zod validation — wrong type
- **Given**: Server is running
- **When**: Client calls `paytm_login` with `{ "state": 12345 }` (number instead of string)
- **Then**: Response has `isError: true` with Zod validation error
- **Priority**: P1

---

## Scenario Group: Input Validation (Zod Schemas)

### SC-130: paytm_login — state is optional string
- **Given**: Server is running
- **When**: Client calls `paytm_login` with no arguments
- **Then**: Succeeds (state is optional)
- **Priority**: P1

### SC-131: paytm_set_tokens — request_token is a string
- **Given**: Server is running
- **When**: Client calls `paytm_set_tokens` with `{ "request_token": "" }` (empty string)
- **Then**: Response has `isError: true` with validation error (empty string not valid)
- **Priority**: P1

### SC-132: paytm_get_funds — config.type enum validation
- **Given**: Server is running
- **When**: Client calls `paytm_get_funds` with `{ "config": { "type": "FUTURES" } }`
- **Then**: Response has `isError: true`; Zod rejects invalid enum value; message indicates valid values are ALL, EQUITY, COMMODITY
- **Priority**: P1

### SC-133: paytm_get_holdings — rejects unexpected input
- **Given**: Server is running
- **When**: Client calls `paytm_get_holdings` with `{ "symbol": "INFY" }` (no input expected)
- **Then**: Extra input is ignored or stripped; tool proceeds to check auth and call API
- **Priority**: P2

---

## Scenario Group: Security

### SC-140: API keys are not exposed in tool responses
- **Given**: Server is running with `PAYTM_API_KEY=secret-key`
- **When**: Any tool is called (success or error)
- **Then**: Response content never contains the `PAYTM_API_KEY` or `PAYTM_API_SECRET` values
- **Priority**: P0

### SC-141: Tokens are not logged to stdout
- **Given**: Server is running; tokens are set
- **When**: Any tool is called
- **Then**: stdout (the MCP transport) contains only JSON-RPC messages; no token values appear in logs on stdout
- **Priority**: P0 (security)

### SC-142: Login URL does not expose API secret
- **Given**: Server is running
- **When**: Client calls `paytm_login`
- **Then**: The returned URL contains `apiKey` but NOT `apiSecret` or `api_secret_key`
- **Priority**: P0

### SC-143: No tokens written to file system
- **Given**: Tokens are set via exchange or manual
- **When**: Server has been running and processing requests
- **Then**: No files containing token values exist in the working directory or temp directories
- **Priority**: P1

---

## Scenario Group: End-to-End Flows

### SC-150: Full auth flow — login → set_tokens → get_holdings
- **Given**: Server is running with valid env vars; Paytm gettoken API and holdings API are stubbed to return valid responses
- **When**: Client calls `paytm_login` (gets URL), then `paytm_set_tokens` with `{ "request_token": "rt" }`, then `paytm_get_holdings`
- **Then**: Login returns URL; set_tokens succeeds; get_holdings returns formatted holdings data
- **Priority**: P0

### SC-151: Full auth flow — login → manual tokens → get_positions + get_funds
- **Given**: Server is running
- **When**: Client calls `paytm_login`, then `paytm_set_tokens` with manual tokens, then `paytm_get_positions`, then `paytm_get_funds`
- **Then**: All calls succeed; positions and funds data returned
- **Priority**: P0

### SC-152: Re-auth after expiry
- **Given**: Server had valid tokens that have now expired (time advanced past 15:30 IST)
- **When**: Client calls `paytm_get_holdings` (gets expiry error), then `paytm_set_tokens` with new tokens, then `paytm_get_holdings` again
- **Then**: First call errors with expiry; second set_tokens succeeds; third call returns holdings
- **Priority**: P1

### SC-153: Multiple tool calls in sequence with same auth
- **Given**: Server is authenticated
- **When**: Client calls `paytm_get_holdings`, then `paytm_get_positions`, then `paytm_get_user_details`, then `paytm_get_funds`, then `paytm_get_order_book`
- **Then**: All 5 calls succeed using the same stored tokens
- **Priority**: P1

---

## Summary

| Priority | Count | Description |
|----------|-------|-------------|
| P0       | 24    | Must pass — core auth, happy paths, security, server lifecycle |
| P1       | 33    | Should pass — error handling, retries, validation, edge cases |
| P2       | 7     | Nice to have — whitespace trimming, extra fields, partial tokens |
| **Total** | **64** | |

### Testcontainers / Test Infrastructure

| Component | Strategy | Notes |
|-----------|----------|-------|
| Paytm Money API | HTTP interceptor (nock or msw) | Intercept outbound HTTP to `developer.paytmmoney.com` |
| MCP Transport | In-process stdio mock or `@modelcontextprotocol/sdk` test client | Use SDK's client to send JSON-RPC via pipes |
| Time/Clock | Fake timers (Vitest `vi.useFakeTimers`) | For token expiry scenarios (15:30 IST) |
| File System | Assert no writes via fs spy or temp dir inspection | For security scenarios (SC-108, SC-143) |

### Test File Structure (Recommended)

```
tests/
├── server.test.ts          # SC-001 to SC-006 (lifecycle)
├── excluded-tools.test.ts  # SC-007 to SC-012
├── tools/
│   ├── login.test.ts       # SC-020 to SC-023
│   ├── set-tokens.test.ts  # SC-030 to SC-040
│   ├── holdings.test.ts    # SC-050 to SC-059
│   ├── positions.test.ts   # SC-060 to SC-064
│   ├── user-details.test.ts# SC-070 to SC-073
│   ├── funds.test.ts       # SC-080 to SC-086
│   └── order-book.test.ts  # SC-090 to SC-094
├── token-manager.test.ts   # SC-100 to SC-108
├── error-handling.test.ts  # SC-110 to SC-120
├── validation.test.ts      # SC-130 to SC-133
├── security.test.ts        # SC-140 to SC-143
└── e2e.test.ts             # SC-150 to SC-153
```

---
---

# Paytm Money MCP Server — Phase 2 Test Scenarios

| Field                  | Value                                      |
|------------------------|--------------------------------------------|
| **Status**             | Approved for implementation                |
| **Approved By**        | QA                                         |
| **Implementation Ready** | Yes                                      |
| **Phase**              | Phase 2 — Trade Execution & Market Data (5 Tools) |
| **Scenario IDs**       | SC-200 through SC-358                      |
| **Test Philosophy**    | Social tests, real HTTP via nock/interceptors, no mocks of business logic |
| **Traces From**        | Phase 2 spec (user-provided); Phase 1 scenarios SC-001–SC-153 |

---

## Scenario Group: Server — Phase 2 Registration

### SC-200: Server registers 12 tools after Phase 2
- **Given**: `PAYTM_API_KEY` and `PAYTM_API_SECRET` are set; no `PAYTM_EXCLUDED_TOOLS`
- **When**: Server starts and client sends `tools/list`
- **Then**: Response contains exactly 12 tools — the original 7 plus `paytm_place_order`, `paytm_modify_order`, `paytm_cancel_order`, `paytm_get_live_price`, `paytm_search_instruments`
- **Priority**: P0

### SC-201: Phase 2 write tools have destructiveHint annotation
- **Given**: Server is started
- **When**: Client sends `tools/list`
- **Then**: `paytm_place_order`, `paytm_modify_order`, `paytm_cancel_order` each have `annotations.destructiveHint: true`
- **Priority**: P0

### SC-202: Phase 2 read tools have readOnlyHint annotation
- **Given**: Server is started
- **When**: Client sends `tools/list`
- **Then**: `paytm_get_live_price` and `paytm_search_instruments` have `annotations.readOnlyHint: true`
- **Priority**: P1

### SC-203: Excluding a Phase 2 tool via PAYTM_EXCLUDED_TOOLS
- **Given**: `PAYTM_EXCLUDED_TOOLS=paytm_place_order` is set
- **When**: Server starts and client sends `tools/list`
- **Then**: Response contains 11 tools; `paytm_place_order` is absent; all other tools present
- **Priority**: P1

### SC-204: Excluding multiple Phase 2 tools
- **Given**: `PAYTM_EXCLUDED_TOOLS=paytm_place_order,paytm_modify_order,paytm_cancel_order` is set
- **When**: Server starts and client sends `tools/list`
- **Then**: Response contains 9 tools; all 3 write tools are absent; read tools remain
- **Priority**: P1

### SC-205: Calling an excluded Phase 2 tool returns error
- **Given**: `PAYTM_EXCLUDED_TOOLS=paytm_place_order` and server is started
- **When**: Client sends `tools/call` for `paytm_place_order`
- **Then**: Response has `isError: true` with a message indicating the tool is not available
- **Priority**: P1

---

## Scenario Group: Tool 8 — paytm_place_order

### Happy Path

### SC-210: Place limit buy order — regular (happy path)
- **Given**: Server is authenticated with `access_token` set; Paytm place order API (`POST /orders/v1/place/regular`) returns `{ "order_no": "ORD-001", "status": "success", "message": "Order placed" }`
- **When**: Client calls `paytm_place_order` with `{ "txn_type": "B", "exchange": "NSE", "segment": "E", "product": "C", "security_id": "14366", "quantity": 10, "validity": "DAY", "order_type": "LMT", "price": 1500.50 }`
- **Then**: Response contains order_no, status, and message; `isError` is false
- **Priority**: P0

### SC-211: Place market buy order — regular
- **Given**: Server is authenticated with `access_token`; API returns success
- **When**: Client calls `paytm_place_order` with `{ "txn_type": "B", "exchange": "NSE", "segment": "E", "product": "I", "security_id": "14366", "quantity": 5, "validity": "DAY", "order_type": "MKT" }`
- **Then**: Response indicates order placed; no price field required for MKT orders; API called at `/orders/v1/place/regular`
- **Priority**: P0

### SC-212: Place sell order — regular CNC
- **Given**: Server is authenticated with `access_token`; API returns success
- **When**: Client calls `paytm_place_order` with `{ "txn_type": "S", "exchange": "NSE", "segment": "E", "product": "C", "security_id": "14366", "quantity": 10, "validity": "DAY", "order_type": "LMT", "price": 1600.00 }`
- **Then**: Response indicates sell order placed successfully
- **Priority**: P0

### SC-213: Place stop-loss order (SL) with trigger price
- **Given**: Server is authenticated; API returns success
- **When**: Client calls `paytm_place_order` with `{ "txn_type": "B", "exchange": "NSE", "segment": "E", "product": "I", "security_id": "14366", "quantity": 5, "validity": "DAY", "order_type": "SL", "price": 1500.00, "trigger_price": 1495.00 }`
- **Then**: Response indicates SL order placed; both price and trigger_price sent to API
- **Priority**: P1

### SC-214: Place stop-loss market order (SLM) with trigger price
- **Given**: Server is authenticated; API returns success
- **When**: Client calls `paytm_place_order` with `{ "txn_type": "S", "exchange": "BSE", "segment": "E", "product": "C", "security_id": "12345", "quantity": 20, "validity": "DAY", "order_type": "SLM", "trigger_price": 800.00 }`
- **Then**: Response indicates SLM order placed; trigger_price sent, no price required
- **Priority**: P1

### SC-215: Place IOC validity order
- **Given**: Server is authenticated; API returns success
- **When**: Client calls `paytm_place_order` with `{ "txn_type": "B", "exchange": "NSE", "segment": "E", "product": "I", "security_id": "14366", "quantity": 100, "validity": "IOC", "order_type": "MKT" }`
- **Then**: Response indicates order placed with IOC validity
- **Priority**: P1

### SC-216: Default source is "N" when not provided
- **Given**: Server is authenticated; API returns success
- **When**: Client calls `paytm_place_order` without `source` field
- **Then**: API request body includes `source: "N"` (default); order placed successfully
- **Priority**: P2

### Order Type Routing

### SC-220: Regular order routes to /orders/v1/place/regular (product C)
- **Given**: Server is authenticated; API returns success
- **When**: Client calls `paytm_place_order` with `product: "C"` (CNC)
- **Then**: Server POSTs to `https://developer.paytmmoney.com/orders/v1/place/regular`
- **Priority**: P0

### SC-221: Regular order routes to /orders/v1/place/regular (product I)
- **Given**: Server is authenticated; API returns success
- **When**: Client calls `paytm_place_order` with `product: "I"` (MIS/intraday)
- **Then**: Server POSTs to `/orders/v1/place/regular`
- **Priority**: P0

### SC-222: Cover order routes to /orders/v1/place/cover
- **Given**: Server is authenticated; API returns success with cover order details
- **When**: Client calls `paytm_place_order` with `{ "product": "V", "sl_price": 1480.00, ... }` (other required fields)
- **Then**: Server POSTs to `/orders/v1/place/cover`; `sl_price` included in body
- **Priority**: P0

### SC-223: Bracket order routes to /orders/v1/place/bracket
- **Given**: Server is authenticated; API returns success with bracket order details
- **When**: Client calls `paytm_place_order` with `{ "product": "B", "sl_price": 1480.00, "tp_price": 1550.00, ... }` (other required fields)
- **Then**: Server POSTs to `/orders/v1/place/bracket`; both `sl_price` and `tp_price` included
- **Priority**: P0

### SC-224: BSE exchange is sent correctly
- **Given**: Server is authenticated; API returns success
- **When**: Client calls `paytm_place_order` with `exchange: "BSE"`
- **Then**: API request body includes `exchange: "BSE"`; order placed on BSE
- **Priority**: P1

### Auth Header & Token

### SC-230: Place order sends access_token in x-jwt-token header
- **Given**: Server has `access_token = "at-write-123"` stored
- **When**: Client calls `paytm_place_order` with valid params
- **Then**: HTTP request includes header `x-jwt-token: at-write-123` (NOT read_access_token, NOT public_access_token)
- **Priority**: P0

### SC-231: Place order fails when only read_access_token is set
- **Given**: Server has `read_access_token` set but NOT `access_token` (e.g., manual tokens with only read token)
- **When**: Client calls `paytm_place_order`
- **Then**: Response has `isError: true` with message indicating `access_token` is required for write operations; instructs to set `access_token` via `paytm_set_tokens`
- **Priority**: P0

### SC-232: Place order fails when no tokens set
- **Given**: No tokens set
- **When**: Client calls `paytm_place_order`
- **Then**: Response has `isError: true` with auth error instructing to login
- **Priority**: P0

### SC-233: Place order fails when token expired
- **Given**: Tokens expired (past 15:30 IST)
- **When**: Client calls `paytm_place_order`
- **Then**: Response has `isError: true` with expiry message
- **Priority**: P0

### Validation — Required Fields

### SC-240: Missing txn_type rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_place_order` with all fields EXCEPT `txn_type`
- **Then**: Response has `isError: true` with Zod validation error indicating `txn_type` is required
- **Priority**: P0

### SC-241: Missing exchange rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_place_order` without `exchange`
- **Then**: Response has `isError: true` with validation error for `exchange`
- **Priority**: P0

### SC-242: Missing security_id rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_place_order` without `security_id`
- **Then**: Response has `isError: true` with validation error for `security_id`
- **Priority**: P0

### SC-243: Missing quantity rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_place_order` without `quantity`
- **Then**: Response has `isError: true` with validation error for `quantity`
- **Priority**: P0

### SC-244: Missing order_type rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_place_order` without `order_type`
- **Then**: Response has `isError: true` with validation error for `order_type`
- **Priority**: P0

### Validation — Invalid Enum Values

### SC-245: Invalid txn_type rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_place_order` with `txn_type: "X"`
- **Then**: Response has `isError: true` with validation error indicating valid values are "B" or "S"
- **Priority**: P0

### SC-246: Invalid exchange rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_place_order` with `exchange: "MCX"`
- **Then**: Response has `isError: true` with validation error indicating valid values are "NSE" or "BSE"
- **Priority**: P1

### SC-247: Invalid product rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_place_order` with `product: "Z"`
- **Then**: Response has `isError: true` with validation error indicating valid values are "C", "I", "V", "B"
- **Priority**: P1

### SC-248: Invalid order_type rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_place_order` with `order_type: "FOK"`
- **Then**: Response has `isError: true` with validation error indicating valid values are "LMT", "MKT", "SL", "SLM"
- **Priority**: P1

### SC-249: Invalid validity rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_place_order` with `validity: "GTC"`
- **Then**: Response has `isError: true` with validation error indicating valid values are "DAY" or "IOC"
- **Priority**: P1

### Validation — Boundary Cases

### SC-250: Quantity zero rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_place_order` with `quantity: 0`
- **Then**: Response has `isError: true` with validation error indicating quantity must be > 0
- **Priority**: P0

### SC-251: Negative quantity rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_place_order` with `quantity: -5`
- **Then**: Response has `isError: true` with validation error indicating quantity must be > 0
- **Priority**: P0

### SC-252: Negative price rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_place_order` with `order_type: "LMT", price: -100`
- **Then**: Response has `isError: true` with validation error indicating price must be > 0
- **Priority**: P1

### SC-253: LMT order without price rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_place_order` with `order_type: "LMT"` but no `price` field
- **Then**: Response has `isError: true` with validation error indicating price is required for LMT orders
- **Priority**: P0

### SC-254: SL order without trigger_price rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_place_order` with `order_type: "SL"` but no `trigger_price`
- **Then**: Response has `isError: true` with validation error indicating trigger_price is required for SL orders
- **Priority**: P0

### SC-255: SLM order without trigger_price rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_place_order` with `order_type: "SLM"` but no `trigger_price`
- **Then**: Response has `isError: true` with validation error indicating trigger_price is required for SLM orders
- **Priority**: P0

### SC-256: MKT order ignores price field
- **Given**: Server is authenticated; API returns success
- **When**: Client calls `paytm_place_order` with `order_type: "MKT"` and `price: 1500`
- **Then**: Order placed successfully; price field is either ignored or passed through (does not cause validation error)
- **Priority**: P2

### SC-257: Fractional quantity rejected (if enforced)
- **Given**: Server is authenticated
- **When**: Client calls `paytm_place_order` with `quantity: 1.5`
- **Then**: Response has `isError: true` with validation error indicating quantity must be a whole number
- **Priority**: P2

### API Errors

### SC-260: Place order — API returns 401 unauthorized
- **Given**: Server has `access_token` set; Paytm API returns 401
- **When**: Client calls `paytm_place_order`
- **Then**: Response has `isError: true` with auth error message
- **Priority**: P1

### SC-261: Place order — API returns 400 with rejection reason
- **Given**: Server is authenticated; API returns 400 `{ "message": "Insufficient funds" }`
- **When**: Client calls `paytm_place_order` with valid params
- **Then**: Response has `isError: true` with message containing "Insufficient funds"
- **Priority**: P1

### SC-262: Place order — API returns 500, retries once, then succeeds
- **Given**: Server is authenticated; API returns 500 first, then 200 with order details
- **When**: Client calls `paytm_place_order`
- **Then**: Response contains order details (retry succeeded)
- **Priority**: P1

### SC-263: Place order — API returns 500 twice (retry exhausted)
- **Given**: Server is authenticated; API returns 500 on both attempts
- **When**: Client calls `paytm_place_order`
- **Then**: Response has `isError: true` with server error
- **Priority**: P1

### SC-264: Place order — API returns 429 rate limit
- **Given**: Server is authenticated; API returns 429 with `Retry-After: 2`
- **When**: Client calls `paytm_place_order`
- **Then**: Server waits per Retry-After and retries; result depends on retry outcome
- **Priority**: P1

### SC-265: Place order — network timeout
- **Given**: Server is authenticated; API does not respond within timeout
- **When**: Client calls `paytm_place_order`
- **Then**: Response has `isError: true` with timeout message
- **Priority**: P1

### SC-266: Place order — API returns rejection for market closed
- **Given**: Server is authenticated; API returns 400 `{ "message": "Market is closed" }`
- **When**: Client calls `paytm_place_order` outside trading hours
- **Then**: Response has `isError: true` with "Market is closed" message
- **Priority**: P1

---

## Scenario Group: Tool 9 — paytm_modify_order

### Happy Path

### SC-270: Modify order — happy path (change quantity)
- **Given**: Server is authenticated with `access_token`; Paytm modify order API returns success; existing order ORD-001 is pending
- **When**: Client calls `paytm_modify_order` with `{ "order_no": "ORD-001", "txn_type": "B", "exchange": "NSE", "segment": "E", "product": "C", "security_id": "14366", "quantity": 20, "validity": "DAY", "order_type": "LMT", "price": 1500.00, "serial_no": 1 }`
- **Then**: Response indicates order modified; `isError` is false
- **Priority**: P0

### SC-271: Modify order — change price
- **Given**: Server is authenticated; API returns success
- **When**: Client calls `paytm_modify_order` with new `price: 1510.00` and same order_no
- **Then**: Response indicates price modified successfully
- **Priority**: P0

### SC-272: Modify order — change order type from LMT to MKT
- **Given**: Server is authenticated; API returns success
- **When**: Client calls `paytm_modify_order` with `order_type: "MKT"` for an existing LMT order
- **Then**: Response indicates order type changed
- **Priority**: P1

### Routing

### SC-273: Modify regular order routes to /orders/v1/modify/regular
- **Given**: Server is authenticated; API returns success
- **When**: Client calls `paytm_modify_order` with `product: "C"`
- **Then**: Server POSTs to `/orders/v1/modify/regular`
- **Priority**: P0

### SC-274: Modify cover order routes to /orders/v1/modify/cover
- **Given**: Server is authenticated; API returns success
- **When**: Client calls `paytm_modify_order` with `product: "V"`
- **Then**: Server POSTs to `/orders/v1/modify/cover`
- **Priority**: P1

### SC-275: Modify bracket order routes to /orders/v1/modify/bracket
- **Given**: Server is authenticated; API returns success
- **When**: Client calls `paytm_modify_order` with `product: "B"` and `group_id: 1`
- **Then**: Server POSTs to `/orders/v1/modify/bracket`; `group_id` included in body
- **Priority**: P1

### Auth & Validation

### SC-276: Modify order uses access_token in header
- **Given**: Server has `access_token = "at-write-456"` stored
- **When**: Client calls `paytm_modify_order`
- **Then**: HTTP request includes header `x-jwt-token: at-write-456`
- **Priority**: P0

### SC-277: Modify order fails without access_token
- **Given**: Only `read_access_token` set (no `access_token`)
- **When**: Client calls `paytm_modify_order`
- **Then**: Response has `isError: true` indicating `access_token` required for write operations
- **Priority**: P0

### SC-278: Modify order fails when not authenticated
- **Given**: No tokens set
- **When**: Client calls `paytm_modify_order`
- **Then**: Response has `isError: true` with auth error
- **Priority**: P0

### SC-279: Modify order fails when token expired
- **Given**: Tokens expired
- **When**: Client calls `paytm_modify_order`
- **Then**: Response has `isError: true` with expiry message
- **Priority**: P0

### SC-280: Missing order_no rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_modify_order` without `order_no`
- **Then**: Response has `isError: true` with validation error for `order_no`
- **Priority**: P0

### SC-281: Missing serial_no rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_modify_order` without `serial_no`
- **Then**: Response has `isError: true` with validation error for `serial_no`
- **Priority**: P0

### SC-282: Modify order has destructiveHint annotation
- **Given**: Server is started
- **When**: Client sends `tools/list`
- **Then**: `paytm_modify_order` has `annotations.destructiveHint: true`
- **Priority**: P0

### API Errors

### SC-283: Modify order — API returns 400 "Order not found"
- **Given**: Server is authenticated; API returns 400 `{ "message": "Order not found" }`
- **When**: Client calls `paytm_modify_order` with invalid `order_no: "FAKE-999"`
- **Then**: Response has `isError: true` with "Order not found" message
- **Priority**: P1

### SC-284: Modify order — API returns 400 "Order already executed"
- **Given**: Server is authenticated; API returns 400 `{ "message": "Cannot modify executed order" }`
- **When**: Client calls `paytm_modify_order` for an already-filled order
- **Then**: Response has `isError: true` with the API error message
- **Priority**: P1

### SC-285: Modify order — API 500 with retry
- **Given**: Server is authenticated; API returns 500 first, then success on retry
- **When**: Client calls `paytm_modify_order`
- **Then**: Response indicates order modified (retry succeeded)
- **Priority**: P1

### SC-286: Modify order — API 429 rate limit
- **Given**: Server is authenticated; API returns 429
- **When**: Client calls `paytm_modify_order`
- **Then**: Server waits and retries per Retry-After header
- **Priority**: P1

---

## Scenario Group: Tool 10 — paytm_cancel_order

### Happy Path

### SC-290: Cancel regular order — happy path
- **Given**: Server is authenticated with `access_token`; pending order ORD-001 exists; Paytm cancel API returns success
- **When**: Client calls `paytm_cancel_order` with `{ "order_no": "ORD-001", "serial_no": 1, "product": "C" }`
- **Then**: Response indicates order cancelled; `isError` is false
- **Priority**: P0

### SC-291: Cancel MIS order
- **Given**: Server is authenticated; pending MIS order exists; API returns success
- **When**: Client calls `paytm_cancel_order` with `{ "order_no": "ORD-002", "serial_no": 1, "product": "I" }`
- **Then**: Response indicates order cancelled
- **Priority**: P1

### Routing

### SC-292: Cancel regular order routes to /orders/v1/cancel/regular
- **Given**: Server is authenticated; API returns success
- **When**: Client calls `paytm_cancel_order` with `product: "C"`
- **Then**: Server POSTs to `/orders/v1/cancel/regular`
- **Priority**: P0

### SC-293: Cancel cover order routes to /orders/v1/cancel/cover
- **Given**: Server is authenticated; API returns success
- **When**: Client calls `paytm_cancel_order` with `product: "V"`
- **Then**: Server POSTs to `/orders/v1/cancel/cover`
- **Priority**: P1

### SC-294: Cancel bracket order routes to /orders/v1/cancel/bracket
- **Given**: Server is authenticated; API returns success
- **When**: Client calls `paytm_cancel_order` with `product: "B"` and `group_id: 1`
- **Then**: Server POSTs to `/orders/v1/cancel/bracket`; `group_id` included
- **Priority**: P1

### Auth & Validation

### SC-295: Cancel order uses access_token in header
- **Given**: Server has `access_token = "at-write-789"` stored
- **When**: Client calls `paytm_cancel_order`
- **Then**: HTTP request includes header `x-jwt-token: at-write-789`
- **Priority**: P0

### SC-296: Cancel order fails without access_token
- **Given**: Only `read_access_token` set
- **When**: Client calls `paytm_cancel_order`
- **Then**: Response has `isError: true` indicating `access_token` required
- **Priority**: P0

### SC-297: Cancel order fails when not authenticated
- **Given**: No tokens set
- **When**: Client calls `paytm_cancel_order`
- **Then**: Response has `isError: true` with auth error
- **Priority**: P0

### SC-298: Cancel order fails when token expired
- **Given**: Tokens expired
- **When**: Client calls `paytm_cancel_order`
- **Then**: Response has `isError: true` with expiry message
- **Priority**: P0

### SC-299: Missing order_no rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_cancel_order` without `order_no`
- **Then**: Response has `isError: true` with validation error
- **Priority**: P0

### SC-300: Missing serial_no rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_cancel_order` without `serial_no`
- **Then**: Response has `isError: true` with validation error
- **Priority**: P0

### SC-301: Missing product rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_cancel_order` without `product`
- **Then**: Response has `isError: true` with validation error
- **Priority**: P0

### SC-302: Cancel order has destructiveHint annotation
- **Given**: Server is started
- **When**: Client sends `tools/list`
- **Then**: `paytm_cancel_order` has `annotations.destructiveHint: true`
- **Priority**: P0

### API Errors

### SC-303: Cancel order — already cancelled
- **Given**: Server is authenticated; API returns 400 `{ "message": "Order already cancelled" }`
- **When**: Client calls `paytm_cancel_order` for an already-cancelled order
- **Then**: Response has `isError: true` with "Order already cancelled" message
- **Priority**: P1

### SC-304: Cancel order — already executed
- **Given**: Server is authenticated; API returns 400 `{ "message": "Cannot cancel executed order" }`
- **When**: Client calls `paytm_cancel_order` for an already-filled order
- **Then**: Response has `isError: true` with the API error message
- **Priority**: P1

### SC-305: Cancel order — order not found
- **Given**: Server is authenticated; API returns 400 `{ "message": "Order not found" }`
- **When**: Client calls `paytm_cancel_order` with invalid `order_no`
- **Then**: Response has `isError: true` with "Order not found" message
- **Priority**: P1

### SC-306: Cancel order — API 500 with retry
- **Given**: Server is authenticated; API returns 500 first, then success
- **When**: Client calls `paytm_cancel_order`
- **Then**: Response indicates cancellation succeeded (retry worked)
- **Priority**: P1

### SC-307: Cancel order — network error
- **Given**: Server is authenticated; API unreachable
- **When**: Client calls `paytm_cancel_order`
- **Then**: Response has `isError: true` with friendly error
- **Priority**: P1

---

## Scenario Group: Tool 11 — paytm_get_live_price

### Happy Path

### SC-310: Get live price — LTP mode single instrument
- **Given**: Server is authenticated with `public_access_token`; Paytm live price API returns `{ "data": [{ "security_id": "14366", "last_price": 1520.50 }] }`
- **When**: Client calls `paytm_get_live_price` with `{ "mode": "LTP", "pref": [{ "exchange": "NSE", "mode": "LTP", "security_id": "14366" }] }`
- **Then**: Response contains LTP data; `isError` is false
- **Priority**: P0

### SC-311: Get live price — FULL mode
- **Given**: Server is authenticated; API returns full quote with open, high, low, close, volume, bid/ask
- **When**: Client calls `paytm_get_live_price` with `mode: "FULL"` and single instrument
- **Then**: Response contains full quote data including OHLCV
- **Priority**: P0

### SC-312: Get live price — QUOTE mode
- **Given**: Server is authenticated; API returns partial quote
- **When**: Client calls `paytm_get_live_price` with `mode: "QUOTE"`
- **Then**: Response contains quote-level data
- **Priority**: P1

### SC-313: Get live price — multiple instruments
- **Given**: Server is authenticated; API returns prices for 3 instruments
- **When**: Client calls `paytm_get_live_price` with `pref` containing 3 instruments (mix of NSE and BSE)
- **Then**: Response contains price data for all 3 instruments
- **Priority**: P0

### Auth & Token

### SC-314: Get live price uses public_access_token in header
- **Given**: Server has `public_access_token = "pat-public-123"` stored
- **When**: Client calls `paytm_get_live_price`
- **Then**: HTTP request includes header `x-jwt-token: pat-public-123` (NOT access_token, NOT read_access_token)
- **Priority**: P0

### SC-315: Get live price fails without public_access_token
- **Given**: Server has `access_token` and `read_access_token` set but NOT `public_access_token`
- **When**: Client calls `paytm_get_live_price`
- **Then**: Response has `isError: true` indicating `public_access_token` is required
- **Priority**: P0

### SC-316: Get live price fails when not authenticated
- **Given**: No tokens set
- **When**: Client calls `paytm_get_live_price`
- **Then**: Response has `isError: true` with auth error
- **Priority**: P0

### SC-317: Get live price fails when token expired
- **Given**: Tokens expired
- **When**: Client calls `paytm_get_live_price`
- **Then**: Response has `isError: true` with expiry message
- **Priority**: P0

### Validation

### SC-318: Missing mode rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_get_live_price` without `mode`
- **Then**: Response has `isError: true` with validation error
- **Priority**: P0

### SC-319: Invalid mode rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_get_live_price` with `mode: "INVALID"`
- **Then**: Response has `isError: true` indicating valid values are "LTP", "FULL", "QUOTE"
- **Priority**: P1

### SC-320: Missing pref rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_get_live_price` without `pref`
- **Then**: Response has `isError: true` with validation error
- **Priority**: P0

### SC-321: Empty pref array rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_get_live_price` with `pref: []`
- **Then**: Response has `isError: true` indicating at least one instrument is required
- **Priority**: P1

### SC-322: Invalid exchange in pref rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_get_live_price` with `pref: [{ "exchange": "MCX", "mode": "LTP", "security_id": "123" }]`
- **Then**: Response has `isError: true` with validation error for exchange
- **Priority**: P1

### API Errors

### SC-323: Get live price — API 401
- **Given**: Server authenticated; API returns 401
- **When**: Client calls `paytm_get_live_price`
- **Then**: Response has `isError: true` with auth error
- **Priority**: P1

### SC-324: Get live price — API 500 with retry
- **Given**: Server authenticated; API returns 500 first, then 200
- **When**: Client calls `paytm_get_live_price`
- **Then**: Response contains price data (retry succeeded)
- **Priority**: P1

### SC-325: Get live price — API 429 rate limit
- **Given**: Server authenticated; API returns 429
- **When**: Client calls `paytm_get_live_price`
- **Then**: Server waits and retries per Retry-After
- **Priority**: P1

### SC-326: Get live price has readOnlyHint annotation
- **Given**: Server is started
- **When**: Client sends `tools/list`
- **Then**: `paytm_get_live_price` has `annotations.readOnlyHint: true`
- **Priority**: P1

---

## Scenario Group: Tool 12 — paytm_search_instruments

### Happy Path

### SC-330: Search instruments — by symbol (happy path)
- **Given**: Server is authenticated with `public_access_token`; security master returns matching instruments
- **When**: Client calls `paytm_search_instruments` with `{ "query": "INFY" }`
- **Then**: Response contains matching instruments with security_id, symbol, name, exchange; `isError` is false
- **Priority**: P0

### SC-331: Search instruments — by company name
- **Given**: Server is authenticated; security master returns matches
- **When**: Client calls `paytm_search_instruments` with `{ "query": "Infosys" }`
- **Then**: Response contains instruments matching "Infosys"
- **Priority**: P0

### SC-332: Search instruments — with exchange filter NSE
- **Given**: Server is authenticated; security master returns matches
- **When**: Client calls `paytm_search_instruments` with `{ "query": "RELIANCE", "exchange": "NSE" }`
- **Then**: Response contains only NSE instruments matching "RELIANCE"
- **Priority**: P1

### SC-333: Search instruments — with exchange filter BSE
- **Given**: Server is authenticated; security master returns matches
- **When**: Client calls `paytm_search_instruments` with `{ "query": "TCS", "exchange": "BSE" }`
- **Then**: Response contains only BSE instruments matching "TCS"
- **Priority**: P1

### SC-334: Search instruments — empty results
- **Given**: Server is authenticated; no instruments match query
- **When**: Client calls `paytm_search_instruments` with `{ "query": "ZZZZNONEXISTENT" }`
- **Then**: Response indicates no matching instruments found (not an error, just empty)
- **Priority**: P1

### SC-335: Search instruments — case insensitive
- **Given**: Server is authenticated
- **When**: Client calls `paytm_search_instruments` with `{ "query": "infy" }` (lowercase)
- **Then**: Response contains matches for "INFY" (case-insensitive search)
- **Priority**: P2

### Auth & Token

### SC-336: Search instruments uses public_access_token
- **Given**: Server has `public_access_token = "pat-search-456"` stored
- **When**: Client calls `paytm_search_instruments`
- **Then**: HTTP request uses `public_access_token` for auth
- **Priority**: P0

### SC-337: Search instruments fails without public_access_token
- **Given**: No `public_access_token` set
- **When**: Client calls `paytm_search_instruments`
- **Then**: Response has `isError: true` indicating `public_access_token` is required
- **Priority**: P0

### SC-338: Search instruments fails when not authenticated
- **Given**: No tokens set
- **When**: Client calls `paytm_search_instruments`
- **Then**: Response has `isError: true` with auth error
- **Priority**: P0

### SC-339: Search instruments fails when token expired
- **Given**: Tokens expired
- **When**: Client calls `paytm_search_instruments`
- **Then**: Response has `isError: true` with expiry message
- **Priority**: P0

### Validation

### SC-340: Missing query rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_search_instruments` without `query`
- **Then**: Response has `isError: true` with validation error
- **Priority**: P0

### SC-341: Empty query string rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_search_instruments` with `{ "query": "" }`
- **Then**: Response has `isError: true` with validation error (empty string not valid)
- **Priority**: P1

### SC-342: Invalid exchange filter rejected
- **Given**: Server is authenticated
- **When**: Client calls `paytm_search_instruments` with `{ "query": "INFY", "exchange": "MCX" }`
- **Then**: Response has `isError: true` indicating valid exchange values are "NSE" or "BSE"
- **Priority**: P1

### SC-343: Search instruments has readOnlyHint annotation
- **Given**: Server is started
- **When**: Client sends `tools/list`
- **Then**: `paytm_search_instruments` has `annotations.readOnlyHint: true`
- **Priority**: P1

### API Errors

### SC-344: Search instruments — API error
- **Given**: Server authenticated; API returns 500
- **When**: Client calls `paytm_search_instruments`
- **Then**: Response has `isError: true` after retry
- **Priority**: P1

---

## Scenario Group: PaytmClient — Phase 2 Methods

### SC-345: placeOrder sends POST with correct body and auth header
- **Given**: PaytmClient instance created
- **When**: `placeOrder(accessToken, params)` is called with valid order params
- **Then**: HTTP POST sent to correct endpoint; body contains all order fields; header `x-jwt-token` set to accessToken
- **Priority**: P0

### SC-346: modifyOrder sends POST with correct body
- **Given**: PaytmClient instance
- **When**: `modifyOrder(accessToken, params)` is called
- **Then**: HTTP POST sent to correct modify endpoint; body includes `order_no` and `serial_no`
- **Priority**: P0

### SC-347: cancelOrder sends POST with correct body
- **Given**: PaytmClient instance
- **When**: `cancelOrder(accessToken, params)` is called
- **Then**: HTTP POST sent to correct cancel endpoint; body includes `order_no`, `serial_no`, `product`
- **Priority**: P0

### SC-348: getLivePrice sends GET with correct query params and public token
- **Given**: PaytmClient instance
- **When**: `getLivePrice(publicAccessToken, mode, pref)` is called
- **Then**: HTTP GET sent to `/data/v1/price/live`; header `x-jwt-token` set to publicAccessToken
- **Priority**: P0

### SC-349: getSecurityMaster sends GET with public token
- **Given**: PaytmClient instance
- **When**: `getSecurityMaster(publicAccessToken)` is called
- **Then**: HTTP GET sent to `/data/v1/scrips/get-security-master`; header `x-jwt-token` set to publicAccessToken
- **Priority**: P0

### SC-350: Phase 2 client methods retry on 5xx
- **Given**: API returns 500 on first call, 200 on second
- **When**: Any Phase 2 client method is called
- **Then**: Method retries after delay and returns success
- **Priority**: P1

### SC-351: Phase 2 client methods handle 429 with Retry-After
- **Given**: API returns 429 with `Retry-After: 2`
- **When**: Any Phase 2 client method is called
- **Then**: Method waits 2 seconds and retries
- **Priority**: P1

---

## Scenario Group: Security — Phase 2

### SC-352: Write tools use access_token, never read_access_token
- **Given**: Server has all 3 tokens set
- **When**: `paytm_place_order`, `paytm_modify_order`, or `paytm_cancel_order` is called
- **Then**: HTTP request uses `access_token` in header; never uses `read_access_token` or `public_access_token`
- **Priority**: P0

### SC-353: Read tools use appropriate tokens
- **Given**: Server has all 3 tokens set
- **When**: `paytm_get_live_price` or `paytm_search_instruments` is called
- **Then**: HTTP request uses `public_access_token`; never uses `access_token`
- **Priority**: P0

### SC-354: API keys not exposed in Phase 2 tool responses
- **Given**: Server running with env vars; Phase 2 tools called
- **When**: Any Phase 2 tool returns success or error
- **Then**: Response content never contains `PAYTM_API_KEY` or `PAYTM_API_SECRET` values
- **Priority**: P0

### SC-355: Tokens not logged in Phase 2 tool responses
- **Given**: Tokens are set; Phase 2 tools called
- **When**: Any Phase 2 tool responds
- **Then**: Response content does not contain raw token values
- **Priority**: P0

### SC-356: Write tools blocked by destructiveHint in cautious clients
- **Given**: MCP client with destructive operation confirmation enabled
- **When**: `paytm_place_order` is called
- **Then**: Client-side confirmation is triggered due to `destructiveHint: true` annotation (client-dependent; server correctly sets the annotation)
- **Priority**: P1

---

## Scenario Group: End-to-End — Phase 2 Flows

### SC-357: Full trade flow — login → set_tokens → search → get_price → place_order → get_order_book
- **Given**: Server is running; all Paytm APIs stubbed
- **When**: Client calls `paytm_login` → `paytm_set_tokens` (with request_token, gets all 3 tokens) → `paytm_search_instruments` (find INFY) → `paytm_get_live_price` (get LTP) → `paytm_place_order` (buy INFY) → `paytm_get_order_book` (verify order)
- **Then**: Each step succeeds; order appears in order book; correct tokens used at each step (public for search/price, access for order)
- **Priority**: P0

### SC-358: Modify and cancel flow — place_order → modify_order → cancel_order → get_order_book
- **Given**: Server is authenticated with all tokens; APIs stubbed
- **When**: Client calls `paytm_place_order` (gets ORD-001) → `paytm_modify_order` (change price on ORD-001) → `paytm_cancel_order` (cancel ORD-001) → `paytm_get_order_book`
- **Then**: Order placed, modified, then cancelled; final order book reflects cancellation
- **Priority**: P0

---

## Phase 2 Summary

| Priority | Count | Description |
|----------|-------|-------------|
| P0       | 52    | Must pass — tool registration, happy paths, auth token routing, validation, security, E2E |
| P1       | 43    | Should pass — error handling, retries, routing variants, edge cases, rate limits |
| P2       | 5     | Nice to have — defaults, case sensitivity, fractional qty, ignored fields |
| **Total** | **100** | |

### New Test Infrastructure (Phase 2)

| Component | Strategy | Notes |
|-----------|----------|-------|
| Paytm Order APIs | HTTP interceptor (nock or msw) | Intercept POST to `/orders/v1/place/*`, `/orders/v1/modify/*`, `/orders/v1/cancel/*` |
| Paytm Market Data API | HTTP interceptor | Intercept GET to `/data/v1/price/live`, `/data/v1/scrips/get-security-master` |
| MCP Transport | Same as Phase 1 (in-process stdio) | Reuse existing test harness |
| Token types | Verify correct token in `x-jwt-token` | access_token for writes, public_access_token for market data |

### Phase 2 Test File Structure (Recommended)

```
tests/
├── ... (Phase 1 files unchanged)
├── tools/
│   ├── ... (Phase 1 tool tests unchanged)
│   ├── place-order.test.ts       # SC-210 to SC-266
│   ├── modify-order.test.ts      # SC-270 to SC-286
│   ├── cancel-order.test.ts      # SC-290 to SC-307
│   ├── live-price.test.ts        # SC-310 to SC-326
│   └── search-instruments.test.ts # SC-330 to SC-344
├── client/
│   └── pm-client.test.ts         # Extend with SC-345 to SC-351
├── security.test.ts              # Extend with SC-352 to SC-356
├── server.test.ts                # Extend with SC-200 to SC-205
└── e2e.test.ts                   # Extend with SC-357 to SC-358
```

---
---

# Paytm Money MCP Server — Phase 3 Test Scenarios

| Field                  | Value                                      |
|------------------------|--------------------------------------------|
| **Status**             | Approved for implementation                |
| **Approved By**        | QA                                         |
| **Implementation Ready** | Yes                                      |
| **Phase**              | Phase 3 — GTT Orders, Option Chain & Charges (7 Tools) |
| **Scenario IDs**       | SC-400 through SC-530                      |
| **Test Philosophy**    | Social tests, real HTTP via nock/interceptors, no mocks of business logic |
| **Traces From**        | Phase 3 spec (user-provided); Phase 1 scenarios SC-001–SC-153; Phase 2 scenarios SC-200–SC-358 |

---

## Scenario Group: Server — Phase 3 Registration

### SC-400: Server registers 19 tools after Phase 3
- **Given**: `PAYTM_API_KEY` and `PAYTM_API_SECRET` are set; no `PAYTM_EXCLUDED_TOOLS`
- **When**: Server starts and client sends `tools/list`
- **Then**: Response contains exactly 19 tools — the 12 from Phase 1+2 plus `paytm_create_gtt`, `paytm_get_gtt`, `paytm_update_gtt`, `paytm_delete_gtt`, `paytm_get_gtt_aggregate`, `paytm_get_option_chain`, `paytm_get_charges`
- **Priority**: P0

### SC-401: Phase 3 GTT write tools have destructiveHint annotation
- **Given**: Server is started
- **When**: Client sends `tools/list`
- **Then**: `paytm_create_gtt`, `paytm_update_gtt`, `paytm_delete_gtt` each have `annotations.destructiveHint: true`
- **Priority**: P0

### SC-402: Phase 3 read tools have readOnlyHint annotation
- **Given**: Server is started
- **When**: Client sends `tools/list`
- **Then**: `paytm_get_gtt`, `paytm_get_gtt_aggregate`, `paytm_get_option_chain`, `paytm_get_charges` each have `annotations.readOnlyHint: true`
- **Priority**: P1

### SC-403: Excluding a Phase 3 tool via PAYTM_EXCLUDED_TOOLS
- **Given**: `PAYTM_EXCLUDED_TOOLS=paytm_create_gtt` is set
- **When**: Server starts and client sends `tools/list`
- **Then**: Response contains 18 tools; `paytm_create_gtt` is absent; all other tools present
- **Priority**: P1

### SC-404: Excluding multiple Phase 3 tools
- **Given**: `PAYTM_EXCLUDED_TOOLS=paytm_create_gtt,paytm_update_gtt,paytm_delete_gtt` is set
- **When**: Server starts and client sends `tools/list`
- **Then**: Response contains 16 tools; all 3 GTT write tools are absent; read tools remain
- **Priority**: P1

### SC-405: Calling an excluded Phase 3 tool returns error
- **Given**: `PAYTM_EXCLUDED_TOOLS=paytm_create_gtt` and server is started
- **When**: Client sends `tools/call` for `paytm_create_gtt`
- **Then**: Response has `isError: true` with a message indicating the tool is not available
- **Priority**: P1

---

## Scenario Group: Tool 13 — paytm_create_gtt

### Happy Path

### SC-410: Create SINGLE GTT limit buy order (happy path)
- **Given**: Server is authenticated with `access_token` set; Paytm GTT create API (`POST /orders/v1/gtt/create`) returns `{ "id": 1001, "status": "NEW_ACTIVE" }`
- **When**: Client calls `paytm_create_gtt` with `{ "segment": "E", "exchange": "NSE", "security_id": "14366", "product_type": "C", "set_price": 1400.00, "transaction_type": "B", "order_type": "LMT", "quantity": 10, "price": 1400.00, "trigger_type": "SINGLE" }`
- **Then**: Response contains GTT order ID and status; `isError` is false
- **Priority**: P0

### SC-411: Create SINGLE GTT market sell order
- **Given**: Server is authenticated with `access_token`; API returns `{ "id": 1002, "status": "NEW_ACTIVE" }`
- **When**: Client calls `paytm_create_gtt` with `{ "segment": "E", "exchange": "NSE", "security_id": "14366", "product_type": "C", "set_price": 1600.00, "transaction_type": "S", "order_type": "MKT", "quantity": 10, "trigger_type": "SINGLE" }`
- **Then**: Response contains GTT ID and status; no `price` required for MKT
- **Priority**: P0

### SC-412: Create TWO_LEG GTT order (happy path)
- **Given**: Server is authenticated with `access_token`; API returns `{ "id": 1003, "status": "NEW_ACTIVE" }`
- **When**: Client calls `paytm_create_gtt` with `{ "segment": "E", "exchange": "BSE", "security_id": "12345", "product_type": "C", "set_price": 1400.00, "transaction_type": "B", "order_type": "LMT", "quantity": 10, "price": 1400.00, "trigger_type": "TWO_LEG", "secondary_set_price": 1600.00, "secondary_transaction_type": "S", "secondary_order_type": "LMT", "secondary_quantity": 10, "secondary_price": 1600.00 }`
- **Then**: Response contains GTT ID and status; both primary and secondary leg params sent to API
- **Priority**: P0

### SC-413: Create SINGLE GTT on BSE exchange
- **Given**: Server is authenticated with `access_token`; API returns success
- **When**: Client calls `paytm_create_gtt` with `exchange: "BSE"`, other valid params
- **Then**: Response indicates GTT created on BSE successfully
- **Priority**: P1

### Authentication & Authorization

### SC-414: Create GTT requires access_token
- **Given**: Server is authenticated; tokens are set
- **When**: Client calls `paytm_create_gtt` with valid params
- **Then**: HTTP request to Paytm API includes `x-jwt-token` header with `access_token` (not public or read token)
- **Priority**: P0

### SC-415: Create GTT fails when not authenticated
- **Given**: Server is running but no tokens set (not authenticated)
- **When**: Client calls `paytm_create_gtt` with valid params
- **Then**: Response has `isError: true` with message "Not authenticated. Call paytm_login..."
- **Priority**: P0

### SC-416: Create GTT fails when session expired
- **Given**: Server is authenticated but token expiry is in the past (past 15:30 IST)
- **When**: Client calls `paytm_create_gtt` with valid params
- **Then**: Response has `isError: true` with message "Session expired..."
- **Priority**: P1

### Validation

### SC-420: Create GTT fails with missing segment
- **Given**: Server is authenticated
- **When**: Client calls `paytm_create_gtt` without `segment`
- **Then**: Response has `isError: true` with Zod validation error mentioning "segment"
- **Priority**: P0

### SC-421: Create GTT fails with missing exchange
- **Given**: Server is authenticated
- **When**: Client calls `paytm_create_gtt` without `exchange`
- **Then**: Response has `isError: true` with Zod validation error mentioning "exchange"
- **Priority**: P0

### SC-422: Create GTT fails with missing security_id
- **Given**: Server is authenticated
- **When**: Client calls `paytm_create_gtt` without `security_id`
- **Then**: Response has `isError: true` with Zod validation error mentioning "security_id"
- **Priority**: P0

### SC-423: Create GTT fails with missing trigger_type
- **Given**: Server is authenticated
- **When**: Client calls `paytm_create_gtt` without `trigger_type`
- **Then**: Response has `isError: true` with Zod validation error mentioning "trigger_type"
- **Priority**: P0

### SC-424: Create GTT fails with invalid exchange value
- **Given**: Server is authenticated
- **When**: Client calls `paytm_create_gtt` with `exchange: "MCX"` (not NSE/BSE)
- **Then**: Response has `isError: true` with Zod validation error for invalid enum value
- **Priority**: P1

### SC-425: Create GTT fails with invalid transaction_type
- **Given**: Server is authenticated
- **When**: Client calls `paytm_create_gtt` with `transaction_type: "X"` (not B/S)
- **Then**: Response has `isError: true` with Zod validation error
- **Priority**: P1

### SC-426: Create GTT fails with invalid order_type
- **Given**: Server is authenticated
- **When**: Client calls `paytm_create_gtt` with `order_type: "IOC"` (not LMT/MKT)
- **Then**: Response has `isError: true` with Zod validation error
- **Priority**: P1

### SC-427: Create GTT fails with invalid trigger_type
- **Given**: Server is authenticated
- **When**: Client calls `paytm_create_gtt` with `trigger_type: "MULTI"` (not SINGLE/TWO_LEG)
- **Then**: Response has `isError: true` with Zod validation error
- **Priority**: P1

### SC-428: Create GTT fails with quantity <= 0
- **Given**: Server is authenticated
- **When**: Client calls `paytm_create_gtt` with `quantity: 0`
- **Then**: Response has `isError: true` with Zod validation error indicating quantity must be positive
- **Priority**: P0

### SC-429: Create GTT fails with negative quantity
- **Given**: Server is authenticated
- **When**: Client calls `paytm_create_gtt` with `quantity: -5`
- **Then**: Response has `isError: true` with Zod validation error
- **Priority**: P1

### SC-430: Create GTT LMT order fails without price
- **Given**: Server is authenticated
- **When**: Client calls `paytm_create_gtt` with `order_type: "LMT"` but no `price` field
- **Then**: Response has `isError: true` with message indicating "price is required for LMT order types"
- **Priority**: P0

### SC-431: Create GTT TWO_LEG fails without secondary_set_price
- **Given**: Server is authenticated
- **When**: Client calls `paytm_create_gtt` with `trigger_type: "TWO_LEG"` but no `secondary_set_price`
- **Then**: Response has `isError: true` with message indicating secondary fields are required for TWO_LEG
- **Priority**: P0

### SC-432: Create GTT TWO_LEG fails without secondary_transaction_type
- **Given**: Server is authenticated
- **When**: Client calls `paytm_create_gtt` with `trigger_type: "TWO_LEG"` but no `secondary_transaction_type`
- **Then**: Response has `isError: true` with validation error for missing secondary fields
- **Priority**: P0

### SC-433: Create GTT TWO_LEG fails without secondary_quantity
- **Given**: Server is authenticated
- **When**: Client calls `paytm_create_gtt` with `trigger_type: "TWO_LEG"` but no `secondary_quantity`
- **Then**: Response has `isError: true` with validation error for missing secondary fields
- **Priority**: P0

### SC-434: Create GTT TWO_LEG LMT fails without secondary_price
- **Given**: Server is authenticated
- **When**: Client calls `paytm_create_gtt` with `trigger_type: "TWO_LEG"`, `secondary_order_type: "LMT"` but no `secondary_price`
- **Then**: Response has `isError: true` with message indicating secondary_price is required for LMT
- **Priority**: P0

### API Errors

### SC-435: Create GTT returns API error (400)
- **Given**: Server is authenticated; Paytm API returns 400 `{ "message": "Invalid security" }`
- **When**: Client calls `paytm_create_gtt` with valid params but invalid security_id
- **Then**: Response has `isError: true` with error message from API
- **Priority**: P1

### SC-436: Create GTT returns API error (500)
- **Given**: Server is authenticated; Paytm API returns 500
- **When**: Client calls `paytm_create_gtt` with valid params
- **Then**: Server retries once; if still 500, response has `isError: true`
- **Priority**: P1

### Annotations

### SC-437: Create GTT has destructiveHint annotation
- **Given**: Server is started
- **When**: Client sends `tools/list`
- **Then**: `paytm_create_gtt` has `annotations.destructiveHint: true`
- **Priority**: P0

---

## Scenario Group: Tool 14 — paytm_get_gtt

### Happy Path

### SC-440: Get GTT order by ID (happy path)
- **Given**: Server is authenticated with `access_token`; Paytm GTT API (`GET /orders/v1/gtt/1001`) returns full GTT details `{ "id": 1001, "status": "NEW_ACTIVE", "security_id": "14366", "set_price": 1400, "quantity": 10, "trigger_type": "SINGLE" }`
- **When**: Client calls `paytm_get_gtt` with `{ "id": 1001 }`
- **Then**: Response contains full GTT order details including trigger price, status, security, quantity; `isError` is false
- **Priority**: P0

### Authentication & Authorization

### SC-441: Get GTT requires access_token
- **Given**: Server is authenticated; tokens are set
- **When**: Client calls `paytm_get_gtt` with `{ "id": 1001 }`
- **Then**: HTTP request includes `x-jwt-token` header with `access_token`
- **Priority**: P0

### SC-442: Get GTT fails when not authenticated
- **Given**: Server is running but no tokens set
- **When**: Client calls `paytm_get_gtt` with `{ "id": 1001 }`
- **Then**: Response has `isError: true` with "Not authenticated..." message
- **Priority**: P0

### SC-443: Get GTT fails when session expired
- **Given**: Server is authenticated but tokens expired
- **When**: Client calls `paytm_get_gtt` with `{ "id": 1001 }`
- **Then**: Response has `isError: true` with "Session expired..." message
- **Priority**: P1

### Validation & Errors

### SC-444: Get GTT with non-existent ID returns 404
- **Given**: Server is authenticated; API returns 404 `{ "message": "GTT order not found" }`
- **When**: Client calls `paytm_get_gtt` with `{ "id": 999999 }`
- **Then**: Response has `isError: true` with error indicating GTT not found
- **Priority**: P0

### SC-445: Get GTT fails with missing id
- **Given**: Server is authenticated
- **When**: Client calls `paytm_get_gtt` with `{}` (no id)
- **Then**: Response has `isError: true` with Zod validation error mentioning "id"
- **Priority**: P0

### SC-446: Get GTT fails with invalid id type
- **Given**: Server is authenticated
- **When**: Client calls `paytm_get_gtt` with `{ "id": "abc" }` (string, not number)
- **Then**: Response has `isError: true` with Zod validation error for type mismatch
- **Priority**: P1

### Annotations

### SC-447: Get GTT has readOnlyHint annotation
- **Given**: Server is started
- **When**: Client sends `tools/list`
- **Then**: `paytm_get_gtt` has `annotations.readOnlyHint: true`
- **Priority**: P1

---

## Scenario Group: Tool 15 — paytm_update_gtt

### Happy Path

### SC-450: Update GTT trigger price (happy path)
- **Given**: Server is authenticated with `access_token`; Paytm GTT update API (`PUT /orders/v1/gtt/update`) returns `{ "id": 1001, "status": "NEW_ACTIVE" }`
- **When**: Client calls `paytm_update_gtt` with `{ "id": 1001, "segment": "E", "exchange": "NSE", "security_id": "14366", "product_type": "C", "set_price": 1350.00, "transaction_type": "B", "order_type": "LMT", "quantity": 10, "price": 1350.00, "trigger_type": "SINGLE" }`
- **Then**: Response contains updated GTT ID and status; `isError` is false
- **Priority**: P0

### SC-451: Update GTT quantity
- **Given**: Server is authenticated; API returns success
- **When**: Client calls `paytm_update_gtt` with `id: 1001` and `quantity: 20` (changed from 10)
- **Then**: Response indicates GTT updated successfully
- **Priority**: P1

### SC-452: Update TWO_LEG GTT with secondary fields
- **Given**: Server is authenticated; API returns success
- **When**: Client calls `paytm_update_gtt` with `id: 1003`, `trigger_type: "TWO_LEG"`, and all secondary fields
- **Then**: Response indicates GTT updated with both legs
- **Priority**: P1

### Authentication & Authorization

### SC-453: Update GTT requires access_token
- **Given**: Server is authenticated; tokens are set
- **When**: Client calls `paytm_update_gtt` with valid params
- **Then**: HTTP request includes `x-jwt-token` header with `access_token`
- **Priority**: P0

### SC-454: Update GTT fails when not authenticated
- **Given**: Server is running but no tokens set
- **When**: Client calls `paytm_update_gtt` with valid params
- **Then**: Response has `isError: true` with "Not authenticated..." message
- **Priority**: P0

### SC-455: Update GTT fails when session expired
- **Given**: Server is authenticated but tokens expired
- **When**: Client calls `paytm_update_gtt` with valid params
- **Then**: Response has `isError: true` with "Session expired..." message
- **Priority**: P1

### Validation & Errors

### SC-456: Update GTT fails with missing id
- **Given**: Server is authenticated
- **When**: Client calls `paytm_update_gtt` without `id` field
- **Then**: Response has `isError: true` with Zod validation error mentioning "id"
- **Priority**: P0

### SC-457: Update GTT fails for non-existent id (404)
- **Given**: Server is authenticated; API returns 404
- **When**: Client calls `paytm_update_gtt` with `id: 999999` and other valid params
- **Then**: Response has `isError: true` with error indicating GTT not found
- **Priority**: P0

### SC-458: Update GTT fails with quantity <= 0
- **Given**: Server is authenticated
- **When**: Client calls `paytm_update_gtt` with `quantity: 0`
- **Then**: Response has `isError: true` with Zod validation error
- **Priority**: P1

### SC-459: Update GTT LMT without price fails
- **Given**: Server is authenticated
- **When**: Client calls `paytm_update_gtt` with `order_type: "LMT"` but no `price`
- **Then**: Response has `isError: true` with "price is required for LMT order types"
- **Priority**: P0

### SC-460: Update GTT returns API error (500)
- **Given**: Server is authenticated; Paytm API returns 500
- **When**: Client calls `paytm_update_gtt` with valid params
- **Then**: Server retries once; if still 500, response has `isError: true`
- **Priority**: P1

### Annotations

### SC-461: Update GTT has destructiveHint annotation
- **Given**: Server is started
- **When**: Client sends `tools/list`
- **Then**: `paytm_update_gtt` has `annotations.destructiveHint: true`
- **Priority**: P0

---

## Scenario Group: Tool 16 — paytm_delete_gtt

### Happy Path

### SC-470: Delete GTT order (happy path)
- **Given**: Server is authenticated with `access_token`; Paytm GTT delete API (`DELETE /orders/v1/gtt/1001`) returns `{ "message": "GTT order deleted successfully" }`
- **When**: Client calls `paytm_delete_gtt` with `{ "id": 1001 }`
- **Then**: Response contains deletion confirmation; `isError` is false
- **Priority**: P0

### Authentication & Authorization

### SC-471: Delete GTT requires access_token
- **Given**: Server is authenticated; tokens are set
- **When**: Client calls `paytm_delete_gtt` with `{ "id": 1001 }`
- **Then**: HTTP request includes `x-jwt-token` header with `access_token`
- **Priority**: P0

### SC-472: Delete GTT fails when not authenticated
- **Given**: Server is running but no tokens set
- **When**: Client calls `paytm_delete_gtt` with `{ "id": 1001 }`
- **Then**: Response has `isError: true` with "Not authenticated..." message
- **Priority**: P0

### SC-473: Delete GTT fails when session expired
- **Given**: Server is authenticated but tokens expired
- **When**: Client calls `paytm_delete_gtt` with `{ "id": 1001 }`
- **Then**: Response has `isError: true` with "Session expired..." message
- **Priority**: P1

### Validation & Errors

### SC-474: Delete GTT with non-existent ID returns 404
- **Given**: Server is authenticated; API returns 404
- **When**: Client calls `paytm_delete_gtt` with `{ "id": 999999 }`
- **Then**: Response has `isError: true` with error indicating GTT not found
- **Priority**: P0

### SC-475: Delete already-deleted GTT returns error
- **Given**: Server is authenticated; API returns 400 or 404 `{ "message": "GTT order already deleted" }`
- **When**: Client calls `paytm_delete_gtt` with `{ "id": 1001 }` (already deleted)
- **Then**: Response has `isError: true` with appropriate error message
- **Priority**: P1

### SC-476: Delete GTT fails with missing id
- **Given**: Server is authenticated
- **When**: Client calls `paytm_delete_gtt` with `{}` (no id)
- **Then**: Response has `isError: true` with Zod validation error mentioning "id"
- **Priority**: P0

### SC-477: Delete GTT returns API error (500)
- **Given**: Server is authenticated; Paytm API returns 500
- **When**: Client calls `paytm_delete_gtt` with valid params
- **Then**: Server retries once; if still 500, response has `isError: true`
- **Priority**: P1

### Annotations

### SC-478: Delete GTT has destructiveHint annotation
- **Given**: Server is started
- **When**: Client sends `tools/list`
- **Then**: `paytm_delete_gtt` has `annotations.destructiveHint: true`
- **Priority**: P0

---

## Scenario Group: Tool 17 — paytm_get_gtt_aggregate

### Happy Path

### SC-480: Get GTT aggregate data (happy path)
- **Given**: Server is authenticated with `access_token`; Paytm GTT aggregate API (`GET /orders/v1/gtt/aggregate`) returns `{ "active": 3, "triggered": 1, "expired": 2, "total": 6 }`
- **When**: Client calls `paytm_get_gtt_aggregate` with no arguments
- **Then**: Response contains summary of all GTT orders (active, triggered, expired counts); `isError` is false
- **Priority**: P0

### SC-481: Get GTT aggregate when no GTTs exist
- **Given**: Server is authenticated; API returns `{ "active": 0, "triggered": 0, "expired": 0, "total": 0 }`
- **When**: Client calls `paytm_get_gtt_aggregate` with no arguments
- **Then**: Response contains zeroes for all counts; `isError` is false
- **Priority**: P1

### Authentication & Authorization

### SC-482: Get GTT aggregate requires access_token
- **Given**: Server is authenticated; tokens are set
- **When**: Client calls `paytm_get_gtt_aggregate`
- **Then**: HTTP request includes `x-jwt-token` header with `access_token`
- **Priority**: P0

### SC-483: Get GTT aggregate fails when not authenticated
- **Given**: Server is running but no tokens set
- **When**: Client calls `paytm_get_gtt_aggregate`
- **Then**: Response has `isError: true` with "Not authenticated..." message
- **Priority**: P0

### SC-484: Get GTT aggregate fails when session expired
- **Given**: Server is authenticated but tokens expired
- **When**: Client calls `paytm_get_gtt_aggregate`
- **Then**: Response has `isError: true` with "Session expired..." message
- **Priority**: P1

### Annotations

### SC-485: Get GTT aggregate has readOnlyHint annotation
- **Given**: Server is started
- **When**: Client sends `tools/list`
- **Then**: `paytm_get_gtt_aggregate` has `annotations.readOnlyHint: true`
- **Priority**: P1

---

## Scenario Group: Tool 18 — paytm_get_option_chain

### Happy Path

### SC-490: Get option chain for calls (CE) — happy path
- **Given**: Server is authenticated with `public_access_token`; Paytm option chain API (`GET /fno/v1/option-chain`) returns option chain data with strike prices, premiums, OI, greeks
- **When**: Client calls `paytm_get_option_chain` with `{ "type": "CE", "underlying": "14366", "expiry": "2026-05-29" }`
- **Then**: Response contains call option chain data; `isError` is false
- **Priority**: P0

### SC-491: Get option chain for puts (PE)
- **Given**: Server is authenticated with `public_access_token`; API returns put option data
- **When**: Client calls `paytm_get_option_chain` with `{ "type": "PE", "underlying": "14366", "expiry": "2026-05-29" }`
- **Then**: Response contains put option chain data
- **Priority**: P0

### SC-492: Get option chain for both (BOTH)
- **Given**: Server is authenticated with `public_access_token`; API returns combined option data
- **When**: Client calls `paytm_get_option_chain` with `{ "type": "BOTH", "underlying": "14366", "expiry": "2026-05-29" }`
- **Then**: Response contains both call and put option chain data
- **Priority**: P0

### Authentication & Authorization

### SC-493: Get option chain requires public_access_token
- **Given**: Server is authenticated; tokens are set
- **When**: Client calls `paytm_get_option_chain` with valid params
- **Then**: HTTP request includes `x-jwt-token` header with `public_access_token` (not access_token or read_access_token)
- **Priority**: P0

### SC-494: Get option chain fails when not authenticated
- **Given**: Server is running but no tokens set
- **When**: Client calls `paytm_get_option_chain` with valid params
- **Then**: Response has `isError: true` with "Not authenticated..." message
- **Priority**: P0

### SC-495: Get option chain fails when session expired
- **Given**: Server is authenticated but tokens expired
- **When**: Client calls `paytm_get_option_chain` with valid params
- **Then**: Response has `isError: true` with "Session expired..." message
- **Priority**: P1

### Validation

### SC-496: Get option chain fails with missing type
- **Given**: Server is authenticated
- **When**: Client calls `paytm_get_option_chain` without `type`
- **Then**: Response has `isError: true` with Zod validation error mentioning "type"
- **Priority**: P0

### SC-497: Get option chain fails with invalid type
- **Given**: Server is authenticated
- **When**: Client calls `paytm_get_option_chain` with `type: "FUT"` (not CE/PE/BOTH)
- **Then**: Response has `isError: true` with Zod validation error for invalid enum value
- **Priority**: P1

### SC-498: Get option chain fails with missing underlying
- **Given**: Server is authenticated
- **When**: Client calls `paytm_get_option_chain` without `underlying`
- **Then**: Response has `isError: true` with Zod validation error mentioning "underlying"
- **Priority**: P0

### SC-499: Get option chain fails with missing expiry
- **Given**: Server is authenticated
- **When**: Client calls `paytm_get_option_chain` without `expiry`
- **Then**: Response has `isError: true` with Zod validation error mentioning "expiry"
- **Priority**: P0

### API Errors

### SC-500: Get option chain returns API error (400 — invalid underlying)
- **Given**: Server is authenticated; API returns 400 `{ "message": "Invalid underlying" }`
- **When**: Client calls `paytm_get_option_chain` with `underlying: "INVALID"`
- **Then**: Response has `isError: true` with error message from API
- **Priority**: P1

### SC-501: Get option chain returns API error (500)
- **Given**: Server is authenticated; API returns 500
- **When**: Client calls `paytm_get_option_chain` with valid params
- **Then**: Server retries once; if still 500, response has `isError: true`
- **Priority**: P1

### Annotations

### SC-502: Get option chain has readOnlyHint annotation
- **Given**: Server is started
- **When**: Client sends `tools/list`
- **Then**: `paytm_get_option_chain` has `annotations.readOnlyHint: true`
- **Priority**: P1

---

## Scenario Group: Tool 19 — paytm_get_charges

### Happy Path

### SC-505: Get charges for equity buy order (happy path)
- **Given**: Server is authenticated with `read_access_token`; Paytm charges API (`POST /charges/v1/charges-info`) returns `{ "brokerage": 20.00, "stt": 1.25, "exchange_charges": 0.50, "gst": 3.60, "stamp_duty": 0.15, "total": 25.50 }`
- **When**: Client calls `paytm_get_charges` with `{ "segment": "E", "exchange": "NSE", "txn_type": "B", "qty": 10, "price": 1500.00, "product": "C" }`
- **Then**: Response contains brokerage, STT, exchange charges, GST, stamp duty, and total charges; `isError` is false
- **Priority**: P0

### SC-506: Get charges for equity sell order
- **Given**: Server is authenticated with `read_access_token`; API returns charges breakdown
- **When**: Client calls `paytm_get_charges` with `{ "segment": "E", "exchange": "NSE", "txn_type": "S", "qty": 10, "price": 1500.00, "product": "C" }`
- **Then**: Response contains charges breakdown (sell STT may differ from buy)
- **Priority**: P0

### SC-507: Get charges for MIS product
- **Given**: Server is authenticated with `read_access_token`; API returns charges
- **When**: Client calls `paytm_get_charges` with `product: "I"` (MIS)
- **Then**: Response contains charges; brokerage may differ from CNC
- **Priority**: P1

### SC-508: Get charges on BSE exchange
- **Given**: Server is authenticated with `read_access_token`; API returns charges
- **When**: Client calls `paytm_get_charges` with `exchange: "BSE"`
- **Then**: Response contains charges; exchange charges may differ from NSE
- **Priority**: P1

### Authentication & Authorization

### SC-509: Get charges requires read_access_token
- **Given**: Server is authenticated; tokens are set
- **When**: Client calls `paytm_get_charges` with valid params
- **Then**: HTTP request includes `x-jwt-token` header with `read_access_token` (not access_token or public_access_token)
- **Priority**: P0

### SC-510: Get charges fails when not authenticated
- **Given**: Server is running but no tokens set
- **When**: Client calls `paytm_get_charges` with valid params
- **Then**: Response has `isError: true` with "Not authenticated..." message
- **Priority**: P0

### SC-511: Get charges fails when session expired
- **Given**: Server is authenticated but tokens expired
- **When**: Client calls `paytm_get_charges` with valid params
- **Then**: Response has `isError: true` with "Session expired..." message
- **Priority**: P1

### Validation

### SC-512: Get charges fails with quantity <= 0
- **Given**: Server is authenticated
- **When**: Client calls `paytm_get_charges` with `qty: 0`
- **Then**: Response has `isError: true` with Zod validation error indicating qty must be positive
- **Priority**: P0

### SC-513: Get charges fails with negative quantity
- **Given**: Server is authenticated
- **When**: Client calls `paytm_get_charges` with `qty: -5`
- **Then**: Response has `isError: true` with Zod validation error
- **Priority**: P1

### SC-514: Get charges fails with price <= 0
- **Given**: Server is authenticated
- **When**: Client calls `paytm_get_charges` with `price: 0`
- **Then**: Response has `isError: true` with Zod validation error indicating price must be positive
- **Priority**: P0

### SC-515: Get charges fails with missing segment
- **Given**: Server is authenticated
- **When**: Client calls `paytm_get_charges` without `segment`
- **Then**: Response has `isError: true` with Zod validation error mentioning "segment"
- **Priority**: P0

### SC-516: Get charges fails with invalid txn_type
- **Given**: Server is authenticated
- **When**: Client calls `paytm_get_charges` with `txn_type: "X"` (not B/S)
- **Then**: Response has `isError: true` with Zod validation error
- **Priority**: P1

### SC-517: Get charges fails with invalid product
- **Given**: Server is authenticated
- **When**: Client calls `paytm_get_charges` with `product: "X"` (not C/I)
- **Then**: Response has `isError: true` with Zod validation error
- **Priority**: P1

### API Errors

### SC-518: Get charges returns API error (500)
- **Given**: Server is authenticated; Paytm API returns 500
- **When**: Client calls `paytm_get_charges` with valid params
- **Then**: Server retries once; if still 500, response has `isError: true`
- **Priority**: P1

### Annotations

### SC-519: Get charges has readOnlyHint annotation
- **Given**: Server is started
- **When**: Client sends `tools/list`
- **Then**: `paytm_get_charges` has `annotations.readOnlyHint: true`
- **Priority**: P1

---

## Scenario Group: PaytmClient — Phase 3 Methods

### SC-520: createGtt sends POST to /orders/v1/gtt/create with access_token
- **Given**: PaytmClient is instantiated; HTTP interceptor stubs POST `/orders/v1/gtt/create` to return success
- **When**: `client.createGtt(accessToken, params)` is called
- **Then**: Request is POST to correct path; `x-jwt-token` header equals `accessToken`; body contains all GTT params
- **Priority**: P0

### SC-521: getGtt sends GET to /orders/v1/gtt/{id} with access_token
- **Given**: PaytmClient is instantiated; HTTP interceptor stubs GET `/orders/v1/gtt/1001`
- **When**: `client.getGtt(accessToken, 1001)` is called
- **Then**: Request is GET to `/orders/v1/gtt/1001`; `x-jwt-token` header equals `accessToken`
- **Priority**: P0

### SC-522: updateGtt sends PUT to /orders/v1/gtt/update with access_token
- **Given**: PaytmClient is instantiated; HTTP interceptor stubs PUT `/orders/v1/gtt/update`
- **When**: `client.updateGtt(accessToken, params)` is called
- **Then**: Request is PUT to correct path; `x-jwt-token` header equals `accessToken`; body contains all params
- **Priority**: P0

### SC-523: deleteGtt sends DELETE to /orders/v1/gtt/{id} with access_token
- **Given**: PaytmClient is instantiated; HTTP interceptor stubs DELETE `/orders/v1/gtt/1001`
- **When**: `client.deleteGtt(accessToken, 1001)` is called
- **Then**: Request is DELETE to `/orders/v1/gtt/1001`; `x-jwt-token` header equals `accessToken`
- **Priority**: P0

### SC-524: getGttAggregate sends GET to /orders/v1/gtt/aggregate with access_token
- **Given**: PaytmClient is instantiated; HTTP interceptor stubs GET `/orders/v1/gtt/aggregate`
- **When**: `client.getGttAggregate(accessToken)` is called
- **Then**: Request is GET to correct path; `x-jwt-token` header equals `accessToken`
- **Priority**: P0

### SC-525: getOptionChain sends GET to /fno/v1/option-chain with public_access_token
- **Given**: PaytmClient is instantiated; HTTP interceptor stubs GET `/fno/v1/option-chain`
- **When**: `client.getOptionChain(publicAccessToken, params)` is called
- **Then**: Request is GET to correct path; `x-jwt-token` header equals `publicAccessToken`; query params contain type, underlying, expiry
- **Priority**: P0

### SC-526: getCharges sends POST to /charges/v1/charges-info with read_access_token
- **Given**: PaytmClient is instantiated; HTTP interceptor stubs POST `/charges/v1/charges-info`
- **When**: `client.getCharges(readAccessToken, params)` is called
- **Then**: Request is POST to correct path; `x-jwt-token` header equals `readAccessToken`; body contains all charge params
- **Priority**: P0

### SC-527: Phase 3 client methods retry on 5xx
- **Given**: PaytmClient is instantiated; HTTP interceptor returns 500 on first call, then 200 on retry
- **When**: Any Phase 3 client method is called (e.g., `createGtt`)
- **Then**: First call fails with 500; retry succeeds with 200; final result is success
- **Priority**: P1

### SC-528: Phase 3 client methods retry on 429 with Retry-After
- **Given**: PaytmClient is instantiated; HTTP interceptor returns 429 with `Retry-After: 1` header, then 200
- **When**: Any Phase 3 client method is called
- **Then**: Client waits for Retry-After duration, retries, and succeeds
- **Priority**: P1

---

## Scenario Group: Security — Phase 3 Token Routing

### SC-529: GTT tools use access_token (not read or public)
- **Given**: Server is authenticated with all 3 tokens (`access_token=AT`, `public_access_token=PAT`, `read_access_token=RAT`)
- **When**: Client calls each GTT tool (`paytm_create_gtt`, `paytm_get_gtt`, `paytm_update_gtt`, `paytm_delete_gtt`, `paytm_get_gtt_aggregate`)
- **Then**: All HTTP requests include `x-jwt-token: AT`; PAT and RAT are never used for GTT operations
- **Priority**: P0

### SC-530: Option chain uses public_access_token (not access or read)
- **Given**: Server is authenticated with all 3 tokens (`access_token=AT`, `public_access_token=PAT`, `read_access_token=RAT`)
- **When**: Client calls `paytm_get_option_chain`
- **Then**: HTTP request includes `x-jwt-token: PAT`; AT and RAT are never used
- **Priority**: P0

### SC-531: Charges tool uses read_access_token (not access or public)
- **Given**: Server is authenticated with all 3 tokens (`access_token=AT`, `public_access_token=PAT`, `read_access_token=RAT`)
- **When**: Client calls `paytm_get_charges`
- **Then**: HTTP request includes `x-jwt-token: RAT`; AT and PAT are never used
- **Priority**: P0

---

## Scenario Group: End-to-End — Phase 3 Flows

### SC-532: Full GTT lifecycle — create → get → update → get → delete → get_aggregate
- **Given**: Server is running; all Paytm APIs stubbed
- **When**: Client calls `paytm_create_gtt` (gets ID 1001) → `paytm_get_gtt` (verify details) → `paytm_update_gtt` (change trigger price) → `paytm_get_gtt` (verify update) → `paytm_delete_gtt` (remove) → `paytm_get_gtt_aggregate` (verify counts)
- **Then**: Each step succeeds; GTT is created, retrieved, updated, verified, deleted; aggregate reflects final state
- **Priority**: P0

### SC-533: Option chain + charges research flow — search → option_chain → charges
- **Given**: Server is authenticated with all tokens; APIs stubbed
- **When**: Client calls `paytm_search_instruments` (find NIFTY) → `paytm_get_option_chain` (get CE options for NIFTY) → `paytm_get_charges` (estimate charges for a potential trade)
- **Then**: Each step succeeds; correct token used at each step (public for search + option chain, read for charges)
- **Priority**: P0

---

## Phase 3 Summary

| Priority | Count | Description |
|----------|-------|-------------|
| P0       | 62    | Must pass — tool registration, happy paths, auth token routing, validation, security, E2E, annotations |
| P1       | 42    | Should pass — error handling, retries, edge cases, rate limits, API errors |
| P2       | 0     | Nice to have |
| **Total** | **104** | |

### New Test Infrastructure (Phase 3)

| Component | Strategy | Notes |
|-----------|----------|-------|
| Paytm GTT APIs | HTTP interceptor (nock or msw) | Intercept POST/GET/PUT/DELETE to `/orders/v1/gtt/*` |
| Paytm Option Chain API | HTTP interceptor | Intercept GET to `/fno/v1/option-chain` |
| Paytm Charges API | HTTP interceptor | Intercept POST to `/charges/v1/charges-info` |
| MCP Transport | Same as Phase 1+2 (in-process stdio) | Reuse existing test harness |
| Token types | Verify correct token in `x-jwt-token` | access_token for GTT CRUD, public_access_token for option chain, read_access_token for charges |

### Phase 3 Test File Structure (Recommended)

```
tests/
├── ... (Phase 1+2 files unchanged)
├── tools/
│   ├── ... (Phase 1+2 tool tests unchanged)
│   ├── create-gtt.test.ts        # SC-410 to SC-437
│   ├── get-gtt.test.ts           # SC-440 to SC-447
│   ├── update-gtt.test.ts        # SC-450 to SC-461
│   ├── delete-gtt.test.ts        # SC-470 to SC-478
│   ├── get-gtt-aggregate.test.ts # SC-480 to SC-485
│   ├── option-chain.test.ts      # SC-490 to SC-502
│   └── charges.test.ts           # SC-505 to SC-519
├── client/
│   └── pm-client.test.ts         # Extend with SC-520 to SC-528
├── security.test.ts              # Extend with SC-529 to SC-531
├── server.test.ts                # Extend with SC-400 to SC-405
└── e2e.test.ts                   # Extend with SC-532 to SC-533
```

---

# Paytm Money MCP Server — Phase 4 Test Scenarios

| Field                  | Value                                      |
|------------------------|--------------------------------------------|
| **Status**             | Approved for implementation                |
| **Approved By**        | QA                                         |
| **Implementation Ready** | Yes                                      |
| **Phase**              | Phase 4 — OAuth Callback Server (Auth UX Enhancement) |
| **Scenario IDs**       | SC-600 through SC-648                      |
| **Test Philosophy**    | Social tests, real HTTP via nock/interceptors, no mocks of business logic |
| **Traces From**        | Phase 4 OAuth callback spec (user-provided); Phase 1–3 scenarios SC-001–SC-533 |

---

## Scenario Group: CallbackServer — Lifecycle

### SC-600: CallbackServer starts and binds to 127.0.0.1 on default port
- **Given**: No other process is listening on port 3000; `PAYTM_CALLBACK_PORT` is not set
- **When**: `CallbackServer.start()` is called
- **Then**: Server is listening on `127.0.0.1:3000`; `server.isRunning()` returns `true`
- **Priority**: P0

### SC-601: CallbackServer starts on custom port via PAYTM_CALLBACK_PORT
- **Given**: `PAYTM_CALLBACK_PORT=9876` is set; port 9876 is free
- **When**: `CallbackServer.start()` is called
- **Then**: Server is listening on `127.0.0.1:9876`; `server.isRunning()` returns `true`
- **Priority**: P1

### SC-602: CallbackServer.stop() shuts down the server
- **Given**: `CallbackServer` is running on port 3000
- **When**: `CallbackServer.stop()` is called
- **Then**: Server stops listening; `server.isRunning()` returns `false`; port 3000 is released
- **Priority**: P0

### SC-603: CallbackServer.stop() is idempotent when not running
- **Given**: `CallbackServer` is not running
- **When**: `CallbackServer.stop()` is called
- **Then**: No error is thrown; `server.isRunning()` remains `false`
- **Priority**: P2

### SC-604: CallbackServer rejects start when port is busy (EADDRINUSE)
- **Given**: Another process is already listening on port 3000
- **When**: `CallbackServer.start()` is called
- **Then**: `start()` rejects with an error indicating the port is in use (EADDRINUSE)
- **Priority**: P0

### SC-605: CallbackServer single-instance — start() while running stops previous
- **Given**: `CallbackServer` is already running on port 3000
- **When**: `CallbackServer.start()` is called again
- **Then**: Previous server is stopped; new server starts successfully on port 3000; `server.isRunning()` returns `true`
- **Priority**: P0

### SC-606: CallbackServer auto-shuts down after timeout
- **Given**: `CallbackServer` is running; timeout is set to a short duration (e.g., 100ms for testing via `PAYTM_CALLBACK_TIMEOUT`)
- **When**: No callback is received within the timeout period
- **Then**: Server auto-stops; `server.isRunning()` returns `false`; port is released
- **Priority**: P0

### SC-607: CallbackServer uses custom timeout from PAYTM_CALLBACK_TIMEOUT
- **Given**: `PAYTM_CALLBACK_TIMEOUT=60000` (1 minute) is set
- **When**: `CallbackServer.start()` is called
- **Then**: Server timeout is set to 60000ms (not the default 300000ms)
- **Priority**: P1

### SC-608: CallbackServer does not write to stdout
- **Given**: `CallbackServer` is running
- **When**: A request is received on the callback endpoint (valid or invalid)
- **Then**: No output is written to `process.stdout`; all logging (if any) goes to `process.stderr` only
- **Priority**: P0

---

## Scenario Group: CallbackServer — Callback Happy Path

### SC-610: Valid callback exchanges requestToken and returns success HTML
- **Given**: `CallbackServer` is running with a valid `apiSecret`; state was generated via `generateState(apiSecret)`
- **When**: `GET /postback?requestToken=valid-req-token&state=<valid-state>` is received; Paytm gettoken API is stubbed to return valid tokens
- **Then**: `TokenManager.isAuthenticated()` returns `true`; HTTP response status is 200; response body contains HTML with a success message; server auto-stops after handling
- **Priority**: P0

### SC-611: Valid callback stores all 3 tokens
- **Given**: `CallbackServer` is running; Paytm gettoken API will return `{ access_token: "at-1", public_access_token: "pat-1", read_access_token: "rat-1" }`
- **When**: Valid callback with correct requestToken and state is received
- **Then**: `TokenManager.getAccessToken()` returns `"at-1"`; `TokenManager.getPublicToken()` returns `"pat-1"`; `TokenManager.getReadToken()` returns `"rat-1"`
- **Priority**: P0

### SC-612: Callback returns error HTML when token exchange fails
- **Given**: `CallbackServer` is running; Paytm gettoken API will return an error (e.g., 401 invalid request token)
- **When**: Valid callback with correct state but an expired/invalid requestToken is received
- **Then**: HTTP response status indicates error; response body contains HTML with an error message; `TokenManager.isAuthenticated()` remains `false`
- **Priority**: P0

---

## Scenario Group: CallbackServer — CSRF / State Validation

### SC-620: Callback rejects request with invalid state (tampered HMAC)
- **Given**: `CallbackServer` is running; state was generated with `apiSecret="secret-A"`
- **When**: `GET /postback?requestToken=token&state=nonce:tampered-hmac` is received
- **Then**: HTTP response status is 403; response body contains HTML with a CSRF/state validation error; tokens are NOT set
- **Priority**: P0

### SC-621: Callback rejects request with missing state parameter
- **Given**: `CallbackServer` is running
- **When**: `GET /postback?requestToken=token` is received (no `state` param)
- **Then**: HTTP response status is 403; response body contains HTML with a state validation error; tokens are NOT set
- **Priority**: P0

### SC-622: Callback rejects request with empty state parameter
- **Given**: `CallbackServer` is running
- **When**: `GET /postback?requestToken=token&state=` is received (empty state)
- **Then**: HTTP response status is 403; response body contains HTML with a state validation error; tokens are NOT set
- **Priority**: P0

### SC-623: Callback rejects request with missing requestToken
- **Given**: `CallbackServer` is running; state is valid
- **When**: `GET /postback?state=<valid-state>` is received (no `requestToken`)
- **Then**: HTTP response indicates error; tokens are NOT set
- **Priority**: P1

### SC-624: Unknown route returns 404
- **Given**: `CallbackServer` is running
- **When**: `GET /unknown-path` is received
- **Then**: HTTP response status is 404
- **Priority**: P1

### SC-625: POST to callback route is rejected
- **Given**: `CallbackServer` is running
- **When**: `POST /postback?requestToken=token&state=<valid-state>` is received
- **Then**: HTTP response status is 404 or 405; tokens are NOT set
- **Priority**: P2

---

## Scenario Group: State/CSRF Functions (oauth-flow.ts)

### SC-630: generateState returns nonce:hmac format
- **Given**: An `apiSecret` is provided
- **When**: `generateState(apiSecret)` is called
- **Then**: Return value matches the pattern `<nonce>:<hmac>` (two non-empty parts separated by a colon)
- **Priority**: P0

### SC-631: generateState produces unique nonces
- **Given**: An `apiSecret` is provided
- **When**: `generateState(apiSecret)` is called twice
- **Then**: The nonce portion (before the colon) differs between the two calls
- **Priority**: P1

### SC-632: validateState accepts a valid state
- **Given**: `state = generateState(apiSecret)` with a known `apiSecret`
- **When**: `validateState(state, apiSecret)` is called
- **Then**: Returns `true`
- **Priority**: P0

### SC-633: validateState rejects a tampered state
- **Given**: `state = generateState(apiSecret)` with a known `apiSecret`; the HMAC portion is modified
- **When**: `validateState(tamperedState, apiSecret)` is called
- **Then**: Returns `false`
- **Priority**: P0

### SC-634: validateState rejects state signed with a different secret
- **Given**: `state = generateState("secret-A")`
- **When**: `validateState(state, "secret-B")` is called
- **Then**: Returns `false`
- **Priority**: P0

### SC-635: validateState rejects empty string
- **Given**: `state = ""`
- **When**: `validateState(state, apiSecret)` is called
- **Then**: Returns `false`
- **Priority**: P1

### SC-636: validateState rejects malformed state (no colon)
- **Given**: `state = "no-colon-here"`
- **When**: `validateState(state, apiSecret)` is called
- **Then**: Returns `false`
- **Priority**: P1

### SC-637: validateState uses constant-time comparison
- **Given**: A valid state and an invalid state of the same length
- **When**: `validateState` is called with each
- **Then**: Implementation uses `crypto.timingSafeEqual` (or equivalent) — verified by code inspection or by confirming the function signature references `timingSafeEqual`
- **Priority**: P1

---

## Scenario Group: Updated paytm_login Tool

### SC-640: paytm_login returns "already authenticated" when tokens exist
- **Given**: Server is running; `TokenManager.isAuthenticated()` returns `true` (tokens were previously set)
- **When**: Client calls `paytm_login`
- **Then**: Response content contains a message indicating already authenticated; callback server is NOT started; `isError` is false
- **Priority**: P0

### SC-641: paytm_login starts callback server and returns URL (happy path)
- **Given**: Server is running; not authenticated; port 3000 is free
- **When**: Client calls `paytm_login`
- **Then**: Response content contains the login URL with `apiKey` and a `state` param in `nonce:hmac` format; response mentions "authentication will complete automatically"; callback server is running; `isError` is false
- **Priority**: P0

### SC-642: paytm_login falls back to manual flow when port is busy
- **Given**: Server is running; not authenticated; port 3000 is occupied by another process
- **When**: Client calls `paytm_login`
- **Then**: Response content contains the login URL; response includes instructions for manual copy-paste of the requestToken; callback server is NOT running; `isError` is false
- **Priority**: P0

### SC-643: paytm_login URL contains correct apiKey
- **Given**: Server is running with `PAYTM_API_KEY=test-key-xyz`; not authenticated; port is free
- **When**: Client calls `paytm_login`
- **Then**: The login URL in the response contains `apiKey=test-key-xyz`
- **Priority**: P0

### SC-644: paytm_login is non-blocking — returns immediately
- **Given**: Server is running; not authenticated; port is free
- **When**: Client calls `paytm_login`
- **Then**: Response is returned without waiting for the callback to arrive; callback server continues listening in the background
- **Priority**: P0

---

## Scenario Group: New paytm_auth_status Tool

### SC-645: paytm_auth_status when not authenticated
- **Given**: Server is running; no tokens have been set
- **When**: Client calls `paytm_auth_status`
- **Then**: Response contains `{ authenticated: false, callback_server_running: false }` (or equivalent text representation); `isError` is false
- **Priority**: P0

### SC-646: paytm_auth_status when authenticated
- **Given**: Server is running; tokens have been set; session is not expired
- **When**: Client calls `paytm_auth_status`
- **Then**: Response contains `authenticated: true`, `expires_at` (ISO timestamp), and `expires_in_minutes` (positive number); `isError` is false
- **Priority**: P0

### SC-647: paytm_auth_status shows callback server running
- **Given**: Server is running; `paytm_login` was called (callback server started); not yet authenticated
- **When**: Client calls `paytm_auth_status`
- **Then**: Response contains `callback_server_running: true`
- **Priority**: P0

### SC-648: paytm_auth_status does not expose token values
- **Given**: Server is running; tokens have been set (access_token, public_access_token, read_access_token all stored)
- **When**: Client calls `paytm_auth_status`
- **Then**: Response does NOT contain any actual token strings; only metadata (authenticated, expires_at, expires_in_minutes, callback_server_running)
- **Priority**: P0

---

## Scenario Group: Server Registration — Phase 4

### SC-650: Server registers 20 tools after Phase 4
- **Given**: `PAYTM_API_KEY` and `PAYTM_API_SECRET` are set; no `PAYTM_EXCLUDED_TOOLS`
- **When**: Server starts and client sends `tools/list`
- **Then**: Response contains exactly 20 tools — the 19 from Phase 1–3 plus `paytm_auth_status`
- **Priority**: P0

### SC-651: paytm_auth_status has readOnlyHint annotation
- **Given**: Server is started
- **When**: Client sends `tools/list`
- **Then**: `paytm_auth_status` has `annotations.readOnlyHint: true`
- **Priority**: P1

### SC-652: paytm_auth_status can be excluded via PAYTM_EXCLUDED_TOOLS
- **Given**: `PAYTM_EXCLUDED_TOOLS=paytm_auth_status` is set
- **When**: Server starts and client sends `tools/list`
- **Then**: `paytm_auth_status` is absent from the tool list; 19 tools remain
- **Priority**: P2

---

## Scenario Group: End-to-End — Phase 4 Flows

### SC-660: E2E — Login → callback → auth_status shows authenticated
- **Given**: Server is running; not authenticated; port is free; Paytm gettoken API is stubbed
- **When**: Client calls `paytm_login` (gets URL + callback server starts) → HTTP GET to the callback URL with valid requestToken and state → Client calls `paytm_auth_status`
- **Then**: `paytm_login` returns URL with state; callback exchanges token successfully; `paytm_auth_status` returns `{ authenticated: true, expires_at: <timestamp>, callback_server_running: false }` (server auto-stopped after success)
- **Priority**: P0

### SC-661: E2E — Login with port busy → manual fallback → set_tokens → authenticated
- **Given**: Server is running; not authenticated; port 3000 is occupied by another process
- **When**: Client calls `paytm_login` (gets manual fallback instructions) → Client calls `paytm_set_tokens` with a valid `request_token` (Paytm API stubbed) → Client calls `paytm_auth_status`
- **Then**: `paytm_login` returns URL with manual instructions (no callback server); `paytm_set_tokens` succeeds; `paytm_auth_status` returns `{ authenticated: true, callback_server_running: false }`
- **Priority**: P0

### SC-662: E2E — Login → callback with invalid state → auth_status shows not authenticated
- **Given**: Server is running; not authenticated; port is free
- **When**: Client calls `paytm_login` → HTTP GET to callback URL with valid requestToken but tampered state → Client calls `paytm_auth_status`
- **Then**: Callback returns 403 HTML; `paytm_auth_status` returns `{ authenticated: false, callback_server_running: true }` (server still waiting for valid callback)
- **Priority**: P0

---

## Phase 4 Summary

| Priority | Count | Description |
|----------|-------|-------------|
| P0       | 27    | Must pass — callback lifecycle, CSRF validation, token exchange, tool behavior, E2E flows, security |
| P1       | 11    | Should pass — custom port/timeout, unique nonces, constant-time compare, annotations, edge cases |
| P2       | 4     | Nice to have — idempotent stop, POST rejection, tool exclusion |
| **Total** | **42** | |

### New Test Infrastructure (Phase 4)

| Component | Strategy | Notes |
|-----------|----------|-------|
| CallbackServer | Direct instantiation in tests | Start/stop real HTTP server on `127.0.0.1`; use `http.request` or `fetch` to simulate browser callbacks |
| Port contention | Bind a dummy `net.createServer` on the target port before test | Forces EADDRINUSE scenario |
| Paytm gettoken API | HTTP interceptor (nock) | Same as Phase 1 — intercept `POST /accounts/v2/gettoken` |
| State/CSRF functions | Direct unit tests of `generateState` / `validateState` | Pure functions, no I/O |
| stdout capture | Capture `process.stdout.write` calls during callback handling | Verify zero stdout writes (MCP JSON-RPC safety) |
| MCP Transport | Same as Phase 1–3 (in-process stdio) | Reuse existing test harness |

### Phase 4 Test File Structure (Recommended)

```
tests/
├── ... (Phase 1–3 files unchanged)
├── auth/
│   ├── oauth-flow.test.ts        # Extend with SC-630 to SC-637
│   └── callback-server.test.ts   # SC-600 to SC-612, SC-620 to SC-625
├── tools/
│   ├── auth.tools.test.ts        # Extend with SC-640 to SC-648
│   └── ...
├── server.test.ts                # Extend with SC-650 to SC-652
└── e2e.test.ts                   # Extend with SC-660 to SC-662
```
