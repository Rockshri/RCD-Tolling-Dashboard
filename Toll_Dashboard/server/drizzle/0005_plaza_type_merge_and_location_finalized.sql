-- (1) Normalise Plaza Mix Type: merge "(1+1) = 2 LANE TOLL PLAZA" into
--     "1+1 = 2 LANE TOLL PLAZA" (the more common spelling, 19 rows vs 2).
--     Raw text unchanged for rows that already match the canonical form.
UPDATE "toll_plazas"
SET "plaza_type_raw" = '1+1 = 2 LANE TOLL PLAZA'
WHERE "plaza_type_raw" = '(1+1) = 2 LANE TOLL PLAZA';--> statement-breakpoint

-- (2) New column: Location Finalized. Nullable; existing 92 rows get NULL.
--     Allowed values validated at the API layer: 'Yes', 'Yet to be Finalized',
--     'Not-Feasible', 'No'.
ALTER TABLE "toll_plazas" ADD COLUMN "location_finalized" text;--> statement-breakpoint

-- Index to keep the KPI filter + card queries cheap.
CREATE INDEX "toll_plazas_location_finalized_idx" ON "toll_plazas" ("location_finalized");
