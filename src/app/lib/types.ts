interface ScenarioDB {
  id: string;
  name: string;
  active: boolean;
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
  nova_data?: string;
  nova_serie?: string;
  novo_cUF?: string;
  emitente?: Record<string, string>;
  destinatario?: Record<string, string>;
  produto_padrao?: Record<string, string>;
  impostos_padrao?: Record<string, string>;
  cstMappings: CstMappingDB[];
  taxReformRules: TaxReformRuleDB[];
}

interface CstMappingDB {
  cfop: string;
  icms?: string;
  ipi?: string;
  pis?: string;
  cofins?: string;
}

interface TaxReformRuleDB {
  pIBSUF?: string;
  pIBSMun?: string;
  pCBS?: string;
  vDevTrib?: string;
  cClassTrib?: string;
  CST?: string;
  gIBSUF_gRed?: Record<string, string>;
  gIBSMun_gRed?: Record<string, string>;
  gCBS_gRed?: Record<string, string>;
}

interface ProcessingReport {
  msg: string;
  alterations: string[];
  newFileName?: string;
  error?: string;
}