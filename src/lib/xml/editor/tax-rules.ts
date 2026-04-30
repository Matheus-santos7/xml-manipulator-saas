import type { NormalizedTaxRule } from "@/lib/tax-rules/types";
import { VENDAS_CFOP } from "@/lib/constants";

type ApplyResult = {
  detBlock: string;
  applied: boolean;
  logs: string[];
  totals: {
    vProd: number;
    vBC: number;
    vBCUFDest: number;
    vICMS: number;
    vFCPUFDest: number;
    vICMSUFDest: number;
    vICMSUFRemet: number;
    vIPI: number;
    vPIS: number;
    vCOFINS: number;
    vBCIBSCBS: number;
    vIBSUF: number;
    vIBSMun: number;
    vIBS: number;
    vCBS: number;
  };
};

export type FiscalSnapshot = {
  icmsCst: string;
  pICMS: string;
  vICMS: string;
  ipiCst: string;
  pIPI: string;
  vIPI: string;
  pisCst: string;
  pPIS: string;
  vPIS: string;
  cofinsCst: string;
  pCOFINS: string;
  vCOFINS: string;
  ibsCst: string;
  cClassTrib: string;
  pIBSUF: string;
  vIBSUF: string;
  pIBSMun: string;
  vIBSMun: string;
  pCBS: string;
  vCBS: string;
};

function formatPercent(value: number): string {
  return value.toFixed(4);
}

function replaceTagValue(xml: string, regex: RegExp, value: string): string {
  if (!regex.test(xml)) return xml;
  return xml.replace(regex, `$1${value}$2`);
}

