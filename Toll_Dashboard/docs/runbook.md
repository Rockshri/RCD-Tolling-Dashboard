# Runbook

Operational procedures. Every destructive step is marked **destructive** — stop and confirm before running in production.

## 1. Set up database roles (one-time)

Postgres GRANTs enforce "app has no UPDATE/DELETE on audit_log" and separate migrator from runtime. The schema is created by `migrator`; the API runs as `app`.

```sql
-- as a Postgres superuser:
CREATE ROLE migrator LOGIN PASSWORD '...';           -- used by drizzle-kit migrate
CREATE ROLE app      LOGIN PASSWORD '...';           -- used by the Express API

GRANT USAGE ON SCHEMA public TO app, migrator;
GRANT CREATE ON SCHEMA public TO migrator;

-- after each migration:
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO app;
GRANT USAGE, SELECT ON ALL SEQUENCES                  IN SCHEMA public TO app;
REVOKE UPDATE, DELETE ON audit_log, import_log        FROM app;        -- append-only
```

For local development the project uses one role (`postgres`) for simplicity.

## 2. Create the first admin

```bash
cd server
npm run db:create-admin -- <username> "<password>" admin
```

Forces password change on first login.

## 3. Deploy

1. Pull commit onto the server, `npm ci` in `server/` and `client/`.
2. `cd client && npm run build`.
3. `cd server && npm run db:migrate` (as `migrator` role).
4. Re-apply the GRANTs from step 1.
5. Point the reverse proxy at `server/dist/index.js` (or run `npm start`), with HTTPS and HSTS at the proxy.
6. Smoke test: `curl -k https://<host>/api/healthz` → `{"ok":true}`.

## 4. Rotate the admin password

If the admin password is lost:

```bash
cd server
npm run db:create-admin -- admin "<new password>" admin
```

The script `UPSERT`s the user by username — safe to re-run.

## 5. Add or disable a user

Add: use the admin UI once built, or temporarily call `npm run db:create-admin -- <user> "<pw>" <role>` (role = viewer | editor | admin).

Disable (destructive to login, non-destructive to data):

```sql
UPDATE users SET disabled = true WHERE username = '<name>';
```

To force logout of a user already signed in:

```sql
DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE username = '<name>');
```

## 6. Back up and restore

**Database** — logical dump:

```bash
pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" > backup-$(date +%F).dump
```

**File storage** — tar `STORAGE_DIR` and store alongside the DB backup.

**Restore drill** (perform quarterly; record result in `docs/reports/restore-YYYY-MM-DD.md`):

```bash
createdb toll_restore
pg_restore --no-owner --no-privileges -d toll_restore backup-<date>.dump
tar -xzf storage-<date>.tar.gz -C /tmp/restore-check
# Point a staging API at toll_restore + /tmp/restore-check and run the integration tests.
```

## 7. Roll back a migration

Drizzle does not generate down migrations. Procedure:

1. **destructive**: `psql $DATABASE_URL -c 'BEGIN; -- hand-written down SQL; COMMIT;'` after review by a second engineer.
2. Edit `drizzle/_journal.json` to remove the rolled-back migration entry.
3. Remove the SQL file.
4. Commit all three changes together.

Avoid rollbacks in production; prefer a forward fix.

## 8. Rotate secrets

- `DATABASE_URL` (app role password): update secret store, redeploy the API. No code change.
- Session cookie signing: the current design uses opaque random IDs stored in the DB, so there is no signing secret to rotate. Deleting a row revokes a session.
- `cookie.secret`: not used (no signed cookies).

## 9. Logs and incidents

- Logs are JSON on stdout via pino. Pipe to the host's log collector.
- `requestId` is logged on every request and returned to the client in `x-request-id` and in error bodies — grep by it to trace a user complaint.
- On a suspected security incident: rotate `app` DB password; `DELETE FROM sessions` to force everyone out; preserve `audit_log` (append-only); hand off to the security team.
