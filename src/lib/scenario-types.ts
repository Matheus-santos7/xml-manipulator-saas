import { z } from "zod";
import { scenarioSchema } from "./scenario-schemas";
import type { Prisma } from "@prisma/client";

/**
 * Tipo de entrada para salvar/atualizar um cenário.
 * Combina os campos do schema base com campos adicionais opcionais.
 */
export type SaveScenarioInput = z.infer<typeof scenarioSchema> & {
  emitente?: string | Record<string, unknown>;
  emitenteData?: Record<string, unknown>;
  produto_padrao?: string | Record<string, unknown>;
  produtoData?: Record<string, unknown>;
  impostos_padrao?: string | Record<string, unknown>;
  impostosData?: Record<string, unknown>;
  destinatario?: string | Record<string, unknown>;
  destinatarioData?: Record<string, unknown>;
  cstMappings?: Array<{
    tipoOperacao: "VENDA" | "DEVOLUCAO" | "RETORNO" | "REMESSA";
    icms?: string;
    ipi?: string;
    pis?: string;
    cofins?: string;
  }>;
  taxReformRule?: {
    pIBSUF?: string;
    pIBSMun?: string;
    pCBS?: string;
    vDevTrib?: string;
    cClassTrib?: string;
    CST?: string;
  };
};

/**
 * Tipo completo de cenário com todas as relações carregadas.
 * Útil para processar XMLs onde todas as configurações são necessárias.
 */
export type ScenarioWithRelations = Prisma.ScenarioGetPayload<{
  include: {
    ScenarioEmitente: true;
    ScenarioDestinatario: true;
    ScenarioProduto: true;
    ScenarioImposto: true;
    CstMapping: true;
    TaxReformRule: true;
  };
}>;

/**
 * Tipo de entrada para atualizar dados de um profile (empresa).
 */
export interface UpdateProfileInput {
  id: string;
  name: string;
  cnpj: string;
  razaoSocial?: string;
  endereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
  };
}
