// src/types/index.ts

export interface ScenarioDB {
  id: string;
  name: string;
  active: boolean;
  // Flags
  editar_emitente: boolean;
  editar_produtos: boolean;
  editar_impostos: boolean;
  editar_data: boolean;
  editar_refNFe: boolean;
  editar_cst: boolean;
  editar_destinatario: boolean;
  zerar_ipi_remessa_retorno: boolean;
  zerar_ipi_venda: boolean;
  reforma_tributaria: boolean;
  alterar_serie: boolean;
  alterar_cUF: boolean;
  aplicar_reducao_aliq: boolean;
  
  // Dados
  nova_data?: string | null;
  nova_serie?: string | null;
  novo_cUF?: string | null;
  emitente?: any; // Json do Prisma
  destinatario?: any; // Json do Prisma
  produto_padrao?: any; // Json do Prisma
  impostos_padrao?: any; // Json do Prisma
  
  // Relações
  cstMappings: CstMappingDB[];
  taxReformRules: TaxReformRuleDB[];
}

export interface CstMappingDB {
  cfop: string;
  icms?: string | null;
  ipi?: string | null;
  pis?: string | null;
  cofins?: string | null;
}

export interface TaxReformRuleDB {
  pIBSUF?: string | null;
  pIBSMun?: string | null;
  pCBS?: string | null;
  vDevTrib?: string | null;
  cClassTrib?: string | null;
  CST?: string | null;
  gIBSUF_gRed?: any; // Json
  gIBSMun_gRed?: any; // Json
  gCBS_gRed?: any; // Json
}

export interface ProcessingReport {
  msg: string;
  alterations: string[];
  newFileName?: string;
}