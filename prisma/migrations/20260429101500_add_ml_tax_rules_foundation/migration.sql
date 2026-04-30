ALTER TABLE "Scenario"
ADD COLUMN "aplicar_regras_tributarias" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ScenarioProduto"
ADD COLUMN "regraTributariaNome" TEXT;

CREATE TABLE "ProfileTaxRules" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "totalRules" INTEGER NOT NULL DEFAULT 0,
  "headers" JSONB NOT NULL,
  "rules" JSONB NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfileTaxRules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfileTaxRules_profileId_key" ON "ProfileTaxRules"("profileId");

ALTER TABLE "ProfileTaxRules"
ADD CONSTRAINT "ProfileTaxRules_profileId_fkey"
FOREIGN KEY ("profileId")
REFERENCES "Profile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
