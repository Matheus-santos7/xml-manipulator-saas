import type {
  NormalizedTaxRule,
  TaxRuleMatchContext,
  TaxRuleTransactionType,
} from "./types";
import {
  REMESSAS_CFOP,
  RETORNOS_CFOP,
  DEVOLUCOES_CFOP,
} from "@/lib/constants/cfop";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Converte o `transactionType` cru vindo da planilha (ex.:
 * "Contribuinte", "Não contribuinte", "Envio de estoque (Transferência ou Remessa)")
 * para o enum interno `TaxRuleTransactionType`.
 */
export function transactionTypeFromRaw(
  raw: string
): TaxRuleTransactionType | null {
  if (!raw) return null;
  const n = normalize(raw);
  if (
    n.includes("envio de estoque") ||
    n.includes("transferencia") ||
    n.includes("remessa") ||
    n === "stock_transfer"
  ) {
    return "STOCK_TRANSFER";
  }
  if (
    n.includes("nao contribuinte") ||
    n.includes("consumidor final") ||
    n.includes("pf") ||
    n === "sale_non_contributor"
  ) {
    return "SALE_NON_CONTRIBUTOR";
  }
  if (n.includes("contribuinte") || n === "sale_contributor") {
    return "SALE_CONTRIBUTOR";
  }
  return null;
}

/**
 * Deriva o `TaxRuleTransactionType` a partir do CFOP do item.
 * - Remessas/retornos → `STOCK_TRANSFER`.
 * - Demais (vendas, devoluções) → `SALE_CONTRIBUTOR` ou `SALE_NON_CONTRIBUTOR`
 *   conforme o destinatário tenha IE.
 */
export function mapTransactionTypeFromCfop(
  cfop: string,
  isContributor: boolean
): TaxRuleTransactionType {
  const trimmed = (cfop || "").trim();
  if (
    REMESSAS_CFOP.includes(trimmed) ||
    RETORNOS_CFOP.includes(trimmed) ||
    /^[56]9/.test(trimmed) // fallback: 59xx / 69xx (remessa/retorno genérico)
  ) {
    return "STOCK_TRANSFER";
  }
  if (DEVOLUCOES_CFOP.includes(trimmed)) {
    return isContributor ? "SALE_CONTRIBUTOR" : "SALE_NON_CONTRIBUTOR";
  }
  return isContributor ? "SALE_CONTRIBUTOR" : "SALE_NON_CONTRIBUTOR";
}

function scoreTransaction(
  rule: NormalizedTaxRule,
  contextEnum: TaxRuleTransactionType
): number {
  const ruleEnum = transactionTypeFromRaw(rule.transactionType);
  if (!ruleEnum) return 0;
  return ruleEnum === contextEnum ? 30 : 0;
}

function scoreOrigin(ruleOrigin: string, contextOrigin: string): number {
  if (!ruleOrigin || !contextOrigin) return 0;
  return normalize(ruleOrigin) === normalize(contextOrigin) ? 25 : 0;
}

/**
 * Encontra a regra que melhor casa com o contexto extraído do XML.
 *
 * Sistema de pontuação:
 * - +100 quando há `preferredRuleName` (trava a regra escolhida pelo usuário).
 * - +30 transactionType bate (venda contribuinte / não contribuinte / remessa).
 * - +25 UF do emitente bate com `rule.origin`.
 * - +15 a regra cobre a UF de destino em `icmsByUf`.
 *
 * Empates são resolvidos pela primeira regra encontrada (estável).
 */
export function findBestTaxRule(
  rules: NormalizedTaxRule[],
  context: TaxRuleMatchContext
): NormalizedTaxRule | null {
  if (!rules.length) return null;

  const preferred = context.preferredRuleName?.trim().toLowerCase();
  const ctxOrigin = normalize(context.origin || "");

  function pickBest(candidates: NormalizedTaxRule[], preferNameBonus = false) {
    let best: { rule: NormalizedTaxRule; score: number } | null = null;
    for (const rule of candidates) {
      let score = 0;
      score += scoreTransaction(rule, context.transactionType);
      score += scoreOrigin(rule.origin, context.origin);
      if (context.destinationUf && rule.icmsByUf[context.destinationUf]) {
        score += 15;
      }
      // Nome preferido vira apenas desempate (não pode sobrepor contexto fiscal).
      if (
        preferNameBonus &&
        preferred &&
        rule.ruleName.trim().toLowerCase() === preferred
      ) {
        score += 5;
      }
      if (!best || score > best.score) {
        best = { rule, score };
      }
    }
    return best;
  }

  // 1) Filtra por tipo de transação (critério obrigatório).
  const byTransaction = rules.filter(
    (rule) => transactionTypeFromRaw(rule.transactionType) === context.transactionType
  );
  const transactionPool = byTransaction.length > 0 ? byTransaction : rules;

  // 2) Dentro do tipo, prioriza regras com UF de origem exata.
  const byOrigin = transactionPool.filter(
    (rule) => normalize(rule.origin || "") === ctxOrigin
  );
  const fiscalPool = byOrigin.length > 0 ? byOrigin : transactionPool;

  const bestFiscal = pickBest(fiscalPool, true);
  if (bestFiscal && bestFiscal.score >= 30) {
    return bestFiscal.rule;
  }

  // 3) Fallback global (somente quando não houve match fiscal consistente).
  const bestGlobal = pickBest(rules, true);
  if (bestGlobal && bestGlobal.score >= 15) {
    return bestGlobal.rule;
  }
  return null;
}
