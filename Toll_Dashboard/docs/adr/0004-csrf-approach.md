# ADR 0004 — CSRF defence via SameSite cookies, not tokens

Status: accepted (2026-11-02)

## Context

Brief T7 requires CSRF defence on state-changing routes. Options: double-submit token, synchroniser-pattern CSRF token in a header, or rely on `SameSite` cookies plus same-origin fetch.

## Decision

Rely on `SameSite=Lax` cookie flag plus:
- same-origin deploy (SPA and API served from one origin — see ADR 0001 / architecture);
- CORS allow-list by exact origin, `credentials: true`, so cross-origin writes with the cookie are impossible from any origin not on the list;
- all write routes behind `requireRole`, which checks the session cookie.

## Consequences

- No CSRF token plumbing. Simpler API, simpler client.
- If the app is ever served under multiple origins (e.g. a subdomain for admin), add a double-submit token at that point.
- A cross-origin HTML form submit with `method=POST` can send the cookie (SameSite=Lax exemption for top-level nav), but the body is `application/x-www-form-urlencoded`, which the Express `express.json()` parser rejects; writes require `application/json` (not sendable from a form without `fetch`), so this attack path is closed.
