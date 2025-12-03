/**
 * Módulo para extração de informações de arquivos XML (NFe)
 * Equivalente às funções get_xml_info() e get_evento_info() do Python
 */

import { XMLParser } from "fast-xml-parser";
import type { NFeInfo, EventoInfo, CTeInfo } from "@/types";

/**
 * Busca um elemento no XML navegando por um path (ex: "ide/nNF")
 * Suporta objetos e arrays retornados pelo parser
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findElement(obj: any, path: string): any {
  if (!obj) return null;

  const parts = path.split("/");
  let current = obj;

  for (const part of parts) {
    if (!current) return null;

    // Se current é um array, pega o primeiro elemento
    if (Array.isArray(current)) {
      current = current[0];
    }

    current = current[part];
  }

  return current;
}

/**
 * Extrai informações essenciais de um CT-e para renomeação
 */
export function getCteInfo(
  xmlContent: string,
  fileName: string
): CTeInfo | null {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });

    const parsed = parser.parse(xmlContent);

    // Verifica se é CT-e
    let infCte = findElement(parsed, "cteProc/CTe/infCte");
    if (!infCte) {
      infCte = findElement(parsed, "CTe/infCte");
    }

    if (!infCte) {
      return null;
    }

    const ide = infCte.ide;
    if (!ide) {
      return null;
    }

    // Extrai a chave do atributo Id (remove o prefixo "CTe")
    const idAttr = infCte["@_Id"] || infCte["@_id"];
    const chave = idAttr ? idAttr.replace(/^CTe/, "") : "";

    if (!chave || chave.length !== 44) {
      return null;
    }

    // Extrai o número do CT-e
    const cteNumber = ide.nCT || "";

    // Tenta extrair a chave da NFe referenciada
    let nfeChave: string | null = null;
    const infDoc = findElement(infCte, "infCTeNorm/infDoc");
    if (infDoc) {
      const infNFeChave = findElement(infDoc, "infNFe/chave");
      if (infNFeChave) {
        nfeChave =
          typeof infNFeChave === "string" ? infNFeChave : String(infNFeChave);
      }
    }

    return {
      tipo: "cte",
      caminhoCompleto: fileName,
      cteNumber: cteNumber,
      chave: chave,
      nfeChave: nfeChave,
    };
  } catch (error) {
    console.error(
      `[xmlExtractor] Erro ao extrair informações do CT-e ${fileName}:`,
      error
    );
    return null;
  }
}

/**
 * Extrai informações essenciais de um XML de NFe para renomeação
 * Equivalente a get_xml_info() do Python
 */
