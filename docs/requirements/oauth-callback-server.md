# REQ: Zero-Friction OAuth Login via Localhost Callback Server

**Status**: Draft  
**Priority**: P1  
**Traces from**: Current auth UX pain (manual copy-paste of requestToken)  
**Traces to**: Architect design → implementation

---

## Problem

Login requires 7 steps including manual URL copy-paste and requestToken extraction from the browser address bar. This breaks flow, confuses users, and is error-prone. Kite MCP solves this with a localhost HTTP callback server running alongside stdio — we should do the same.

## Goal

Reduce login from 7 manual steps to 2: click URL → return to chat (already authenticated).

**Success metric**: Zero copy-paste required for the happy path. Entire auth round-trip completes without user returning to the chat to paste tokens.

---

## Functional Requirements

### FR-1: Localhost OAuth Callback Server (P1)

- The MCP server SHALL spin up a temporary HTTP server on `127.0.0.1` when `paytm_login` is called
- The callback server SHALL listen on a configurable port via `PAYTM_CALLBACK_PORT` env var (default: `3000`)
- The callback path SHALL be `/postback` (matching current Paytm app config)
- The callback server SHALL extract `requestToken` from the query string on redirect
- The callback server SHALL automatically exchange `requestToken` for access tokens using existing `PaytmClient.exchangeToken()`
- The callback server SHALL store tokens in the existing `TokenManager`
- The callback server SHALL shut down after successful token capture (not persist as a long-running server)
- The callback server SHALL respond to the browser with an HTML page: "Login successful. You can return to your MCP client."

### FR-2: Updated `paytm_login` Tool (P1)

- `paytm_login` SHALL start the callback server BEFORE returning the login URL
- `paytm_login` SHALL return the login URL as clickable text (current behavior preserved)
- `paytm_login` SHALL include the callback server address in the response so the user knows what's happening
- If already authenticated and tokens not expired, `paytm_login` SHALL return a message indicating active session instead of generating a new URL

### FR-3: `paytm_auth_status` Tool (P2)

- New tool that returns current auth state:
  - `authenticated`: boolean
  - `expires_at`: ISO timestamp or null
  - `expires_in_minutes`: number or null
  - `last_refreshed`: ISO timestamp or null
- SHALL NOT expose actual token values
- Useful for agents to check auth state before making API calls

### FR-4: Manual Fallback (P1)

- `paytm_set_tokens` SHALL continue to work as-is (manual requestToken or direct token input)
- If the callback server fails to start (port conflict), `paytm_login` SHALL fall back to the current UX: return URL + instruct user to paste requestToken manually
- Fallback message SHALL clearly explain what to do

### FR-5: Token Expiry Handling (P2)

- When any authenticated tool is called and tokens are expired, the error message SHALL proactively suggest calling `paytm_login` to re-authenticate
- Token expiry is 15:30 IST daily (already implemented in `TokenManager`)

---

## Non-Functional Requirements

### NFR-1: Port Conflict Resilience (P1)

- If the configured port is in use, the server SHALL try the next 2 ports (port+1, port+2) before falling back to manual flow
- The actual port used SHALL be reflected in the login URL's redirect parameter if Paytm's OAuth supports dynamic redirect URIs — otherwise, the port MUST match the registered callback URL

### NFR-2: Timeout (P1)

- The callback server SHALL auto-shutdown after 5 minutes if no callback is received (user abandoned login)
- Timeout SHALL be configurable via `PAYTM_CALLBACK_TIMEOUT` env var (default: 300000ms)

### NFR-3: Security (P1)

- Callback server SHALL bind to `127.0.0.1` only (not `0.0.0.0`)
- Callback server SHALL validate the `state` parameter matches what was sent in the login URL (CSRF protection)
- Tokens SHALL remain in-memory only (no disk persistence)
- Callback HTML response SHALL NOT include any token values

### NFR-4: Concurrency (P2)

- If `paytm_login` is called while a callback server is already running, it SHALL shut down the previous one and start fresh
- Only one callback server instance SHALL run at a time

---

## Acceptance Criteria

1. **Happy path**: User calls `paytm_login` → clicks URL → logs in via browser → browser redirects to `127.0.0.1:3000/postback` → sees "Login successful" → returns to chat → subsequent API calls work without any token paste
2. **Port conflict**: Configured port in use → server tries +1, +2 → if all fail, returns manual fallback message with copy-paste instructions
3. **Timeout**: User calls `paytm_login` but never completes browser login → callback server shuts down after 5 min → no resource leak
4. **Already authenticated**: User calls `paytm_login` while tokens are valid → returns "Already authenticated, session expires at HH:MM IST"
5. **Manual fallback**: `paytm_set_tokens` with `request_token` continues to work identically to current behavior
6. **Auth status**: `paytm_auth_status` returns correct state before login, after login, and after expiry
7. **State validation**: Callback rejects requests where `state` parameter doesn't match → returns 403

---

## Edge Cases

| Case | Expected Behavior |
|------|-------------------|
| Multiple rapid `paytm_login` calls | Previous callback server killed, new one started |
| Browser hits callback after server timeout | Connection refused (server already shut down) — user must re-initiate login |
| Invalid/expired requestToken in callback | Exchange fails → callback page shows error → user must retry |
| MCP server restarts mid-session | Tokens lost (in-memory) → user must re-authenticate |
| Paytm callback URL mismatch | Token exchange fails at Paytm's end → show clear error |

---

## Out of Scope

- Token persistence to disk (separate enhancement)
- Auto-open browser (`open` / `xdg-open`) — URL is returned for agent to render as clickable
- Refresh token flow (Paytm Money doesn't support it — tokens expire at 15:30 IST daily)
- SSE transport (server is stdio-only)

---

## Open Questions

| # | Question | Owner |
|---|----------|-------|
| 1 | Does Paytm Money OAuth support dynamic redirect URIs, or must the callback URL exactly match the registered one? If exact match required, port fallback (NFR-1) won't work — remove it. | Architect to verify |
| 2 | Should the callback server serve the success page with auto-close JS (`window.close()`)? | Architect |
