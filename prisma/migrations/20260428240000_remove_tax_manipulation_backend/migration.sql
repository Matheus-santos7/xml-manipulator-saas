-- Remove Mercado Livre / planilha tributária por empresa
DROP TABLE IF EXISTS "ProfileTaxRules";

-- Remove impostos persistidos por cenário
DROP TABLE IF EXISTS "ScenarioImposto";

ALTER TABLE "Scenario" DROP COLUMN IF EXISTS "editar_impostos";
ALTER TABLE "Scenario" DROP COLUMN IF EXISTS "zerar_ipi_remessa_retorno";
ALTER TABLE "Scenario" DROP COLUMN IF EXISTS "zerar_ipi_venda";
ALTER TABLE "Scenario" DROP COLUMN IF EXISTS "aplicar_reducao_aliq";

ALTER TABLE "ScenarioProduto" DROP COLUMN IF EXISTS "regraTributariaNome";

DELETE FROM "Scenario" WHERE "name" = '__ML_TAX_RULES_TEMPLATE__';
