import * as XLSX from "xlsx";
import type { NormalizedTaxRule, ParsedTaxRulesWorkbook } from "./types";

const TAX_RULES_SHEET = "Regras Tributárias";

function extractCode(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  const match = text.match(/^([A-Za-z0-9]+)\s*-/);
  return match ? match[1] : text;
}

function parseNumber(value: unknown): number | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || text.toLowerCase().includes("calculada")) return null;
  const normalized = text.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeHeader(v: unknown): string {
  return String(v ?? "").trim();
}

function parseIbsCbsRate(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    if (!(key in row)) continue;
    const parsed = parseNumber(row[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function mapIcmsByUf(row: Record<string, unknown>): Record<string, Record<string, string | number | null>> {
  const grouped: Record<string, Record<string, string | number | null>> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!key.startsWith("ICMS_")) continue;
    const parts = key.split("_");
    if (parts.length < 3) continue;
    const uf = parts[1];
    const field = parts.slice(2).join("_");
    if (!grouped[uf]) grouped[uf] = {};

    // Campos de código tributário vêm com descrição na planilha
    // (ex.: "00 - Tributada integralmente"). No XML só pode ir o código.
    const isCstLikeField =
      field === "CST" ||
      field === "CSOSN" ||
      field === "MOT_DES_ICMS" ||
      field === "COD_BENEF" ||
      field === "COD_BENEF_RBC" ||
      field === "COD_BENEF_PRES";
    if (isCstLikeField) {
      const code = extractCode(value);
      grouped[uf][field] = code ?? (value == null ? null : String(value));
      continue;
    }

    const numeric = parseNumber(value);
    grouped[uf][field] = numeric === null ? (value == null ? null : String(value)) : numeric;
  }
  return grouped;
}

function normalizeRule(row: Record<string, unknown>): NormalizedTaxRule | null {
  const ruleName = String(row.RULE_NAME ?? "").trim();
  const origin = String(row.ORIGIN ?? "").trim();
  const transactionType = String(row.TRANSACTION_TYPE ?? "").trim();
  if (!ruleName || !origin || !transactionType) return null;

  return {
    ruleId: String(row.RULE_ID ?? "").trim() || undefined,
    ruleName,
    origin,
    transactionType,
    ipi: {
      cst: extractCode(row.IPI_ST),
      aliquota: parseNumber(row.IPI_ALIQUOTA),
      cEnq: String(row.IPI_COD_ENQ ?? "").trim() || undefined,
    },
    pis: {
      cst: extractCode(row.PIS_ST),
      aliquota: parseNumber(row.PIS_ALIQUOTA),
    },
    cofins: {
      cst: extractCode(row.COFINS_ST),
      aliquota: parseNumber(row.COFINS_ALIQUOTA),
    },
    ibsCbs: {
      cst: extractCode(row.IBS_CBS_ST),
      cClassTrib: extractCode(row.IBS_CBS_CCLASSTRIB),
      reducao: parseNumber(row.IBS_CBS_REDUCAO),
      pIBSUF: parseIbsCbsRate(row, ["IBS_CBS_PIBSUF", "IBS_CBS_ALIQ_IBSUF"]),
      pIBSMun: parseIbsCbsRate(row, ["IBS_CBS_PIBSMUN", "IBS_CBS_ALIQ_IBSMUN"]),
      pCBS: parseIbsCbsRate(row, ["IBS_CBS_PCBS", "IBS_CBS_ALIQ_CBS"]),
    },
    icmsByUf: mapIcmsByUf(row),
  };
}

export function parseTaxRulesWorkbookFromBuffer(
  fileBuffer: Buffer
): ParsedTaxRulesWorkbook {
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const sheet = workbook.Sheets[TAX_RULES_SHEET];
  if (!sheet) {
    throw new Error(`A aba "${TAX_RULES_SHEET}" não foi encontrada na planilha.`);
  }

  const rowsAsMatrix = XLSX.utils.sheet_to_json<(string | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: null,
  });

  if (rowsAsMatrix.length < 3) {
    throw new Error("Planilha sem estrutura mínima esperada.");
  }

  const headers = (rowsAsMatrix[1] ?? []).map(normalizeHeader);
  const dataRows = rowsAsMatrix.slice(3);

  const objects = dataRows.map((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      obj[h] = row[idx];
    });
    return obj;
  });

  const rules = objects.map(normalizeRule).filter((r): r is NormalizedTaxRule => !!r);

  return {
    rules,
    sheetName: TAX_RULES_SHEET,
  };
}
