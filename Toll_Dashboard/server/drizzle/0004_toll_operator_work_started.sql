-- Add "Work started" to Name of Toll Operator and reorder so Not Feasible is last.
-- No plaza data changes.

INSERT INTO "status_options" ("field", "label", "tone", "sort_order")
VALUES ('toll_operator', 'Work started', 'progress', 20)
ON CONFLICT ("field", "label") DO NOTHING;--> statement-breakpoint

UPDATE "status_options" SET "sort_order" = 30
WHERE "field" = 'toll_operator' AND "label" = 'Not Feasible';
