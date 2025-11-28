/**
 * Módulo para edição de chaves de acesso em arquivos XML (NFe, CTe, Eventos)
 * Baseado no modelo Python (funções _editar_nfe, _editar_cte, _editar_cancelamento)
 *
 * IMPORTANTE: Este módulo usa APENAS manipulação de strings (regex) para editar XMLs.
 * NÃO reconstrói o XML, preservando 100% a estrutura, ordem e formatação original.
 * Apenas os valores específicos das tags são alterados, nenhuma tag é adicionada ou removida.
 */

import { XMLParser } from "fast-xml-parser";
import type { ChaveMapping, ReferenceMapping } from "./chaveHelper";

/**
 * Resultado da edição de um arquivo XML
 */
export interface ResultadoEdicao {
  nomeArquivo: string;
  tipo: "NFe" | "CTe" | "Cancelamento" | "Inutilizacao" | "Desconhecido";
  sucesso: boolean;
  alteracoes: string[];
  conteudoEditado?: string;
  erro?: string;
}

/**
 * Formata uma data no formato ISO para XMLs (YYYY-MM-DDTHH:MM:SS-03:00)
 */
function formatarDataParaXml(dataStr: string): string {
  // dataStr formato: DD/MM/YYYY
  const [dia, mes, ano] = dataStr.split("/");
  const agora = new Date();
  const horas = agora.getHours().toString().padStart(2, "0");
  const minutos = agora.getMinutes().toString().padStart(2, "0");
  const segundos = agora.getSeconds().toString().padStart(2, "0");

  return `${ano}-${mes}-${dia}T${horas}:${minutos}:${segundos}-03:00`;
}

/**
 * Busca um elemento no XML navegando por um path
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findElement(obj: any, path: string): any {
  if (!obj) return null;

  const parts = path.split("/");
  let current = obj;

  for (const part of parts) {
    if (!current) return null;
    if (Array.isArray(current)) {
      current = current[0];
    }
    current = current[part];
  }

  return current;
}

/**
 * Edita as chaves de acesso em um XML de NFe usando APENAS manipulação de strings
 * NÃO reconstrói o XML - preserva 100% a estrutura original
 */
