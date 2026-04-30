-- Persist optional distribution center name selected/sorted in scenario editor
ALTER TABLE "ScenarioDestinatario"
ADD COLUMN "centroDistribuicao" TEXT;
