-- Align production schema drift with current Prisma datamodel.
-- Uses IF EXISTS / IF NOT EXISTS to remain safe if partially applied.

ALTER TABLE "Scenario"
ADD COLUMN IF NOT EXISTS "editar_destinatario_remessa" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Scenario"
ADD COLUMN IF NOT EXISTS "destinatarioRemessaMlCdId" TEXT;

ALTER TABLE "ScenarioProduto"
ADD COLUMN IF NOT EXISTS "vUnComVenda" TEXT;

ALTER TABLE "ScenarioProduto"
ADD COLUMN IF NOT EXISTS "vUnComTransferencia" TEXT;

ALTER TABLE "ScenarioProduto"
ADD COLUMN IF NOT EXISTS "pesoBruto" TEXT;

ALTER TABLE "ScenarioProduto"
ADD COLUMN IF NOT EXISTS "pesoLiquido" TEXT;

ALTER TABLE "ProfileTaxRules"
DROP COLUMN IF EXISTS "headers";

DROP TABLE IF EXISTS "DivergentNote";
DROP TABLE IF EXISTS "DivergenceSummary";
