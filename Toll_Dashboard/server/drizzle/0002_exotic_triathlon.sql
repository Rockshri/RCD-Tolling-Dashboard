-- Rename the Postgres enum value `cancelled` to `not_feasible` on `status_tone`.
-- ALTER TYPE ... RENAME VALUE is a single DDL that updates every row in place —
-- no data copy, no transient down-cast through text. Postgres 10+.
ALTER TYPE "public"."status_tone" RENAME VALUE 'cancelled' TO 'not_feasible';--> statement-breakpoint

-- Relabel display strings in status_options. The 14-row counts stay the same.
UPDATE "status_options" SET "label" = 'Not Feasible' WHERE "label" = 'Cancelled';--> statement-breakpoint

-- Normalise Toll Notification spelling to match the new Layout vocabulary.
UPDATE "status_options" SET "label" = 'In-process' WHERE "label" IN ('In Process', 'In process');--> statement-breakpoint

-- Add the two new Layout options so the dropdown has Done, Not Feasible, In-process.
-- Idempotent via the (field,label) unique index.
INSERT INTO "status_options" ("field", "label", "tone", "sort_order")
VALUES
  ('layout', 'Not Feasible', 'not_feasible', 20),
  ('layout', 'In-process',   'progress',     30)
ON CONFLICT ("field", "label") DO NOTHING;
