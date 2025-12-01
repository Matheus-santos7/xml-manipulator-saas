-- CreateTable
CREATE TABLE "DivergenceSummary" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalErp" INTEGER NOT NULL,
    "totalMl" INTEGER NOT NULL,
    "diferenca" INTEGER NOT NULL,

    CONSTRAINT "DivergenceSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DivergentNote" (
    "id" TEXT NOT NULL,
    "summaryId" TEXT NOT NULL,
    "nfKey" TEXT NOT NULL,
    "status_conciliacao" TEXT NOT NULL,

    CONSTRAINT "DivergentNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DivergentNote_nfKey_key" ON "DivergentNote"("nfKey");

-- AddForeignKey
ALTER TABLE "DivergentNote" ADD CONSTRAINT "DivergentNote_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "DivergenceSummary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
