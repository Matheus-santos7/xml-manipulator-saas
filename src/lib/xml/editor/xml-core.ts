/**
 * Núcleo de edição de XMLs fiscais via regex, preservando a estrutura.
 * Migração do antigo src/lib/xmlEditor.ts para src/lib/xml/editor/xml-core.ts
 */

import { XMLParser } from "fast-xml-parser";
import type { ChaveMapping, ReferenceMapping } from "@/lib/xml";
import { editarInutilizacao } from "./inutilizacao-editor";
import {
  VENDAS_CFOP,
  DEVOLUCOES_CFOP,
  RETORNOS_CFOP,
  REMESSAS_CFOP,
} from "@/lib/data";
import {
  processarImpostos,
  type CstMappingData,
  type TaxReformRuleData,
  type ImpostosData,
} from "./taxes";
import {
  CHAVE_PATTERNS,
  IDENTIFICACAO_PATTERNS,
  createEmitenteFieldRegex,
  createEnderEmitenteRegex,
  createDestinatarioFieldRegex,
  createEnderDestinatarioRegex,
  createProdutoFieldRegex,
  createOrigemIcmsRegex,
  XML_STRUCTURE,
  XML_TAGS,
  EVENTO_PATTERNS,
} from "./regexPatterns";

export interface DadosEmitente {
  CNPJ?: string;
  xNome?: string;
  xFant?: string;
  IE?: string;
  IEST?: string;
  IM?: string;
  CNAE?: string;
  CRT?: string;
  xLgr?: string;
  nro?: string;
  xCpl?: string;
  xBairro?: string;
  cMun?: string;
  xMun?: string;
  UF?: string;
  CEP?: string;
  cPais?: string;
  xPais?: string;
  fone?: string;
}

export interface DadosDestinatario {
  CNPJ?: string;
  CPF?: string;
  xNome?: string;
  IE?: string;
  xLgr?: string;
  nro?: string;
  xBairro?: string;
  cMun?: string;
  xMun?: string;
  UF?: string;
  CEP?: string;
  cPais?: string;
  xPais?: string;
  fone?: string;
}

export interface DadosProduto {
  xProd?: string;
  cEAN?: string;
  cProd?: string;
  NCM?: string;
  // Origem do produto para ICMS (<orig>)
  origem?: string;
}

export interface ResultadoEdicao {
  nomeArquivo: string;
  tipo: "NFe" | "CTe" | "Cancelamento" | "Inutilizacao" | "Desconhecido";
  sucesso: boolean;
  alteracoes: string[];
  conteudoEditado?: string;
  erro?: string;
}

function formatarDataParaXml(dataStr: string): string {
  const [dia, mes, ano] = dataStr.split("/");
  const agora = new Date();
  const horas = agora.getHours().toString().padStart(2, "0");
  const minutos = agora.getMinutes().toString().padStart(2, "0");
  const segundos = agora.getSeconds().toString().padStart(2, "0");

  return `${ano}-${mes}-${dia}T${horas}:${minutos}:${segundos}-03:00`;
}

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

