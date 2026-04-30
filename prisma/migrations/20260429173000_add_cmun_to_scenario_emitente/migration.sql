-- Add IBGE municipality code to scenario emitter data
ALTER TABLE "ScenarioEmitente"
ADD COLUMN "cMun" TEXT;
