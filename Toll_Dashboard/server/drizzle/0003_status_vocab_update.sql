-- Status vocabulary update (user request, 2026-11-04).
-- Preserves all plaza counts: nothing is deleted, only label/tone/sort_order changes
-- plus one INSERT for the new "Yet to be Processed" option under toll_notification.

-- 1. Civil Work: "Work not started" -> "Yet to be Started", tone pending -> neutral.
UPDATE "status_options"
SET "label" = 'Yet to be Started', "tone" = 'neutral', "sort_order" = 30
WHERE "field" = 'civil' AND "label" = 'Work not started';--> statement-breakpoint

UPDATE "status_options" SET "sort_order" = 20
WHERE "field" = 'civil' AND "label" = 'Not Feasible';--> statement-breakpoint

-- 2. Layout: "In-process" -> "In Process", reorder so Not Feasible is last.
UPDATE "status_options" SET "label" = 'In Process', "sort_order" = 20
WHERE "field" = 'layout' AND "label" = 'In-process';--> statement-breakpoint

UPDATE "status_options" SET "sort_order" = 30
WHERE "field" = 'layout' AND "label" = 'Not Feasible';--> statement-breakpoint

-- 3. System Integrator: pull Not Feasible up next to RFP Floated.
UPDATE "status_options" SET "sort_order" = 20
WHERE "field" = 'system_integrator' AND "label" = 'Not Feasible';--> statement-breakpoint

-- 4. Toll Notification: "In-process" -> "In Process"; add "Yet to be Processed".
UPDATE "status_options" SET "label" = 'In Process', "sort_order" = 10
WHERE "field" = 'toll_notification' AND "label" = 'In-process';--> statement-breakpoint

UPDATE "status_options" SET "sort_order" = 30
WHERE "field" = 'toll_notification' AND "label" = 'Not Feasible';--> statement-breakpoint

INSERT INTO "status_options" ("field", "label", "tone", "sort_order")
VALUES ('toll_notification', 'Yet to be Processed', 'neutral', 20)
ON CONFLICT ("field", "label") DO NOTHING;--> statement-breakpoint

-- 5. Toll Operator: left unchanged (per user confirmation).
