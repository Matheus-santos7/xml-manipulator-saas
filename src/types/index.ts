/**
 * Tipos globais do projeto.
 * Cenários: re-exportados de @/lib/scenarios.
 * XML/renomeação: definidos aqui.
 */

export type {
  ScenarioDB,
  ScenarioEmitenteDB,
  ScenarioDestinatarioDB,
  ScenarioProdutoDB,
  ScenarioImpostoDB,
  CstMappingDB,
  TaxReformRuleDB,
} from "@/lib/scenarios";

export interface ProcessingReport {
  msg: string;
  alterations: string[];
  newFileName?: string;
}

export interface NFeInfo {
  tipo: "nfe";
  caminhoCompleto: string;
  nfeNumber: string;
  cfop: string;
  natOp: string;
  refNFe: string | null;
  xTexto: string;
  chave: string;
  emitCnpj: string;
}

export interface EventoInfo {
  tipo: "cancelamento";
  caminhoCompleto: string;
  chaveCancelada: string;
}

export interface CTeInfo {
  tipo: "cte";
  caminhoCompleto: string;
  cteNumber: string;
  chave: string;
  nfeChave: string | null;
}

export interface RenameResult {
  originalName: string;
  newName: string | null;
  status: "renamed" | "skipped" | "error";
  message?: string;
}

export interface RenameReport {
  totalRenamed: number;
  totalSkipped: number;
  totalErrors: number;
  details: RenameResult[];
}
