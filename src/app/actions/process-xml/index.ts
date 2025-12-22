"use server";

import { db } from "@/app/lib/db";
import { logScenarioAndFiles } from "@/app/actions/process-xml/logging";
import { prepararArquivosParaProcessamento } from "@/app/actions/process-xml/prepare-files";
import { prepararMapeamentosELog } from "@/app/actions/process-xml/map-keys";
import { editarArquivosEAtualizarReferencias } from "@/app/actions/process-xml/edit-files";

/**
 * Função servidor responsável por orquestrar todo o fluxo de processamento de XML:
 *  - validação do cenário e arquivos recebidos do formulário
 *  - busca dos dados completos do cenário no banco (emitente, destinatário, produtos, impostos etc.)
 *  - preparação e renomeação inicial dos arquivos
 *  - cálculo de mapeamento de chaves (NFe antiga → nova)
 *  - edição dos XMLs de acordo com o cenário (dados cadastrais, datas, CST, reforma tributária)
 *  - montagem do payload final com relatórios e arquivos processados para o frontend.
 *
 * A assinatura (FormData → objeto com success, message, processedFiles, etc.) é mantida
 * compatível com a implementação original usada pelo componente do manipulador.
 */
export async function processarArquivosXml(formData: FormData) {
  try {
    // Extrai do FormData o ID do cenário selecionado e a lista de arquivos enviados.
    const scenarioId = formData.get("scenarioId") as string;
    const files = formData.getAll("files") as File[];

    // Se faltam dados mínimos, encerra cedo com mensagem amigável.
    if (!scenarioId || files.length === 0) {
      return { success: false, message: "Cenário ou arquivos faltando." };
    }

    // Carrega o cenário completo do banco, incluindo todas as entidades relacionadas
    // necessárias para decidir como os XMLs serão transformados.
    const scenario = await db.scenario.findUnique({
      where: {
        id: scenarioId,
        deletedAt: null,
      },
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

    // Ponto único para logging/observabilidade do cenário e arquivos processados.
    logScenarioAndFiles(scenario, files, scenarioId);
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
        // Resultado de edição estrutural de XML (emitente, datas, CST, etc.)
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
    console.error("Erro ao processar arquivos XML:", error);
    return {
      success: false,
      message: "Erro ao processar arquivos. Por favor, tente novamente.",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}
