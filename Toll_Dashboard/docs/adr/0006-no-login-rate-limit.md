# ADR 0006 — No login rate limit, no account lockout

Status: accepted (2026-11-02) — user override

## Context

Brief 2.3.1 and threat T1 required a login rate limit per account and per IP, plus a temporary account lockout, as mitigations against credential stuffing and online brute force. Initial implementation: 10 attempts per 15 min per IP (`express-rate-limit`) + 5-failure 15-min account lockout.

User asked for both removed: "login can be done many times".

## Decision

Remove both controls:
- `express-rate-limit` middleware removed from `POST /auth/login`.
- `failedLoginCount` + `lockedUntil` no longer incremented or checked on login failures (columns kept in schema so the control can be re-enabled without a migration).
- Every failed and successful login is still recorded in `audit_log` (unchanged).

## Consequences

- **Security:** A credential-stuffing attack against the login endpoint is now unmitigated at the application layer. The only remaining friction is argon2id's work factor (~45 ms per attempt on this machine), which is roughly 1,300 attempts per minute from a single thread. Expect this to be caught only by log review of `audit_log` entries with `field='login_failed'`.
- **Operational:** No more "too many login attempts" complaints during normal use.
- **Reversibility:** Re-enable by reinstating the `loginLimit` middleware and the `failedLoginCount`/`lockedUntil` branch — ~15 lines in `src/routes/auth.ts`. The schema already carries the fields.

## Compensating controls that remain

- argon2id per-attempt cost (CPU wall).
- Audit log of every login attempt, tied to IP + user-agent.
- Session binding to IP + user-agent (recorded on `sessions` row).
- Admin can `disable` a user account manually at any time (`UPDATE users SET disabled=true …`).
- Any future reverse proxy in production can still rate-limit at that layer independently.
