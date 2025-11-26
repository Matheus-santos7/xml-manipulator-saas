// src/types/index.ts

export interface ScenarioDB {
  id: string;
  profileId: string;
  name: string;
  active: boolean;
  // Flags
  editar_emitente: boolean;
  editar_destinatario: boolean;
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

  // Dados simples
  nova_data?: string | null;
  nova_serie?: string | null;
  novo_cUF?: string | null;

  // Campos legacy (quando o cenário armazena JSON diretamente)
  emitente?: Record<string, unknown> | null; // JSON antigo
  destinatario?: Record<string, unknown> | null; // JSON antigo
  produto_padrao?: Record<string, unknown> | null; // JSON antigo
  impostos_padrao?: Record<string, unknown> | null; // JSON antigo

  // Novas relações normalizadas (tabelas separadas no schema)
  emitenteData?: ScenarioEmitenteDB | null;
  destinatarioData?: ScenarioDestinatarioDB | null;
  produtoData?: ScenarioProdutoDB | null;
  impostosData?: ScenarioImpostoDB | null;

  // Relações 1:N
  cstMappings: CstMappingDB[];
  taxReformRules: TaxReformRuleDB[];
}

export interface CstMappingDB {
  id?: string;
  scenarioId?: string;
  cfop: string;
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
  gIBSUF_gRed?: Record<string, unknown> | null; // Json
  gIBSMun_gRed?: Record<string, unknown> | null; // Json
  gCBS_gRed?: Record<string, unknown> | null; // Json
}

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
  CEST?: string | null;
  EXTIPI?: string | null;
  CFOP?: string | null;
}

export interface ScenarioImpostoDB {
  id: string;
  scenarioId: string;
  pFCP?: string | null;
  pICMS?: string | null;
  pICMSUFDest?: string | null;
  pICMSInter?: string | null;
  pPIS?: string | null;
  pCOFINS?: string | null;
  pIPI?: string | null;
}

export interface ProcessingReport {
  msg: string;
  alterations: string[];
  newFileName?: string;
}