export function getXmlInfo(
  xmlContent: string,
  fileName: string
): NFeInfo | null {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });

    const parsed = parser.parse(xmlContent);

    // Ignora eventos de cancelamento (mas não CT-e, que será tratado separadamente)
    if (parsed.procEventoNFe) {
      return null;
    }

    // Ignora CT-e (será processado por getCteInfo)
    if (parsed.cteProc || parsed.CTe) {
      return null;
    }

    // Navega até infNFe
    let infNFe = findElement(parsed, "nfeProc/NFe/infNFe");
    if (!infNFe) {
      infNFe = findElement(parsed, "NFe/infNFe");
    }

    if (!infNFe) {
      return null;
    }

    const ide = infNFe.ide;
    const emit = infNFe.emit;
    const det = Array.isArray(infNFe.det) ? infNFe.det[0] : infNFe.det;

    if (!ide || !emit) {
      return null;
    }

    // Extrai a chave do atributo Id (remove o prefixo "NFe")
    const idAttr = infNFe["@_Id"] || infNFe["@_id"];
    const chave = idAttr ? idAttr.replace(/^NFe/, "") : "";

    if (!chave || chave.length !== 44) {
      return null;
    }

    // Extrai CFOP (pode estar no primeiro item de produtos)
    const cfop = det?.prod?.CFOP || "";

    // Extrai informações adicionais
    const xTexto = infNFe.infAdic?.obsCont?.xTexto || "";

    // Extrai referência de NFe (pode vir como string, objeto ou array)
    let refNFe: string | null = null;
    const refNFeRaw = ide.NFref?.refNFe;
    if (refNFeRaw) {
      if (typeof refNFeRaw === "string") {
        refNFe = refNFeRaw;
      } else if (Array.isArray(refNFeRaw) && refNFeRaw.length > 0) {
        refNFe = String(refNFeRaw[0]);
      } else if (typeof refNFeRaw === "object") {
        refNFe = String(refNFeRaw);
      }
    }

    return {
      tipo: "nfe",
      caminhoCompleto: fileName,
      nfeNumber: ide.nNF || "",
      cfop: cfop,
      natOp: ide.natOp || "",
      refNFe: refNFe,
      xTexto: xTexto,
      chave: chave,
      emitCnpj: emit.CNPJ || "",
    };
  } catch (error) {
    console.error(
      `[xmlExtractor] Erro ao extrair informações do XML ${fileName}:`,
      error
    );
    console.error(
      `[xmlExtractor] Tipo de erro:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

/**
 * Extrai informações de eventos de cancelamento de NFe
 * Equivalente a get_evento_info() do Python
 */
export function getEventoInfo(
  xmlContent: string,
  fileName: string
): EventoInfo | null {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });

    const parsed = parser.parse(xmlContent);

    // Verifica se é um evento de cancelamento
    if (!parsed.procEventoNFe) {
      return null;
    }

    const evento = parsed.procEventoNFe.evento;
    const infEvento = evento?.infEvento;

    if (!infEvento) return null;

    // Verifica se é um cancelamento (tpEvento = 110111)
    const tpEvento = infEvento.tpEvento;
    if (tpEvento !== "110111") {
      return null;
    }

    const chaveCancelada = infEvento.chNFe;
    if (!chaveCancelada) {
      return null;
    }

    return {
      tipo: "cancelamento",
      caminhoCompleto: fileName,
      chaveCancelada: chaveCancelada,
    };
  } catch (error) {
    console.error(`Erro ao extrair informações de evento ${fileName}:`, error);
    return null;
  }
}

/**
 * Extrai informações para mapeamento de chaves
 * Equivalente a _get_chave_info_for_mapping() do Python
 */
export function getChaveInfoForMapping(
  xmlContent: string,
  fileName: string
): {
  doc_type: "NFe" | "CTe" | "Inutilizacao";
  caminho_completo: string;
  chave: string;
  emit_cnpj: string;
  nfe_number: string | null;
  ref_nfe: string | null;
  cfop: string | null;
} | null {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });

    const parsed = parser.parse(xmlContent);

    // Tenta NF-e
    let infNFe = findElement(parsed, "nfeProc/NFe/infNFe");
    if (!infNFe) {
      infNFe = findElement(parsed, "NFe/infNFe");
    }

    if (infNFe) {
      const idAttr = infNFe["@_Id"] || infNFe["@_id"];
      const chave = idAttr ? idAttr.replace(/^NFe/, "") : "";

      if (chave && chave.length === 44) {
        const ide = infNFe.ide;
        const emit = infNFe.emit;

        const cnpj = emit?.CNPJ || "";
        const nfeNumber = ide?.nNF || null;

        // Extrai referência de NFe
        let refNFe: string | null = null;
        const refNFeRaw = ide?.NFref?.refNFe;
        if (refNFeRaw) {
          if (typeof refNFeRaw === "string") {
            refNFe = refNFeRaw;
          } else if (Array.isArray(refNFeRaw) && refNFeRaw.length > 0) {
            refNFe = String(refNFeRaw[0]);
          } else if (typeof refNFeRaw === "object") {
            refNFe = String(refNFeRaw);
          }
        }

        // Extrai CFOP do primeiro item (det)
        let cfop: string | null = null;
        const det = infNFe.det;
        if (det) {
          const detItem = Array.isArray(det) ? det[0] : det;
          const prod = detItem?.prod;
          if (prod?.CFOP) {
            cfop = String(prod.CFOP);
          }
        }

        return {
          doc_type: "NFe",
          caminho_completo: fileName,
          chave: chave,
          emit_cnpj: cnpj,
          nfe_number: nfeNumber,
          ref_nfe: refNFe,
          cfop: cfop,
        };
      }
    }

    // Tenta CT-e
    let infCte = findElement(parsed, "cteProc/CTe/infCte");
    if (!infCte) {
      infCte = findElement(parsed, "CTe/infCte");
    }

    if (infCte) {
      const idAttr = infCte["@_Id"] || infCte["@_id"];
      const chave = idAttr ? idAttr.replace(/^CTe/, "") : "";

      if (chave && chave.length === 44) {
        // CTe usa 'rem' (remetente) em vez de 'emit'
        const rem = infCte.rem;
        const cnpj = rem?.CNPJ || "";

        return {
          doc_type: "CTe",
          caminho_completo: fileName,
          chave: chave,
          emit_cnpj: cnpj,
          nfe_number: null,
          ref_nfe: null,
          cfop: null,
        };
      }
    }

    // Tenta Inutilização
    let infInut = findElement(parsed, "procInutNFe/inutNFe/infInut");
    if (!infInut) {
      infInut = findElement(parsed, "procInutNFe/retInutNFe/infInut");
    }
    if (!infInut) {
      infInut = findElement(parsed, "inutNFe/infInut");
    }

    if (infInut) {
      const chaveId = infInut["@_Id"] || infInut["@_id"] || "";
      const cnpj = infInut.CNPJ || "";

      return {
        doc_type: "Inutilizacao",
        caminho_completo: fileName,
        chave: chaveId,
        emit_cnpj: cnpj,
        nfe_number: null,
        ref_nfe: null,
        cfop: null,
      };
    }

    return null;
  } catch (error) {
    console.error(
      `[xmlExtractor] Erro ao extrair info para mapeamento de ${fileName}:`,
      error
    );
    return null;
  }
}

/**
 * Extrai informações básicas de múltiplos XMLs
 * Equivalente a _extrair_infos_xmls() do Python
 */
export function extrairInfosXmls(
  files: Array<{ name: string; content: string }>
): {
  nfeInfos: Map<string, NFeInfo>;
  eventosInfo: EventoInfo[];
  cteInfos: Map<string, CTeInfo>;
  arquivosNaoReconhecidos: string[];
} {
  const nfeInfos = new Map<string, NFeInfo>();
  const eventosInfo: EventoInfo[] = [];
  const cteInfos = new Map<string, CTeInfo>();
  const arquivosNaoReconhecidos: string[] = [];

  for (const file of files) {
    // Tenta extrair como NFe
    const nfeInfo = getXmlInfo(file.content, file.name);
    if (nfeInfo) {
      nfeInfos.set(nfeInfo.nfeNumber, nfeInfo);
      continue;
    }

    // Tenta extrair como CT-e
    const cteInfo = getCteInfo(file.content, file.name);
    if (cteInfo) {
      cteInfos.set(cteInfo.cteNumber, cteInfo);
      continue;
    }

    // Tenta extrair como evento de cancelamento
    const eventoInfo = getEventoInfo(file.content, file.name);
    if (eventoInfo) {
      eventosInfo.push(eventoInfo);
      continue;
    }

    // Se não foi reconhecido como nenhum tipo, adiciona à lista
    arquivosNaoReconhecidos.push(file.name);
  }

  return { nfeInfos, eventosInfo, cteInfos, arquivosNaoReconhecidos };
}
