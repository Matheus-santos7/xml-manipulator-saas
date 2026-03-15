import { editarChavesEmLote, type ResultadoEdicao } from "@/lib/xml/editor";
import type { ArquivoParaProcessamento } from "./prepare-files";
import { buildEditorParams, type ScenarioForEditor } from "./build-editor-params";
import { updateReferencesInFiles } from "./update-references";

export type ResultadoEdicaoComTotais = {
  arquivosEditados: ArquivoParaProcessamento[];
  resultadosEdicao: ResultadoEdicao[];
  totalEditados: number;
  totalErros: number;
  totalSemAlteracao: number;
};

export function editarArquivosEAtualizarReferencias(args: {
  filesForProcessing: ArquivoParaProcessamento[];
  scenario: ScenarioForEditor;
  chaveMapping: Record<string, string>;
  referenceMap: Record<string, string>;
  chaveVendaNova?: string | null;
}): ResultadoEdicaoComTotais {
  const {
    filesForProcessing,
    scenario,
    chaveMapping,
    referenceMap,
    chaveVendaNova,
  } = args;

  const params = buildEditorParams(scenario);

  const resultadosEdicao = editarChavesEmLote(
    filesForProcessing,
    chaveMapping,
    referenceMap,
    chaveVendaNova ?? null,
    scenario.editar_data ? scenario.nova_data || null : null,
    scenario.alterar_cUF ? scenario.novo_cUF || null : null,
    scenario.alterar_serie ? scenario.nova_serie || null : null,
    params.novoEmitente,
    params.novoDestinatario,
    params.produtos,
    params.cstMappings,
    params.taxReformRule,
    params.impostosData
  );

  let totalEditados = 0;
  let totalErros = 0;
  let totalSemAlteracao = 0;
  for (const resultado of resultadosEdicao) {
    if (!resultado.sucesso) {
      totalErros++;
    } else if (resultado.alteracoes.includes("Nenhuma alteração necessária")) {
      totalSemAlteracao++;
    } else {
      totalEditados++;
    }
  }

  const arquivosEditados = filesForProcessing.map((file, index) => {
    const resultado = resultadosEdicao[index];
    return {
      ...file,
      content: resultado.conteudoEditado || file.content,
    };
  });

  updateReferencesInFiles(arquivosEditados, resultadosEdicao, chaveMapping);

  return {
    arquivosEditados,
    resultadosEdicao,
    totalEditados,
    totalErros,
    totalSemAlteracao,
  };
}

