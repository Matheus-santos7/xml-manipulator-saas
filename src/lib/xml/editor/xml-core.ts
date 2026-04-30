/**
 * Núcleo de edição de XMLs via regex, preservando a estrutura.
 * Migração do antigo src/lib/xmlEditor.ts para src/lib/xml/editor/xml-core.ts
 */

import { XMLParser } from "fast-xml-parser";
import type { ChaveMapping, ReferenceMapping } from "@/lib/xml";
import type { NormalizedTaxRule } from "@/lib/tax-rules/types";
import {
  findBestTaxRule,
  mapTransactionTypeFromCfop,
} from "@/lib/tax-rules/matcher";
import { editarInutilizacao } from "./inutilizacao-editor";
import {
  applyTaxRuleToDetBlock,
  recalcImpostosByVProdRatio,
  updateNFeTotals,
} from "./tax-rules";
import {
  VENDAS_CFOP,
  DEVOLUCOES_CFOP,
  RETORNOS_CFOP,
  REMESSAS_CFOP,
} from "@/lib/constants";
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
  regraTributariaNome?: string;
  // Origem do produto (<orig>)
  origem?: string;
  // Valor unitário aplicado em CFOPs de venda/devolução
  vUnComVenda?: string;
  // Valor unitário (custo) aplicado em CFOPs de remessa/retorno/transferência
  vUnComTransferencia?: string;
  // Peso bruto unitário (kg)
  pesoBruto?: string;
  // Peso líquido unitário (kg)
  pesoLiquido?: string;
}

export interface ResultadoEdicao {
  nomeArquivo: string;
  tipo: "NFe" | "CTe" | "Cancelamento" | "Inutilizacao" | "Desconhecido";
  sucesso: boolean;
  alteracoes: string[];
  conteudoEditado?: string;
  erro?: string;
}

/**
 * Converte string para número aceitando vírgula ou ponto como separador decimal.
 *
 * Regras de detecção:
 *  - Se a string tem somente dígitos com ponto (ex.: "1.0000", "69.99"),
 *    o ponto é tratado como separador decimal (formato XML/NFe nativo).
 *  - Se a string tem vírgula como separador decimal e ponto como milhar
 *    (ex.: "1.234,56"), removemos o ponto e trocamos vírgula por ponto.
 *  - Se a string tem somente vírgula (ex.: "69,99"), trocamos para ponto.
 *
 * Retorna `null` quando o valor é inválido / vazio.
 */
function parseDecimal(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  let normalized = raw;
  if (hasComma && hasDot) {
    // formato pt-BR: "1.234,56"
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // só vírgula: "69,99"
    normalized = raw.replace(",", ".");
  }
  // só ponto ou só dígitos: já está em formato JS válido
  const v = Number(normalized);
  return Number.isFinite(v) ? v : null;
}

/**
 * Substitui o valor numérico de uma tag dentro de um trecho de XML.
 * Mantém estrutura/atributos.
 */
function replaceNumericTagValue(
  xml: string,
  tag: string,
  value: string
): { updated: string; changed: boolean } {
  const re = new RegExp(`(<${tag}>)[^<]*(<\\/${tag}>)`, "i");
  if (!re.test(xml)) return { updated: xml, changed: false };
  return { updated: xml.replace(re, `$1${value}$2`), changed: true };
}

