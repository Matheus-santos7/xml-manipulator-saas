"use server";

import { PrismaClient } from "@prisma/client";
import { processarRenomeacao, gerarResumoRenomeacao } from "@/lib/xmlRenamer";

const prisma = new PrismaClient();

/**
 * Função responsável por receber os arquivos XML do frontend e logar no console.
 *
 * @param formData - Dados do formulário contendo o ID do cenário e os arquivos.
 */
export async function processarArquivosXml(formData: FormData) {
  const scenarioId = formData.get("scenarioId") as string;
  const files = formData.getAll("files") as File[];

  if (!scenarioId || files.length === 0) {
    return { success: false, message: "Cenário ou arquivos faltando." };
  }

  // Buscar o cenário completo com todas as relações
  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    include: {
      ScenarioEmitente: true,
      ScenarioDestinatario: true,
      ScenarioProduto: true,
      ScenarioImposto: true,
      CstMapping: true,
      TaxReformRule: true,
    },
  });

  if (!scenario) {
    return { success: false, message: "Cenário não encontrado." };
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`INICIANDO PROCESSAMENTO DE ARQUIVOS XML`);
  console.log(`${"=".repeat(60)}\n`);

  console.log(`CENÁRIO: ${scenario.name}`);
  console.log(`ID: ${scenarioId}`);
  console.log(`Quantidade de arquivos: ${files.length}\n`);

  console.log(`${"=".repeat(60)}\n`);

  console.log(`${"─".repeat(60)}`);
  console.log(`FLAGS DE MANIPULAÇÃO ATIVAS:`);
  console.log(`${"─".repeat(60)}\n`);

  const flags = [
    {
      key: "editar_emitente",
      label: "Editar Emitente",
      value: scenario.editar_emitente,
    },
    {
      key: "editar_destinatario_pj",
      label: "Editar Destinatário PJ",
      value: scenario.editar_destinatario_pj,
    },
    {
      key: "editar_destinatario_pf",
      label: "Editar Destinatário PF",
      value: scenario.editar_destinatario_pf,
    },
    {
      key: "editar_produtos",
      label: "Editar Produtos",
      value: scenario.editar_produtos,
    },
    {
      key: "editar_impostos",
      label: "Editar Impostos",
      value: scenario.editar_impostos,
    },
    { key: "editar_data", label: "Editar Data", value: scenario.editar_data },
    {
      key: "editar_refNFe",
      label: "Editar Referência NFe",
      value: scenario.editar_refNFe,
    },
    { key: "editar_cst", label: "Editar CST", value: scenario.editar_cst },
    {
      key: "zerar_ipi_remessa_retorno",
      label: "Zerar IPI Remessa/Retorno",
      value: scenario.zerar_ipi_remessa_retorno,
    },
    {
      key: "zerar_ipi_venda",
      label: "Zerar IPI Venda",
      value: scenario.zerar_ipi_venda,
    },
    {
      key: "reforma_tributaria",
      label: "Reforma Tributária",
      value: scenario.reforma_tributaria,
    },
    {
      key: "alterar_serie",
      label: "Alterar Série",
      value: scenario.alterar_serie,
    },
    { key: "alterar_cUF", label: "Alterar cUF", value: scenario.alterar_cUF },
    {
      key: "aplicar_reducao_aliq",
      label: "Aplicar Redução de Alíquota",
      value: scenario.aplicar_reducao_aliq,
    },
  ];

  const activeFlags = flags.filter((f) => f.value);

  if (activeFlags.length === 0) {
    console.log("Nenhuma flag de manipulação está ativa.\n");
  } else {
    activeFlags.forEach((flag) => {
      console.log(`   ${flag.label}`);
    });
    console.log();
  }

  // Exibir dados adicionais se flags relacionadas estiverem ativas
  if (scenario.alterar_serie && scenario.nova_serie) {
    console.log(`   Nova Série: ${scenario.nova_serie}`);
  }
  if (scenario.alterar_cUF && scenario.novo_cUF) {
    console.log(`   Novo cUF: ${scenario.novo_cUF}`);
  }
  if (scenario.editar_data && scenario.nova_data) {
    console.log(`   Nova Data: ${scenario.nova_data}`);
  }

  if (scenario.editar_emitente && scenario.ScenarioEmitente) {
    console.log(`\n   Dados do Emitente configurados`);
  }
  if (
    (scenario.editar_destinatario_pj || scenario.editar_destinatario_pf) &&
    scenario.ScenarioDestinatario
  ) {
    console.log(`   Dados do Destinatário configurados`);
  }
  if (scenario.editar_produtos && scenario.ScenarioProduto) {
    console.log(`   Dados de Produto configurados`);
  }
  if (scenario.editar_impostos && scenario.ScenarioImposto) {
    console.log(`   Dados de Impostos configurados`);
  }
  if (scenario.editar_cst && scenario.CstMapping.length > 0) {
    console.log(
      `   ${scenario.CstMapping.length} mapeamento(s) de CST configurado(s)`
    );
  }
  if (scenario.reforma_tributaria && scenario.TaxReformRule.length > 0) {
    console.log(
      `   ${scenario.TaxReformRule.length} regra(s) de Reforma Tributária configurada(s)`
    );
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`ARQUIVOS RECEBIDOS:`);
  console.log(`${"─".repeat(60)}\n`);

  for (const file of files) {
    console.log(`   ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
  }

  console.log(`\n${"=".repeat(60)}\n`);

  // ========== ETAPA 1: ORGANIZAÇÃO E RENOMEAÇÃO DOS ARQUIVOS ==========
  // Preparar arquivos para processamento
  const filesForProcessing: Array<{ name: string; content: string }> = [];

  for (const file of files) {
    try {
      const content = await file.text();
      filesForProcessing.push({
        name: file.name,
        content: content,
      });
    } catch (error) {
      console.error(`Erro ao ler arquivo ${file.name}:`, error);
    }
  }

  // Processar renomeação
  const renameReport = processarRenomeacao(filesForProcessing);

  // Exibir resumo da renomeação
  console.log(gerarResumoRenomeacao(renameReport));
  console.log("");

  // ========== ETAPA 2: MANIPULAÇÃO E EDIÇÃO DOS ARQUIVOS (EM DESENVOLVIMENTO) ==========
  // console.log(`${"=".repeat(60)}`);
  // console.log(`ETAPA 2: MANIPULAÇÃO E EDIÇÃO DOS ARQUIVOS`);
  // console.log(`${"=".repeat(60)}\n`);

  // Criar mapa de renomeação por nome de arquivo original
  const renameMap = new Map<
    string,
    { newName: string | null; status: string; message?: string }
  >();
  for (const detail of renameReport.details) {
    renameMap.set(detail.originalName, {
      newName: detail.newName,
      status: detail.status,
      message: detail.message,
    });
  }

  return {
    success: true,
    message: "Arquivos processados com sucesso.",
    renameReport: renameReport,
    processedFiles: filesForProcessing.map((file) => {
      const renameInfo = renameMap.get(file.name);
      return {
        originalName: file.name,
        newName: renameInfo?.newName || file.name,
        content: file.content,
        status: renameInfo?.status === "renamed" ? "success" : "skipped",
        logs: renameInfo?.message ? [renameInfo.message] : [],
      };
    }),
  };
}
