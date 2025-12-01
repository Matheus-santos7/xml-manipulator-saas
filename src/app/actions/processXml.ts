"use server";

import { PrismaClient } from "@prisma/client";
import { processarRenomeacao, gerarResumoRenomeacao } from "@/lib/xmlRenamer";
import { getChaveInfoForMapping } from "@/lib/xmlExtractor";
import {
  prepararMapeamentosDeChaves,
  type DocumentoInfo,
  type ResultadoMapeamento,
} from "@/lib/chaveHelper";
import { editarChavesEmLote, type ResultadoEdicao } from "@/lib/xmlEditor";

const prisma = new PrismaClient();

/**
 * Prepara os mapeamentos de chaves antigas para novas
 * Baseado na função _prepara_mapeamentos do Python
 */
async function prepararMapeamentosChaves(
  files: Array<{ name: string; content: string }>,
  scenario: {
    editar_emitente: boolean;
    editar_data: boolean;
    alterar_cUF: boolean;
    alterar_serie: boolean;
    nova_data?: string | null;
    novo_cUF?: string | null;
    nova_serie?: string | null;
    ScenarioEmitente?: { cnpj?: string | null } | null;
  }
): Promise<ResultadoMapeamento> {
  // Extrai informações de todos os documentos
  const documentos: DocumentoInfo[] = [];

  for (const file of files) {
    const info = getChaveInfoForMapping(file.content, file.name);
    if (info && info.chave.length >= 43) {
      documentos.push(info);
    }
  }

  // Prepara os dados para o mapeamento
  const alterarEmitente = scenario.editar_emitente;
  const novoCnpj = scenario.ScenarioEmitente?.cnpj || null;
  const alterarData = scenario.editar_data;
  const novaData = scenario.nova_data || null;
  const alterarUF = scenario.alterar_cUF;
  const novoUF = scenario.novo_cUF || null;
  const alterarSerie = scenario.alterar_serie;
  const novaSerie = scenario.nova_serie || null;

  // Chama a função de mapeamento
  return prepararMapeamentosDeChaves(
    documentos,
    alterarEmitente,
    novoCnpj,
    alterarData,
    novaData,
    alterarUF,
    novoUF,
    alterarSerie,
    novaSerie
  );
}

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

  // ========== ETAPA 2: PREPARAÇÃO PARA MANIPULAÇÃO (MAPEAMENTO DE CHAVES) ==========
  console.log(`${"=".repeat(60)}`);
  console.log(`ETAPA 2: PREPARAÇÃO PARA MANIPULAÇÃO (MAPEAMENTO DE CHAVES)`);
  console.log(`${"=".repeat(60)}\n`);

  // Extrai informações de todos os documentos para mapeamento
  const { chaveMapping, referenceMap, chaveVendaNova } =
    await prepararMapeamentosChaves(filesForProcessing, scenario);

  console.log(`Resumo do Mapeamento:`);
  console.log(`   Chaves mapeadas: ${Object.keys(chaveMapping).length}`);
  console.log(`   Referências mapeadas: ${Object.keys(referenceMap).length}`);
  if (chaveVendaNova) {
    console.log(`   Chave da Venda Nova identificada`);
  }

  // Exibe detalhes das chaves mapeadas se houver alterações
  if (Object.keys(chaveMapping).length > 0) {
    console.log(`\nDetalhes das Chaves Alteradas:\n`);
    let count = 1;
    for (const [chaveAntiga, chaveNova] of Object.entries(chaveMapping)) {
      const numeroNota = chaveAntiga.substring(25, 34).replace(/^0+/, "");
      console.log(`   ${count}. NFe/CTe nº ${numeroNota}:`);
      console.log(`      Antiga: ${chaveAntiga}`);
      console.log(`      Nova:   ${chaveNova}`);

      // Mostra o que mudou
      const mudancas: string[] = [];
      if (chaveAntiga.substring(0, 2) !== chaveNova.substring(0, 2)) {
        mudancas.push(
          `UF: ${chaveAntiga.substring(0, 2)} → ${chaveNova.substring(0, 2)}`
        );
      }
      if (chaveAntiga.substring(2, 6) !== chaveNova.substring(2, 6)) {
        mudancas.push(
          `Data: ${chaveAntiga.substring(2, 6)} → ${chaveNova.substring(2, 6)}`
        );
      }
      if (chaveAntiga.substring(6, 20) !== chaveNova.substring(6, 20)) {
        mudancas.push(
          `CNPJ: ${chaveAntiga.substring(6, 20)} → ${chaveNova.substring(
            6,
            20
          )}`
        );
      }
      if (chaveAntiga.substring(22, 25) !== chaveNova.substring(22, 25)) {
        mudancas.push(
          `Série: ${chaveAntiga.substring(22, 25)} → ${chaveNova.substring(
            22,
            25
          )}`
        );
      }

      if (mudancas.length > 0) {
        console.log(`      Alterações: ${mudancas.join(", ")}`);
      }
      console.log();
      count++;
    }
  }

  // Exibe detalhes das referências se houver
  if (Object.keys(referenceMap).length > 0) {
    console.log(`Referências entre Documentos:\n`);
    for (const [chaveDoc, chaveRef] of Object.entries(referenceMap)) {
      const numDoc = chaveDoc.substring(25, 34).replace(/^0+/, "");
      const numRef = chaveRef.substring(25, 34).replace(/^0+/, "");
      console.log(`   NFe nº ${numDoc} referencia NFe nº ${numRef}`);
    }
    console.log();
  }

  console.log(`${"=".repeat(60)}\n`);

  // ========== ETAPA 3: MANIPULAÇÃO E EDIÇÃO DOS ARQUIVOS ==========
  console.log(`${"=".repeat(60)}`);
  console.log(`ETAPA 3: MANIPULAÇÃO E EDIÇÃO DOS ARQUIVOS`);
  console.log(`${"=".repeat(60)}\n`);

  // Sub-etapa 3.1: Edita as chaves nos XMLs usando os mapeamentos da ETAPA 2
  console.log(`Sub-etapa 3.1: Alteração de Chaves, Datas e Atributos\n`);

  // Prepara os dados do emitente para edição
  const novoEmitente =
    scenario.editar_emitente && scenario.ScenarioEmitente
      ? {
          CNPJ: (scenario.ScenarioEmitente.cnpj || "").replace(/\D/g, ""), // Remove máscara do CNPJ
          xNome: scenario.ScenarioEmitente.xNome || "",
          xFant: scenario.ScenarioEmitente.xNome || "", // Usa xNome como fallback para xFant
          IE: scenario.ScenarioEmitente.IE || "",
          IEST: undefined,
          IM: undefined,
          CNAE: undefined,
          CRT: undefined,
          xLgr: scenario.ScenarioEmitente.xLgr || "",
          nro: scenario.ScenarioEmitente.nro || "",
          xCpl: scenario.ScenarioEmitente.xCpl || "",
          xBairro: scenario.ScenarioEmitente.xBairro || "",
          cMun: undefined,
          xMun: scenario.ScenarioEmitente.xMun || "",
          UF: scenario.ScenarioEmitente.UF || "",
          CEP: (scenario.ScenarioEmitente.CEP || "").replace(/\D/g, ""), // Remove máscara do CEP
          cPais: undefined,
          xPais: undefined,
          fone: (scenario.ScenarioEmitente.fone || "").replace(/\D/g, ""), // Remove máscara do telefone
        }
      : null;

  // Prepara os dados do destinatário para edição
  const novoDestinatario =
    (scenario.editar_destinatario_pj || scenario.editar_destinatario_pf) &&
    scenario.ScenarioDestinatario
      ? {
          CNPJ:
            scenario.editar_destinatario_pj &&
            scenario.ScenarioDestinatario.cnpj
              ? scenario.ScenarioDestinatario.cnpj.replace(/\D/g, "")
              : undefined,
          CPF:
            scenario.editar_destinatario_pf && scenario.ScenarioDestinatario.cpf
              ? scenario.ScenarioDestinatario.cpf.replace(/\D/g, "")
              : undefined,
          xNome: scenario.ScenarioDestinatario.xNome || "",
          IE: scenario.ScenarioDestinatario.IE || "",
          xLgr: scenario.ScenarioDestinatario.xLgr || "",
          nro: scenario.ScenarioDestinatario.nro || "",
          xBairro: scenario.ScenarioDestinatario.xBairro || "",
          cMun: undefined,
          xMun: scenario.ScenarioDestinatario.xMun || "",
          UF: scenario.ScenarioDestinatario.UF || "",
          CEP: scenario.ScenarioDestinatario.CEP
            ? scenario.ScenarioDestinatario.CEP.replace(/\D/g, "")
            : "",
          cPais: undefined,
          xPais: undefined,
          fone: scenario.ScenarioDestinatario.fone
            ? scenario.ScenarioDestinatario.fone.replace(/\D/g, "")
            : "",
        }
      : null;

  // Prepara os dados dos produtos para edição (apenas se flag ativa)
  const produtos =
    scenario.editar_produtos &&
    scenario.ScenarioProduto &&
    scenario.ScenarioProduto.length > 0
      ? scenario.ScenarioProduto.map((p) => ({
          xProd: p.xProd || undefined,
          cEAN: p.cEAN || undefined,
          cProd: p.cProd || undefined,
          NCM: p.NCM || undefined,
          isPrincipal: p.isPrincipal,
          ordem: p.ordem,
        })).sort((a, b) => a.ordem - b.ordem) // Ordena por ordem crescente
      : null;

  // Prepara os mapeamentos de CST por Tipo de Operação (apenas se flag ativa)
  const cstMappings =
    scenario.editar_cst && scenario.CstMapping && scenario.CstMapping.length > 0
      ? scenario.CstMapping.map((m) => ({
          tipoOperacao: m.tipoOperacao as
            | "VENDA"
            | "DEVOLUCAO"
            | "RETORNO"
            | "REMESSA",
          icms: m.icms,
          ipi: m.ipi,
          pis: m.pis,
          cofins: m.cofins,
        }))
      : null;

  const resultadosEdicao = editarChavesEmLote(
    filesForProcessing,
    chaveMapping,
    referenceMap,
    chaveVendaNova,
    scenario.nova_data || null,
    scenario.novo_cUF || null,
    scenario.nova_serie || null,
    novoEmitente,
    novoDestinatario,
    produtos,
    cstMappings
  );

  // Exibe resumo da edição
  let totalEditados = 0;
  let totalErros = 0;
  let totalSemAlteracao = 0;

  console.log(`Resumo da Edição:\n`);

  for (const resultado of resultadosEdicao) {
    if (!resultado.sucesso) {
      totalErros++;
      console.log(`[ERRO] ${resultado.nomeArquivo}: ${resultado.erro}`);
    } else if (resultado.alteracoes.includes("Nenhuma alteração necessária")) {
      totalSemAlteracao++;
    } else {
      totalEditados++;
      console.log(`\n[OK] ${resultado.tipo}: ${resultado.nomeArquivo}`);
      for (const alteracao of resultado.alteracoes) {
        console.log(`   - ${alteracao}`);
      }
    }
  }

  console.log(`\nTotais:`);
  console.log(`   Arquivos editados: ${totalEditados}`);
  console.log(`   Sem alteração: ${totalSemAlteracao}`);
  console.log(`   Erros: ${totalErros}`);

  // Atualiza o conteúdo dos arquivos com as edições
  const arquivosEditados = filesForProcessing.map((file, index) => {
    const resultado = resultadosEdicao[index];
    return {
      ...file,
      content: resultado.conteudoEditado || file.content,
    };
  });

  // Sub-etapa 3.2: Atualização de Referências entre Notas
  console.log(`\n${"─".repeat(60)}`);
  console.log(`Sub-etapa 3.2: Atualização de Referências (refNFe e chave)\n`);

  // Converte chaveMapping para Map
  const chaveMappingMap = new Map(Object.entries(chaveMapping));

  if (chaveMappingMap.size > 0) {
    console.log(
      `Aplicando substituição de chaves antigas por novas em todas as referências...\n`
    );

    // Para cada arquivo, substitui TODAS as ocorrências de chaves antigas por novas
    // Isso garante que referências em tags <refNFe>, <chave>, etc sejam atualizadas
    const resultadosReferenciamento: Array<{
      nomeArquivo: string;
      alteracoes: string[];
    }> = [];

    for (let i = 0; i < arquivosEditados.length; i++) {
      const arquivo = arquivosEditados[i];
      let xmlAtualizado = arquivo.content;
      const alteracoesRef: string[] = [];

      // Para cada chave mapeada, substitui TODAS as ocorrências no XML
      chaveMappingMap.forEach((novaChave, chaveAntiga) => {
        // Verifica se a chave antiga aparece no XML (em qualquer lugar)
        if (xmlAtualizado.includes(chaveAntiga)) {
          // Regex global para substituir em tags <refNFe>, <chave>, ou qualquer outra
          const regexChaveEmTags = new RegExp(`(>)${chaveAntiga}(<)`, "g");

          const ocorrenciasBefore = (
            xmlAtualizado.match(regexChaveEmTags) || []
          ).length;

          if (ocorrenciasBefore > 0) {
            xmlAtualizado = xmlAtualizado.replace(
              regexChaveEmTags,
              `$1${novaChave}$2`
            );

            const numNota = chaveAntiga.substring(25, 34).replace(/^0+/, "");
            const numNotaNova = novaChave.substring(25, 34).replace(/^0+/, "");

            alteracoesRef.push(
              `Referência atualizada: nota nº ${numNota} → ${numNotaNova} (${ocorrenciasBefore} ocorrência(s))`
            );

            console.log(
              `   [${arquivo.name}] Substituiu chave ...${chaveAntiga.slice(
                -10
              )} por ...${novaChave.slice(-10)} (${ocorrenciasBefore}x)`
            );
          }
        }
      });

      // Se houve alterações, atualiza o conteúdo
      if (alteracoesRef.length > 0) {
        arquivosEditados[i] = {
          ...arquivo,
          content: xmlAtualizado,
        };

        resultadosReferenciamento.push({
          nomeArquivo: arquivo.name,
          alteracoes: alteracoesRef,
        });

        // Adiciona as alterações ao resultado da edição
        resultadosEdicao[i].alteracoes.push(...alteracoesRef);
      }
    }

    // Exibe resumo
    console.log();
    if (resultadosReferenciamento.length > 0) {
      console.log(`Resumo de Referências Atualizadas:\n`);
      for (const resultado of resultadosReferenciamento) {
        console.log(`   ✓ ${resultado.nomeArquivo}:`);
        for (const alteracao of resultado.alteracoes) {
          console.log(`     • ${alteracao}`);
        }
      }
    } else {
      console.log(
        `Nenhuma referência precisou ser atualizada (notas não se referenciam)\n`
      );
    }
  } else {
    console.log(
      `Nenhuma chave foi alterada, não há referências para atualizar\n`
    );
  }

  console.log(`\n${"=".repeat(60)}\n`);

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
    chaveMapping: chaveMapping,
    referenceMap: referenceMap,
    edicaoReport: {
      totalEditados,
      totalErros,
      totalSemAlteracao,
      detalhes: resultadosEdicao,
    },
    processedFiles: arquivosEditados.map((file, index) => {
      const renameInfo = renameMap.get(file.name);
      const edicaoInfo = resultadosEdicao[index];

      // Combina logs de renomeação e edição
      const logs: string[] = [];

      // Adiciona log de renomeação
      if (renameInfo?.message) {
        logs.push(renameInfo.message);
      }

      // Adiciona logs de edição
      if (edicaoInfo && edicaoInfo.sucesso) {
        if (
          edicaoInfo.alteracoes.length > 0 &&
          !edicaoInfo.alteracoes.includes("Nenhuma alteração necessária")
        ) {
          logs.push(`Edições realizadas (${edicaoInfo.tipo}):`);
          edicaoInfo.alteracoes.forEach((alteracao) => {
            logs.push(`  • ${alteracao}`);
          });
        }
      } else if (edicaoInfo && !edicaoInfo.sucesso) {
        logs.push(`[ERRO na edição] ${edicaoInfo.erro}`);
      }

      return {
        originalName: file.name,
        newName: renameInfo?.newName || file.name,
        content: file.content,
        status: renameInfo?.status === "renamed" ? "success" : "skipped",
        logs: logs,
      };
    }),
  };
}