function readNumericTagValue(xml: string, tag: string): number {
  const m = xml.match(new RegExp(`<${tag}>\\s*([^<]+)\\s*<\\/${tag}>`, "i"));
  if (!m) return 0;
  const n = Number(String(m[1]).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function sumDetTagValues(xml: string, tag: string): number {
  const detBlocks = xml.match(XML_STRUCTURE.DET_BLOCK) || [];
  let total = 0;
  for (const detBlock of detBlocks) {
    total += readNumericTagValue(detBlock, tag);
  }
  return Number(total.toFixed(2));
}

function nearlyEqual(a: number, b: number, tolerance = 0.01): boolean {
  return Math.abs(a - b) <= tolerance;
}

/** Lê `vNF` dentro de `ICMSTot` no primeiro bloco `total`. */
function readIcmsTotVNF(xml: string): number {
  const totalM = xml.match(XML_STRUCTURE.TOTAL_BLOCK);
  if (!totalM) return 0;
  const icmsM = totalM[0].match(/<ICMSTot>[\s\S]*?<\/ICMSTot>/i);
  if (!icmsM) return 0;
  return readNumericTagValue(icmsM[0], "vNF");
}

/**
 * Em cada `<det>`, iguala `<vItem>` ao `<vProd>` do `<prod>` (soma dos itens
 * passa a coincidir com a soma dos `vProd` e com ICMSTot/vProd após recálculo).
 */
function syncDetVItemToVProd(xml: string): { xml: string; logs: string[] } {
  const logs: string[] = [];
  let out = xml;
  const dets = out.match(XML_STRUCTURE.DET_BLOCK) || [];
  let n = 0;
  for (const det of dets) {
    const prodM = det.match(/<prod[^>]*>[\s\S]*?<\/prod>/i);
    if (!prodM) continue;
    const vProdM = prodM[0].match(/<vProd>([^<]+)<\/vProd>/i);
    if (!vProdM) continue;
    const vProdNum = parseDecimal(vProdM[1]);
    if (vProdNum === null) continue;
    const vStr = formatMoney(vProdNum);
    const r = replaceNumericTagValue(det, "vItem", vStr);
    if (r.changed) {
      out = out.replace(det, r.updated);
      n += 1;
    }
  }
  if (n > 0) {
    logs.push(`Pagamentos/totais: <vItem> alinhado ao <vProd> em ${n} item(ns).`);
  }
  return { xml: out, logs };
}

/**
 * Em cada `<det>`, redefine `<imposto><vTotTrib>` como a soma dos tributos
 * do item (vICMS + vIPI + vPIS + vCOFINS), alinhado ao critério do ICMSTot.
 */
function syncDetImpostoVTotTribToItemTaxes(xml: string): {
  xml: string;
  logs: string[];
} {
  const logs: string[] = [];
  let out = xml;
  const dets = out.match(XML_STRUCTURE.DET_BLOCK) || [];
  let n = 0;
  for (const det of dets) {
    const impM = det.match(/<imposto[^>]*>[\s\S]*?<\/imposto>/i);
    if (!impM) continue;
    const impostoBlock = impM[0];
    const vICMS = readNumericTagValue(impostoBlock, "vICMS");
    const vIPI = readNumericTagValue(impostoBlock, "vIPI");
    const vPIS = readNumericTagValue(impostoBlock, "vPIS");
    const vCOFINS = readNumericTagValue(impostoBlock, "vCOFINS");
    const vTot = Number((vICMS + vIPI + vPIS + vCOFINS).toFixed(2));
    const r = replaceNumericTagValue(
      impostoBlock,
      "vTotTrib",
      formatMoney(vTot)
    );
    if (!r.changed) continue;
    const newDet = det.replace(impM[0], r.updated);
    out = out.replace(det, newDet);
    n += 1;
  }
  if (n > 0) {
    logs.push(
      `Itens: <imposto>/<vTotTrib> atualizado (vICMS+vIPI+vPIS+vCOFINS) em ${n} det(s).`
    );
  }
  return { xml: out, logs };
}

/**
 * Atualiza `ICMSTot/vProd` pela soma dos `det/vProd`, recalcula `vNF`/`vNFTot`
 * e campos auxiliares (mesma fórmula já usada na manipulação de produtos).
 */
function recalculateIcmsTotFromDetSums(xml: string): {
  xml: string;
  vNF: number;
  logs: string[];
} {
  const logs: string[] = [];
  const totalBlockMatch = xml.match(XML_STRUCTURE.TOTAL_BLOCK);
  if (!totalBlockMatch) {
    return { xml, vNF: readIcmsTotVNF(xml), logs };
  }
  let totalBlock = totalBlockMatch[0];
  const vProdTotalCalculado = sumDetTagValues(xml, "vProd");
  const vProdTotalStr = formatMoney(vProdTotalCalculado);
  const r1 = replaceNumericTagValue(totalBlock, "vProd", vProdTotalStr);
  if (r1.changed) totalBlock = r1.updated;

  const vProdTotal = readNumericTagValue(totalBlock, "vProd");
  const vFreteTotal = readNumericTagValue(totalBlock, "vFrete");
  const vSegTotal = readNumericTagValue(totalBlock, "vSeg");
  const vDescTotal = readNumericTagValue(totalBlock, "vDesc");
  const vIITotal = readNumericTagValue(totalBlock, "vII");
  const vIPITotal = readNumericTagValue(totalBlock, "vIPI");
  const vIPIDevolTotal = readNumericTagValue(totalBlock, "vIPIDevol");
  const vOutroTotal = readNumericTagValue(totalBlock, "vOutro");
  const vICMSUFDestTotal = readNumericTagValue(totalBlock, "vICMSUFDest");
  const vNFTotal =
    vProdTotal +
    vFreteTotal +
    vSegTotal +
    vIITotal +
    vIPITotal +
    vIPIDevolTotal +
    vICMSUFDestTotal +
    vOutroTotal -
    vDescTotal;
  const r2 = replaceNumericTagValue(totalBlock, "vNF", formatMoney(vNFTotal));
  if (r2.changed) totalBlock = r2.updated;
  const rNfTot = replaceNumericTagValue(
    totalBlock,
    "vNFTot",
    formatMoney(vNFTotal)
  );
  if (rNfTot.changed) totalBlock = rNfTot.updated;

  const vICMSTotal = readNumericTagValue(totalBlock, "vICMS");
  const vIPITotalCalc = readNumericTagValue(totalBlock, "vIPI");
  const vPISTotalCalc = readNumericTagValue(totalBlock, "vPIS");
  const vCOFINSTotalCalc = readNumericTagValue(totalBlock, "vCOFINS");
  const vTotTribCalc =
    vICMSTotal + vIPITotalCalc + vPISTotalCalc + vCOFINSTotalCalc;
  const r3 = replaceNumericTagValue(
    totalBlock,
    "vTotTrib",
    formatMoney(vTotTribCalc)
  );
  if (r3.changed) totalBlock = r3.updated;

  const emitUfFinalMatch = xml.match(
    /<enderEmit[^>]*>[\s\S]*?<UF>([^<]+)<\/UF>/i
  );
  const destUfFinalMatch = xml.match(
    /<enderDest[^>]*>[\s\S]*?<UF>([^<]+)<\/UF>/i
  );
  const emitUfFinal = emitUfFinalMatch
    ? emitUfFinalMatch[1].trim().toUpperCase()
    : "";
  const destUfFinal = destUfFinalMatch
    ? destUfFinalMatch[1].trim().toUpperCase()
    : "";
  const idDestFinal = (readTagValue(xml, "idDest") || "").trim();
  const isInterestadual =
    idDestFinal === "2" &&
    !!emitUfFinal &&
    !!destUfFinal &&
    emitUfFinal !== destUfFinal;

  let difalAlterado = false;
  if (!isInterestadual) {
    const r4 = replaceNumericTagValue(totalBlock, "vFCPUFDest", "0.00");
    if (r4.changed) {
      totalBlock = r4.updated;
      difalAlterado = true;
    }
    const r5 = replaceNumericTagValue(totalBlock, "vICMSUFDest", "0.00");
    if (r5.changed) {
      totalBlock = r5.updated;
      difalAlterado = true;
    }
    const r6 = replaceNumericTagValue(totalBlock, "vICMSUFRemet", "0.00");
    if (r6.changed) {
      totalBlock = r6.updated;
      difalAlterado = true;
    }
  }

  const out = xml.replace(totalBlockMatch[0], totalBlock);
  if (
    r1.changed ||
    r2.changed ||
    rNfTot.changed ||
    r3.changed ||
    difalAlterado
  ) {
    logs.push(
      `Pagamentos/totais: ICMSTot/vProd=${vProdTotalStr}, vNF=${formatMoney(vNFTotal)}`
    );
  }
  return { xml: out, vNF: vNFTotal, logs };
}

/**
 * Ajusta `<vPag>` em `<detPag>` para fechar com `vNF`:
 * - um meio: `vPag` = `vNF`;
 * - vários: mantém se a soma já bate com `vNF`; senão redistribui
 *   proporcionalmente (preserva o rateio relativo).
 */
function syncPagVPagWithVnf(xml: string, vNF: number): { xml: string; logs: string[] } {
  const logs: string[] = [];
  const pagMatch = xml.match(/<pag[^>]*>[\s\S]*?<\/pag>/i);
  if (!pagMatch) return { xml, logs };

  const pagBlock = pagMatch[0];
  const detPagRe = /<detPag[^>]*>[\s\S]*?<\/detPag>/gi;
  const parts = [...pagBlock.matchAll(detPagRe)].map((m) => m[0]);
  if (parts.length === 0) return { xml, logs };

  let newParts: string[];
  if (parts.length === 1) {
    const only = replaceNumericTagValue(parts[0], "vPag", formatMoney(vNF));
    newParts = [only.updated];
    if (only.changed) {
      logs.push(`Pagamentos: <vPag> igualado ao vNF (${formatMoney(vNF)}).`);
    }
  } else {
    const values = parts.map((p) => readNumericTagValue(p, "vPag"));
    const sum = Number(values.reduce((a, b) => a + b, 0).toFixed(2));
    if (nearlyEqual(sum, vNF)) {
      return { xml, logs };
    }
    if (sum <= 0) {
      newParts = parts.map((p, i) =>
        replaceNumericTagValue(
          p,
          "vPag",
          formatMoney(i === 0 ? vNF : 0)
        ).updated
      );
      logs.push(
        `Pagamentos: soma vPag era zero; total (${formatMoney(
          vNF
        )}) alocado ao primeiro <detPag>.`
      );
    } else {
      newParts = [];
      let allocated = 0;
      for (let i = 0; i < parts.length - 1; i++) {
        const v = Number(((values[i] * vNF) / sum).toFixed(2));
        allocated += v;
        newParts.push(
          replaceNumericTagValue(parts[i], "vPag", formatMoney(v)).updated
        );
      }
      const last = Number((vNF - allocated).toFixed(2));
      newParts.push(
        replaceNumericTagValue(
          parts[parts.length - 1],
          "vPag",
          formatMoney(last)
        ).updated
      );
      logs.push(
        `Pagamentos: ${parts.length} meios — <vPag> ajustados para somar vNF (${formatMoney(vNF)}).`
      );
    }
  }

  const open = pagBlock.match(/^<pag[^>]*>/i)?.[0] || "<pag>";
  const rebuilt = `${open}${newParts.join("")}</pag>`;
  const out = xml.replace(pagMatch[0], rebuilt);
  return { xml: out, logs };
}

function finalizeNFeVItemTotalsPagamentos(xml: string): {
  xml: string;
  logs: string[];
} {
  const logs: string[] = [];
  let out = xml;
  const temItens = (out.match(XML_STRUCTURE.DET_BLOCK) || []).length > 0;
  if (temItens) {
    const s1 = syncDetVItemToVProd(out);
    out = s1.xml;
    logs.push(...s1.logs);
    const s2 = recalculateIcmsTotFromDetSums(out);
    out = s2.xml;
    logs.push(...s2.logs);
    const s2b = syncDetImpostoVTotTribToItemTaxes(out);
    out = s2b.xml;
    logs.push(...s2b.logs);
    const s3 = syncPagVPagWithVnf(out, s2.vNF);
    out = s3.xml;
    logs.push(...s3.logs);
  } else {
    const vNF = readIcmsTotVNF(out);
    const s3 = syncPagVPagWithVnf(out, vNF);
    out = s3.xml;
    logs.push(...s3.logs);
  }

  const s4 = syncInformacoesComplementaresTributos(out);
  out = s4.xml;
  logs.push(...s4.logs);

  return { xml: out, logs };
}

function readTagValue(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([^<]+)<\\/${tag}>`, "i"));
  return m ? m[1] : null;
}

function onlyDigits(value: string | null | undefined): string {
  return (value || "").replace(/\D/g, "");
}

function isIeCompatibleWithUf(ie: string | null | undefined, uf: string | null | undefined): boolean {
  const ufNorm = (uf || "").trim().toUpperCase();
  const ieRaw = (ie || "").trim();
  if (!ufNorm || !ieRaw) return true;
  if (ieRaw.toUpperCase() === "ISENTO") return true;
  const digits = ieRaw.replace(/\D/g, "");
  if (!digits) return false;

  const allowedByUf: Record<string, number[]> = {
    AC: [13],
    AL: [9],
    AP: [9],
    AM: [9],
    BA: [8, 9],
    CE: [9],
    DF: [13],
    ES: [9],
    GO: [9],
    MA: [9],
    MT: [11],
    MS: [9],
    MG: [13],
    PA: [9],
    PB: [9],
    PR: [10],
    PE: [14],
    PI: [9],
    RJ: [8],
    RN: [9],
    RO: [14],
    RR: [9],
    RS: [10],
    SC: [9],
    SP: [12],
    SE: [9],
    TO: [9, 11],
  };

  const allowed = allowedByUf[ufNorm];
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(digits.length);
}

function formatMoney(value: number): string {
  return value.toFixed(2);
}

/** Valor monetário no padrão textual brasileiro (ex.: infCpl / infAdProd). */
function formatValorRealPtBr(value: number): string {
  return `R$${formatMoney(value).replace(".", ",")}`;
}

/**
 * Alinha textos da Lei 12.741/2012 (tributos aproximados, DIFAL) em
 * `<infCpl>` e `<infAdProd>` ao `ICMSTot` atual (após mudança de valores).
 */
function syncInformacoesComplementaresTributos(xml: string): {
  xml: string;
  logs: string[];
} {
  const logs: string[] = [];
  const totalM = xml.match(XML_STRUCTURE.TOTAL_BLOCK);
  if (!totalM) return { xml, logs };
  const icmsM = totalM[0].match(/<ICMSTot>[\s\S]*?<\/ICMSTot>/i);
  if (!icmsM) return { xml, logs };
  const ic = icmsM[0];
  const vTotTrib = readNumericTagValue(ic, "vTotTrib");
  const vICMSUFDest = readNumericTagValue(ic, "vICMSUFDest");
  const vFCPUFDest = readNumericTagValue(ic, "vFCPUFDest");
  const vICMSUFRemet = readNumericTagValue(ic, "vICMSUFRemet");

  const brl = formatValorRealPtBr;
  const numPt = (n: number) => formatMoney(n).replace(".", ",");
  let out = xml;
  let touched = false;
  const detBlocks = out.match(XML_STRUCTURE.DET_BLOCK) || [];
  const isNotaVenda = detBlocks.some((det) => {
    const cfop = (det.match(/<CFOP>([^<]+)<\/CFOP>/i)?.[1] || "").trim();
    return VENDAS_CFOP.includes(cfop);
  });

  const infCplRe = /(<infCpl>)([\s\S]*?)(<\/infCpl>)/i;
  const cplMatch = out.match(infCplRe);
  if (cplMatch) {
    let inner = cplMatch[2];
    const before = inner;

    inner = inner.replace(
      /Valor aproximado dos tributos\s*\(IBPT\)\s*R\$\s*[\d.,]+/gi,
      () => `Valor aproximado dos tributos (IBPT) ${brl(vTotTrib)}`
    );
    inner = inner.replace(
      /(Total aproximado de tributos federais, estaduais e municipais)\s*:?\s*R\$\s*[\d.,]+/gi,
      (_, g1: string) => `${g1}: ${brl(vTotTrib)}`
    );
    inner = inner.replace(
      /DIFAL da UF destino\s*R\$\s*[\d.,]+\s*\+\s*FCP\s*R\$\s*[\d.,]+\s*;\s*DIFAL da UF Origem\s*R\$\s*[\d.,]+/gi,
      () =>
        `DIFAL da UF destino ${brl(vICMSUFDest)} + FCP ${brl(vFCPUFDest)}; DIFAL da UF Origem ${brl(vICMSUFRemet)}`
    );
    inner = inner.replace(
      /N\/A\s+[\d.,]+\s+[\d.,]+/gi,
      () => `N/A ${numPt(vTotTrib)} ${numPt(vICMSUFDest)}`
    );
    if (isNotaVenda) {
      const enderEmit = out.match(/<enderEmit[^>]*>[\s\S]*?<\/enderEmit>/i)?.[0] || "";
      const xLgr = readTagValue(enderEmit, "xLgr") || "";
      const nro = readTagValue(enderEmit, "nro") || "";
      const xCpl = readTagValue(enderEmit, "xCpl") || "";
      const xBairro = readTagValue(enderEmit, "xBairro") || "";
      const xMun = readTagValue(enderEmit, "xMun") || "";
      const cep = readTagValue(enderEmit, "CEP") || "";
      const uf = readTagValue(enderEmit, "UF") || "";
      const xPais = readTagValue(enderEmit, "xPais") || "BR";
      const enderecoEmitenteTexto =
        `saindo do endereco: ${xLgr}, Numero: ${nro}, Complemento: ${xCpl}, ` +
        `Bairro: ${xBairro}, Cidade: ${xMun}, Cep: ${cep}, Estado: ${uf}, Pais: ${xPais}.`;
      inner = inner.replace(
        /saindo do endereco:[\s\S]*?Pais:\s*[^.]+?\./i,
        () => enderecoEmitenteTexto
      );
    }

    if (inner !== before) {
      out = out.replace(
        infCplRe,
        (_m, open: string, _mid: string, close: string) => open + inner + close
      );
      touched = true;
    }
  }

  out = out.replace(
    /(<infAdProd>)([^<]*)(<\/infAdProd>)/gi,
    (_full, a: string, text: string, c: string) => {
      let t = text;
      const before = t;
      t = t.replace(
        /(Total aproximado de tributos federais, estaduais e municipais)\s*:?\s*R\$\s*[\d.,]+/gi,
        (_, g1: string) => `${g1}: ${brl(vTotTrib)}`
      );
      if (t !== before) touched = true;
      return `${a}${t}${c}`;
    }
  );

  if (touched) {
    logs.push(
      `Informações complementares: tributos aproximados / DIFAL alinhados ao ICMSTot (${brl(vTotTrib)}).`
    );
    if (isNotaVenda) {
      logs.push(
        "Informações complementares: endereço de saída em <infCpl> alinhado ao endereço do emitente na venda."
      );
    }
  }
  return { xml: out, logs };
}

function formatWeight(value: number): string {
  return value.toFixed(3);
}

function isVendaOuDevolucaoCfop(cfop: string): boolean {
  return VENDAS_CFOP.includes(cfop) || DEVOLUCOES_CFOP.includes(cfop);
}

function isRemessaOuRetornoCfop(cfop: string): boolean {
  return REMESSAS_CFOP.includes(cfop) || RETORNOS_CFOP.includes(cfop);
}

function formatarDataParaXml(dataStr: string): string {
  const [dia, mes, ano] = dataStr.split("/");
  const agora = new Date();
  const horas = agora.getHours().toString().padStart(2, "0");
  const minutos = agora.getMinutes().toString().padStart(2, "0");
  const segundos = agora.getSeconds().toString().padStart(2, "0");

  return `${ano}-${mes}-${dia}T${horas}:${minutos}:${segundos}-03:00`;
}

const IBGE_UF_CODE_TO_SIGLA: Record<string, string> = {
  "11": "RO",
  "12": "AC",
  "13": "AM",
  "14": "RR",
  "15": "PA",
  "16": "AP",
  "17": "TO",
  "21": "MA",
  "22": "PI",
  "23": "CE",
  "24": "RN",
  "25": "PB",
  "26": "PE",
  "27": "AL",
  "28": "SE",
  "29": "BA",
  "31": "MG",
  "32": "ES",
  "33": "RJ",
  "35": "SP",
  "41": "PR",
  "42": "SC",
  "43": "RS",
  "50": "MS",
  "51": "MT",
  "52": "GO",
  "53": "DF",
};

const UF_SIGLA_TO_CODE: Record<string, string> = Object.entries(
  IBGE_UF_CODE_TO_SIGLA
).reduce((acc, [code, uf]) => {
  acc[uf] = code;
  return acc;
}, {} as Record<string, string>);

function resolveUfFromCMun(cMun?: string | null): string | null {
  const clean = (cMun || "").replace(/\D/g, "");
  if (clean.length < 2) return null;
  return IBGE_UF_CODE_TO_SIGLA[clean.slice(0, 2)] || null;
}

function resolveCodeFromUfSigla(uf?: string | null): string | null {
  const sigla = (uf || "").trim().toUpperCase();
  if (!sigla) return null;
  return UF_SIGLA_TO_CODE[sigla] || null;
}

/**
 * Avisos sobre divergência entre UF de emissão (ide/cUF × emit) e locais
 * alternativos de retirada/entrega (campos comuns em rejeições SEFAZ).
 */
function collectGeographicFiscalWarnings(xml: string): string[] {
  const w: string[] = [];
  const emitUfM = xml.match(/<enderEmit[^>]*>[\s\S]*?<UF>([^<]+)<\/UF>/i);
  const emitUf = emitUfM ? emitUfM[1].trim().toUpperCase() : "";
  const ideCufM = xml.match(/<ide[^>]*>[\s\S]*?<cUF>([^<]+)<\/cUF>/i);
  const ideCuf = ideCufM ? ideCufM[1].trim() : "";
  const cufEsperadoEmit = resolveCodeFromUfSigla(emitUf);
  if (emitUf && cufEsperadoEmit && ideCuf && ideCuf !== cufEsperadoEmit) {
    w.push(
      `ICMS aviso: ide/cUF (${ideCuf}) diverge da UF do emitente (${emitUf} → código IBGE ${cufEsperadoEmit}). Ajuste o cenário ou a chave para a UF fiscal real do estabelecimento emissor.`
    );
  }

  const retM = xml.match(/<retirada[^>]*>[\s\S]*?<\/retirada>/i);
  if (retM && emitUf) {
    const retUfM = retM[0].match(/<UF>([^<]+)<\/UF>/i);
    const retUf = retUfM ? retUfM[1].trim().toUpperCase() : "";
    if (retUf && retUf !== emitUf) {
      w.push(
        `ICMS aviso: <retirada>/UF (${retUf}) difere do emitente (${emitUf}). Saída física em outra UF exige estabelecimento emissor com IE na UF correta ou nota emitida por essa filial.`
      );
    }
  }

  const entM = xml.match(/<entrega[^>]*>[\s\S]*?<\/entrega>/i);
  if (entM && emitUf) {
    const entUfM = entM[0].match(/<UF>([^<]+)<\/UF>/i);
    const entUf = entUfM ? entUfM[1].trim().toUpperCase() : "";
    if (entUf && entUf !== emitUf) {
      w.push(
        `ICMS aviso: <entrega>/UF (${entUf}) difere do emitente (${emitUf}). Verifique coerência fiscal do local de entrega com o emissor da NF-e.`
      );
    }
  }

  return w;
}

/**
 * Mantém `ide/cUF` e `ide/idDest` coerentes com as UFs efetivas de emitente
 * e destinatário após manipulação (requisitos de validação SEFAZ).
 *
 * - cUF: código IBGE da UF do emitente (mesma regra do manual: local do emitente).
 * - idDest: 1 = operação interna (emit.UF === dest.UF); 2 = interestadual.
 */
function syncIdeCufAndIdDestFromAddresses(xml: string): {
  xml: string;
  logs: string[];
} {
  const logs: string[] = [];
  let out = xml;
  const emitM = out.match(/<enderEmit[^>]*>[\s\S]*?<UF>([^<]+)<\/UF>/i);
  const destM = out.match(/<enderDest[^>]*>[\s\S]*?<UF>([^<]+)<\/UF>/i);
  const emitUf = emitM ? emitM[1].trim().toUpperCase() : "";
  const destUf = destM ? destM[1].trim().toUpperCase() : "";

  const cufCode = resolveCodeFromUfSigla(emitUf);
  if (cufCode && IDENTIFICACAO_PATTERNS.CUF_REPLACE.test(out)) {
    out = out.replace(
      IDENTIFICACAO_PATTERNS.CUF_REPLACE,
      `$1${cufCode}$2`
    );
    logs.push(
      `Identificação: <cUF> sincronizado com UF do emitente (${emitUf}): ${cufCode}`
    );
  }

  if (emitUf && destUf) {
    const idDest = emitUf === destUf ? "1" : "2";
    if (IDENTIFICACAO_PATTERNS.IDDEST_IN_IDE_REPLACE.test(out)) {
      out = out.replace(
        IDENTIFICACAO_PATTERNS.IDDEST_IN_IDE_REPLACE,
        `$1${idDest}$2`
      );
      logs.push(
        `Identificação: <idDest> ajustado para ${idDest} (${emitUf} x ${destUf})`
      );
    }
  }

  return { xml: out, logs };
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
  taxRules: NormalizedTaxRule[] | null = null,
  novoDestinatarioRemessa: DadosDestinatario | null = null
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
    {
      // Garante que a referência fiscal da NFe aponte para a chave correta após
      // remapeamento (ex.: venda -> retorno, retorno -> remessa).
      const refEsperadaAntiga = referenceMap[chaveOriginal];
      if (refEsperadaAntiga) {
        const refEsperadaNova =
          chaveMapping[refEsperadaAntiga] || refEsperadaAntiga;
        const refTagRegex = /(<refNFe>)[0-9]{44}(<\/refNFe>)/i;
        if (refTagRegex.test(xmlEditado)) {
          xmlEditado = xmlEditado.replace(
            refTagRegex,
            `$1${refEsperadaNova}$2`
          );
          alteracoes.push(
            `NFref sincronizada para a chave referenciada correta: ${refEsperadaNova}`
          );
        }
      } else if (/<refNFe>[0-9]{44}<\/refNFe>/i.test(xmlEditado)) {
        alteracoes.push(
          "ICMS aviso: NFref encontrada sem mapeamento de cadeia; verifique vínculo remessa/retorno/venda."
        );
      }
    }
    // ide/cUF deve refletir a UF do emitente (local fiscal de emissão). Se o
    // cenário informa emitente com UF, não sobrescrever com `novo_cUF` da chave
    // (evita cUF 35 com saída física / emit em SC).
    const emitenteUfNoCenario = (novoEmitente?.UF || "").trim();
    if (novoUF) {
      if (emitenteUfNoCenario) {
        alteracoes.push(
          `ICMS aviso: alterar_cUF (${novoUF}) não foi aplicado em ide/cUF — mantida coerência com a UF do emitente do cenário (${emitenteUfNoCenario}).`
        );
      } else if (IDENTIFICACAO_PATTERNS.CUF_REPLACE.test(xmlEditado)) {
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
      if (!isIeCompatibleWithUf(novoEmitente.IE, novoEmitente.UF)) {
        return {
          nomeArquivo: fileName,
          tipo: "NFe",
          sucesso: false,
          alteracoes: [],
          erro: `IE do emitente incompatível com a UF ${novoEmitente.UF}.`,
        };
      }
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

      // UF de emissão x local físico (cMun IBGE): a SEFAZ exige que a UF do
      // emitente acompanhe o município do estabelecimento emissor (ex.: saída
      // em Governador Celso Ramos ⇒ SC / cUF 42, não SP / 35).
      const ufEsperadaPorCMunEmit = resolveUfFromCMun(novoEmitente.cMun);
      const ufCenario = (novoEmitente.UF || "").trim().toUpperCase();
      const precisaUfPorMunicipio =
        !!ufEsperadaPorCMunEmit &&
        !!novoEmitente.cMun &&
        (!ufCenario || ufCenario !== ufEsperadaPorCMunEmit);
      if (precisaUfPorMunicipio) {
        const regexUfEmit = createEnderEmitenteRegex("UF");
        if (regexUfEmit.test(xmlEditado)) {
          xmlEditado = xmlEditado.replace(
            regexUfEmit,
            `$1$2${ufEsperadaPorCMunEmit}$3`
          );
          alteracoes.push(
            ufCenario
              ? `Emitente Endereço: <UF> ajustado para ${ufEsperadaPorCMunEmit} conforme cMun ${novoEmitente.cMun} (coerência UF de emissão × local do emitente).`
              : `Emitente Endereço: <UF> preenchido com ${ufEsperadaPorCMunEmit} conforme cMun ${novoEmitente.cMun}.`
          );
        }
      }

      // Mantém coerência entre UF do emitente e município do fato gerador.
      // Quando o cenário traz cMun IBGE do emitente, atualizamos também <cMunFG>.
      if (novoEmitente.cMun) {
        const cMunFgRegex = /(<ide[^>]*>[\s\S]*?<cMunFG>)[^<]+(<\/cMunFG>)/i;
        if (cMunFgRegex.test(xmlEditado)) {
          xmlEditado = xmlEditado.replace(
            cMunFgRegex,
            `$1${novoEmitente.cMun}$2`
          );
          alteracoes.push(
            `Identificação: <cMunFG> alterado para ${novoEmitente.cMun}`
          );
        }
      }
    }
    {
      const det = findElement(infNFe, "det");
      const prod = det ? findElement(det, "prod") : null;
      const cfopValue = prod ? findElement(prod, "CFOP") : null;
      const cfopAtual =
        typeof cfopValue === "string" ? cfopValue : String(cfopValue || "");
      const isVendaOuDev =
        VENDAS_CFOP.includes(cfopAtual) || DEVOLUCOES_CFOP.includes(cfopAtual);
      const isRemessaOuRet =
        REMESSAS_CFOP.includes(cfopAtual) || RETORNOS_CFOP.includes(cfopAtual);

      // Decisão da fonte do <dest>:
      //  - Venda/Devolução: usa `novoDestinatario` (cadastro do cenário).
      //  - Remessa/Retorno: usa `novoDestinatarioRemessa` (CD do ML), se houver.
      let destAtivo: DadosDestinatario | null = null;
      let origemDest: "scenario" | "ml-cd" | null = null;
      if (isVendaOuDev && novoDestinatario) {
        destAtivo = novoDestinatario;
        origemDest = "scenario";
      } else if (isRemessaOuRet) {
        // Remessa/retorno: prioriza destinatário específico de CD (ML), mas
        // usa destinatário padrão do cenário como fallback quando não houver CD.
        if (novoDestinatarioRemessa) {
          destAtivo = novoDestinatarioRemessa;
          origemDest = "ml-cd";
        } else if (novoDestinatario) {
          destAtivo = novoDestinatario;
          origemDest = "scenario";
        }
      }

      if (destAtivo) {
        if (!isIeCompatibleWithUf(destAtivo.IE, destAtivo.UF)) {
          return {
            nomeArquivo: fileName,
            tipo: "NFe",
            sucesso: false,
            alteracoes: [],
            erro: `IE do destinatário incompatível com a UF ${destAtivo.UF}.`,
          };
        }
        const ufEsperadaPorCMunDest = resolveUfFromCMun(destAtivo.cMun);
        if (
          ufEsperadaPorCMunDest &&
          destAtivo.UF &&
          destAtivo.UF.trim().toUpperCase() !== ufEsperadaPorCMunDest
        ) {
          alteracoes.push(
            `ICMS aviso: Destinatário com UF (${destAtivo.UF}) divergente do cMun (${destAtivo.cMun}→${ufEsperadaPorCMunDest}).`
          );
        }

        const camposDest = [
          { campo: "CNPJ", valor: destAtivo.CNPJ },
          { campo: "CPF", valor: destAtivo.CPF },
          { campo: "xNome", valor: destAtivo.xNome },
          { campo: "IE", valor: destAtivo.IE },
        ];
        const camposEnderDest = [
          { campo: "xLgr", valor: destAtivo.xLgr },
          { campo: "nro", valor: destAtivo.nro },
          { campo: "xBairro", valor: destAtivo.xBairro },
          { campo: "cMun", valor: destAtivo.cMun },
          { campo: "xMun", valor: destAtivo.xMun },
          { campo: "UF", valor: destAtivo.UF },
          { campo: "CEP", valor: destAtivo.CEP },
          { campo: "cPais", valor: destAtivo.cPais },
          { campo: "xPais", valor: destAtivo.xPais },
          { campo: "fone", valor: destAtivo.fone },
        ];
        const tag =
          origemDest === "ml-cd" ? "Destinatário (CD ML)" : "Destinatário";
        for (const { campo, valor } of camposDest) {
          if (valor && valor.trim() !== "") {
            const regex = createDestinatarioFieldRegex(campo);
            if (regex.test(xmlEditado)) {
              xmlEditado = xmlEditado.replace(regex, `$1$2${valor}$3`);
              alteracoes.push(`${tag}: <${campo}> alterado para ${valor}`);
            }
          }
        }
        for (const { campo, valor } of camposEnderDest) {
          if (valor && valor.trim() !== "") {
            const regex = createEnderDestinatarioRegex(campo);
            if (regex.test(xmlEditado)) {
              xmlEditado = xmlEditado.replace(regex, `$1$2${valor}$3`);
              alteracoes.push(
                `${tag} Endereço: <${campo}> alterado para ${valor}`
              );
            }
          }
        }
      }
    }

    const ideSync = syncIdeCufAndIdDestFromAddresses(xmlEditado);
    xmlEditado = ideSync.xml;
    if (ideSync.logs.length > 0) {
      alteracoes.push(...ideSync.logs);
    }
    alteracoes.push(...collectGeographicFiscalWarnings(xmlEditado));

    if (produtos && produtos.length > 0) {
      const totaisImpostos = {
        vProd: 0,
        vBC: 0,
        vBCUFDest: 0,
        vICMS: 0,
        vFCPUFDest: 0,
        vICMSUFDest: 0,
        vICMSUFRemet: 0,
        vIPI: 0,
        vPIS: 0,
        vCOFINS: 0,
        vBCIBSCBS: 0,
        vIBSUF: 0,
        vIBSMun: 0,
        vIBS: 0,
        vCBS: 0,
      };
      const totaisVolume = {
        pesoB: 0,
        pesoL: 0,
        algumPesoAtualizado: false,
      };
      let vProdTotalRecalculado = 0;
      let algumValorRecalculado = false;
      // Lê UFs DIRETAMENTE de `xmlEditado` para refletir manipulações já
      // aplicadas (troca de destinatário PJ/PF, remessa para CD do ML, etc.).
      const destUfMatch = xmlEditado.match(
        /<enderDest[^>]*>[\s\S]*?<UF>([^<]+)<\/UF>/i
      );
      const destUf = destUfMatch ? destUfMatch[1].trim().toUpperCase() : "";
      const emitUfMatch = xmlEditado.match(
        /<enderEmit[^>]*>[\s\S]*?<UF>([^<]+)<\/UF>/i
      );
      const emitUf = emitUfMatch ? emitUfMatch[1].trim().toUpperCase() : "";
      const emitUfEfetiva = (novoEmitente?.UF || emitUf || "").trim().toUpperCase();
      const indIeDestValue = findElement(infNFe, "dest/indIEDest");
      const isContributor = String(indIeDestValue ?? "").trim() === "1";
      const indFinalValue = findElement(infNFe, "ide/indFinal");
      const isFinalConsumer = String(indFinalValue ?? "").trim() === "1";
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
              // cEANTrib (EAN da unidade tributável) recebe o mesmo valor
              // do cEAN cadastrado no cenário, conforme regra do Demillus.
              { campo: "cEANTrib", valor: produtoSelecionado.cEAN },
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

            // ============================================================
            // Valor unitário condicional ao CFOP do item (venda x remessa)
            // ============================================================
            const itemCfopMatchValor = detBlockEditado.match(
              /<CFOP>([^<]+)<\/CFOP>/i
            );
            const itemCfopValor = itemCfopMatchValor ? itemCfopMatchValor[1] : cfop;

            let novoVUnCom: number | null = null;
            let origemValor: "venda" | "transferencia" | null = null;
            if (
              isVendaOuDevolucaoCfop(itemCfopValor) &&
              produtoSelecionado.vUnComVenda
            ) {
              const v = parseDecimal(produtoSelecionado.vUnComVenda);
              if (v !== null) {
                novoVUnCom = v;
                origemValor = "venda";
              }
            } else if (
              isRemessaOuRetornoCfop(itemCfopValor) &&
              produtoSelecionado.vUnComTransferencia
            ) {
              const v = parseDecimal(produtoSelecionado.vUnComTransferencia);
              if (v !== null) {
                novoVUnCom = v;
                origemValor = "transferencia";
              }
            }

            // Guarda o vProd original antes de qualquer alteração para
            // permitir o recálculo proporcional dos impostos quando não há
            // regra tributária aplicada para esse item.
            const vProdAntigo = (() => {
              const prodBlockOld = detBlockEditado.match(
                /<prod[^>]*>[\s\S]*?<\/prod>/i
              );
              if (!prodBlockOld) return 0;
              const m = prodBlockOld[0].match(/<vProd>([^<]+)<\/vProd>/i);
              if (!m) return 0;
              return parseDecimal(m[1]) ?? 0;
            })();
            let vProdNovoAplicado: number | null = null;

            if (novoVUnCom !== null) {
              const qComStr = readTagValue(detBlockEditado, "qCom");
              const qCom = parseDecimal(qComStr) ?? 0;

              const vUnComStr = novoVUnCom.toFixed(10);
              const vUnTribStr = vUnComStr;
              const vProdNovo = qCom > 0 ? qCom * novoVUnCom : novoVUnCom;
              const vProdNovoStr = formatMoney(vProdNovo);

              const prodBlockMatch = detBlockEditado.match(
                /<prod[^>]*>[\s\S]*?<\/prod>/i
              );
              if (prodBlockMatch) {
                let prodBlock = prodBlockMatch[0];
                const r1 = replaceNumericTagValue(prodBlock, "vUnCom", vUnComStr);
                if (r1.changed) prodBlock = r1.updated;
                const r2 = replaceNumericTagValue(prodBlock, "vUnTrib", vUnTribStr);
                if (r2.changed) prodBlock = r2.updated;
                const r3 = replaceNumericTagValue(
                  prodBlock,
                  "vProd",
                  vProdNovoStr
                );
                if (r3.changed) prodBlock = r3.updated;
                detBlockEditado = detBlockEditado.replace(
                  prodBlockMatch[0],
                  prodBlock
                );

                const rItem = replaceNumericTagValue(
                  detBlockEditado,
                  "vItem",
                  vProdNovoStr
                );
                if (rItem.changed) detBlockEditado = rItem.updated;

                vProdTotalRecalculado += vProdNovo;
                algumValorRecalculado = true;
                vProdNovoAplicado = vProdNovo;
                if (index === 0) {
                  alteracoes.push(
                    origemValor === "venda"
                      ? `Produto: vUnCom/vUnTrib/vProd (venda) atualizados (${vUnComStr})`
                      : `Produto: vUnCom/vUnTrib/vProd (transferência/remessa) atualizados (${vUnComStr})`
                  );
                }
              }
            }

            // ============================================================
            // Peso bruto e líquido (aplicados sempre que informados)
            // ============================================================
            if (
              (produtoSelecionado.pesoBruto &&
                produtoSelecionado.pesoBruto.trim() !== "") ||
              (produtoSelecionado.pesoLiquido &&
                produtoSelecionado.pesoLiquido.trim() !== "")
            ) {
              const qComStr = readTagValue(detBlockEditado, "qCom");
              const qCom = parseDecimal(qComStr) ?? 1;
              if (
                produtoSelecionado.pesoBruto &&
                produtoSelecionado.pesoBruto.trim() !== ""
              ) {
                const pb = parseDecimal(produtoSelecionado.pesoBruto);
                if (pb !== null) {
                  totaisVolume.pesoB += pb * qCom;
                  totaisVolume.algumPesoAtualizado = true;
                }
              }
              if (
                produtoSelecionado.pesoLiquido &&
                produtoSelecionado.pesoLiquido.trim() !== ""
              ) {
                const pl = parseDecimal(produtoSelecionado.pesoLiquido);
                if (pl !== null) {
                  totaisVolume.pesoL += pl * qCom;
                  totaisVolume.algumPesoAtualizado = true;
                }
              }
            }

            // Atualiza a origem do produto no bloco relevante (<orig>)
            if (
              produtoSelecionado.origem &&
              produtoSelecionado.origem.trim() !== ""
            ) {
              // Procura qualquer ocorrência de <orig> no bloco do item
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
                    `Produto ${tipoOp}: Origem (<orig>) alterada para ${produtoSelecionado.origem}`
                  );
                }
              }
            }

            let regraTributariaAplicada = false;
            if (taxRules && taxRules.length > 0) {
              const itemCfopMatch = detBlockEditado.match(/<CFOP>([^<]+)<\/CFOP>/i);
              const itemCfop = itemCfopMatch ? itemCfopMatch[1] : cfop;
              const itemEhRemessaOuRetorno =
                REMESSAS_CFOP.includes(itemCfop) || RETORNOS_CFOP.includes(itemCfop);
              const itemEhVendaOuDevolucao =
                VENDAS_CFOP.includes(itemCfop) || DEVOLUCOES_CFOP.includes(itemCfop);
              const destUfEfetiva = (
                (itemEhRemessaOuRetorno
                  ? (novoDestinatarioRemessa?.UF || novoDestinatario?.UF)
                  : undefined) ||
                (itemEhVendaOuDevolucao ? novoDestinatario?.UF : undefined) ||
                destUf ||
                ""
              )
                .trim()
                .toUpperCase();
              const transactionType = mapTransactionTypeFromCfop(
                itemCfop,
                isContributor
              );
              const itemProductOriginMatch = detBlockEditado.match(
                /<orig>([^<]+)<\/orig>/i
              );
              const itemProductOrigin = itemProductOriginMatch
                ? itemProductOriginMatch[1]
                : "";
              const matchedRule = findBestTaxRule(taxRules, {
                destinationUf: destUfEfetiva,
                transactionType,
                origin: emitUfEfetiva,
                isContributor,
                productOrigin: itemProductOrigin,
                preferredRuleName: produtoSelecionado.regraTributariaNome,
              });
              if (matchedRule) {
                const taxApplied = applyTaxRuleToDetBlock(
                  detBlockEditado,
                  matchedRule,
                  destUfEfetiva,
                  emitUfEfetiva,
                  itemProductOrigin,
                  isContributor,
                  isFinalConsumer
                );
                if (taxApplied.applied) {
                  detBlockEditado = taxApplied.detBlock;
                  regraTributariaAplicada = true;
                  totaisImpostos.vProd += taxApplied.totals.vProd;
                  totaisImpostos.vBC += taxApplied.totals.vBC;
                  totaisImpostos.vBCUFDest += taxApplied.totals.vBCUFDest;
                  totaisImpostos.vICMS += taxApplied.totals.vICMS;
                  totaisImpostos.vFCPUFDest += taxApplied.totals.vFCPUFDest;
                  totaisImpostos.vICMSUFDest += taxApplied.totals.vICMSUFDest;
                  totaisImpostos.vICMSUFRemet += taxApplied.totals.vICMSUFRemet;
                  totaisImpostos.vIPI += taxApplied.totals.vIPI;
                  totaisImpostos.vPIS += taxApplied.totals.vPIS;
                  totaisImpostos.vCOFINS += taxApplied.totals.vCOFINS;
                  totaisImpostos.vBCIBSCBS += taxApplied.totals.vBCIBSCBS;
                  totaisImpostos.vIBSUF += taxApplied.totals.vIBSUF;
                  totaisImpostos.vIBSMun += taxApplied.totals.vIBSMun;
                  totaisImpostos.vIBS += taxApplied.totals.vIBS;
                  totaisImpostos.vCBS += taxApplied.totals.vCBS;
                  if (index === 0) {
                    alteracoes.push(
                      `Regra tributária aplicada: ${matchedRule.ruleName}`
                    );
                    for (const log of taxApplied.logs) {
                      alteracoes.push(`  ${log}`);
                    }
                  }
                }
              }
            }

            // Recálculo proporcional dos impostos quando o vProd mudou e a
            // regra tributária NÃO foi aplicada (ou não há regras importadas).
            // Mantém as alíquotas existentes no XML e ajusta as bases / valores
            // proporcionalmente ao novo vProd.
            if (
              !regraTributariaAplicada &&
              vProdNovoAplicado !== null &&
              vProdAntigo > 0 &&
              Math.abs(vProdNovoAplicado - vProdAntigo) > 0.0001
            ) {
              const ratio = vProdNovoAplicado / vProdAntigo;
              const recalc = recalcImpostosByVProdRatio(
                detBlockEditado,
                ratio,
                vProdNovoAplicado
              );
              if (recalc.applied) {
                detBlockEditado = recalc.detBlock;
                totaisImpostos.vProd += recalc.totals.vProd;
                totaisImpostos.vBC += recalc.totals.vBC;
                totaisImpostos.vICMS += recalc.totals.vICMS;
                totaisImpostos.vIPI += recalc.totals.vIPI;
                totaisImpostos.vPIS += recalc.totals.vPIS;
                totaisImpostos.vCOFINS += recalc.totals.vCOFINS;
                totaisImpostos.vBCIBSCBS += recalc.totals.vBCIBSCBS;
                totaisImpostos.vIBSUF += recalc.totals.vIBSUF;
                totaisImpostos.vIBSMun += recalc.totals.vIBSMun;
                totaisImpostos.vIBS += recalc.totals.vIBS;
                totaisImpostos.vCBS += recalc.totals.vCBS;
                if (index === 0) {
                  for (const log of recalc.logs) alteracoes.push(log);
                }
              }
            }

            xmlEditado = xmlEditado.replace(detBlock, detBlockEditado);
          } else {
            // Cenário sem produto vinculado: ainda assim precisamos aplicar
            // regras tributárias por UF/CFOP para não deixar pICMS zerado.
            if (taxRules && taxRules.length > 0) {
              const itemCfopMatch = detBlockEditado.match(/<CFOP>([^<]+)<\/CFOP>/i);
              const itemCfop = itemCfopMatch ? itemCfopMatch[1] : cfop;
              const itemEhRemessaOuRetorno =
                REMESSAS_CFOP.includes(itemCfop) || RETORNOS_CFOP.includes(itemCfop);
              const itemEhVendaOuDevolucao =
                VENDAS_CFOP.includes(itemCfop) || DEVOLUCOES_CFOP.includes(itemCfop);
              const destUfEfetiva = (
                (itemEhRemessaOuRetorno
                  ? (novoDestinatarioRemessa?.UF || novoDestinatario?.UF)
                  : undefined) ||
                (itemEhVendaOuDevolucao ? novoDestinatario?.UF : undefined) ||
                destUf ||
                ""
              )
                .trim()
                .toUpperCase();
              const transactionType = mapTransactionTypeFromCfop(
                itemCfop,
                isContributor
              );
              const itemProductOriginMatch = detBlockEditado.match(
                /<orig>([^<]+)<\/orig>/i
              );
              const itemProductOrigin = itemProductOriginMatch
                ? itemProductOriginMatch[1]
                : "";
              const matchedRule = findBestTaxRule(taxRules, {
                destinationUf: destUfEfetiva,
                transactionType,
                origin: emitUfEfetiva,
                isContributor,
                productOrigin: itemProductOrigin,
              });
              if (matchedRule) {
                const taxApplied = applyTaxRuleToDetBlock(
                  detBlockEditado,
                  matchedRule,
                  destUfEfetiva,
                  emitUfEfetiva,
                  itemProductOrigin,
                  isContributor,
                  isFinalConsumer
                );
                if (taxApplied.applied) {
                  detBlockEditado = taxApplied.detBlock;
                  totaisImpostos.vProd += taxApplied.totals.vProd;
                  totaisImpostos.vBC += taxApplied.totals.vBC;
                  totaisImpostos.vBCUFDest += taxApplied.totals.vBCUFDest;
                  totaisImpostos.vICMS += taxApplied.totals.vICMS;
                  totaisImpostos.vFCPUFDest += taxApplied.totals.vFCPUFDest;
                  totaisImpostos.vICMSUFDest += taxApplied.totals.vICMSUFDest;
                  totaisImpostos.vICMSUFRemet += taxApplied.totals.vICMSUFRemet;
                  totaisImpostos.vIPI += taxApplied.totals.vIPI;
                  totaisImpostos.vPIS += taxApplied.totals.vPIS;
                  totaisImpostos.vCOFINS += taxApplied.totals.vCOFINS;
                  totaisImpostos.vBCIBSCBS += taxApplied.totals.vBCIBSCBS;
                  totaisImpostos.vIBSUF += taxApplied.totals.vIBSUF;
                  totaisImpostos.vIBSMun += taxApplied.totals.vIBSMun;
                  totaisImpostos.vIBS += taxApplied.totals.vIBS;
                  totaisImpostos.vCBS += taxApplied.totals.vCBS;
                  if (index === 0) {
                    alteracoes.push(
                      `Regra tributária aplicada (sem produto vinculado): ${matchedRule.ruleName}`
                    );
                    for (const log of taxApplied.logs) {
                      alteracoes.push(`  ${log}`);
                    }
                  }
                }
              }
            }
            xmlEditado = xmlEditado.replace(detBlock, detBlockEditado);
          }
        });
      }
      const algumTotalAlterado =
        totaisImpostos.vBC > 0 ||
        totaisImpostos.vICMS > 0 ||
        totaisImpostos.vIPI > 0 ||
        totaisImpostos.vPIS > 0 ||
        totaisImpostos.vCOFINS > 0 ||
        totaisImpostos.vBCIBSCBS > 0 ||
        totaisImpostos.vIBS > 0 ||
        totaisImpostos.vCBS > 0;
      if (algumTotalAlterado) {
        xmlEditado = updateNFeTotals(xmlEditado, totaisImpostos);
        alteracoes.push("Totais fiscais da NFe atualizados (ICMSTot e IBSCBSTot).");
      }

      if (algumValorRecalculado && vProdTotalRecalculado > 0) {
        const totalBlockMatch = xmlEditado.match(
          /<total[^>]*>[\s\S]*?<\/total>/i
        );
        if (totalBlockMatch) {
          let totalBlock = totalBlockMatch[0];
          const vProdTotalCalculado = sumDetTagValues(xmlEditado, "vProd");
          const vProdTotalStr = formatMoney(vProdTotalCalculado);
          const r1 = replaceNumericTagValue(totalBlock, "vProd", vProdTotalStr);
          if (r1.changed) totalBlock = r1.updated;

          // Recalcula vNF para manter coerência com os totais após alteração
          // de vProd (qCom x vUnCom/vUnTrib).
          const vProdTotal = readNumericTagValue(totalBlock, "vProd");
          const vFreteTotal = readNumericTagValue(totalBlock, "vFrete");
          const vSegTotal = readNumericTagValue(totalBlock, "vSeg");
          const vDescTotal = readNumericTagValue(totalBlock, "vDesc");
          const vIITotal = readNumericTagValue(totalBlock, "vII");
          const vIPITotal = readNumericTagValue(totalBlock, "vIPI");
          const vIPIDevolTotal = readNumericTagValue(totalBlock, "vIPIDevol");
          const vOutroTotal = readNumericTagValue(totalBlock, "vOutro");
          const vICMSUFDestTotal = readNumericTagValue(totalBlock, "vICMSUFDest");
          const vNFTotal =
            vProdTotal +
            vFreteTotal +
            vSegTotal +
            vIITotal +
            vIPITotal +
            vIPIDevolTotal +
            vICMSUFDestTotal +
            vOutroTotal -
            vDescTotal;
          const r2 = replaceNumericTagValue(totalBlock, "vNF", formatMoney(vNFTotal));
          if (r2.changed) totalBlock = r2.updated;
          const rNfTot = replaceNumericTagValue(
            totalBlock,
            "vNFTot",
            formatMoney(vNFTotal)
          );
          if (rNfTot.changed) totalBlock = rNfTot.updated;

          // Atualiza vTotTrib para refletir os principais tributos totais
          // recalculados na nota após manipulação.
          const vICMSTotal = readNumericTagValue(totalBlock, "vICMS");
          const vIPITotalCalc = readNumericTagValue(totalBlock, "vIPI");
          const vPISTotalCalc = readNumericTagValue(totalBlock, "vPIS");
          const vCOFINSTotalCalc = readNumericTagValue(totalBlock, "vCOFINS");
          const vTotTribCalc =
            vICMSTotal + vIPITotalCalc + vPISTotalCalc + vCOFINSTotalCalc;
          const r3 = replaceNumericTagValue(
            totalBlock,
            "vTotTrib",
            formatMoney(vTotTribCalc)
          );
          if (r3.changed) totalBlock = r3.updated;

          // DIFAL: só zera automaticamente quando a operação NÃO for interestadual.
          const emitUfFinalMatch = xmlEditado.match(
            /<enderEmit[^>]*>[\s\S]*?<UF>([^<]+)<\/UF>/i
          );
          const destUfFinalMatch = xmlEditado.match(
            /<enderDest[^>]*>[\s\S]*?<UF>([^<]+)<\/UF>/i
          );
          const emitUfFinal = emitUfFinalMatch
            ? emitUfFinalMatch[1].trim().toUpperCase()
            : "";
          const destUfFinal = destUfFinalMatch
            ? destUfFinalMatch[1].trim().toUpperCase()
            : "";
          const idDestFinal = (readTagValue(xmlEditado, "idDest") || "").trim();
          const isInterestadual =
            idDestFinal === "2" &&
            !!emitUfFinal &&
            !!destUfFinal &&
            emitUfFinal !== destUfFinal;

          if (!isInterestadual) {
            const r4 = replaceNumericTagValue(totalBlock, "vFCPUFDest", "0.00");
            if (r4.changed) totalBlock = r4.updated;
            const r5 = replaceNumericTagValue(totalBlock, "vICMSUFDest", "0.00");
            if (r5.changed) totalBlock = r5.updated;
            const r6 = replaceNumericTagValue(totalBlock, "vICMSUFRemet", "0.00");
            if (r6.changed) totalBlock = r6.updated;
          }

          xmlEditado = xmlEditado.replace(totalBlockMatch[0], totalBlock);
          alteracoes.push(
            `Total ICMSTot/vProd recalculado: ${vProdTotalStr}`
          );
          alteracoes.push(`Total ICMSTot/vNF recalculado: ${formatMoney(vNFTotal)}`);
          alteracoes.push(
            `Total ICMSTot/vTotTrib recalculado: ${formatMoney(vTotTribCalc)}`
          );
          if (!isInterestadual) {
            alteracoes.push(
              "Total ICMSTot DIFAL zerado por operação não-interestadual."
            );
          }
        }
      }

      if (totaisVolume.algumPesoAtualizado) {
        const transpMatch = xmlEditado.match(/<transp[^>]*>[\s\S]*?<\/transp>/i);
        if (transpMatch) {
          let transpBlock = transpMatch[0];
          const volMatch = transpBlock.match(/<vol[^>]*>[\s\S]*?<\/vol>/i);
          if (volMatch) {
            let volBlock = volMatch[0];
            if (totaisVolume.pesoB > 0) {
              const r1 = replaceNumericTagValue(
                volBlock,
                "pesoB",
                formatWeight(totaisVolume.pesoB)
              );
              if (r1.changed) {
                volBlock = r1.updated;
                alteracoes.push(
                  `Transporte: <pesoB> atualizado para ${formatWeight(totaisVolume.pesoB)}`
                );
              }
            }
            if (totaisVolume.pesoL > 0) {
              const r2 = replaceNumericTagValue(
                volBlock,
                "pesoL",
                formatWeight(totaisVolume.pesoL)
              );
              if (r2.changed) {
                volBlock = r2.updated;
                alteracoes.push(
                  `Transporte: <pesoL> atualizado para ${formatWeight(totaisVolume.pesoL)}`
                );
              }
            }
            transpBlock = transpBlock.replace(volMatch[0], volBlock);
            xmlEditado = xmlEditado.replace(transpMatch[0], transpBlock);
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

    // ============================================================
    // Ajuste do primeiro dígito do CFOP de cada item conforme as
    // UFs finais do emitente e do destinatário (após manipulações).
    //  - 1xxx/5xxx ⇒ operação dentro do estado (mesma UF).
    //  - 2xxx/6xxx ⇒ operação fora do estado (UFs diferentes).
    //  - 3xxx/7xxx ⇒ exterior, não tocamos.
    // ============================================================
    {
      const ufEmitMatchFinal = xmlEditado.match(
        /<enderEmit[^>]*>[\s\S]*?<UF>([^<]+)<\/UF>/i
      );
      const ufDestMatchFinal = xmlEditado.match(
        /<enderDest[^>]*>[\s\S]*?<UF>([^<]+)<\/UF>/i
      );
      const ufEmitFinal = ufEmitMatchFinal
        ? ufEmitMatchFinal[1].trim().toUpperCase()
        : "";
      const ufDestFinal = ufDestMatchFinal
        ? ufDestMatchFinal[1].trim().toUpperCase()
        : "";

      if (ufEmitFinal && ufDestFinal) {
        const mesmoEstado = ufEmitFinal === ufDestFinal;
        const detBlocksParaCfop = xmlEditado.match(XML_STRUCTURE.DET_BLOCK);
        if (detBlocksParaCfop) {
          const cfopsAlterados = new Set<string>();
          detBlocksParaCfop.forEach((detBlock, idx) => {
            const cfopMatch = detBlock.match(/<CFOP>([^<]+)<\/CFOP>/i);
            if (!cfopMatch) return;
            const cfopAtual = cfopMatch[1].trim();
            if (!/^\d{4}$/.test(cfopAtual)) return;
            const primeiro = cfopAtual[0];
            // Operações com exterior não devem ser corrigidas automaticamente.
            if (primeiro === "3" || primeiro === "7") return;

            let novoPrimeiro: string | null = null;
            if (primeiro === "1" || primeiro === "2") {
              // Entrada
              novoPrimeiro = mesmoEstado ? "1" : "2";
            } else if (primeiro === "5" || primeiro === "6") {
              // Saída
              novoPrimeiro = mesmoEstado ? "5" : "6";
            }

            if (!novoPrimeiro || novoPrimeiro === primeiro) return;

            const cfopNovo = novoPrimeiro + cfopAtual.slice(1);
            const detEditado = detBlock.replace(
              /<CFOP>[^<]+<\/CFOP>/i,
              `<CFOP>${cfopNovo}</CFOP>`
            );
            xmlEditado = xmlEditado.replace(detBlock, detEditado);
            const par = `${cfopAtual}→${cfopNovo}`;
            if (!cfopsAlterados.has(par) || idx === 0) {
              cfopsAlterados.add(par);
            }
          });
          if (cfopsAlterados.size > 0) {
            const tipo = mesmoEstado
              ? `intra-estadual (${ufEmitFinal})`
              : `interestadual (${ufEmitFinal}→${ufDestFinal})`;
            alteracoes.push(
              `CFOP ajustado para operação ${tipo}: ${[...cfopsAlterados].join(", ")}`
            );
          }
        }
      }
    }

    {
      const fin = finalizeNFeVItemTotalsPagamentos(xmlEditado);
      xmlEditado = fin.xml;
      if (fin.logs.length > 0) {
        alteracoes.push(...fin.logs);
      }

      const totalM = xmlEditado.match(XML_STRUCTURE.TOTAL_BLOCK);
      const icmsTotXml = totalM?.[0].match(/<ICMSTot>[\s\S]*?<\/ICMSTot>/i)?.[0];
      const totalVProd = icmsTotXml
        ? readNumericTagValue(icmsTotXml, "vProd")
        : readNumericTagValue(xmlEditado, "vProd");
      const totalVNF = icmsTotXml
        ? readNumericTagValue(icmsTotXml, "vNF")
        : readIcmsTotVNF(xmlEditado);
      const totalVNFTot = readNumericTagValue(
        xmlEditado.match(XML_STRUCTURE.TOTAL_BLOCK)?.[0] || xmlEditado,
        "vNFTot"
      );

      const temDetalhes =
        (xmlEditado.match(XML_STRUCTURE.DET_BLOCK) || []).length > 0;
      if (temDetalhes) {
        const sumVProdDet = sumDetTagValues(xmlEditado, "vProd");
        const sumVItemDet = sumDetTagValues(xmlEditado, "vItem");
        if (!nearlyEqual(sumVProdDet, totalVProd)) {
          alteracoes.push(
            `ICMS aviso: inconsistência de totais vProd (itens=${formatMoney(
              sumVProdDet
            )} vs ICMSTot/vProd=${formatMoney(totalVProd)}).`
          );
        }
        if (!nearlyEqual(sumVItemDet, totalVProd)) {
          alteracoes.push(
            `ICMS aviso: inconsistência vItem (soma itens=${formatMoney(
              sumVItemDet
            )} vs ICMSTot/vProd=${formatMoney(totalVProd)}).`
          );
        }
      }
      if (totalVNFTot > 0 && !nearlyEqual(totalVNF, totalVNFTot)) {
        alteracoes.push(
          `ICMS aviso: inconsistência entre vNF (${formatMoney(
            totalVNF
          )}) e vNFTot (${formatMoney(totalVNFTot)}).`
        );
      }

      const pagM = xmlEditado.match(/<pag[^>]*>[\s\S]*?<\/pag>/i);
      if (pagM) {
        const partes = [...pagM[0].matchAll(/<detPag[^>]*>[\s\S]*?<\/detPag>/gi)];
        const somaVPag = partes.reduce(
          (acc, m) => acc + readNumericTagValue(m[0], "vPag"),
          0
        );
        if (
          partes.length > 0 &&
          !nearlyEqual(Number(somaVPag.toFixed(2)), totalVNF)
        ) {
          alteracoes.push(
            `ICMS aviso: soma dos <vPag> (${formatMoney(
              somaVPag
            )}) difere de vNF (${formatMoney(totalVNF)}).`
          );
        }
      }
    }

    if (alteracoes.length === 0) {
      if (xmlEditado === xmlContent) {
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
        alteracoes: [
          "Ajustes finais: totais (vProd/vNF) e pagamentos (vPag) conferidos.",
        ],
        conteudoEditado: xmlEditado,
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
  novoDestinatario: DadosDestinatario | null = null,
  novoDestinatarioRemessa: DadosDestinatario | null = null
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
    const emitenteCte = novoEmitente;
    const origemSaidaCte = novoDestinatarioRemessa || novoEmitente;

    if (emitenteCte) {
      if (!isIeCompatibleWithUf(emitenteCte.IE, emitenteCte.UF)) {
        return {
          nomeArquivo: fileName,
          tipo: "CTe",
          sucesso: false,
          alteracoes: [],
          erro: `IE do remetente incompatível com a UF ${emitenteCte.UF}.`,
        };
      }
      const camposRem = [
        { campo: "CNPJ", valor: onlyDigits(emitenteCte.CNPJ) },
        { campo: "xNome", valor: emitenteCte.xNome },
        { campo: "xFant", valor: emitenteCte.xFant },
        { campo: "IE", valor: onlyDigits(emitenteCte.IE) },
      ];
      const camposEnderReme = [
        { campo: "xLgr", valor: emitenteCte.xLgr },
        { campo: "nro", valor: emitenteCte.nro },
        { campo: "xCpl", valor: emitenteCte.xCpl },
        { campo: "xBairro", valor: emitenteCte.xBairro },
        { campo: "cMun", valor: emitenteCte.cMun },
        { campo: "xMun", valor: emitenteCte.xMun },
        { campo: "CEP", valor: emitenteCte.CEP },
        { campo: "UF", valor: emitenteCte.UF },
        { campo: "fone", valor: emitenteCte.fone },
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
      // Fallback robusto: alguns CT-es trazem variações de estrutura em que a
      // substituição por bloco pode não capturar a IE do remetente.
      // Forçamos a IE no escopo de <rem> (ou <emit>, quando existir).
      const ieEmitenteCteLimpa = onlyDigits(emitenteCte.IE);
      if (ieEmitenteCteLimpa) {
        const ieRemRegex = /(<rem[^>]*>[\s\S]*?<IE>)[^<]+(<\/IE>)/i;
        const ieEmitRegex = /(<emit[^>]*>[\s\S]*?<IE>)[^<]+(<\/IE>)/i;
        const beforeIe = xmlEditado;
        if (ieRemRegex.test(xmlEditado)) {
          xmlEditado = xmlEditado.replace(
            ieRemRegex,
            `$1${ieEmitenteCteLimpa}$2`
          );
        }
        if (ieEmitRegex.test(xmlEditado)) {
          xmlEditado = xmlEditado.replace(
            ieEmitRegex,
            `$1${ieEmitenteCteLimpa}$2`
          );
        }
        if (xmlEditado !== beforeIe) {
          alteracoes.push(
            `Remetente (CTe): IE sincronizada com o cenário (${ieEmitenteCteLimpa})`
          );
        }
      }

      // Quando houver CD ML selecionado no cenário de remessa/retorno,
      // o bloco <emit> do CTe deve refletir esse CD.
      if (novoDestinatarioRemessa) {
        const camposEmitCte = [
          { campo: "CNPJ", valor: onlyDigits(novoDestinatarioRemessa.CNPJ) },
          { campo: "xNome", valor: novoDestinatarioRemessa.xNome },
          { campo: "IE", valor: onlyDigits(novoDestinatarioRemessa.IE) },
        ];
        for (const { campo, valor } of camposEmitCte) {
          if (valor && valor.trim() !== "") {
            const regex = new RegExp(
              `(<emit>(?:(?!<enderEmit>)[\\s\\S])*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
              "i"
            );
            if (regex.test(xmlEditado)) {
              xmlEditado = xmlEditado.replace(regex, `$1$2${valor}$3`);
              alteracoes.push(`Emitente (CTe): <${campo}> alterado para ${valor}`);
            }
          }
        }

        const camposEnderEmitCte = [
          { campo: "xLgr", valor: novoDestinatarioRemessa.xLgr },
          { campo: "nro", valor: novoDestinatarioRemessa.nro },
          { campo: "xBairro", valor: novoDestinatarioRemessa.xBairro },
          { campo: "cMun", valor: novoDestinatarioRemessa.cMun },
          { campo: "xMun", valor: novoDestinatarioRemessa.xMun },
          { campo: "CEP", valor: novoDestinatarioRemessa.CEP },
          { campo: "UF", valor: novoDestinatarioRemessa.UF },
        ];
        for (const { campo, valor } of camposEnderEmitCte) {
          if (valor && valor.trim() !== "") {
            const regex = new RegExp(
              `(<enderEmit[^>]*>[\\s\\S]*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
              "i"
            );
            if (regex.test(xmlEditado)) {
              xmlEditado = xmlEditado.replace(regex, `$1$2${valor}$3`);
              alteracoes.push(
                `Emitente Endereço (CTe): <${campo}> alterado para ${valor}`
              );
            }
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

      // CT-e deve iniciar no mesmo local fiscal de saída do emitente manipulado.
      // Alinha grupos ide/toma para evitar CT-e iniciando em UF diversa da NF-e.
      const inicioPrestacaoFields = [
        { campo: "cMunEnv", valor: origemSaidaCte?.cMun },
        { campo: "xMunEnv", valor: origemSaidaCte?.xMun },
        { campo: "UFEnv", valor: origemSaidaCte?.UF },
        { campo: "cMunIni", valor: origemSaidaCte?.cMun },
        { campo: "xMunIni", valor: origemSaidaCte?.xMun },
        { campo: "UFIni", valor: origemSaidaCte?.UF },
      ];
      for (const { campo, valor } of inicioPrestacaoFields) {
        if (valor && valor.trim() !== "") {
          const regex = new RegExp(`(<${campo}>)[^<]+(<\\/${campo}>)`, "i");
          if (regex.test(xmlEditado)) {
            xmlEditado = xmlEditado.replace(regex, `$1${valor}$2`);
            alteracoes.push(
              `CTe Início de Prestação: <${campo}> alinhado à origem de saída (${valor})`
            );
          }
        }
      }
    }
    if (novoDestinatario) {
      if (!isIeCompatibleWithUf(novoDestinatario.IE, novoDestinatario.UF)) {
        return {
          nomeArquivo: fileName,
          tipo: "CTe",
          sucesso: false,
          alteracoes: [],
          erro: `IE do destinatário incompatível com a UF ${novoDestinatario.UF}.`,
        };
      }
      const camposDest = [
        { campo: "CNPJ", valor: onlyDigits(novoDestinatario.CNPJ) },
        { campo: "CPF", valor: onlyDigits(novoDestinatario.CPF) },
        { campo: "xNome", valor: novoDestinatario.xNome },
        { campo: "IE", valor: onlyDigits(novoDestinatario.IE) },
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
  taxRules: NormalizedTaxRule[] | null = null,
  novoDestinatarioRemessa: DadosDestinatario | null = null
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
      novoDestinatario,
      novoDestinatarioRemessa
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
      taxRules,
      novoDestinatarioRemessa
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
