# ADR 0003 — No map provider in v1

Status: accepted (2026-11-02)

## Context

Brief 3.2 includes a map view as an optional feature. User answered "no map tiles" in the first scoping round. A map provider requires relaxing CSP (`img-src tile.openstreetmap.org`, `connect-src` for attribution) and adds a dependency.

## Decision

Ship v1 without the map view. Keep CSP strict (`default-src 'self'`, no third-party tile host). Coordinates are shown as text in the detail drawer; rows with `coords_need_review=true` surface a warning.

## Consequences

- CSP stays short; no third-party cache behaviour.
- Users who need geographic context must consult coordinates manually.
- Adding a map later: a new ADR, a CSP exception, and a route-level lazy-load so the dashboard page isn't delayed by map tiles.
