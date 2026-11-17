-- (1) New column: users.email (nullable). Captured by admin at user creation.
ALTER TABLE "users" ADD COLUMN "email" text;--> statement-breakpoint

-- Case-insensitive uniqueness: no two users may share an email.
-- Index excludes NULL so multiple users without an email are still allowed.
CREATE UNIQUE INDEX "users_email_uq" ON "users" (lower("email")) WHERE "email" IS NOT NULL;--> statement-breakpoint

-- (2) Password-reset tokens. Plain token lives only in the email body + user's URL;
-- we store a sha256 hash so the DB dump alone cannot be used to log in as anyone.
CREATE TABLE "password_resets" (
  "id"         serial PRIMARY KEY,
  "user_id"    integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone NOT NULL,
  "used_at"    timestamp with time zone
);--> statement-breakpoint

CREATE UNIQUE INDEX "password_resets_token_hash_uq" ON "password_resets" ("token_hash");--> statement-breakpoint
CREATE INDEX "password_resets_user_idx" ON "password_resets" ("user_id");
