/**
 * xmlReferencer.ts
 *
 * Gerenciador de Referências entre Notas Fiscais
 *
 * Este módulo é responsável por:
 * 1. Identificar quais notas referenciam outras (através da tag refNFe)
 * 2. Criar um mapa de referências (qual nota aponta para qual)
 * 3. Atualizar as referências quando as chaves originais forem alteradas
 *
 * Exemplos de uso:
 * - Nota de RETORNO referencia a nota de REMESSA
 * - Nota de DEVOLUÇÃO referencia a nota de VENDA
 * - Nota complementar referencia a nota original
 *
 */

import { XMLParser } from "fast-xml-parser";

/**
 * Mapa de referências: chave da nota que referencia -> chave da nota referenciada
 */
export type ReferenceMap = Map<string, string>;

/**
 * Interface para informações de referência extraídas de um XML
 */
export interface ReferenceInfo {
  /** Chave da nota atual (44 dígitos com DV) */
  chaveAtual: string;
  /** Chave referenciada na tag refNFe (se existir) */
  chaveReferenciada: string | null;
  /** Tipo de documento (NFe, CTe) */
  tipoDocumento: "NFe" | "CTe" | "Cancelamento" | "Desconhecido";
  /** Nome do arquivo */
  nomeArquivo: string;
}

/**
 * Extrai informações de referência de um XML
 */
export function extrairInfoReferencia(
  xmlContent: string,
  nomeArquivo: string
): ReferenceInfo | null {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseTagValue: false,
    });

    const parsedXml = parser.parse(xmlContent);

    // NFe
    if (parsedXml.nfeProc || parsedXml.NFe) {
      const nfeProc = parsedXml.nfeProc || parsedXml.NFe;
      const nfe = nfeProc.NFe || nfeProc;
      const infNFe = nfe.infNFe;

      if (!infNFe) return null;

      // Extrai chave atual do atributo Id
      const idAttr = infNFe["@_Id"];
      if (!idAttr) return null;

      const chaveAtual = idAttr.replace("NFe", "");

      // Busca por refNFe em NFref
      let chaveReferenciada: string | null = null;
      const ide = infNFe.ide;

      if (ide && ide.NFref) {
        // NFref pode ser um objeto ou array de objetos
        const nfRefs = Array.isArray(ide.NFref) ? ide.NFref : [ide.NFref];

        for (const nfRef of nfRefs) {
          if (nfRef.refNFe) {
            chaveReferenciada = nfRef.refNFe;
            break; // Pega a primeira referência encontrada
          }
        }
      }

      return {
        chaveAtual,
        chaveReferenciada,
        tipoDocumento: "NFe",
        nomeArquivo,
      };
    }

    // CTe
    if (parsedXml.cteProc || parsedXml.CTe) {
      const cteProc = parsedXml.cteProc || parsedXml.CTe;
      const cte = cteProc.CTe || cteProc;
      const infCte = cte.infCte;

      if (!infCte) return null;

      const idAttr = infCte["@_Id"];
      if (!idAttr) return null;

      const chaveAtual = idAttr.replace("CTe", "");

      // CTe pode referenciar NFe em infDoc/infNFe/chave
      let chaveReferenciada: string | null = null;
      const infCTeNorm = infCte.infCTeNorm;

      if (infCTeNorm && infCTeNorm.infDoc) {
        const infDoc = infCTeNorm.infDoc;

        if (infDoc.infNFe) {
          const infNFes = Array.isArray(infDoc.infNFe)
            ? infDoc.infNFe
            : [infDoc.infNFe];

          for (const infNFe of infNFes) {
            if (infNFe.chave) {
              chaveReferenciada = infNFe.chave;
              break;
            }
          }
        }
      }

      return {
        chaveAtual,
        chaveReferenciada,
        tipoDocumento: "CTe",
        nomeArquivo,
      };
    }

    // Cancelamento
    if (parsedXml.procEventoNFe) {
      const evento = parsedXml.procEventoNFe.evento;
      if (!evento || !evento.infEvento) return null;

      const chaveAtual = evento.infEvento.chNFe;

      return {
        chaveAtual,
        chaveReferenciada: null, // Cancelamento não referencia outras notas
        tipoDocumento: "Cancelamento",
        nomeArquivo,
      };
    }

    return null;
  } catch (error) {
    console.error(
      `[xmlReferencer] Erro ao extrair info de referência de ${nomeArquivo}:`,
      error
    );
    return null;
  }
}

/**
 * Constrói um mapa de referências a partir de múltiplos XMLs
 *
 * @param arquivos Array de objetos {name, content}
 * @returns ReferenceMap onde a chave é a nota que referencia e o valor é a nota referenciada
 */
export function construirMapaReferencias(
  arquivos: Array<{ name: string; content: string }>
): ReferenceMap {
  const referenceMap: ReferenceMap = new Map();

  for (const arquivo of arquivos) {
    const info = extrairInfoReferencia(arquivo.content, arquivo.name);

    if (info && info.chaveReferenciada) {
      // Nota atual referencia outra nota
      referenceMap.set(info.chaveAtual, info.chaveReferenciada);

      console.log(
        `[xmlReferencer] ${arquivo.name} (${info.chaveAtual.slice(
          -10
        )}) referencia chave ${info.chaveReferenciada.slice(-10)}`
      );
    }
  }

  console.log(
    `[xmlReferencer] Mapa de referências construído com ${referenceMap.size} entradas`
  );
  return referenceMap;
}

