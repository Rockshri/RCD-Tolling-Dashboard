-- Merge "(1)x2 = 2 lane" (24 rows) into "1+1 = 2 LANE TOLL PLAZA" (21 rows)
-- so the Plaza Type Mix shows a single bucket for 2-lane toll plazas (45 rows).
UPDATE "toll_plazas"
SET "plaza_type_raw" = '1+1 = 2 LANE TOLL PLAZA'
WHERE "plaza_type_raw" = '(1)x2 = 2 lane';
