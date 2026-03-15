import { z } from "zod";
import { scenarioSchema } from "./schemas";
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
 * Tipo de entrada para criar um novo profile (empresa).
 */
export interface CreateProfileInput {
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

// ─── Tipos de cenário para formulários e UI (compatíveis com Prisma) ───

export interface ScenarioEmitenteDB {
  id: string;
  scenarioId: string;
  cnpj?: string | null;
  xNome?: string | null;
  xLgr?: string | null;
  nro?: string | null;
  xCpl?: string | null;
  xBairro?: string | null;
  xMun?: string | null;
  UF?: string | null;
  fone?: string | null;
  IE?: string | null;
}

export interface ScenarioDestinatarioDB {
  id: string;
  scenarioId: string;
  cnpj?: string | null;
  cpf?: string | null;
  xNome?: string | null;
  IE?: string | null;
  xLgr?: string | null;
  nro?: string | null;
  xBairro?: string | null;
  xMun?: string | null;
  UF?: string | null;
  CEP?: string | null;
  fone?: string | null;
}

export interface ScenarioProdutoDB {
  id: string;
  scenarioId: string;
  xProd?: string | null;
  cEAN?: string | null;
  cProd?: string | null;
  NCM?: string | null;
  origem?: string | null;
  isPrincipal: boolean;
  ordem: number;
}

export interface ScenarioImpostoDB {
  id: string;
  scenarioId: string;
  tipoTributacao?: string | null;
  pFCP?: string | null;
  pICMS?: string | null;
  pICMSUFDest?: string | null;
  pICMSInter?: string | null;
  pPIS?: string | null;
  pCOFINS?: string | null;
  pIPI?: string | null;
}

export interface CstMappingDB {
  id?: string;
  scenarioId?: string;
  tipoOperacao: string;
  icms?: string | null;
  ipi?: string | null;
  pis?: string | null;
  cofins?: string | null;
}

export interface TaxReformRuleDB {
  id?: string;
  scenarioId?: string;
  pIBSUF?: string | null;
  pIBSMun?: string | null;
  pCBS?: string | null;
  vDevTrib?: string | null;
  cClassTrib?: string | null;
  CST?: string | null;
  gIBSUF_gRed?: Prisma.JsonValue | null;
  gIBSMun_gRed?: Prisma.JsonValue | null;
  gCBS_gRed?: Prisma.JsonValue | null;
}

/**
 * Cenário com flags e relações (formulário/editor).
 * Inclui nomes em PascalCase (Prisma) para compatibilidade.
 */
export interface ScenarioDB {
  id: string;
  profileId: string;
  name: string;
  active: boolean;
  editar_emitente: boolean;
  editar_destinatario_pj: boolean;
  editar_destinatario_pf: boolean;
  editar_produtos: boolean;
  editar_impostos: boolean;
  editar_data: boolean;
  editar_refNFe: boolean;
  editar_cst: boolean;
  zerar_ipi_remessa_retorno: boolean;
  zerar_ipi_venda: boolean;
  reforma_tributaria: boolean;
  alterar_serie: boolean;
  alterar_cUF: boolean;
  aplicar_reducao_aliq: boolean;
  nova_data?: string | null;
  nova_serie?: string | null;
  novo_cUF?: string | null;
  emitente?: Record<string, unknown> | null;
  destinatario?: Record<string, unknown> | null;
  produto_padrao?: Record<string, unknown> | null;
  impostos_padrao?: Record<string, unknown> | null;
  emitenteData?: ScenarioEmitenteDB | null;
  destinatarioData?: ScenarioDestinatarioDB | null;
  produtoData?: ScenarioProdutoDB[] | null;
  impostosData?: ScenarioImpostoDB | null;
  cstMappings?: CstMappingDB[];
  taxReformRules?: TaxReformRuleDB[];
  ScenarioEmitente?: ScenarioEmitenteDB | null;
  ScenarioDestinatario?: ScenarioDestinatarioDB | null;
  ScenarioProduto: ScenarioProdutoDB[];
  ScenarioImposto?: ScenarioImpostoDB | null;
  CstMapping?: CstMappingDB[];
  TaxReformRule?: TaxReformRuleDB[];
}