/**
 * Atualiza as referências em um XML quando as chaves foram alteradas
 *
 * @param xmlContent Conteúdo XML original
 * @param tipoDocumento Tipo do documento (NFe, CTe, Cancelamento)
 * @param chaveMapping Mapeamento de chaves antigas -> novas
 * @param referenceMap Mapa de referências (qual nota referencia qual)
 * @param chaveAtual Chave atual do documento
 * @returns Objeto com conteúdo atualizado e lista de alterações
 */
export function atualizarReferenciasNoXml(
  xmlContent: string,
  tipoDocumento: "NFe" | "CTe" | "Cancelamento",
  chaveMapping: Map<string, string>,
  referenceMap: ReferenceMap,
  chaveAtual: string
): { conteudoAtualizado: string; alteracoes: string[] } {
  const alteracoes: string[] = [];
  let conteudoAtualizado = xmlContent;

  // Verifica se esta nota referencia outra
  const chaveReferenciada = referenceMap.get(chaveAtual);

  if (!chaveReferenciada) {
    return { conteudoAtualizado, alteracoes };
  }

  // Verifica se a chave referenciada foi alterada
  const novaChaveReferenciada = chaveMapping.get(chaveReferenciada);

  if (!novaChaveReferenciada) {
    console.log(
      `[xmlReferencer] Chave referenciada ${chaveReferenciada.slice(
        -10
      )} não foi alterada`
    );
    return { conteudoAtualizado, alteracoes };
  }

  console.log(
    `[xmlReferencer] Atualizando referência: ${chaveReferenciada.slice(
      -10
    )} -> ${novaChaveReferenciada.slice(-10)}`
  );

  // Atualiza a referência no XML
  if (tipoDocumento === "NFe") {
    // Atualiza tag <refNFe>
    const regexRefNFe = new RegExp(
      `(<refNFe>)${chaveReferenciada}(</refNFe>)`,
      "g"
    );

    if (regexRefNFe.test(conteudoAtualizado)) {
      conteudoAtualizado = conteudoAtualizado.replace(
        regexRefNFe,
        `$1${novaChaveReferenciada}$2`
      );
      alteracoes.push(
        `Referência <refNFe> atualizada: ${chaveReferenciada.slice(
          -10
        )} → ${novaChaveReferenciada.slice(-10)}`
      );
    }
  } else if (tipoDocumento === "CTe") {
    // Atualiza tag <chave> dentro de <infNFe>
    const regexChaveCTe = new RegExp(
      `(<chave>)${chaveReferenciada}(</chave>)`,
      "g"
    );

    if (regexChaveCTe.test(conteudoAtualizado)) {
      conteudoAtualizado = conteudoAtualizado.replace(
        regexChaveCTe,
        `$1${novaChaveReferenciada}$2`
      );
      alteracoes.push(
        `Referência <chave> (CTe) atualizada: ${chaveReferenciada.slice(
          -10
        )} → ${novaChaveReferenciada.slice(-10)}`
      );
    }
  }

  return { conteudoAtualizado, alteracoes };
}

/**
 * Valida se todas as referências foram corretamente atualizadas
 *
 * @param arquivosEditados Arquivos após edição
 * @param chaveMapping Mapeamento de chaves antigas -> novas
 * @param referenceMap Mapa de referências original
 * @returns Array de avisos/erros encontrados
 */
export function validarReferencias(
  arquivosEditados: Array<{ name: string; content: string }>,
  chaveMapping: Map<string, string>,
  referenceMap: ReferenceMap
): string[] {
  const avisos: string[] = [];

  for (const arquivo of arquivosEditados) {
    const info = extrairInfoReferencia(arquivo.content, arquivo.name);

    if (!info) continue;

    // Se tinha referência antes e foi mapeada, valida se foi atualizada
    const chaveOriginalReferenciada = referenceMap.get(info.chaveAtual);

    if (chaveOriginalReferenciada) {
      const novaChaveEsperada = chaveMapping.get(chaveOriginalReferenciada);

      if (novaChaveEsperada && info.chaveReferenciada !== novaChaveEsperada) {
        avisos.push(
          `[AVISO] ${arquivo.name}: Referência não foi atualizada corretamente. ` +
            `Esperado: ${novaChaveEsperada.slice(-10)}, Encontrado: ${
              info.chaveReferenciada?.slice(-10) || "nenhuma"
            }`
        );
      }
    }
  }

  return avisos;
}

/**
 * Função auxiliar para debug: exibe o mapa de referências
 */
export function exibirMapaReferencias(
  referenceMap: ReferenceMap,
  chaveMapping?: Map<string, string>
): void {
  console.log("\n=== MAPA DE REFERÊNCIAS ===");

  if (referenceMap.size === 0) {
    console.log("Nenhuma referência encontrada");
    return;
  }

  referenceMap.forEach((chaveReferenciada, chaveAtual) => {
    const chaveAtualAbrev = chaveAtual.slice(-10);
    const chaveRefAbrev = chaveReferenciada.slice(-10);

    let mensagem = `${chaveAtualAbrev} → ${chaveRefAbrev}`;

    if (chaveMapping) {
      const novaChaveAtual = chaveMapping.get(chaveAtual);
      const novaChaveRef = chaveMapping.get(chaveReferenciada);

      if (novaChaveAtual || novaChaveRef) {
        mensagem += " | Após mapeamento: ";
        mensagem += novaChaveAtual
          ? novaChaveAtual.slice(-10)
          : chaveAtualAbrev;
        mensagem += " → ";
        mensagem += novaChaveRef ? novaChaveRef.slice(-10) : chaveRefAbrev;
      }
    }

    console.log(mensagem);
  });

  console.log("===========================\n");
}
