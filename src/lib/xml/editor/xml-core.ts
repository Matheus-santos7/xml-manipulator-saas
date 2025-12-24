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
  type TipoOperacao,
} from "@/lib/data";

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

export interface CstMappingData {
  tipoOperacao: TipoOperacao;
  icms?: string | null;
  ipi?: string | null;
  pis?: string | null;
  cofins?: string | null;
}

export interface TaxReformRuleData {
  pIBSUF?: string | null;
  pIBSMun?: string | null;
  pCBS?: string | null;
  vDevTrib?: string | null;
  cClassTrib?: string | null;
  CST?: string | null;
}

export interface ResultadoEdicao {
  nomeArquivo: string;
  tipo: "NFe" | "CTe" | "Cancelamento" | "Inutilizacao" | "Desconhecido";
  sucesso: boolean;
  alteracoes: string[];
  conteudoEditado?: string;
  erro?: string;
}

interface ValoresIBSCBS {
  vBC: string;
  vIBSUF: string;
  vIBSMun: string;
  vCBS: string;
  vDevTrib: string;
}

function formatDecimal(value: number): string {
  return value.toFixed(2);
}

function parsePercent(value: string | null | undefined): number {
  if (!value) return 0;
  return parseFloat(value.replace(",", ".")) || 0;
}

function criarBlocoIBSCBS(
  vProd: string,
  taxRule: TaxReformRuleData
): { xml: string; valores: ValoresIBSCBS } {
  const vBC = parseFloat(vProd) || 0;
  const pIBSUF = parsePercent(taxRule.pIBSUF);
  const pIBSMun = parsePercent(taxRule.pIBSMun);
  const pCBS = parsePercent(taxRule.pCBS);
  const vDevTrib = parsePercent(taxRule.vDevTrib);

  const vIBSUF = (vBC * pIBSUF) / 100;
  const vIBSMun = (vBC * pIBSMun) / 100;
  const vCBS = (vBC * pCBS) / 100;

  const cst = taxRule.CST || "000";
  const cClassTrib = taxRule.cClassTrib || "000001";

  const xml =
    `<IBSCBS>` +
    `<CST>${cst}</CST>` +
    `<cClassTrib>${cClassTrib}</cClassTrib>` +
    `<gIBSCBS>` +
    `<vBC>${formatDecimal(vBC)}</vBC>` +
    `<gIBSUF>` +
    `<pIBSUF>${formatDecimal(pIBSUF)}</pIBSUF>` +
    `<gDevTrib><vDevTrib>${formatDecimal(vDevTrib)}</vDevTrib></gDevTrib>` +
    `<vIBSUF>${formatDecimal(vIBSUF)}</vIBSUF>` +
    `</gIBSUF>` +
    `<gIBSMun>` +
    `<pIBSMun>${formatDecimal(pIBSMun)}</pIBSMun>` +
    `<gDevTrib><vDevTrib>0.00</vDevTrib></gDevTrib>` +
    `<vIBSMun>${formatDecimal(vIBSMun)}</vIBSMun>` +
    `</gIBSMun>` +
    `<gCBS>` +
    `<pCBS>${formatDecimal(pCBS)}</pCBS>` +
    `<gDevTrib><vDevTrib>0.00</vDevTrib></gDevTrib>` +
    `<vCBS>${formatDecimal(vCBS)}</vCBS>` +
    `</gCBS>` +
    `</gIBSCBS>` +
    `</IBSCBS>`;

  return {
    xml,
    valores: {
      vBC: formatDecimal(vBC),
      vIBSUF: formatDecimal(vIBSUF),
      vIBSMun: formatDecimal(vIBSMun),
      vCBS: formatDecimal(vCBS),
      vDevTrib: formatDecimal(vDevTrib),
    },
  };
}

