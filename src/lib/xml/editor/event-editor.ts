import { editarChavesXml } from "./xml-core";
import type { ChaveMapping } from "@/lib/xml";
import type { ResultadoEdicao } from "./types";

export function editarCancelamento(
  xmlContent: string,
  fileName: string,
  params: {
    chaveMapping: ChaveMapping;
    novaData?: string | null;
  }
): ResultadoEdicao {
  if (
    !xmlContent.includes("<procEventoNFe") &&
    !xmlContent.includes("<envEvento")
  ) {
    return {
      nomeArquivo: fileName,
      tipo: "Desconhecido",
      sucesso: false,
      alteracoes: [],
      erro: "Conteúdo não parece ser um Evento de Cancelamento",
    };
  }

  const { chaveMapping, novaData = null } = params;

  return editarChavesXml(
    xmlContent,
    fileName,
    chaveMapping,
    {},
    null,
    novaData,
    null,
    null,
    null,
    null,
    null,
    null,
    null
  );
}
