# Architecture — RCD Toll Plaza Monitor

## Shape

```
Browser (React 18 SPA, Vite)
   │   HTTPS, same-origin cookies
   ▼
[Reverse proxy, TLS, HSTS]       (user to provision — nginx / IIS / Azure Front Door)
   │
   ▼
Express API (Node 20, modular monolith)
   │        │
   │        └──► Private file storage ($STORAGE_DIR, outside web root)
   ▼
PostgreSQL 14+ (private network)
```

### Modules (`server/src/`)

| Module | Responsibility |
|---|---|
| `db/schema.ts` | Drizzle schema — single source of truth; migrations generated from it |
| `db/client.ts` | pg Pool + Drizzle instance |
| `db/filters.ts` | Shared `buildWhere()` — every filtered query goes through it |
| `db/summary.ts` | KPIs, status-card counts, chart aggregates |
| `lib/auth.ts` | argon2id hashing, session create/load/destroy, timing-safe equal |
| `lib/middleware.ts` | `requestId`, `attachUser`, `requireAuth`, `requireRole`, `authorize` |
| `lib/log.ts` | pino logger with redaction |
| `lib/parseFilters.ts` | strict zod → `Filters` type; rejects unknown params |
| `routes/auth.ts` | `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/change-password` |
| `routes/filters.ts` | `/filters` — zones, divisions, status options |
| `routes/summary.ts` | `/summary`, `/charts` |
| `routes/plazas.ts` | list/CRUD |
| `routes/files.ts` | upload / download / delete, magic-byte check, EXIF read |
| `routes/download.ts` | per-plaza PDF, ZIP bundle |

### Modules (`client/src/`)

| Module | Responsibility |
|---|---|
| `lib/api.ts` | typed fetch wrapper, 401 broadcaster, `ApiError` |
| `lib/auth.tsx` | React context: `me`, `login`, `logout`, 401-triggered logout |
| `lib/useFilters.ts` | URL-synced filter state (`?zone=&…`) |
| `lib/useAnimatedNumber.ts` | count-up tween, respects `prefers-reduced-motion` |
| `pages/Login.tsx` | login form |
| `pages/Dashboard.tsx` | composes header, filter bar, chips, KPIs, cards, charts, table, drawer |
| `pages/PlazaForm.tsx` | create/edit with live-calculated totals |
| `components/*` | presentational pieces (Header, FilterBar, FilterChips, KpiStrip, StatusCards, Charts, PlazaTable, PlazaDrawer, StatusPill) |

## Decisions

Short rationale per decision. ADRs in `docs/adr/`.

1. **Modular monolith, same-origin deploy.** Small dataset (92 rows). One Express app; SPA and API served from one origin so cookies, CORS and CSP stay simple.
2. **Session cookies, not JWT.** Server-side sessions in Postgres (one row per login). Rotatable, revocable, no secret in the client.
3. **Drizzle only.** No raw SQL except via `sql` helper for generated columns and aggregates. Generated columns compute totals in Postgres so UI and PDF share one source of truth.
4. **No `localStorage` for auth state.** Session cookie is `HttpOnly`; UI learns the user from `/auth/me`.
5. **Self-hosted fonts.** `script-src 'self'` can stay strict; no Google Fonts in CSP.
6. **Three roles.** Viewer / Editor / Admin — no division scoping (per user confirmation 2026-11-02).
7. **No external map provider in v1.** CSP stays `connect-src 'self'`. Map view can be added later behind a CSP exception + ADR.

## Environments

| Env | Where | DB | Secrets |
|---|---|---|---|
| dev | laptop | local Postgres (`toll`) | `.env` |
| staging | CONFIRM | separate DB | secret manager (CONFIRM) |
| prod | CONFIRM | private network DB | secret manager (CONFIRM) |

## Open architecture items (brief section 7)

- Hosting target (public internet vs government network) — Q1
- Secret manager choice — Q6
- Antivirus service — Q8
- Map provider — Q9
