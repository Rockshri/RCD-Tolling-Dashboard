# ADR 0001 — Session cookies instead of JWT

Status: accepted (2026-11-02)

## Context

Brief 2.3.1 proposes server-side sessions in Postgres delivered through an `HttpOnly; Secure; SameSite=Lax` cookie, avoiding `localStorage`. User confirmed own-password auth, 3 roles, no SSO.

## Decision

Use server-side sessions:
- `sessions` table (`id` is a 256-bit random token, `created_at`, `last_seen_at`, `expires_at`, `ip`, `user_agent`).
- Idle timeout 30 min, absolute 12 h.
- `HttpOnly; Secure` (secure only when `NODE_ENV=production`); `SameSite=Lax`.
- Rotate session id on login (new row); destroy on logout.

## Consequences

- No client-side state about auth beyond "someone is logged in or not" (fetched from `/auth/me`).
- Any route can revoke by deleting the session row.
- One extra `SELECT` per authenticated request (indexed PK lookup — negligible).
- CSRF defence relies on `SameSite=Lax` plus same-origin fetch; cross-origin writes would need a token (not needed in v1).
