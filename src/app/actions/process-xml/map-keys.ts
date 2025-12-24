import {
  getChaveInfoForMapping,
  prepararMapeamentosDeChaves,
  type DocumentoInfo,
  type ResultadoMapeamento,
} from "@/lib/xml";
import type { ArquivoParaProcessamento } from "./prepare-files";

/**
 * A partir dos arquivos XML e das opções do cenário, extrai as chaves
 * das notas e calcula o mapeamento necessário (alteração de CNPJ, data, UF, série).
 */
async function prepararMapeamentosChaves(
  files: ArquivoParaProcessamento[],
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
  const documentos: DocumentoInfo[] = [];

  for (const file of files) {
    const info = getChaveInfoForMapping(file.content, file.name);
    if (info && info.chave.length >= 43) {
      documentos.push(info);
    }
  }

  const alterarEmitente = scenario.editar_emitente;
  const novoCnpj = scenario.ScenarioEmitente?.cnpj || null;
  const alterarData = scenario.editar_data;
  const novaData = scenario.nova_data || null;
  const alterarUF = scenario.alterar_cUF;
  const novoUF = scenario.novo_cUF || null;
  const alterarSerie = scenario.alterar_serie;
  const novaSerie = scenario.nova_serie || null;

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
 * Gera o mapeamento de chaves para todos os arquivos de processamento.
 * Centraliza a chamada de `prepararMapeamentosChaves` para uso nas actions.
 */
export async function prepararMapeamentosELog(
  filesForProcessing: ArquivoParaProcessamento[],
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
  const { chaveMapping, referenceMap, chaveVendaNova } =
    await prepararMapeamentosChaves(filesForProcessing, scenario);

  return {
    chaveMapping,
    referenceMap,
    chaveVendaNova,
  };
}
