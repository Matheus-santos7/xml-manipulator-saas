-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CstMapping" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "cfop" TEXT NOT NULL,
    "icms" TEXT,
    "ipi" TEXT,
    "pis" TEXT,
    "cofins" TEXT,

    CONSTRAINT "CstMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "razaoSocial" TEXT,
    "endereco" JSONB,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "editar_emitente" BOOLEAN NOT NULL DEFAULT false,
    "editar_produtos" BOOLEAN NOT NULL DEFAULT false,
    "editar_impostos" BOOLEAN NOT NULL DEFAULT false,
    "editar_data" BOOLEAN NOT NULL DEFAULT false,
    "editar_refNFe" BOOLEAN NOT NULL DEFAULT false,
    "editar_cst" BOOLEAN NOT NULL DEFAULT false,
    "editar_destinatario_pj" BOOLEAN NOT NULL DEFAULT false,
    "editar_destinatario_pf" BOOLEAN NOT NULL DEFAULT false,
    "zerar_ipi_remessa_retorno" BOOLEAN NOT NULL DEFAULT false,
    "zerar_ipi_venda" BOOLEAN NOT NULL DEFAULT false,
    "reforma_tributaria" BOOLEAN NOT NULL DEFAULT false,
    "alterar_serie" BOOLEAN NOT NULL DEFAULT false,
    "alterar_cUF" BOOLEAN NOT NULL DEFAULT false,
    "aplicar_reducao_aliq" BOOLEAN NOT NULL DEFAULT false,
    "nova_data" TEXT,
    "nova_serie" TEXT,
    "novo_cUF" TEXT,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioDestinatario" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "cnpj" TEXT,
    "cpf" TEXT,
    "xNome" TEXT,
    "IE" TEXT,
    "xLgr" TEXT,
    "nro" TEXT,
    "xBairro" TEXT,
    "xMun" TEXT,
    "UF" TEXT,
    "CEP" TEXT,
    "fone" TEXT,

    CONSTRAINT "ScenarioDestinatario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioEmitente" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "cnpj" TEXT,
    "xNome" TEXT,
    "xLgr" TEXT,
    "nro" TEXT,
    "xCpl" TEXT,
    "xBairro" TEXT,
    "xMun" TEXT,
    "UF" TEXT,
    "fone" TEXT,
    "IE" TEXT,
    "CEP" TEXT,

    CONSTRAINT "ScenarioEmitente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioImposto" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "pFCP" TEXT,
    "pICMS" TEXT,
    "pICMSUFDest" TEXT,
    "pICMSInter" TEXT,
    "pPIS" TEXT,
    "pCOFINS" TEXT,
    "pIPI" TEXT,

    CONSTRAINT "ScenarioImposto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioProduto" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "xProd" TEXT,
    "cEAN" TEXT,
    "cProd" TEXT,
    "NCM" TEXT,
    "isPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ScenarioProduto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxReformRule" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "pIBSUF" TEXT,
    "pIBSMun" TEXT,
    "pCBS" TEXT,
    "vDevTrib" TEXT,
    "cClassTrib" TEXT,
    "CST" TEXT,
    "gIBSUF_gRed" JSONB,
    "gIBSMun_gRed" JSONB,
    "gCBS_gRed" JSONB,

    CONSTRAINT "TaxReformRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_cnpj_key" ON "Profile"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Scenario_profileId_name_key" ON "Scenario"("profileId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioDestinatario_scenarioId_key" ON "ScenarioDestinatario"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioEmitente_scenarioId_key" ON "ScenarioEmitente"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioImposto_scenarioId_key" ON "ScenarioImposto"("scenarioId");

-- CreateIndex
CREATE INDEX "ScenarioProduto_scenarioId_idx" ON "ScenarioProduto"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioProduto_scenarioId_ordem_key" ON "ScenarioProduto"("scenarioId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CstMapping" ADD CONSTRAINT "CstMapping_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioDestinatario" ADD CONSTRAINT "ScenarioDestinatario_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioEmitente" ADD CONSTRAINT "ScenarioEmitente_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioImposto" ADD CONSTRAINT "ScenarioImposto_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioProduto" ADD CONSTRAINT "ScenarioProduto_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxReformRule" ADD CONSTRAINT "TaxReformRule_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