function editarChavesNFe(
  xmlContent: string,
  fileName: string,
  chaveMapping: ChaveMapping,
  referenceMap: ReferenceMapping,
  novaData: string | null = null,
  novoUF: string | null = null,
  novaSerie: string | null = null,
  novoEmitente: DadosEmitente | null = null,
  novoDestinatario: DadosDestinatario | null = null,
  produtos: Array<
    DadosProduto & { isPrincipal: boolean; ordem: number }
  > | null = null,
  cstMappings: CstMappingData[] | null = null,
  taxReformRule: TaxReformRuleData | null = null,
  impostosData: ImpostosData | null = null
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
    let infNFe = findElement(parsed, "nfeProc/NFe/infNFe");
    if (!infNFe) infNFe = findElement(parsed, "NFe/infNFe");
    if (!infNFe) {
      return {
        nomeArquivo: fileName,
        tipo: "Desconhecido",
        sucesso: false,
        alteracoes: [],
        erro: "Não é um XML de NFe válido",
      };
    }
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
    const chaveOriginal = idAttr.replace(CHAVE_PATTERNS.REMOVE_NFE_PREFIX, "");
    if (chaveMapping[chaveOriginal]) {
      const novaChave = chaveMapping[chaveOriginal];
      const regexId = CHAVE_PATTERNS.INF_NFE_ID(chaveOriginal);
      if (regexId.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexId, `$1NFe${novaChave}$2`);
        alteracoes.push(`Chave de Acesso ID alterada para: ${novaChave}`);
      }
      const regexChNFe = CHAVE_PATTERNS.CH_NFE_TAG(chaveOriginal);
      if (regexChNFe.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexChNFe, `$1${novaChave}$2`);
        alteracoes.push("Chave de Acesso do Protocolo alterada");
      }
    }
    if (referenceMap[chaveOriginal]) {
      const chaveReferenciada = referenceMap[chaveOriginal];
      if (chaveMapping[chaveReferenciada]) {
        const novaChaveReferenciada = chaveMapping[chaveReferenciada];
        const regexRefNFe = CHAVE_PATTERNS.REF_NFE_TAG(chaveReferenciada);
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
    if (novoUF) {
      if (IDENTIFICACAO_PATTERNS.CUF_REPLACE.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(
          IDENTIFICACAO_PATTERNS.CUF_REPLACE,
          `$1${novoUF}$2`
        );
        alteracoes.push(`UF <cUF> alterado para: ${novoUF}`);
      }
    }
    if (novaSerie) {
      if (IDENTIFICACAO_PATTERNS.SERIE_REPLACE.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(
          IDENTIFICACAO_PATTERNS.SERIE_REPLACE,
          `$1${novaSerie}$2`
        );
        alteracoes.push(`Série <serie> alterada para: ${novaSerie}`);
      }
    }
    if (novoEmitente) {
      const camposEmit = [
        { campo: "CNPJ", valor: novoEmitente.CNPJ },
        { campo: "xNome", valor: novoEmitente.xNome },
        { campo: "xFant", valor: novoEmitente.xFant },
        { campo: "IE", valor: novoEmitente.IE },
        { campo: "IEST", valor: novoEmitente.IEST },
        { campo: "IM", valor: novoEmitente.IM },
        { campo: "CNAE", valor: novoEmitente.CNAE },
        { campo: "CRT", valor: novoEmitente.CRT },
      ];
      const camposEnderEmit = [
        { campo: "xLgr", valor: novoEmitente.xLgr },
        { campo: "nro", valor: novoEmitente.nro },
        { campo: "xCpl", valor: novoEmitente.xCpl },
        { campo: "xBairro", valor: novoEmitente.xBairro },
        { campo: "cMun", valor: novoEmitente.cMun },
        { campo: "xMun", valor: novoEmitente.xMun },
        { campo: "UF", valor: novoEmitente.UF },
        { campo: "CEP", valor: novoEmitente.CEP },
        { campo: "cPais", valor: novoEmitente.cPais },
        { campo: "xPais", valor: novoEmitente.xPais },
        { campo: "fone", valor: novoEmitente.fone },
      ];
      for (const { campo, valor } of camposEmit) {
        if (valor) {
          const regex = createEmitenteFieldRegex(campo);
          if (regex.test(xmlEditado)) {
            xmlEditado = xmlEditado.replace(regex, `$1$2${valor}$3`);
            alteracoes.push(`Emitente: <${campo}> alterado para ${valor}`);
          }
        }
      }
      for (const { campo, valor } of camposEnderEmit) {
        if (valor) {
          const regex = createEnderEmitenteRegex(campo);
          if (regex.test(xmlEditado)) {
            xmlEditado = xmlEditado.replace(regex, `$1$2${valor}$3`);
            alteracoes.push(
              `Emitente Endereço: <${campo}> alterado para ${valor}`
            );
          }
        }
      }
    }
    if (novoDestinatario) {
      const det = findElement(infNFe, "det");
      const prod = det ? findElement(det, "prod") : null;
      const cfopValue = prod ? findElement(prod, "CFOP") : null;
      const cfop =
        typeof cfopValue === "string" ? cfopValue : String(cfopValue || "");
      const deveAtualizarDestinatario =
        VENDAS_CFOP.includes(cfop) || DEVOLUCOES_CFOP.includes(cfop);
      if (deveAtualizarDestinatario) {
        const camposDest = [
          { campo: "CNPJ", valor: novoDestinatario.CNPJ },
          { campo: "CPF", valor: novoDestinatario.CPF },
          { campo: "xNome", valor: novoDestinatario.xNome },
          { campo: "IE", valor: novoDestinatario.IE },
        ];
        const camposEnderDest = [
          { campo: "xLgr", valor: novoDestinatario.xLgr },
          { campo: "nro", valor: novoDestinatario.nro },
          { campo: "xBairro", valor: novoDestinatario.xBairro },
          { campo: "cMun", valor: novoDestinatario.cMun },
          { campo: "xMun", valor: novoDestinatario.xMun },
          { campo: "UF", valor: novoDestinatario.UF },
          { campo: "CEP", valor: novoDestinatario.CEP },
          { campo: "cPais", valor: novoDestinatario.cPais },
          { campo: "xPais", valor: novoDestinatario.xPais },
          { campo: "fone", valor: novoDestinatario.fone },
        ];
        for (const { campo, valor } of camposDest) {
          if (valor && valor.trim() !== "") {
            const regex = createDestinatarioFieldRegex(campo);
            if (regex.test(xmlEditado)) {
              xmlEditado = xmlEditado.replace(regex, `$1$2${valor}$3`);
              alteracoes.push(
                `Destinatário: <${campo}> alterado para ${valor}`
              );
            }
          }
        }
        for (const { campo, valor } of camposEnderDest) {
          if (valor && valor.trim() !== "") {
            const regex = createEnderDestinatarioRegex(campo);
            if (regex.test(xmlEditado)) {
              xmlEditado = xmlEditado.replace(regex, `$1$2${valor}$3`);
              alteracoes.push(
                `Destinatário Endereço: <${campo}> alterado para ${valor}`
              );
            }
          }
        }
      }
    }
    if (produtos && produtos.length > 0) {
      const det = findElement(infNFe, "det");
      const prod = det ? findElement(det, "prod") : null;
      const cfopValue = prod ? findElement(prod, "CFOP") : null;
      const cfop =
        typeof cfopValue === "string" ? cfopValue : String(cfopValue || "");
      const isVendaRetornoOuDevolucao =
        VENDAS_CFOP.includes(cfop) ||
        DEVOLUCOES_CFOP.includes(cfop) ||
        RETORNOS_CFOP.includes(cfop);
      const isRemessa = REMESSAS_CFOP.includes(cfop);
      const isRemessaSimbolicaOuRetorno = XML_TAGS.HAS_REF_NFE.test(xmlEditado);
      const isRemessaNormal = isRemessa && !isRemessaSimbolicaOuRetorno;
      const detBlocks = xmlEditado.match(XML_STRUCTURE.DET_BLOCK);
      if (detBlocks && (isVendaRetornoOuDevolucao || isRemessa)) {
        detBlocks.forEach((detBlock, index) => {
          let detBlockEditado = detBlock;
          let produtoSelecionado: DadosProduto | null = null;
          if (isVendaRetornoOuDevolucao || isRemessaSimbolicaOuRetorno) {
            produtoSelecionado = produtos.find((p) => p.isPrincipal) || null;
          } else if (isRemessaNormal) {
            produtoSelecionado = produtos[index % produtos.length];
          }
          if (produtoSelecionado) {
            const camposProd = [
              { campo: "xProd", valor: produtoSelecionado.xProd },
              { campo: "cEAN", valor: produtoSelecionado.cEAN },
              { campo: "cProd", valor: produtoSelecionado.cProd },
              { campo: "NCM", valor: produtoSelecionado.NCM },
            ];
            for (const { campo, valor } of camposProd) {
              if (valor && valor.trim() !== "") {
                const regex = createProdutoFieldRegex(campo);
                if (regex.test(detBlockEditado)) {
                  detBlockEditado = detBlockEditado.replace(
                    regex,
                    `$1$2${valor}$3`
                  );
                  if (index === 0) {
                    const tipoOp = isRemessaNormal
                      ? "Remessa (rotação)"
                      : "Venda/Retorno/Devolução/Remessa Simbólica (principal)";
                    alteracoes.push(
                      `Produto ${tipoOp}: <${campo}> alterado para ${valor}`
                    );
                  }
                }
              }
            }

            // Atualiza a origem do produto dentro do bloco ICMS (<orig>)
            if (
              produtoSelecionado.origem &&
              produtoSelecionado.origem.trim() !== ""
            ) {
              // Procura qualquer ocorrência de <orig> dentro do bloco <ICMS> do item
              const regexOrig = createOrigemIcmsRegex();
              if (regexOrig.test(detBlockEditado)) {
                detBlockEditado = detBlockEditado.replace(
                  regexOrig,
                  `$1$2${produtoSelecionado.origem}$3`
                );
                if (index === 0) {
                  const tipoOp = isRemessaNormal
                    ? "Remessa (rotação)"
                    : "Venda/Retorno/Devolução/Remessa Simbólica (principal)";
                  alteracoes.push(
                    `Produto ${tipoOp}: Origem (ICMS orig) alterada para ${produtoSelecionado.origem}`
                  );
                }
              }
            }
            xmlEditado = xmlEditado.replace(detBlock, detBlockEditado);
          }
        });
      }
    }

    // Processa impostos usando o módulo taxes.ts
    xmlEditado = processarImpostos(
      xmlEditado,
      {
        cstMappings,
        taxReformRule,
        impostosData,
      },
      alteracoes
    );

    if (novaData) {
      const novaDataFormatada = formatarDataParaXml(novaData);
      const regexDhEmi = IDENTIFICACAO_PATTERNS.DH_EMI;
      if (regexDhEmi.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexDhEmi, `$1${novaDataFormatada}$2`);
        alteracoes.push(`Data de Emissão <dhEmi> alterada para ${novaData}`);
      }
      const regexDhSaiEnt = IDENTIFICACAO_PATTERNS.DH_SAI_ENT;
      if (regexDhSaiEnt.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(
          regexDhSaiEnt,
          `$1${novaDataFormatada}$2`
        );
        alteracoes.push(
          `Data de Saída/Entrada <dhSaiEnt> alterada para ${novaData}`
        );
      }
      const regexDhRecbto = IDENTIFICACAO_PATTERNS.DH_RECBTO;
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
      conteudoEditado: xmlEditado,
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

function editarChavesCTe(
  xmlContent: string,
  fileName: string,
  chaveMapping: ChaveMapping,
  chaveVendaNova: string | null,
  novaData: string | null = null,
  novoUF: string | null = null,
  novoEmitente: DadosEmitente | null = null,
  novoDestinatario: DadosDestinatario | null = null
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
    let infCte = findElement(parsed, "cteProc/CTe/infCte");
    if (!infCte) infCte = findElement(parsed, "CTe/infCte");
    if (!infCte) {
      return {
        nomeArquivo: fileName,
        tipo: "Desconhecido",
        sucesso: false,
        alteracoes: [],
        erro: "Não é um XML de CTe válido",
      };
    }
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
    if (chaveMapping[chaveOriginal]) {
      const novaChave = chaveMapping[chaveOriginal];
      const regexId = new RegExp(
        `(<infCte[^>]*\\s(?:Id|id)=["'])CTe${chaveOriginal}(["'][^>]*>)`,
        "g"
      );
      if (regexId.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexId, `$1CTe${novaChave}$2`);
        alteracoes.push(`Chave de acesso do CTe alterada para: ${novaChave}`);
      }
      const regexChCTe = new RegExp(`(<chCTe>)${chaveOriginal}(</chCTe>)`, "g");
      if (regexChCTe.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexChCTe, `$1${novaChave}$2`);
        alteracoes.push("protCTe/infProt/chCTe sincronizado");
      }
    }
    const regexChaveAtual = /<infNFe[^>]*>[\s\S]*?<chave>([^<]+)<\/chave>/i;
    const matchChaveAtual = xmlEditado.match(regexChaveAtual);
    if (matchChaveAtual && matchChaveAtual[1]) {
      const chaveNFeAtual = matchChaveAtual[1];
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
      } else if (chaveVendaNova && chaveNFeAtual !== chaveVendaNova) {
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
    if (novoUF) {
      const regexCUF = IDENTIFICACAO_PATTERNS.CUF_REPLACE;
      if (regexCUF.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexCUF, `$1${novoUF}$2`);
        alteracoes.push(`UF <cUF> alterado para: ${novoUF}`);
      }
    }
    if (novoEmitente) {
      const camposRem = [
        { campo: "CNPJ", valor: novoEmitente.CNPJ },
        { campo: "xNome", valor: novoEmitente.xNome },
        { campo: "xFant", valor: novoEmitente.xFant },
        { campo: "IE", valor: novoEmitente.IE },
      ];
      const camposEnderReme = [
        { campo: "xLgr", valor: novoEmitente.xLgr },
        { campo: "nro", valor: novoEmitente.nro },
        { campo: "xCpl", valor: novoEmitente.xCpl },
        { campo: "xBairro", valor: novoEmitente.xBairro },
        { campo: "cMun", valor: novoEmitente.cMun },
        { campo: "xMun", valor: novoEmitente.xMun },
        { campo: "CEP", valor: novoEmitente.CEP },
        { campo: "UF", valor: novoEmitente.UF },
        { campo: "fone", valor: novoEmitente.fone },
      ];
      for (const { campo, valor } of camposRem) {
        if (valor && valor.trim() !== "") {
          const regex = new RegExp(
            `(<rem>(?:(?!<enderReme>)[\\s\\S])*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
            "i"
          );
          if (regex.test(xmlEditado)) {
            xmlEditado = xmlEditado.replace(regex, `$1$2${valor}$3`);
            alteracoes.push(`Remetente: <${campo}> alterado para ${valor}`);
          }
        }
      }
      for (const { campo, valor } of camposEnderReme) {
        if (valor && valor.trim() !== "") {
          const regex = new RegExp(
            `(<enderReme[^>]*>[\\s\\S]*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
            "i"
          );
          if (regex.test(xmlEditado)) {
            xmlEditado = xmlEditado.replace(regex, `$1$2${valor}$3`);
            alteracoes.push(
              `Remetente Endereço: <${campo}> alterado para ${valor}`
            );
          }
        }
      }
    }
    if (novoDestinatario) {
      const camposDest = [
        { campo: "CNPJ", valor: novoDestinatario.CNPJ },
        { campo: "CPF", valor: novoDestinatario.CPF },
        { campo: "xNome", valor: novoDestinatario.xNome },
        { campo: "IE", valor: novoDestinatario.IE },
      ];
      const camposEnderDest = [
        { campo: "xLgr", valor: novoDestinatario.xLgr },
        { campo: "nro", valor: novoDestinatario.nro },
        { campo: "xBairro", valor: novoDestinatario.xBairro },
        { campo: "cMun", valor: novoDestinatario.cMun },
        { campo: "xMun", valor: novoDestinatario.xMun },
        { campo: "UF", valor: novoDestinatario.UF },
        { campo: "CEP", valor: novoDestinatario.CEP },
        { campo: "cPais", valor: novoDestinatario.cPais },
        { campo: "xPais", valor: novoDestinatario.xPais },
        { campo: "fone", valor: novoDestinatario.fone },
      ];
      for (const { campo, valor } of camposDest) {
        if (valor && valor.trim() !== "") {
          const regex = new RegExp(
            `(<dest>(?:(?!<enderDest>)[\\s\\S])*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
            "i"
          );
          if (regex.test(xmlEditado)) {
            xmlEditado = xmlEditado.replace(regex, `$1$2${valor}$3`);
            alteracoes.push(
              `Destinatário (CTe): <${campo}> alterado para ${valor}`
            );
          }
        }
      }
      for (const { campo, valor } of camposEnderDest) {
        if (valor && valor.trim() !== "") {
          const regex = new RegExp(
            `(<enderDest[^>]*>[\\s\\S]*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
            "i"
          );
          if (regex.test(xmlEditado)) {
            xmlEditado = xmlEditado.replace(regex, `$1$2${valor}$3`);
            alteracoes.push(
              `Destinatário Endereço (CTe): <${campo}> alterado para ${valor}`
            );
          }
        }
      }
    }
    if (novaData) {
      const novaDataFormatada = formatarDataParaXml(novaData);
      const regexDhEmi = IDENTIFICACAO_PATTERNS.DH_EMI;
      if (regexDhEmi.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexDhEmi, `$1${novaDataFormatada}$2`);
        alteracoes.push(`Data de Emissão <dhEmi> alterada para ${novaData}`);
      }
      const regexDhRecbto = IDENTIFICACAO_PATTERNS.DH_RECBTO;
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
      conteudoEditado: xmlEditado,
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

function editarChavesCancelamento(
  xmlContent: string,
  fileName: string,
  chaveMapping: ChaveMapping,
  novaData: string | null = null
): ResultadoEdicao {
  const alteracoes: string[] = [];
  let xmlEditado = xmlContent;
  try {
    const regexChNFe = /<chNFe>([0-9]{44})<\/chNFe>/g;
    const chavesEncontradas = new Set<string>();
    let match;
    while ((match = regexChNFe.exec(xmlContent)) !== null) {
      chavesEncontradas.add(match[1]);
    }
    chavesEncontradas.forEach((chaveAntiga) => {
      if (chaveMapping[chaveAntiga]) {
        const novaChave = chaveMapping[chaveAntiga];
        const regexReplace = new RegExp(
          `(<chNFe>)${chaveAntiga}(<\\/chNFe>)`,
          "g"
        );
        const ocorrencias = (xmlEditado.match(regexReplace) || []).length;
        if (ocorrencias > 0) {
          xmlEditado = xmlEditado.replace(regexReplace, `$1${novaChave}$2`);
          alteracoes.push(
            `chNFe alterado para nova chave em ${ocorrencias} local(is): ${novaChave}`
          );
        }
      }
    });
    if (novaData) {
      const novaDataFormatada = formatarDataParaXml(novaData);
      const regexDhEvento = EVENTO_PATTERNS.DH_EVENTO_REPLACE;
      if (regexDhEvento.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(
          regexDhEvento,
          `$1${novaDataFormatada}$2`
        );
        alteracoes.push(`dhEvento alterado para ${novaData}`);
      }
      const regexDhRecbto = EVENTO_PATTERNS.DH_RECBTO_REPLACE;
      if (regexDhRecbto.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(
          regexDhRecbto,
          `$1${novaDataFormatada}$2`
        );
        alteracoes.push(`dhRecbto alterado para ${novaData}`);
      }
      const regexDhRegEvento = EVENTO_PATTERNS.DH_REG_EVENTO_REPLACE;
      if (regexDhRegEvento.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(
          regexDhRegEvento,
          `$1${novaDataFormatada}$2`
        );
        alteracoes.push(`dhRegEvento alterado para ${novaData}`);
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
      conteudoEditado: xmlEditado,
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

export function editarChavesXml(
  xmlContent: string,
  fileName: string,
  chaveMapping: ChaveMapping,
  referenceMap: ReferenceMapping,
  chaveVendaNova: string | null,
  novaData: string | null = null,
  novoUF: string | null = null,
  novaSerie: string | null = null,
  novoEmitente: DadosEmitente | null = null,
  novoDestinatario: DadosDestinatario | null = null,
  produtos: Array<
    DadosProduto & { isPrincipal: boolean; ordem: number }
  > | null = null,
  cstMappings: CstMappingData[] | null = null,
  taxReformRule: TaxReformRuleData | null = null,
  impostosData: ImpostosData | null = null
): ResultadoEdicao {
  if (
    xmlContent.includes("<procEventoNFe") ||
    xmlContent.includes("<envEvento")
  ) {
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
      novoUF,
      novoEmitente,
      novoDestinatario
    );
  } else if (xmlContent.includes("<nfeProc") || xmlContent.includes("<NFe")) {
    return editarChavesNFe(
      xmlContent,
      fileName,
      chaveMapping,
      referenceMap,
      novaData,
      novoUF,
      novaSerie,
      novoEmitente,
      novoDestinatario,
      produtos,
      cstMappings,
      taxReformRule,
      impostosData
    );
  } else if (
    xmlContent.includes("<procInutNFe") ||
    xmlContent.includes("<inutNFe")
  ) {
    // Delegar para o editor de inutilização, aplicando flags de cenário
    return editarInutilizacao(xmlContent, fileName, {
      alterarEmitente: !!novoEmitente,
      novoEmitente,
      alterarData: !!novaData,
      novaData,
      alterarCUF: !!novoUF,
      novoCUF: novoUF,
      alterarSerie: !!novaSerie,
      novaSerie,
    });
  }
  return {
    nomeArquivo: fileName,
    tipo: "Desconhecido",
    sucesso: false,
    alteracoes: [],
    erro: "Tipo de documento não reconhecido",
  };
}

export function editarChavesEmLote(
  files: Array<{ name: string; content: string }>,
  chaveMapping: ChaveMapping,
  referenceMap: ReferenceMapping,
  chaveVendaNova: string | null,
  novaData: string | null = null,
  novoUF: string | null = null,
  novaSerie: string | null = null,
  novoEmitente: DadosEmitente | null = null,
  novoDestinatario: DadosDestinatario | null = null,
  produtos: Array<
    DadosProduto & { isPrincipal: boolean; ordem: number }
  > | null = null,
  cstMappings: CstMappingData[] | null = null,
  taxReformRule: TaxReformRuleData | null = null
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
      novaSerie,
      novoEmitente,
      novoDestinatario,
      produtos,
      cstMappings,
      taxReformRule
    );
    resultados.push(resultado);
  }
  return resultados;
}
