/*
  Warnings:

  - You are about to drop the column `cfop` on the `CstMapping` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[scenarioId,tipoOperacao]` on the table `CstMapping` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tipoOperacao` to the `CstMapping` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CstMapping" DROP COLUMN "cfop",
ADD COLUMN     "tipoOperacao" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CstMapping_scenarioId_tipoOperacao_key" ON "CstMapping"("scenarioId", "tipoOperacao");
