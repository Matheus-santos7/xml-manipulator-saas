-- AlterTable
ALTER TABLE "DivergenceSummary" ADD COLUMN     "profileId" TEXT;

-- AddForeignKey
ALTER TABLE "DivergenceSummary" ADD CONSTRAINT "DivergenceSummary_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
