import {
  getChaveInfoForMapping,
  prepararMapeamentosDeChaves,
  type DocumentoInfo,
  type ResultadoMapeamento,
} from "@/lib/xml";
import type { ArquivoParaProcessamento } from "./prepare-files";

const UF_SIGLA_TO_CUF: Record<string, string> = {
  RO: "11",
  AC: "12",
  AM: "13",
  RR: "14",
  PA: "15",
  AP: "16",
  TO: "17",
  MA: "21",
  PI: "22",
  CE: "23",
  RN: "24",
  PB: "25",
  PE: "26",
  AL: "27",
  SE: "28",
  BA: "29",
  MG: "31",
  ES: "32",
  RJ: "33",
  SP: "35",
  PR: "41",
  SC: "42",
  RS: "43",
  MS: "50",
  MT: "51",
  GO: "52",
  DF: "53",
};

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
    ScenarioEmitente?: { cnpj?: string | null; UF?: string | null } | null;
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
  const ufEmitenteSigla = (scenario.ScenarioEmitente?.UF || "")
    .trim()
    .toUpperCase();
  const cufByEmitente = UF_SIGLA_TO_CUF[ufEmitenteSigla] || null;
  const alterarUF = scenario.alterar_cUF || !!cufByEmitente;
  const novoUF = cufByEmitente || scenario.novo_cUF || null;
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
    ScenarioEmitente?: { cnpj?: string | null; UF?: string | null } | null;
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

