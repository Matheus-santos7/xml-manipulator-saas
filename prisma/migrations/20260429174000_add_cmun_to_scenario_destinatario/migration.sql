-- Add IBGE municipality code to scenario destination data
ALTER TABLE "ScenarioDestinatario"
ADD COLUMN "cMun" TEXT;
