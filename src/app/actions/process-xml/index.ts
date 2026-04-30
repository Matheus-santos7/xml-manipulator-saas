"use server";

import { db } from "@/lib/db";
import {
  logScenarioAndFiles,
  prepararArquivosParaProcessamento,
  prepararMapeamentosELog,
  editarArquivosEAtualizarReferencias,
} from "@/lib/actions/process-xml";
import { mascararXmls } from "@/lib/masking/xml-masking";
import type { Prisma } from "@prisma/client";

/**
 * Função servidor responsável por orquestrar todo o fluxo de processamento de XML:
 *  - validação do cenário e arquivos recebidos do formulário
 *  - busca dos dados completos do cenário no banco (emitente, destinatário e produtos)
 *  - preparação e renomeação inicial dos arquivos
 *  - cálculo de mapeamento de chaves (NFe antiga → nova)
 *  - edição dos XMLs de acordo com o cenário (dados cadastrais e datas)
 *  - montagem do payload final com relatórios e arquivos processados para o frontend.
 *
 */
export async function processarArquivosXml(formData: FormData) {
  try {
    // Extrai do FormData o ID do cenário (quando houver) e a lista de arquivos enviados.
    const scenarioIdRaw = formData.get("scenarioId");
    const scenarioId = typeof scenarioIdRaw === "string" ? scenarioIdRaw : "";
    const maskScenarioDataRaw = formData.get("maskScenarioData");
    const maskScenarioData =
      typeof maskScenarioDataRaw === "string"
        ? maskScenarioDataRaw === "true"
        : true;
    const files = formData.getAll("files") as File[];

    // Se não há arquivos, encerra cedo com mensagem amigável.
    if (files.length === 0) {
      return { success: false, message: "Nenhum arquivo enviado." };
    }

    // Quando a flag de mascaramento estiver ativa e nenhum cenário for selecionado,
    // primeiro aplicamos a lógica de renomeação (apenas para definir o novo nome)
    // e, em seguida, mascaramos os dados sensíveis dos XMLs, sem aplicar regras de cenário.
    if (maskScenarioData && !scenarioId) {
      const { filesForProcessing, renameReport } =
        await prepararArquivosParaProcessamento(files);

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

      const mascarados = mascararXmls(
        filesForProcessing.map((file) => {
          const renameInfo = renameMap.get(file.name);
          return {
            name: renameInfo?.newName || file.name,
            content: file.content,
          };
        })
      ).map((masked) => {
        const renameInfo = renameMap.get(masked.originalName);
        const logs = [...masked.logs];
        if (renameInfo?.message) {
          logs.unshift(renameInfo.message);
        }
        return {
          ...masked,
          newName: renameInfo?.newName || masked.newName,
          status: renameInfo?.status === "renamed" ? "success" : masked.status,
          logs,
        };
      });

      return {
        success: true,
        message: "XMLs renomeados (quando aplicável) e mascarados com sucesso.",
        processedFiles: mascarados,
      };
    }

    // A partir daqui, é obrigatório ter cenário para aplicar regras de edição.
    if (!scenarioId) {
      return {
        success: false,
        message:
          "Cenário não informado. Se deseja apenas mascarar dados, ative a opção de mascaramento.",
      };
    }

    // Carrega cenário + relações sem depender do include integral de ProfileTaxRules.
    // Em ambiente dev, o Prisma Client pode ficar cacheado com colunas antigas
    // (ex.: headers) e quebrar com P2022 mesmo com DB já migrado.
    const scenarioBase = await db.scenario.findUnique({
      where: {
        id: scenarioId,
        deletedAt: null,
      },
      include: {
        ScenarioEmitente: true,
        ScenarioDestinatario: true,
        ScenarioProduto: true,
        Profile: true,
      },
    });

    if (!scenarioBase) {
      return { success: false, message: "Cenário não encontrado." };
    }

    let profileTaxRules: { rules: Prisma.JsonValue | null } | null = null;
    try {
      // Caminho padrão (rápido) — funciona quando o client está alinhado.
      profileTaxRules = await db.profileTaxRules.findUnique({
        where: { profileId: scenarioBase.profileId },
        select: { rules: true },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isLegacyHeadersError =
        msg.includes("ProfileTaxRules.headers") || msg.includes("Argument `headers`");
      if (!isLegacyHeadersError) throw error;

      // Fallback resiliente para client cacheado em dev:
      const rows = await db.$queryRawUnsafe<Array<{ rules: Prisma.JsonValue }>>(
        `SELECT "rules" FROM "ProfileTaxRules" WHERE "profileId" = $1 LIMIT 1`,
        scenarioBase.profileId
      );
      profileTaxRules = rows[0] ? { rules: rows[0].rules } : null;
    }

    const scenario = {
      ...scenarioBase,
      Profile: {
        ...scenarioBase.Profile,
        ProfileTaxRules: profileTaxRules,
      },
    };

    // Ponto único para logging/observabilidade do cenário e arquivos processados.
    if (maskScenarioData) {
      logScenarioAndFiles(scenario, files, scenarioId);
    }
    // 1) Lê o conteúdo dos arquivos recebidos e executa a renomeação inicial
    const { filesForProcessing, renameReport } =
      await prepararArquivosParaProcessamento(files);

    // 2) Calcula o mapeamento de chaves com base nas regras do cenário
    const { chaveMapping, referenceMap, chaveVendaNova } =
      await prepararMapeamentosELog(filesForProcessing, scenario);

    // 3) Aplica efetivamente as alterações nos XMLs
    const {
      arquivosEditados,
      resultadosEdicao,
      totalEditados,
      totalErros,
      totalSemAlteracao,
    } = editarArquivosEAtualizarReferencias({
      filesForProcessing,
      scenario,
      chaveMapping,
      referenceMap,
      chaveVendaNova,
    });

    // Constrói um mapa auxiliar para recuperar rapidamente informações de renomeação
    // por nome de arquivo original.
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

    // Monta o payload final esperado pelo frontend, incluindo:
    //  - relatório de renomeação
    //  - relatório de edição (totais e detalhes)
    //  - lista de arquivos processados com nome final, conteúdo e logs agregados
    return {
      success: true,
      message: "Arquivos processados com sucesso.",
      renameReport,
      chaveMapping,
      referenceMap,
      edicaoReport: {
        // Totais consolidados vindos do editor de XML
        totalEditados,
        totalErros,
        totalSemAlteracao,
        // Lista detalhada de alterações/erros por arquivo
        detalhes: resultadosEdicao,
      },
      // Para cada arquivo editado, montamos um objeto rico usado pela UI
      // do manipulador para exibir nome final, conteúdo e logs de processamento.
      processedFiles: arquivosEditados.map((file, index) => {
        // Resultado de renomeação para este arquivo específico (se houver)
        const renameInfo = renameMap.get(file.name);
        // Resultado de edição estrutural de XML (emitente, destinatário, produtos e datas)
        const edicaoInfo = resultadosEdicao[index];

        // Array de mensagens human-readable que será exibido na interface
        const logs: string[] = [];

        // 1) Mensagem de renomeação (ex.: novo nome ou motivo de não renomear)
        if (renameInfo?.message) {
          logs.push(renameInfo.message);
        }

        // 2) Mensagens de alterações realizadas no conteúdo XML
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
          // 3) Caso a edição tenha falhado, registramos o erro principal
          logs.push(`[ERRO na edição] ${edicaoInfo.erro}`);
        }

        // Objeto final por arquivo, consumido diretamente pelo frontend
        return {
          // Nome original enviado pelo usuário
          originalName: file.name,
          // Nome final após a etapa de renomeação (ou o original, se não renomeado)
          newName: renameInfo?.newName || file.name,
          // Conteúdo XML já editado
          content: file.content,
          // Status simples para destacar na UI se o arquivo foi efetivamente renomeado
          status: renameInfo?.status === "renamed" ? "success" : "skipped",
          // Lista de mensagens para exibição em logs detalhados
          logs,
        };
      }),
    };
  } catch (error) {
    const scenarioIdParam = formData.get("scenarioId");
    console.error("Erro ao processar arquivos XML", {
      scenarioId:
        typeof scenarioIdParam === "string" ? scenarioIdParam : undefined,
      error,
    });
    return {
      success: false,
      message: "Erro ao processar arquivos. Por favor, tente novamente.",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}
