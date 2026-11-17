# ADR 0002 — Local disk file storage for v1

Status: accepted (2026-11-02)

## Context

Uploads: PDFs and geolocation images, up to 10 files per kind per plaza, 10 MB each. Brief 2.3.5 lists local disk and object storage as alternatives.

## Decision

Store under `$STORAGE_DIR` on the server disk (outside the web root), with keys of the form `{plazaId}/{uuid}.{ext}`. Original filename kept only as metadata, sanitised. Serve through `GET /plazas/:id/files/:fileId` with `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`, after auth.

## Consequences

- Simplest to run today — no cloud dependency.
- Backup must cover `$STORAGE_DIR` alongside the DB (runbook).
- To move to S3/Azure Blob later, swap the two helpers in `routes/files.ts` and `routes/download.ts`; the DB schema already stores `storageKey` as an opaque pointer.
