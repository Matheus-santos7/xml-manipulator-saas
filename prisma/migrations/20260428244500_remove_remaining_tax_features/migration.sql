DROP TABLE IF EXISTS "CstMapping";
DROP TABLE IF EXISTS "TaxReformRule";

ALTER TABLE "Scenario" DROP COLUMN IF EXISTS "editar_cst";
ALTER TABLE "Scenario" DROP COLUMN IF EXISTS "reforma_tributaria";
