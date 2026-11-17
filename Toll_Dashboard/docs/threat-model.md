# Threat model — RCD Toll Plaza Monitor

Mapped from `Security_UX_Testing.md` section 2.2. Each row links a STRIDE threat to the control that mitigates it and the test(s) that verify the control.

## Data classes

| Data | Where | Sensitivity |
|---|---|---|
| Plaza, road, length, status data | `toll_plazas`, `divisions`, `status_options` | Internal (not confirmed; treat as sensitive by default) |
| User accounts, password hashes, sessions | `users`, `sessions` | Confidential |
| Uploaded PDFs and geolocation images | file storage + `plaza_files` | Internal (images may contain GPS) |
| Audit and import logs | `audit_log`, `import_log` | Internal, append-only for app role |
| Secrets (DB password) | `.env` / env vars | Secret |

## Threat matrix

| # | STRIDE | Where | Control | Where in code | Test |
|---|---|---|---|---|---|
| T1 | Spoofing | Login, sessions | argon2id hashing, HttpOnly+Secure+SameSite=Lax cookie, generic error, every attempt logged. **Rate limit and account lockout removed on user request — see ADR 0006.** | `lib/auth.ts`, `routes/auth.ts` | integration `RBAC > writes require auth` |
| T2 | Broken access control | `/plazas` write/upload/download | `requireAuth` + `requireRole(editor,admin)` on all writes; `requireAuth` on all downloads; deny-by-default | `lib/middleware.ts`, `routes/*.ts` | `writes require auth` integration test |
| T3 | IDOR | `/plazas/:id/files/:fileId` | Query joins `plazaId` + `fileId`; 404 if file not under that plaza | `routes/files.ts` get handler | pending Playwright extension |
| T4 | Malicious upload | PDF/image upload | `file-type` magic-byte check; 10 MB per file; max 10 files per kind per plaza; stored under random UUID path | `routes/files.ts` | upload abuse tests (pending — fixture files) |
| T5 | Injection | `q`, filter params, import | All DB access via Drizzle parameters; `escapeLike` on `%`/`_`/`\`; `.strict()` zod on every param; unknown params → 400 | `db/filters.ts`, `lib/parseFilters.ts` | integration `search param is injection-safe`, `q literal % finds nothing`, `unknown filter param returns 400` |
| T6 | Stored XSS | Any user-written text field | React auto-escaping; no `dangerouslySetInnerHTML`; strict CSP (`script-src 'self'`); fonts self-hosted (no CSP relaxation) | `index.html`, `src/index.ts` helmet | manual + pending axe scan |
| T7 | CSRF | Writes | `SameSite=Lax` cookie; same-origin fetch with `credentials: include`; CORS allow-list by exact origin | `src/index.ts`, `lib/api.ts` | pending explicit CSRF test with cross-origin fetch |
| T8 | Spreadsheet formula injection | Future CSV export | Prefix `=`/`+`/`-`/`@` with `'` before writing cell | not yet exported — rule enforced when export is added | pending |
| T9 | Oversized/malicious Excel import | `scripts/import.ts` | Admin only (local shell), reads values not formulas, 92-row cap | `scripts/import.ts` | import acceptance test (counts match 2.1) |
| T10 | Information disclosure | Errors, logs | Generic `{ error, requestId }` body; pino redacts cookie/authorization; no stack traces to client | `src/index.ts` error handler, `lib/log.ts` | pending explicit error-body test |
| T11 | DoS | Upload, search, summary | 300 req/min API limit; 10/15min login limit; 256 KB JSON body limit; 10 MB upload limit; `pageSize ≤ 200`; indexes on every filter column | `src/index.ts`, `routes/*.ts` | pending k6 scenario |
| T12 | Tampering with history | `audit_log` | Append-only insert from app code; **recommended** DB GRANTs block UPDATE/DELETE for `app` role (see runbook) | `routes/*.ts` audit inserts | pending GRANT drill |
| T13 | Supply-chain attack | npm deps | Lockfile committed, `npm audit --audit-level=high` in CI, pinned major versions | `package-lock.json`, `.github/workflows/ci.yml` | CI job |
| T14 | Data loss | DB + file storage | Daily DB backup + file-storage backup + tested restore (runbook) | ops | pending — see `docs/runbook.md` |

## Residual risks (unmitigated, awaiting user decisions — see brief section 7)

- No antivirus scan on uploaded files (brief Q8 unanswered).
- No independent penetration test yet (brief Q15; Phase 7).
- Backup target not provisioned (brief Q6 unanswered).
- Logging retention not set (brief Q7 unanswered).
