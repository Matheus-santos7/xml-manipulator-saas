export interface NormalizedTaxRule {
  ruleId?: string;
  ruleName: string;
  origin: string;
  transactionType: string;
  ipi: {
    cst?: string;
    aliquota?: number | null;
    cEnq?: string;
  };
  pis: {
    cst?: string;
    aliquota?: number | null;
  };
  cofins: {
    cst?: string;
    aliquota?: number | null;
  };
  ibsCbs: {
    cst?: string;
    cClassTrib?: string;
    reducao?: number | null;
    pIBSUF?: number | null;
    pIBSMun?: number | null;
    pCBS?: number | null;
  };
  icmsByUf: Record<string, Record<string, string | number | null>>;
}

/**
 * Enum interno usado pelo motor para casar regras com o XML.
 * - SALE_CONTRIBUTOR: venda/devolução para destinatário com IE (contribuinte).
 * - SALE_NON_CONTRIBUTOR: venda/devolução para destinatário sem IE (consumidor final).
 * - STOCK_TRANSFER: transferência ou remessa (CFOPs 59xx/69xx etc.).
 */
export type TaxRuleTransactionType =
  | "SALE_CONTRIBUTOR"
  | "SALE_NON_CONTRIBUTOR"
  | "STOCK_TRANSFER";

export interface TaxRuleMatchContext {
  /** UF do destinatário — usado para selecionar `icmsByUf[destinationUf]`. */
  destinationUf: string;
  /** Tipo de transação derivado de CFOP + contribuinte. */
  transactionType: TaxRuleTransactionType;
  /** UF do emitente — usado para casar `rule.origin` da planilha. */
  origin: string;
  /** Se o destinatário é contribuinte (indIEDest === "1"). */
  isContributor: boolean;
  /** Origem do produto (`<orig>`: 0..8). Não usada hoje, reservada. */
  productOrigin?: string;
  preferredRuleName?: string;
}

export interface ParsedTaxRulesWorkbook {
  rules: NormalizedTaxRule[];
  sheetName: string;
}
