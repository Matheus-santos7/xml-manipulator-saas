-- CreateTable
CREATE TABLE "ProfileTaxRules" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sheetName" TEXT,
    "templateVersion" TEXT,
    "totalEntries" INTEGER NOT NULL DEFAULT 0,
    "totalRuleGroups" INTEGER NOT NULL DEFAULT 0,
    "totalColumns" INTEGER NOT NULL DEFAULT 0,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rules" JSONB NOT NULL,

    CONSTRAINT "ProfileTaxRules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfileTaxRules_profileId_key" ON "ProfileTaxRules"("profileId");

-- AddForeignKey
ALTER TABLE "ProfileTaxRules" ADD CONSTRAINT "ProfileTaxRules_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
