import { editarChavesXml } from "./xml-core";
import type { ChaveMapping, ReferenceMapping } from "@/lib/xml";
import type {
  DadosEmitente,
  DadosDestinatario,
  DadosProduto,
  CstMappingData,
  TaxReformRuleData,
  ResultadoEdicao,
} from "./types";

export function editarNFe(
  xmlContent: string,
  fileName: string,
  params: {
    chaveMapping: ChaveMapping;
    referenceMap: ReferenceMapping;
    chaveVendaNova?: string | null;
    novaData?: string | null;
    novoUF?: string | null;
    novaSerie?: string | null;
    novoEmitente?: DadosEmitente | null;
    novoDestinatario?: DadosDestinatario | null;
    produtos?: Array<
      DadosProduto & { isPrincipal: boolean; ordem: number }
    > | null;
    cstMappings?: CstMappingData[] | null;
    taxReformRule?: TaxReformRuleData | null;
  }
): ResultadoEdicao {
  if (!xmlContent.includes("<nfeProc") && !xmlContent.includes("<NFe")) {
    return {
      nomeArquivo: fileName,
      tipo: "Desconhecido",
      sucesso: false,
      alteracoes: [],
      erro: "Conteúdo não parece ser uma NFe",
    };
  }

  const {
    chaveMapping,
    referenceMap,
    chaveVendaNova = null,
    novaData = null,
    novoUF = null,
    novaSerie = null,
    novoEmitente = null,
    novoDestinatario = null,
    produtos = null,
    cstMappings = null,
    taxReformRule = null,
  } = params;

  return editarChavesXml(
    xmlContent,
    fileName,
    chaveMapping,
    referenceMap,
    chaveVendaNova,
    novaData,
    novoUF,
    novaSerie,
    novoEmitente,
    novoDestinatario,
    produtos,
    cstMappings,
    taxReformRule
  );
}
