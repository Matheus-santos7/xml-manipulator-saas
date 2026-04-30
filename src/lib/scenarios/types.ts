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
  produtoData?: Record<string, unknown> | unknown[];
  destinatario?: string | Record<string, unknown>;
  destinatarioData?: Record<string, unknown>;
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
    cMun?: string;
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
    cMun?: string;
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
  cMun?: string | null;
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
  centroDistribuicao?: string | null;
  xNome?: string | null;
  IE?: string | null;
  xLgr?: string | null;
  nro?: string | null;
  xBairro?: string | null;
  cMun?: string | null;
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
  regraTributariaNome?: string | null;
  origem?: string | null;
  vUnComVenda?: string | null;
  vUnComTransferencia?: string | null;
  pesoBruto?: string | null;
  pesoLiquido?: string | null;
  isPrincipal: boolean;
  ordem: number;
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
  editar_destinatario_remessa: boolean;
  destinatarioRemessaMlCdId?: string | null;
  editar_produtos: boolean;
  aplicar_regras_tributarias: boolean;
  editar_data: boolean;
  editar_refNFe: boolean;
  alterar_serie: boolean;
  alterar_cUF: boolean;
  nova_data?: string | null;
  nova_serie?: string | null;
  novo_cUF?: string | null;
  emitente?: Record<string, unknown> | null;
  destinatario?: Record<string, unknown> | null;
  produto_padrao?: Record<string, unknown> | null;
  emitenteData?: ScenarioEmitenteDB | null;
  destinatarioData?: ScenarioDestinatarioDB | null;
  produtoData?: ScenarioProdutoDB[] | null;
  ScenarioEmitente?: ScenarioEmitenteDB | null;
  ScenarioDestinatario?: ScenarioDestinatarioDB | null;
  ScenarioProduto: ScenarioProdutoDB[];
}
