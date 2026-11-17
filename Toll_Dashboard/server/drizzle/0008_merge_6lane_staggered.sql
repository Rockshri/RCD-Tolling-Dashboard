-- Merge "(2+1)x2 = 6 lane(Staggered)" (3 rows) into
-- "(2+1) X 2 = 6 LANE STAGGERED" (5 rows). Combined: 8 rows.
UPDATE "toll_plazas"
SET "plaza_type_raw" = '(2+1) X 2 = 6 LANE STAGGERED'
WHERE "plaza_type_raw" = '(2+1)x2 = 6 lane(Staggered)';