function criarBlocoIBSCBSTot(totais: {
  vBC: number;
  vIBSUF: number;
  vIBSMun: number;
  vCBS: number;
  vDevTrib: number;
}): string {
  const vIBS = totais.vIBSUF + totais.vIBSMun;

  return (
    `<IBSCBSTot>` +
    `<vBCIBSCBS>${formatDecimal(totais.vBC)}</vBCIBSCBS>` +
    `<gIBS>` +
    `<gIBSUF>` +
    `<vDif>0.00</vDif>` +
    `<vDevTrib>${formatDecimal(totais.vDevTrib)}</vDevTrib>` +
    `<vIBSUF>${formatDecimal(totais.vIBSUF)}</vIBSUF>` +
    `</gIBSUF>` +
    `<gIBSMun>` +
    `<vDif>0.00</vDif>` +
    `<vDevTrib>0.00</vDevTrib>` +
    `<vIBSMun>${formatDecimal(totais.vIBSMun)}</vIBSMun>` +
    `</gIBSMun>` +
    `<vIBS>${formatDecimal(vIBS)}</vIBS>` +
    `<vCredPres>0.00</vCredPres>` +
    `<vCredPresCondSus>0.00</vCredPresCondSus>` +
    `</gIBS>` +
    `<gCBS>` +
    `<vDif>0.00</vDif>` +
    `<vDevTrib>0.00</vDevTrib>` +
    `<vCBS>${formatDecimal(totais.vCBS)}</vCBS>` +
    `<vCredPres>0.00</vCredPres>` +
    `<vCredPresCondSus>0.00</vCredPresCondSus>` +
    `</gCBS>` +
    `</IBSCBSTot>`
  );
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

function aplicarReformaTributaria(
  xmlContent: string,
  taxRule: TaxReformRuleData,
  alteracoes: string[]
): string {
  let xmlEditado = xmlContent;
  const totais = { vBC: 0, vIBSUF: 0, vIBSMun: 0, vCBS: 0, vDevTrib: 0 };
  const regexDet = /<det[^>]*>([\s\S]*?)<\/det>/gi;
  let match;
  let itemCount = 0;
  const detBlocks: Array<{ original: string; edited: string }> = [];
  while ((match = regexDet.exec(xmlContent)) !== null) {
    const detBlock = match[0];
    let detBlockEditado = detBlock;
    const vProdMatch = detBlock.match(/<vProd>([^<]+)<\/vProd>/i);
    if (vProdMatch && vProdMatch[1]) {
      const vProd = vProdMatch[1];
      const { xml: ibscbsXml, valores } = criarBlocoIBSCBS(vProd, taxRule);
      totais.vBC += parseFloat(valores.vBC);
      totais.vIBSUF += parseFloat(valores.vIBSUF);
      totais.vIBSMun += parseFloat(valores.vIBSMun);
      totais.vCBS += parseFloat(valores.vCBS);
      totais.vDevTrib += parseFloat(valores.vDevTrib);
      detBlockEditado = detBlockEditado.replace(
        /<IBSCBS>[\s\S]*?<\/IBSCBS>/gi,
        ""
      );
      detBlockEditado = detBlockEditado.replace(
        /(<\/imposto>)/i,
        `${ibscbsXml}$1`
      );
      itemCount++;
    }
    detBlocks.push({ original: detBlock, edited: detBlockEditado });
  }
  for (const block of detBlocks) {
    xmlEditado = xmlEditado.replace(block.original, block.edited);
  }
  if (itemCount > 0) {
    alteracoes.push(
      `Reforma Tributária: <IBSCBS> adicionado em ${itemCount} item(s)`
    );
  }
  const ibscbsTotXml = criarBlocoIBSCBSTot(totais);
  xmlEditado = xmlEditado.replace(/<IBSCBSTot>[\s\S]*?<\/IBSCBSTot>/gi, "");
  if (xmlEditado.includes("</total>")) {
    xmlEditado = xmlEditado.replace(/(<\/total>)/i, `${ibscbsTotXml}$1`);
    alteracoes.push(
      `Reforma Tributária: <IBSCBSTot> adicionado (vBC: ${formatDecimal(
        totais.vBC
      )}, vIBS: ${formatDecimal(
        totais.vIBSUF + totais.vIBSMun
      )}, vCBS: ${formatDecimal(totais.vCBS)})`
    );
  }
  return xmlEditado;
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
  taxReformRule: TaxReformRuleData | null = null
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
    const chaveOriginal = idAttr.replace(/^NFe/, "");
    if (chaveMapping[chaveOriginal]) {
      const novaChave = chaveMapping[chaveOriginal];
      const regexId = new RegExp(
        `(<infNFe[^>]*\\s(?:Id|id)=["'])NFe${chaveOriginal}(["'][^>]*>)`,
        "g"
      );
      if (regexId.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexId, `$1NFe${novaChave}$2`);
        alteracoes.push(`Chave de Acesso ID alterada para: ${novaChave}`);
      }
      const regexChNFe = new RegExp(`(<chNFe>)${chaveOriginal}(</chNFe>)`, "g");
      if (regexChNFe.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexChNFe, `$1${novaChave}$2`);
        alteracoes.push("Chave de Acesso do Protocolo alterada");
      }
    }
    if (referenceMap[chaveOriginal]) {
      const chaveReferenciada = referenceMap[chaveOriginal];
      if (chaveMapping[chaveReferenciada]) {
        const novaChaveReferenciada = chaveMapping[chaveReferenciada];
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
    if (novoUF) {
      const regexCUF = /(<cUF>)[^<]+(<\/cUF>)/g;
      if (regexCUF.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexCUF, `$1${novoUF}$2`);
        alteracoes.push(`UF <cUF> alterado para: ${novoUF}`);
      }
    }
    if (novaSerie) {
      const regexSerie = /(<serie>)[^<]+(<\/serie>)/g;
      if (regexSerie.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexSerie, `$1${novaSerie}$2`);
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
          const regex = new RegExp(
            `(<emit>(?:(?!<enderEmit>)[\\s\\S])*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
            "i"
          );
          if (regex.test(xmlEditado)) {
            xmlEditado = xmlEditado.replace(regex, `$1$2${valor}$3`);
            alteracoes.push(`Emitente: <${campo}> alterado para ${valor}`);
          }
        }
      }
      for (const { campo, valor } of camposEnderEmit) {
        if (valor) {
          const regex = new RegExp(
            `(<enderEmit[^>]*>[\\s\\S]*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
            "i"
          );
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
            const regex = new RegExp(
              `(<dest>(?:(?!<enderDest>)[\\s\\S])*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
              "i"
            );
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
            const regex = new RegExp(
              `(<enderDest[^>]*>[\\s\\S]*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
              "i"
            );
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
      const regexRefNFeCheck = /<refNFe>[^<]+<\/refNFe>/i;
      const isRemessaSimbolicaOuRetorno = regexRefNFeCheck.test(xmlEditado);
      const isRemessaNormal = isRemessa && !isRemessaSimbolicaOuRetorno;
      const regexDet = /<det[^>]*>[\s\S]*?<\/det>/gi;
      const detBlocks = xmlEditado.match(regexDet);
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
                const regex = new RegExp(
                  `(<prod[\\s\\S]*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
                  "i"
                );
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
              const regexOrig = /(<ICMS[^>]*>[\s\S]*?)(<orig>)[^<]+(<\/orig>)/i;
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
    if (cstMappings && cstMappings.length > 0) {
      const cstMapByTipoOp = new Map<
        TipoOperacao,
        {
          icms?: string | null;
          ipi?: string | null;
          pis?: string | null;
          cofins?: string | null;
        }
      >();
      for (const mapping of cstMappings) {
        cstMapByTipoOp.set(mapping.tipoOperacao, {
          icms: mapping.icms,
          ipi: mapping.ipi,
          pis: mapping.pis,
          cofins: mapping.cofins,
        });
      }
      const getTipoOperacaoByCfop = (cfop: string): TipoOperacao | null => {
        if (VENDAS_CFOP.includes(cfop)) return "VENDA";
        if (DEVOLUCOES_CFOP.includes(cfop)) return "DEVOLUCAO";
        if (RETORNOS_CFOP.includes(cfop)) return "RETORNO";
        if (REMESSAS_CFOP.includes(cfop)) return "REMESSA";
        return null;
      };
      const regexDetCst = /<det[^>]*>[\s\S]*?<\/det>/gi;
      const detBlocksCst = xmlEditado.match(regexDetCst);
      if (detBlocksCst) {
        for (const detBlock of detBlocksCst) {
          let detBlockEditado = detBlock;
          const cfopMatch = detBlock.match(/<CFOP>([^<]+)<\/CFOP>/i);
          const cfopItem = cfopMatch ? cfopMatch[1] : null;
          const tipoOp = cfopItem ? getTipoOperacaoByCfop(cfopItem) : null;
          if (tipoOp && cstMapByTipoOp.has(tipoOp)) {
            const cstRules = cstMapByTipoOp.get(tipoOp)!;
            if (cstRules.icms) {
              const regexCstIcms =
                /(<ICMS[^>]*>[\s\S]*?)(<CST>)[^<]+(<\/CST>)/i;
              if (regexCstIcms.test(detBlockEditado)) {
                detBlockEditado = detBlockEditado.replace(
                  regexCstIcms,
                  `$1$2${cstRules.icms}$3`
                );
                alteracoes.push(
                  `CST ICMS alterado para ${cstRules.icms} (${tipoOp} - CFOP ${cfopItem})`
                );
              }
            }
            if (cstRules.ipi) {
              const regexCstIpi = /(<IPI[^>]*>[\s\S]*?)(<CST>)[^<]+(<\/CST>)/i;
              if (regexCstIpi.test(detBlockEditado)) {
                detBlockEditado = detBlockEditado.replace(
                  regexCstIpi,
                  `$1$2${cstRules.ipi}$3`
                );
                alteracoes.push(
                  `CST IPI alterado para ${cstRules.ipi} (${tipoOp} - CFOP ${cfopItem})`
                );
              }
            }
            if (cstRules.pis) {
              const regexCstPis = /(<PIS[^>]*>[\s\S]*?)(<CST>)[^<]+(<\/CST>)/i;
              if (regexCstPis.test(detBlockEditado)) {
                detBlockEditado = detBlockEditado.replace(
                  regexCstPis,
                  `$1$2${cstRules.pis}$3`
                );
                alteracoes.push(
                  `CST PIS alterado para ${cstRules.pis} (${tipoOp} - CFOP ${cfopItem})`
                );
              }
            }
            if (cstRules.cofins) {
              const regexCstCofins =
                /(<COFINS[^>]*>[\s\S]*?)(<CST>)[^<]+(<\/CST>)/i;
              if (regexCstCofins.test(detBlockEditado)) {
                detBlockEditado = detBlockEditado.replace(
                  regexCstCofins,
                  `$1$2${cstRules.cofins}$3`
                );
                alteracoes.push(
                  `CST COFINS alterado para ${cstRules.cofins} (${tipoOp} - CFOP ${cfopItem})`
                );
              }
            }
            if (detBlockEditado !== detBlock) {
              xmlEditado = xmlEditado.replace(detBlock, detBlockEditado);
            }
          }
        }
      }
    }
    if (novaData) {
      const novaDataFormatada = formatarDataParaXml(novaData);
      const regexDhEmi = /(<dhEmi>)[^<]+(<\/dhEmi>)/g;
      if (regexDhEmi.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexDhEmi, `$1${novaDataFormatada}$2`);
        alteracoes.push(`Data de Emissão <dhEmi> alterada para ${novaData}`);
      }
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
    if (
      taxReformRule &&
      (taxReformRule.pIBSUF || taxReformRule.pIBSMun || taxReformRule.pCBS)
    ) {
      xmlEditado = aplicarReformaTributaria(
        xmlEditado,
        taxReformRule,
        alteracoes
      );
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
      const regexCUF = /(<cUF>)[^<]+(<\/cUF>)/g;
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
      const regexDhEmi = /(<dhEmi>)[^<]+(<\/dhEmi>)/g;
      if (regexDhEmi.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexDhEmi, `$1${novaDataFormatada}$2`);
        alteracoes.push(`Data de Emissão <dhEmi> alterada para ${novaData}`);
      }
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
      const regexDhEvento = /(<dhEvento>)[^<]+(<\/dhEvento>)/g;
      if (regexDhEvento.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(
          regexDhEvento,
          `$1${novaDataFormatada}$2`
        );
        alteracoes.push(`dhEvento alterado para ${novaData}`);
      }
      const regexDhRecbto = /(<dhRecbto>)[^<]+(<\/dhRecbto>)/g;
      if (regexDhRecbto.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(
          regexDhRecbto,
          `$1${novaDataFormatada}$2`
        );
        alteracoes.push(`dhRecbto alterado para ${novaData}`);
      }
      const regexDhRegEvento = /(<dhRegEvento>)[^<]+(<\/dhRegEvento>)/g;
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
  taxReformRule: TaxReformRuleData | null = null
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
      taxReformRule
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
