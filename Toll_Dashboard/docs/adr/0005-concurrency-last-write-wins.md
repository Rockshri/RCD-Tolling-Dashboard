# ADR 0005 — Concurrency: last write wins (interim)

Status: proposed (2026-11-02) — awaiting user answer on brief Q13

## Context

Brief 3.2 item 15 and section 7 Q13 ask whether concurrent edits should warn (optimistic check against `updatedAt`) or silently last-write-wins.

## Decision (interim)

Last write wins, with a complete audit log so lost writes are recoverable from history. The server already writes an `audit_log` row per changed field on every `PUT /plazas/:id`.

## Consequences

- Simple server code (no `If-Match`).
- A later migration to optimistic concurrency means:
  - add `If-Match: <updatedAt>` on the client PUT,
  - compare in the server before `UPDATE`, return 409 on mismatch,
  - show a conflict UI (keep the user's edits, show diff).
- Until then, two officers editing the same plaza simultaneously may overwrite each other, but neither write is lost — both appear in `audit_log`.