function parseNumberTag(xml: string, tag: string): number {
  const match = xml.match(new RegExp(`<${tag}>\\s*([^<]+)\\s*<\\/${tag}>`, "i"));
  if (!match) return 0;
  const normalized = match[1].replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>\\s*([^<]+)\\s*<\\/${tag}>`, "i"));
  return match?.[1]?.trim() ?? "";
}

function readTagInSection(xml: string, section: string, tag: string): string {
  const sectionMatch = xml.match(
    new RegExp(`<${section}[^>]*>[\\s\\S]*?<${tag}>\\s*([^<]+)\\s*<\\/${tag}>`, "i")
  );
  return sectionMatch?.[1]?.trim() ?? "";
}

function formatValue(value: number): string {
  return value.toFixed(2);
}

function calculateTax(base: number, aliquota: number): number {
  return Number(((base * aliquota) / 100).toFixed(2));
}

export function extractFiscalSnapshot(detBlock: string): FiscalSnapshot {
  return {
    icmsCst: readTagInSection(detBlock, "ICMS", "CST"),
    pICMS: readTagInSection(detBlock, "ICMS", "pICMS"),
    vICMS: readTagInSection(detBlock, "ICMS", "vICMS"),
    ipiCst: readTagInSection(detBlock, "IPI", "CST"),
    pIPI: readTagInSection(detBlock, "IPI", "pIPI"),
    vIPI: readTagInSection(detBlock, "IPI", "vIPI"),
    pisCst: readTagInSection(detBlock, "PIS", "CST"),
    pPIS: readTagInSection(detBlock, "PIS", "pPIS"),
    vPIS: readTagInSection(detBlock, "PIS", "vPIS"),
    cofinsCst: readTagInSection(detBlock, "COFINS", "CST"),
    pCOFINS: readTagInSection(detBlock, "COFINS", "pCOFINS"),
    vCOFINS: readTagInSection(detBlock, "COFINS", "vCOFINS"),
    ibsCst: readTagInSection(detBlock, "IBSCBS", "CST"),
    cClassTrib: readTagInSection(detBlock, "IBSCBS", "cClassTrib"),
    pIBSUF: readTagInSection(detBlock, "IBSCBS", "pIBSUF"),
    vIBSUF: readTagInSection(detBlock, "IBSCBS", "vIBSUF"),
    pIBSMun: readTagInSection(detBlock, "IBSCBS", "pIBSMun"),
    vIBSMun: readTagInSection(detBlock, "IBSCBS", "vIBSMun"),
    pCBS: readTagInSection(detBlock, "IBSCBS", "pCBS"),
    vCBS: readTagInSection(detBlock, "IBSCBS", "vCBS"),
  };
}

/**
 * Estados Sul/Sudeste exceto ES (regra Resolução 13/2012).
 * Pares "Sul/Sudeste exceto ES" → "demais" usam alíquota 7%; demais combinações
 * interestaduais nacionais usam 12%; mercadorias importadas usam 4%.
 */
const SUL_SUDESTE_EXCETO_ES = new Set([
  "SP",
  "RJ",
  "MG",
  "PR",
  "RS",
  "SC",
]);

/**
 * Origens de produto consideradas importadas para fins da Resolução 13/2012:
 *  - 1: Estrangeira (importação direta)
 *  - 2: Estrangeira (adquirida no mercado interno)
 *  - 3: Nacional com Conteúdo de Importação > 40%
 *  - 6: Estrangeira (importação direta) sem similar nacional
 *  - 8: Nacional com Conteúdo de Importação > 70%
 */
const ORIGENS_IMPORTADAS = new Set(["1", "2", "3", "6", "8"]);

/**
 * Calcula a alíquota interestadual oficial conforme Resolução 13/2012.
 * Retorna `null` se as UFs forem inválidas.
 */
export function getInterstateIcmsRate(
  emitUf: string,
  destUf: string,
  productOrigin: string
): number | null {
  const a = (emitUf || "").toUpperCase();
  const b = (destUf || "").toUpperCase();
  if (!a || !b || a === b) return null;
  if (ORIGENS_IMPORTADAS.has(String(productOrigin || "").trim())) return 4;
  if (SUL_SUDESTE_EXCETO_ES.has(a) && !SUL_SUDESTE_EXCETO_ES.has(b)) return 7;
  return 12;
}

function pickIcmsUfRule(
  rule: NormalizedTaxRule,
  uf: string
): {
  ufRule: Record<string, string | number | null> | null;
  ufResolved: string | null;
  fallback: boolean;
} {
  const key = uf.toUpperCase();
  if (rule.icmsByUf[key]) {
    return { ufRule: rule.icmsByUf[key], ufResolved: key, fallback: false };
  }
  const entries = Object.entries(rule.icmsByUf);
  if (entries.length === 0) {
    return { ufRule: null, ufResolved: null, fallback: false };
  }
  const [firstUf, firstRule] = entries[0];
  return { ufRule: firstRule, ufResolved: firstUf, fallback: true };
}

/**
 * Recalcula proporcionalmente os impostos de um `<det>` quando o `vProd`
 * sofreu alteração (ex.: ajuste de valor unitário pelo cenário) e
 * **não** há regra tributária ativa para sobrescrever esses valores.
 *
 * Mantém as alíquotas já presentes no XML e multiplica todas as bases /
 * valores monetários por `ratio = vProdNovo / vProdAntigo`. Funciona para
 * ICMS, IPI, PIS, COFINS e IBS/CBS, ignorando seções inexistentes
 * (CST 102, 70 etc.) sem erro.
 */
export function recalcImpostosByVProdRatio(
  detBlock: string,
  ratio: number,
  vProdNovo: number
): ApplyResult {
  const emptyTotals = {
    vProd: vProdNovo,
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
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return { detBlock, applied: false, logs: [], totals: emptyTotals };
  }

  let out = detBlock;
  const logs: string[] = [];

  /**
   * Escala o valor da `tag` dentro da `section` pelo `ratio`.
   * Retorna o novo valor (0 se não existir / inválido).
   */
  function scaleInSection(section: string, tag: string): number {
    const re = new RegExp(
      `(<${section}[^>]*>[\\s\\S]*?<${tag}>)([^<]+)(<\\/${tag}>)`,
      "i"
    );
    const m = out.match(re);
    if (!m) return 0;
    const oldNum = Number(String(m[2]).trim().replace(",", "."));
    if (!Number.isFinite(oldNum) || oldNum === 0) return 0;
    const novo = Number((oldNum * ratio).toFixed(2));
    out = out.replace(re, `$1${formatValue(novo)}$3`);
    return novo;
  }

  const vBC_ICMS = scaleInSection("ICMS", "vBC");
  const vICMS = scaleInSection("ICMS", "vICMS");
  scaleInSection("IPI", "vBC");
  const vIPI = scaleInSection("IPI", "vIPI");
  scaleInSection("PIS", "vBC");
  const vPIS = scaleInSection("PIS", "vPIS");
  scaleInSection("COFINS", "vBC");
  const vCOFINS = scaleInSection("COFINS", "vCOFINS");
  const vBCIBSCBS = scaleInSection("IBSCBS", "vBCIBSCBS");
  const vIBSUF = scaleInSection("IBSCBS", "vIBSUF");
  const vIBSMun = scaleInSection("IBSCBS", "vIBSMun");
  const vIBS = scaleInSection("IBSCBS", "vIBS");
  const vCBS = scaleInSection("IBSCBS", "vCBS");

  if (out !== detBlock) {
    logs.push(
      `Impostos recalculados proporcionalmente (ratio ${ratio.toFixed(4)}, vProd ${formatValue(vProdNovo)})`
    );
  }

  return {
    detBlock: out,
    applied: out !== detBlock,
    logs,
    totals: {
      vProd: vProdNovo,
      vBC: vBC_ICMS || vProdNovo,
      vBCUFDest: 0,
      vICMS,
      vFCPUFDest: 0,
      vICMSUFDest: 0,
      vICMSUFRemet: 0,
      vIPI,
      vPIS,
      vCOFINS,
      vBCIBSCBS,
      vIBSUF,
      vIBSMun,
      vIBS,
      vCBS,
    },
  };
}

export function updateNFeTotals(xml: string, totals: ApplyResult["totals"]): string {
  let out = xml;
  out = replaceTagValue(out, /(<ICMSTot>[\s\S]*?<vProd>)[^<]+(<\/vProd>)/i, formatValue(totals.vProd));
  out = replaceTagValue(out, /(<ICMSTot>[\s\S]*?<vBC>)[^<]+(<\/vBC>)/i, formatValue(totals.vBC));
  out = replaceTagValue(out, /(<ICMSTot>[\s\S]*?<vBCUFDest>)[^<]+(<\/vBCUFDest>)/i, formatValue(totals.vBCUFDest));
  out = replaceTagValue(out, /(<ICMSTot>[\s\S]*?<vICMS>)[^<]+(<\/vICMS>)/i, formatValue(totals.vICMS));
  out = replaceTagValue(out, /(<ICMSTot>[\s\S]*?<vFCPUFDest>)[^<]+(<\/vFCPUFDest>)/i, formatValue(totals.vFCPUFDest));
  out = replaceTagValue(out, /(<ICMSTot>[\s\S]*?<vICMSUFDest>)[^<]+(<\/vICMSUFDest>)/i, formatValue(totals.vICMSUFDest));
  out = replaceTagValue(out, /(<ICMSTot>[\s\S]*?<vICMSUFRemet>)[^<]+(<\/vICMSUFRemet>)/i, formatValue(totals.vICMSUFRemet));
  out = replaceTagValue(out, /(<ICMSTot>[\s\S]*?<vIPI>)[^<]+(<\/vIPI>)/i, formatValue(totals.vIPI));
  out = replaceTagValue(out, /(<ICMSTot>[\s\S]*?<vPIS>)[^<]+(<\/vPIS>)/i, formatValue(totals.vPIS));
  out = replaceTagValue(out, /(<ICMSTot>[\s\S]*?<vCOFINS>)[^<]+(<\/vCOFINS>)/i, formatValue(totals.vCOFINS));
  out = replaceTagValue(out, /(<IBSCBSTot>[\s\S]*?<vBCIBSCBS>)[^<]+(<\/vBCIBSCBS>)/i, formatValue(totals.vBCIBSCBS));
  out = replaceTagValue(out, /(<IBSCBSTot>[\s\S]*?<vIBSUF>)[^<]+(<\/vIBSUF>)/i, formatValue(totals.vIBSUF));
  out = replaceTagValue(out, /(<IBSCBSTot>[\s\S]*?<vIBSMun>)[^<]+(<\/vIBSMun>)/i, formatValue(totals.vIBSMun));
  out = replaceTagValue(out, /(<IBSCBSTot>[\s\S]*?<vIBS>)[^<]+(<\/vIBS>)/i, formatValue(totals.vIBS));
  out = replaceTagValue(out, /(<IBSCBSTot>[\s\S]*?<vCBS>)[^<]+(<\/vCBS>)/i, formatValue(totals.vCBS));
  return out;
}

export function applyTaxRuleToDetBlock(
  detBlock: string,
  rule: NormalizedTaxRule,
  destUf: string,
  emitUf: string = "",
  productOrigin: string = "",
  isContributorDest: boolean = false,
  isFinalConsumer: boolean = false
): ApplyResult {
  let out = detBlock;
  const logs: string[] = [];
  const vProd = parseNumberTag(out, "vProd");
  const totals = {
    vProd,
    vBC: vProd,
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

  // ICMS
  if (rule.icmsByUf && Object.keys(rule.icmsByUf).length > 0) {
    const { ufRule, ufResolved, fallback } = pickIcmsUfRule(rule, destUf);
    if (fallback && ufResolved) {
      logs.push(
        `ICMS aviso: UF de destino "${destUf}" não está nas colunas da regra; usando "${ufResolved}" como fallback`
      );
    }
    if (ufRule?.CST) {
      // Extrai apenas o código (planilha pode trazer "00 - Tributada integralmente").
      const cstRaw = String(ufRule.CST).trim();
      const cstMatch = cstRaw.match(/^([A-Za-z0-9]+)/);
      const cstCode = cstMatch ? cstMatch[1] : cstRaw;
      const previous = out;
      out = replaceTagValue(out, /(<ICMS[^>]*>[\s\S]*?<CST>)[^<]+(<\/CST>)/i, cstCode);
      if (out !== previous) logs.push(`ICMS CST -> ${cstCode} (UF=${ufResolved ?? destUf})`);
    }
    // Decisão da alíquota:
    //  - mesma UF (intra)  → usa PICMS_INTERNAL da planilha.
    //  - UFs diferentes (inter) → calcula via Resolução 13/2012 (4/7/12%);
    //    se a planilha tiver PICMS_INTERSTATE numérico, este prevalece.
    const ufEmit = (emitUf || "").toUpperCase();
    const ufDest = (ufResolved || destUf || "").toUpperCase();
    const intraEstadual = !!ufEmit && !!ufDest && ufEmit === ufDest;

    let aliquotaIcms: number | null = null;
    let origemAliquota: "PICMS_INTERNAL" | "PICMS_INTERSTATE" | "Resolução 13/2012" | null = null;

    if (intraEstadual && typeof ufRule?.PICMS_INTERNAL === "number") {
      aliquotaIcms = ufRule.PICMS_INTERNAL;
      origemAliquota = "PICMS_INTERNAL";
    } else if (!intraEstadual) {
      // Para inter, tenta primeiro a coluna PICMS_INTERSTATE numérica.
      const pInterstateRaw = ufRule?.PICMS_INTERSTATE;
      if (typeof pInterstateRaw === "number") {
        aliquotaIcms = pInterstateRaw;
        origemAliquota = "PICMS_INTERSTATE";
      } else {
        const calculada = getInterstateIcmsRate(ufEmit, ufDest, productOrigin);
        if (calculada !== null) {
          aliquotaIcms = calculada;
          origemAliquota = "Resolução 13/2012";
        }
      }
    }

    if (typeof aliquotaIcms === "number") {
      const previous = out;
      out = replaceTagValue(out, /(<ICMS[^>]*>[\s\S]*?<pICMS>)[^<]+(<\/pICMS>)/i, formatPercent(aliquotaIcms));
      out = replaceTagValue(out, /(<ICMS[^>]*>[\s\S]*?<vBC>)[^<]+(<\/vBC>)/i, formatValue(vProd));
      const vICMS = calculateTax(vProd, aliquotaIcms);
      out = replaceTagValue(out, /(<ICMS[^>]*>[\s\S]*?<vICMS>)[^<]+(<\/vICMS>)/i, formatValue(vICMS));
      totals.vICMS = vICMS;
      if (out !== previous) {
        const tipo = intraEstadual ? "intra" : `inter ${ufEmit}→${ufDest}`;
        logs.push(
          `ICMS pICMS -> ${formatPercent(aliquotaIcms)} (${tipo}, fonte=${origemAliquota}, vICMS=${formatValue(vICMS)})`
        );
      }
    }

    /**
     * DIFAL (SEFAZ/EC 87): aplica somente em operação interestadual para
     * consumidor final não contribuinte.
     *
     * Critérios usados:
     *  - UFs diferentes (interestadual)
     *  - indFinal=1
     *  - indIEDest != 1 (não contribuinte)
     *
     * Alíquotas:
     *  - interna destino: PICMS_INTERNAL (planilha)
     *  - interestadual: PICMS_INTERSTATE numérica ou cálculo automático (4/7/12)
     *  - FCP destino: PICMS_FCP (planilha), quando houver
     */
    const isConsumidorFinal = isFinalConsumer;
    const isContribuinteDest = isContributorDest;
    const isInterestadual = !!ufEmit && !!ufDest && ufEmit !== ufDest;
    const pInternaDest =
      typeof ufRule?.PICMS_INTERNAL === "number" ? ufRule.PICMS_INTERNAL : null;
    const pInterestadual =
      typeof ufRule?.PICMS_INTERSTATE === "number"
        ? ufRule.PICMS_INTERSTATE
        : getInterstateIcmsRate(ufEmit, ufDest, productOrigin);
    const pFcpDest =
      typeof ufRule?.PICMS_FCP === "number" ? ufRule.PICMS_FCP : 0;

    if (
      isInterestadual &&
      isConsumidorFinal &&
      !isContribuinteDest &&
      typeof pInternaDest === "number" &&
      typeof pInterestadual === "number"
    ) {
      const vBCUFDest = vProd;
      const pDifal = Math.max(pInternaDest - pInterestadual, 0);
      const pPartDest = 100; // desde 2019, partilha integral para destino
      const vFCPUFDest = calculateTax(vBCUFDest, pFcpDest);
      const vICMSUFDest = Number(
        ((vBCUFDest * pDifal * pPartDest) / 10000).toFixed(2)
      );
      const vICMSUFRemet = 0;

      out = replaceTagValue(
        out,
        /(<ICMSUFDest[^>]*>[\s\S]*?<vBCUFDest>)[^<]+(<\/vBCUFDest>)/i,
        formatValue(vBCUFDest)
      );
      out = replaceTagValue(
        out,
        /(<ICMSUFDest[^>]*>[\s\S]*?<pFCPUFDest>)[^<]+(<\/pFCPUFDest>)/i,
        formatPercent(pFcpDest)
      );
      out = replaceTagValue(
        out,
        /(<ICMSUFDest[^>]*>[\s\S]*?<pICMSUFDest>)[^<]+(<\/pICMSUFDest>)/i,
        formatPercent(pInternaDest)
      );
      out = replaceTagValue(
        out,
        /(<ICMSUFDest[^>]*>[\s\S]*?<pICMSInter>)[^<]+(<\/pICMSInter>)/i,
        formatPercent(pInterestadual)
      );
      out = replaceTagValue(
        out,
        /(<ICMSUFDest[^>]*>[\s\S]*?<pICMSInterPart>)[^<]+(<\/pICMSInterPart>)/i,
        formatPercent(pPartDest)
      );
      out = replaceTagValue(
        out,
        /(<ICMSUFDest[^>]*>[\s\S]*?<vFCPUFDest>)[^<]+(<\/vFCPUFDest>)/i,
        formatValue(vFCPUFDest)
      );
      out = replaceTagValue(
        out,
        /(<ICMSUFDest[^>]*>[\s\S]*?<vICMSUFDest>)[^<]+(<\/vICMSUFDest>)/i,
        formatValue(vICMSUFDest)
      );
      out = replaceTagValue(
        out,
        /(<ICMSUFDest[^>]*>[\s\S]*?<vICMSUFRemet>)[^<]+(<\/vICMSUFRemet>)/i,
        formatValue(vICMSUFRemet)
      );

      totals.vBCUFDest = vBCUFDest;
      totals.vFCPUFDest = vFCPUFDest;
      totals.vICMSUFDest = vICMSUFDest;
      totals.vICMSUFRemet = vICMSUFRemet;
      logs.push(
        `DIFAL aplicado (SEFAZ): vBCUFDest=${formatValue(
          vBCUFDest
        )}, pInt=${formatPercent(pInternaDest)}, pInter=${formatPercent(
          pInterestadual
        )}, vICMSUFDest=${formatValue(vICMSUFDest)}, vFCPUFDest=${formatValue(
          vFCPUFDest
        )}`
      );
    }
  }

  // IPI
  if (rule.ipi.cst) {
    const previous = out;
    out = replaceTagValue(out, /(<IPI[^>]*>[\s\S]*?<CST>)[^<]+(<\/CST>)/i, rule.ipi.cst);
    if (out !== previous) logs.push(`IPI CST -> ${rule.ipi.cst}`);
  }
  if (typeof rule.ipi.aliquota === "number") {
    const previous = out;
    out = replaceTagValue(out, /(<IPI[^>]*>[\s\S]*?<pIPI>)[^<]+(<\/pIPI>)/i, formatPercent(rule.ipi.aliquota));
    out = replaceTagValue(out, /(<IPI[^>]*>[\s\S]*?<vBC>)[^<]+(<\/vBC>)/i, formatValue(vProd));
    const vIPI = calculateTax(vProd, rule.ipi.aliquota);
    out = replaceTagValue(out, /(<IPI[^>]*>[\s\S]*?<vIPI>)[^<]+(<\/vIPI>)/i, formatValue(vIPI));
    totals.vIPI = vIPI;
    if (out !== previous) logs.push(`IPI pIPI -> ${formatPercent(rule.ipi.aliquota)}`);
  }
  if (rule.ipi.cEnq) {
    const previous = out;
    out = replaceTagValue(out, /(<IPI[^>]*>[\s\S]*?<cEnq>)[^<]+(<\/cEnq>)/i, rule.ipi.cEnq);
    if (out !== previous) logs.push(`IPI cEnq -> ${rule.ipi.cEnq}`);
  }

  // PIS
  if (rule.pis.cst) {
    const previous = out;
    out = replaceTagValue(out, /(<PIS[^>]*>[\s\S]*?<CST>)[^<]+(<\/CST>)/i, rule.pis.cst);
    if (out !== previous) logs.push(`PIS CST -> ${rule.pis.cst}`);
  }
  if (typeof rule.pis.aliquota === "number") {
    const previous = out;
    out = replaceTagValue(out, /(<PIS[^>]*>[\s\S]*?<pPIS>)[^<]+(<\/pPIS>)/i, formatPercent(rule.pis.aliquota));
    out = replaceTagValue(out, /(<PIS[^>]*>[\s\S]*?<vBC>)[^<]+(<\/vBC>)/i, formatValue(vProd));
    const vPIS = calculateTax(vProd, rule.pis.aliquota);
    out = replaceTagValue(out, /(<PIS[^>]*>[\s\S]*?<vPIS>)[^<]+(<\/vPIS>)/i, formatValue(vPIS));
    totals.vPIS = vPIS;
    if (out !== previous) logs.push(`PIS pPIS -> ${formatPercent(rule.pis.aliquota)}`);
  }

  // COFINS
  if (rule.cofins.cst) {
    const previous = out;
    out = replaceTagValue(out, /(<COFINS[^>]*>[\s\S]*?<CST>)[^<]+(<\/CST>)/i, rule.cofins.cst);
    if (out !== previous) logs.push(`COFINS CST -> ${rule.cofins.cst}`);
  }
  if (typeof rule.cofins.aliquota === "number") {
    const previous = out;
    out = replaceTagValue(out, /(<COFINS[^>]*>[\s\S]*?<pCOFINS>)[^<]+(<\/pCOFINS>)/i, formatPercent(rule.cofins.aliquota));
    out = replaceTagValue(out, /(<COFINS[^>]*>[\s\S]*?<vBC>)[^<]+(<\/vBC>)/i, formatValue(vProd));
    const vCOFINS = calculateTax(vProd, rule.cofins.aliquota);
    out = replaceTagValue(out, /(<COFINS[^>]*>[\s\S]*?<vCOFINS>)[^<]+(<\/vCOFINS>)/i, formatValue(vCOFINS));
    totals.vCOFINS = vCOFINS;
    if (out !== previous) logs.push(`COFINS pCOFINS -> ${formatPercent(rule.cofins.aliquota)}`);
  }

  // IBS/CBS (se já existir no XML)
  if (rule.ibsCbs.cst) {
    const previous = out;
    out = replaceTagValue(out, /(<IBSCBS[^>]*>[\s\S]*?<CST>)[^<]+(<\/CST>)/i, rule.ibsCbs.cst);
    if (out !== previous) logs.push(`IBS/CBS CST -> ${rule.ibsCbs.cst}`);
  }
  if (rule.ibsCbs.cClassTrib) {
    const previous = out;
    out = replaceTagValue(out, /(<IBSCBS[^>]*>[\s\S]*?<cClassTrib>)[^<]+(<\/cClassTrib>)/i, rule.ibsCbs.cClassTrib);
    if (out !== previous) logs.push(`IBS/CBS cClassTrib -> ${rule.ibsCbs.cClassTrib}`);
  }
  const cfopItem = readTag(out, "CFOP");
  const isVenda = VENDAS_CFOP.includes(cfopItem);
  const baseIbs = isVenda ? vProd : parseNumberTag(out, "vBC") || vProd;
  out = replaceTagValue(
    out,
    /(<IBSCBS[^>]*>[\s\S]*?<vBC>)[^<]+(<\/vBC>)/i,
    formatValue(baseIbs)
  );
  if (typeof rule.ibsCbs.pIBSUF === "number") {
    out = replaceTagValue(out, /(<IBSCBS[^>]*>[\s\S]*?<pIBSUF>)[^<]+(<\/pIBSUF>)/i, formatPercent(rule.ibsCbs.pIBSUF));
    const vIBSUF = calculateTax(baseIbs, rule.ibsCbs.pIBSUF);
    out = replaceTagValue(out, /(<IBSCBS[^>]*>[\s\S]*?<vIBSUF>)[^<]+(<\/vIBSUF>)/i, formatValue(vIBSUF));
    totals.vIBSUF = vIBSUF;
  }
  if (typeof rule.ibsCbs.pIBSMun === "number") {
    out = replaceTagValue(out, /(<IBSCBS[^>]*>[\s\S]*?<pIBSMun>)[^<]+(<\/pIBSMun>)/i, formatPercent(rule.ibsCbs.pIBSMun));
    const vIBSMun = calculateTax(baseIbs, rule.ibsCbs.pIBSMun);
    out = replaceTagValue(out, /(<IBSCBS[^>]*>[\s\S]*?<vIBSMun>)[^<]+(<\/vIBSMun>)/i, formatValue(vIBSMun));
    totals.vIBSMun = vIBSMun;
  }
  totals.vIBS = Number((totals.vIBSUF + totals.vIBSMun).toFixed(2));
  if (totals.vIBS > 0) {
    out = replaceTagValue(out, /(<IBSCBS[^>]*>[\s\S]*?<vIBS>)[^<]+(<\/vIBS>)/i, formatValue(totals.vIBS));
  }
  if (typeof rule.ibsCbs.pCBS === "number") {
    out = replaceTagValue(out, /(<IBSCBS[^>]*>[\s\S]*?<pCBS>)[^<]+(<\/pCBS>)/i, formatPercent(rule.ibsCbs.pCBS));
    const vCBS = calculateTax(baseIbs, rule.ibsCbs.pCBS);
    out = replaceTagValue(out, /(<IBSCBS[^>]*>[\s\S]*?<vCBS>)[^<]+(<\/vCBS>)/i, formatValue(vCBS));
    totals.vCBS = vCBS;
  }
  totals.vBCIBSCBS = baseIbs;

  return {
    detBlock: out,
    applied: out !== detBlock,
    logs,
    totals,
  };
}