function editarChavesNFe(
  xmlContent: string,
  fileName: string,
  chaveMapping: ChaveMapping,
  referenceMap: ReferenceMapping,
  novaData: string | null = null,
  novoUF: string | null = null,
  novaSerie: string | null = null
): ResultadoEdicao {
  const alteracoes: string[] = [];
  let xmlEditado = xmlContent;

  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseAttributeValue: false,
      trimValues: false,
    });

    const parsed = parser.parse(xmlContent);

    // Verifica se é NFe
    let infNFe = findElement(parsed, "nfeProc/NFe/infNFe");
    if (!infNFe) {
      infNFe = findElement(parsed, "NFe/infNFe");
    }

    if (!infNFe) {
      return {
        nomeArquivo: fileName,
        tipo: "Desconhecido",
        sucesso: false,
        alteracoes: [],
        erro: "Não é um XML de NFe válido",
      };
    }

    // Extrai a chave original
    const idAttr = infNFe["@_Id"] || infNFe["@_id"];
    if (!idAttr) {
      return {
        nomeArquivo: fileName,
        tipo: "NFe",
        sucesso: false,
        alteracoes: [],
        erro: "Chave não encontrada no atributo Id",
      };
    }

    const chaveOriginal = idAttr.replace(/^NFe/, "");

    // 1. Atualiza o atributo Id do infNFe (REGEX - preserva estrutura)
    if (chaveMapping[chaveOriginal]) {
      const novaChave = chaveMapping[chaveOriginal];

      // Regex para Id="NFe..." ou id="NFe..."
      const regexId = new RegExp(
        `(<infNFe[^>]*\\s(?:Id|id)=["'])NFe${chaveOriginal}(["'][^>]*>)`,
        "g"
      );

      if (regexId.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexId, `$1NFe${novaChave}$2`);
        alteracoes.push(`Chave de Acesso ID alterada para: ${novaChave}`);
      }

      // 2. Atualiza a chave no protocolo <chNFe> (REGEX)
      const regexChNFe = new RegExp(`(<chNFe>)${chaveOriginal}(</chNFe>)`, "g");

      if (regexChNFe.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexChNFe, `$1${novaChave}$2`);
        alteracoes.push("Chave de Acesso do Protocolo alterada");
      }
    }

    // 3. Atualiza a referência de NFe (REGEX)
    if (referenceMap[chaveOriginal]) {
      const chaveReferenciada = referenceMap[chaveOriginal];

      if (chaveMapping[chaveReferenciada]) {
        const novaChaveReferenciada = chaveMapping[chaveReferenciada];

        // Regex para <refNFe>chave</refNFe>
        const regexRefNFe = new RegExp(
          `(<refNFe>)${chaveReferenciada}(</refNFe>)`,
          "g"
        );

        if (regexRefNFe.test(xmlEditado)) {
          xmlEditado = xmlEditado.replace(
            regexRefNFe,
            `$1${novaChaveReferenciada}$2`
          );
          alteracoes.push(
            `Chave de Referência alterada para: ${novaChaveReferenciada}`
          );
        }
      }
    }

    // 4. Atualiza UF no IDE (REGEX)
    if (novoUF) {
      const regexCUF = /(<cUF>)[^<]+(<\/cUF>)/g;
      if (regexCUF.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexCUF, `$1${novoUF}$2`);
        alteracoes.push(`UF <cUF> alterado para: ${novoUF}`);
      }
    }

    // 5. Atualiza Série no IDE (REGEX)
    if (novaSerie) {
      const regexSerie = /(<serie>)[^<]+(<\/serie>)/g;
      if (regexSerie.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexSerie, `$1${novaSerie}$2`);
        alteracoes.push(`Série <serie> alterada para: ${novaSerie}`);
      }
    }

    // 6. Atualiza as datas (REGEX)
    if (novaData) {
      const novaDataFormatada = formatarDataParaXml(novaData);

      // dhEmi - Data/Hora de Emissão
      const regexDhEmi = /(<dhEmi>)[^<]+(<\/dhEmi>)/g;
      if (regexDhEmi.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexDhEmi, `$1${novaDataFormatada}$2`);
        alteracoes.push(`Data de Emissão <dhEmi> alterada para ${novaData}`);
      }

      // dhSaiEnt - Data/Hora de Saída/Entrada
      const regexDhSaiEnt = /(<dhSaiEnt>)[^<]+(<\/dhSaiEnt>)/g;
      if (regexDhSaiEnt.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(
          regexDhSaiEnt,
          `$1${novaDataFormatada}$2`
        );
        alteracoes.push(
          `Data de Saída/Entrada <dhSaiEnt> alterada para ${novaData}`
        );
      }

      // dhRecbto no protocolo
      const regexDhRecbto = /(<dhRecbto>)[^<]+(<\/dhRecbto>)/g;
      if (regexDhRecbto.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(
          regexDhRecbto,
          `$1${novaDataFormatada}$2`
        );
        alteracoes.push(
          `Data de Recebimento <dhRecbto> alterada para ${novaData}`
        );
      }
    }

    if (alteracoes.length === 0) {
      return {
        nomeArquivo: fileName,
        tipo: "NFe",
        sucesso: true,
        alteracoes: ["Nenhuma alteração necessária"],
        conteudoEditado: xmlContent,
      };
    }

    return {
      nomeArquivo: fileName,
      tipo: "NFe",
      sucesso: true,
      alteracoes,
      conteudoEditado: xmlEditado, // Retorna o XML com alterações via regex
    };
  } catch (error) {
    return {
      nomeArquivo: fileName,
      tipo: "NFe",
      sucesso: false,
      alteracoes: [],
      erro: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Edita as chaves de acesso em um XML de CTe usando APENAS manipulação de strings
 * NÃO reconstrói o XML - preserva 100% a estrutura original
 */
function editarChavesCTe(
  xmlContent: string,
  fileName: string,
  chaveMapping: ChaveMapping,
  chaveVendaNova: string | null,
  novaData: string | null = null,
  novoUF: string | null = null
): ResultadoEdicao {
  const alteracoes: string[] = [];
  let xmlEditado = xmlContent;

  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseAttributeValue: false,
      trimValues: false,
    });

    const parsed = parser.parse(xmlContent);

    // Verifica se é CTe
    let infCte = findElement(parsed, "cteProc/CTe/infCte");
    if (!infCte) {
      infCte = findElement(parsed, "CTe/infCte");
    }

    if (!infCte) {
      return {
        nomeArquivo: fileName,
        tipo: "Desconhecido",
        sucesso: false,
        alteracoes: [],
        erro: "Não é um XML de CTe válido",
      };
    }

    // Extrai a chave original
    const idAttr = infCte["@_Id"] || infCte["@_id"];
    if (!idAttr) {
      return {
        nomeArquivo: fileName,
        tipo: "CTe",
        sucesso: false,
        alteracoes: [],
        erro: "Chave não encontrada no atributo Id",
      };
    }

    const chaveOriginal = idAttr.replace(/^CTe/, "");

    // 1. Atualiza o atributo Id do infCte (REGEX)
    if (chaveMapping[chaveOriginal]) {
      const novaChave = chaveMapping[chaveOriginal];

      // Regex para Id="CTe..." ou id="CTe..."
      const regexId = new RegExp(
        `(<infCte[^>]*\\s(?:Id|id)=["'])CTe${chaveOriginal}(["'][^>]*>)`,
        "g"
      );

      if (regexId.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexId, `$1CTe${novaChave}$2`);
        alteracoes.push(`Chave de acesso do CTe alterada para: ${novaChave}`);
      }

      // 2. Atualiza a chave no protocolo <chCTe> (REGEX)
      const regexChCTe = new RegExp(`(<chCTe>)${chaveOriginal}(</chCTe>)`, "g");

      if (regexChCTe.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexChCTe, `$1${novaChave}$2`);
        alteracoes.push("protCTe/infProt/chCTe sincronizado");
      }
    }

    // 3. Atualiza a chave da NFe referenciada no CTe (REGEX)
    const infDoc = findElement(infCte, "infCTeNorm/infDoc");
    if (infDoc?.infNFe?.chave !== undefined) {
      const chaveNFeAtual = infDoc.infNFe.chave;

      // Tenta atualizar pela chave mapeada
      if (chaveMapping[chaveNFeAtual]) {
        const novaChaveNFe = chaveMapping[chaveNFeAtual];

        const regexChaveNFe = new RegExp(
          `(<chave>)${chaveNFeAtual}(</chave>)`,
          "g"
        );

        if (regexChaveNFe.test(xmlEditado)) {
          xmlEditado = xmlEditado.replace(regexChaveNFe, `$1${novaChaveNFe}$2`);
          alteracoes.push(
            `Referência de NFe <chave> atualizada para: ${novaChaveNFe}`
          );
        }
      }
      // Se não encontrou no mapeamento mas tem chaveVendaNova, força a atualização
      else if (chaveVendaNova && chaveNFeAtual !== chaveVendaNova) {
        const regexChaveNFe = new RegExp(
          `(<chave>)${chaveNFeAtual}(</chave>)`,
          "g"
        );

        if (regexChaveNFe.test(xmlEditado)) {
          xmlEditado = xmlEditado.replace(
            regexChaveNFe,
            `$1${chaveVendaNova}$2`
          );
          alteracoes.push(
            `Referência de NFe <chave> FORÇADA para a chave da venda: ${chaveVendaNova}`
          );
        }
      }
    }

    // 4. Atualiza UF no IDE (REGEX) - apenas para CTe
    if (novoUF) {
      const regexCUF = /(<cUF>)[^<]+(<\/cUF>)/g;
      if (regexCUF.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexCUF, `$1${novoUF}$2`);
        alteracoes.push(`UF <cUF> alterado para: ${novoUF}`);
      }
    }

    // 5. Atualiza as datas (REGEX)
    if (novaData) {
      const novaDataFormatada = formatarDataParaXml(novaData);

      // dhEmi
      const regexDhEmi = /(<dhEmi>)[^<]+(<\/dhEmi>)/g;
      if (regexDhEmi.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexDhEmi, `$1${novaDataFormatada}$2`);
        alteracoes.push(`Data de Emissão <dhEmi> alterada para ${novaData}`);
      }

      // dhRecbto no protocolo
      const regexDhRecbto = /(<dhRecbto>)[^<]+(<\/dhRecbto>)/g;
      if (regexDhRecbto.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(
          regexDhRecbto,
          `$1${novaDataFormatada}$2`
        );
        alteracoes.push(
          `Data de Recebimento <dhRecbto> alterada para ${novaData}`
        );
      }
    }

    if (alteracoes.length === 0) {
      return {
        nomeArquivo: fileName,
        tipo: "CTe",
        sucesso: true,
        alteracoes: ["Nenhuma alteração necessária"],
        conteudoEditado: xmlContent,
      };
    }

    return {
      nomeArquivo: fileName,
      tipo: "CTe",
      sucesso: true,
      alteracoes,
      conteudoEditado: xmlEditado, // Retorna o XML com alterações via regex
    };
  } catch (error) {
    return {
      nomeArquivo: fileName,
      tipo: "CTe",
      sucesso: false,
      alteracoes: [],
      erro: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Edita as chaves de acesso em um evento de cancelamento usando APENAS manipulação de strings
 * NÃO reconstrói o XML - preserva 100% a estrutura original
 */
function editarChavesCancelamento(
  xmlContent: string,
  fileName: string,
  chaveMapping: ChaveMapping,
  novaData: string | null = null
): ResultadoEdicao {
  const alteracoes: string[] = [];
  let xmlEditado = xmlContent;

  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseAttributeValue: false,
      trimValues: false,
    });

    const parsed = parser.parse(xmlContent);

    // Verifica se é um evento de cancelamento
    if (!parsed.procEventoNFe) {
      return {
        nomeArquivo: fileName,
        tipo: "Desconhecido",
        sucesso: false,
        alteracoes: [],
        erro: "Não é um evento de cancelamento válido",
      };
    }

    // 1. Atualiza chNFe no evento (REGEX)
    const infEvento = parsed.procEventoNFe?.evento?.infEvento;
    if (infEvento?.chNFe) {
      const chaveAntiga = infEvento.chNFe;
      if (chaveMapping[chaveAntiga]) {
        const novaChave = chaveMapping[chaveAntiga];

        // Atualiza todas as ocorrências de chNFe (evento e retorno)
        const regexChNFe = new RegExp(`(<chNFe>)${chaveAntiga}(</chNFe>)`, "g");

        const ocorrencias = (xmlEditado.match(regexChNFe) || []).length;
        if (ocorrencias > 0) {
          xmlEditado = xmlEditado.replace(regexChNFe, `$1${novaChave}$2`);
          alteracoes.push(
            `chNFe alterado para nova chave em ${ocorrencias} local(is): ${novaChave}`
          );
        }
      }
    }

    // 2. Atualiza as datas (REGEX)
    if (novaData) {
      const novaDataFormatada = formatarDataParaXml(novaData);

      // dhEvento no evento
      const regexDhEvento = /(<dhEvento>)[^<]+(<\/dhEvento>)/g;
      if (regexDhEvento.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(
          regexDhEvento,
          `$1${novaDataFormatada}$2`
        );
        alteracoes.push(`Data do Evento <dhEvento> alterada para ${novaData}`);
      }

      // dhRecbto no retorno
      const regexDhRecbto = /(<dhRecbto>)[^<]+(<\/dhRecbto>)/g;
      if (regexDhRecbto.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(
          regexDhRecbto,
          `$1${novaDataFormatada}$2`
        );
        alteracoes.push(
          `Data de Recebimento <dhRecbto> alterada para ${novaData}`
        );
      }

      // dhRegEvento no retorno
      const regexDhRegEvento = /(<dhRegEvento>)[^<]+(<\/dhRegEvento>)/g;
      if (regexDhRegEvento.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(
          regexDhRegEvento,
          `$1${novaDataFormatada}$2`
        );
        alteracoes.push(
          `Data de Registro <dhRegEvento> alterada para ${novaData}`
        );
      }
    }

    if (alteracoes.length === 0) {
      return {
        nomeArquivo: fileName,
        tipo: "Cancelamento",
        sucesso: true,
        alteracoes: ["Nenhuma alteração necessária"],
        conteudoEditado: xmlContent,
      };
    }

    return {
      nomeArquivo: fileName,
      tipo: "Cancelamento",
      sucesso: true,
      alteracoes,
      conteudoEditado: xmlEditado, // Retorna o XML com alterações via regex
    };
  } catch (error) {
    return {
      nomeArquivo: fileName,
      tipo: "Cancelamento",
      sucesso: false,
      alteracoes: [],
      erro: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Detecta o tipo de documento XML e edita as chaves apropriadamente
 */
export function editarChavesXml(
  xmlContent: string,
  fileName: string,
  chaveMapping: ChaveMapping,
  referenceMap: ReferenceMapping,
  chaveVendaNova: string | null,
  novaData: string | null = null,
  novoUF: string | null = null,
  novaSerie: string | null = null
): ResultadoEdicao {
  // Detecção rápida do tipo de documento
  if (xmlContent.includes("<procEventoNFe")) {
    return editarChavesCancelamento(
      xmlContent,
      fileName,
      chaveMapping,
      novaData
    );
  } else if (xmlContent.includes("<cteProc") || xmlContent.includes("<CTe")) {
    return editarChavesCTe(
      xmlContent,
      fileName,
      chaveMapping,
      chaveVendaNova,
      novaData,
      novoUF
    );
  } else if (xmlContent.includes("<nfeProc") || xmlContent.includes("<NFe")) {
    return editarChavesNFe(
      xmlContent,
      fileName,
      chaveMapping,
      referenceMap,
      novaData,
      novoUF,
      novaSerie
    );
  } else if (
    xmlContent.includes("<procInutNFe") ||
    xmlContent.includes("<inutNFe")
  ) {
    // Inutilizações não precisam de edição de chave (por enquanto)
    return {
      nomeArquivo: fileName,
      tipo: "Inutilizacao",
      sucesso: true,
      alteracoes: ["Inutilização não requer alteração de chave"],
      conteudoEditado: xmlContent,
    };
  }

  return {
    nomeArquivo: fileName,
    tipo: "Desconhecido",
    sucesso: false,
    alteracoes: [],
    erro: "Tipo de documento não reconhecido",
  };
}

/**
 * Edita as chaves de acesso em múltiplos arquivos XML
 */
export function editarChavesEmLote(
  files: Array<{ name: string; content: string }>,
  chaveMapping: ChaveMapping,
  referenceMap: ReferenceMapping,
  chaveVendaNova: string | null,
  novaData: string | null = null,
  novoUF: string | null = null,
  novaSerie: string | null = null
): ResultadoEdicao[] {
  const resultados: ResultadoEdicao[] = [];

  for (const file of files) {
    const resultado = editarChavesXml(
      file.content,
      file.name,
      chaveMapping,
      referenceMap,
      chaveVendaNova,
      novaData,
      novoUF,
      novaSerie
    );
    resultados.push(resultado);
  }

  return resultados;
}
