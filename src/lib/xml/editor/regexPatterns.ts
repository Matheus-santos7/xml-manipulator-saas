/**
 * Padrões Regex para Manipulação de XMLs Fiscais Brasileiros
 *
 * Este módulo centraliza todos os padrões regex utilizados na manipulação
 * de XMLs de NFe, CT-e, Cancelamento e Inutilização.
 *
 * Benefícios:
 * - Manutenção centralizada
 * - Reutilização de padrões
 * - Documentação clara
 * - Facilita testes
 * - Melhor performance (regex compilados uma vez)
 */

// ============================================================================
// ESTRUTURA XML - BLOCOS E TAGS
// ============================================================================

/**
 * Padrões para blocos estruturais do XML
 */
export const XML_STRUCTURE = {
  /** Bloco de item/produto <det>...</det> */
  DET_BLOCK: /<det[^>]*>[\s\S]*?<\/det>/gi,

  /** Bloco de impostos <imposto>...</imposto> */
  IMPOSTO_BLOCK: /<imposto[^>]*>[\s\S]*?<\/imposto>/gi,

  /** Bloco de emitente <emit>...</emit> */
  EMIT_BLOCK: /<emit[^>]*>[\s\S]*?<\/emit>/i,

  /** Bloco de destinatário <dest>...</dest> */
  DEST_BLOCK: /<dest[^>]*>[\s\S]*?<\/dest>/i,

  /** Bloco de totalizador <total>...</total> */
  TOTAL_BLOCK: /<total[^>]*>[\s\S]*?<\/total>/i,

  /** Bloco de identificação <ide>...</ide> */
  IDE_BLOCK: /<ide[^>]*>[\s\S]*?<\/ide>/i,
} as const;

/**
 * Padrões para tags específicas
 */
export const XML_TAGS = {
  /** Tag de valor de produto */
  V_PROD: /<vProd>([^<]+)<\/vProd>/i,

  /** Tag CFOP */
  CFOP: /<CFOP>([^<]+)<\/CFOP>/i,

  /** Tag de referência NFe */
  REF_NFE: /<refNFe>([^<]+)<\/refNFe>/i,

  /** Verifica se tem referência NFe */
  HAS_REF_NFE: /<refNFe>[^<]+<\/refNFe>/i,
} as const;

// ============================================================================
// CHAVES DE ACESSO E IDENTIFICAÇÃO
// ============================================================================

/**
 * Padrões para manipulação de chaves de acesso
 */
export const CHAVE_PATTERNS = {
  /** Remove prefixo NFe da chave */
  REMOVE_NFE_PREFIX: /^NFe/,

  /** Tag chNFe no protocolo */
  CH_NFE_TAG: (chave: string) => new RegExp(`(<chNFe>)${chave}(</chNFe>)`, "g"),

  /** Atributo Id do infNFe */
  INF_NFE_ID: (chave: string) =>
    new RegExp(`(<infNFe[^>]*\\s(?:Id|id)=["'])NFe${chave}(["'][^>]*>)`, "g"),

  /** Tag refNFe (referência) */
  REF_NFE_TAG: (chave: string) =>
    new RegExp(`(<refNFe>)${chave}(</refNFe>)`, "g"),
} as const;

// ============================================================================
// IDENTIFICAÇÃO E DADOS FISCAIS
// ============================================================================

/**
 * Padrões para UF, série, data, etc.
 */
export const IDENTIFICACAO_PATTERNS = {
  /** Tag cUF (código UF) */
  CUF: /<cUF>([^<]+)<\/cUF>/g,
  CUF_REPLACE: /(<cUF>)[^<]+(<\/cUF>)/g,

  /** Tag série */
  SERIE: /<serie>([^<]+)<\/serie>/g,
  SERIE_REPLACE: /(<serie>)[^<]+(<\/serie>)/g,

  /** Data de emissão */
  DH_EMI: /(<dhEmi>)[^<]+(<\/dhEmi>)/g,

  /** Data de saída/entrada */
  DH_SAI_ENT: /(<dhSaiEnt>)[^<]+(<\/dhSaiEnt>)/g,

  /** Data de recebimento */
  DH_RECBTO: /(<dhRecbto>)[^<]+(<\/dhRecbto>)/g,

  /** Validação de data DD/MM/YYYY */
  VALIDATE_DATE: /^\s*(\d{2})\/(\d{2})\/(\d{4})\s*$/,
} as const;

// ============================================================================
// EMITENTE E DESTINATÁRIO
// ============================================================================

/**
 * Cria regex para campo do emitente (fora de enderEmit)
 */
export function createEmitenteFieldRegex(campo: string): RegExp {
  return new RegExp(
    `(<emit>(?:(?!<enderEmit>)[\\s\\S])*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
    "i"
  );
}

/**
 * Cria regex para campo do endereço do emitente
 */
export function createEnderEmitenteRegex(campo: string): RegExp {
  return new RegExp(
    `(<enderEmit[^>]*>[\\s\\S]*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
    "i"
  );
}

/**
 * Cria regex para campo do destinatário (fora de enderDest)
 */
export function createDestinatarioFieldRegex(campo: string): RegExp {
  return new RegExp(
    `(<dest>(?:(?!<enderDest>)[\\s\\S])*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
    "i"
  );
}

/**
 * Cria regex para campo do endereço do destinatário
 */
export function createEnderDestinatarioRegex(campo: string): RegExp {
  return new RegExp(
    `(<enderDest[^>]*>[\\s\\S]*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
    "i"
  );
}

// ============================================================================
// PRODUTOS
// ============================================================================

/**
 * Padrões para manipulação de produtos
 */
export const PRODUTO_PATTERNS = {
  /** Tag xProd (descrição do produto) */
  X_PROD: /<xProd>([^<]+)<\/xProd>/i,

  /** Tag cEAN (código de barras) */
  C_EAN: /<cEAN>([^<]+)<\/cEAN>/i,

  /** Tag cProd (código do produto) */
  C_PROD: /<cProd>([^<]+)<\/cProd>/i,

  /** Tag NCM */
  NCM: /<NCM>([^<]+)<\/NCM>/i,

  /** Tag origem (origem do produto para ICMS) */
  ORIGEM: /<orig>([^<]+)<\/orig>/i,
} as const;

/**
 * Cria regex para campo de produto dentro de <prod>
 */
export function createProdutoFieldRegex(campo: string): RegExp {
  return new RegExp(
    `(<prod[^>]*>[\\s\\S]*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
    "i"
  );
}

/**
 * Cria regex para origem dentro do bloco ICMS
 */
export function createOrigemIcmsRegex(): RegExp {
  return new RegExp(`(<ICMS[^>]*>[\\s\\S]*?)(<orig>)[^<]+(<\\/orig>)`, "i");
}

// ============================================================================
// IMPOSTOS - CST
// ============================================================================

/**
 * Padrões para manipulação de CST (Código de Situação Tributária)
 */
export const CST_PATTERNS = {
  /** CST do ICMS (dentro de <ICMS><ICMSxx><CST>) */
  ICMS: /(<ICMS[^>]*>[\s\S]*?)(<CST>)[^<]+(<\/CST>)/i,

  /** CST do IPI (dentro de <IPI><IPITrib> ou <IPI><IPINT>) */
  IPI: /(<IPI[^>]*>[\s\S]*?)(<CST>)[^<]+(<\/CST>)/i,

  /** CST do PIS */
  PIS: /(<PIS[^>]*>[\s\S]*?)(<CST>)[^<]+(<\/CST>)/i,

  /** CST do COFINS */
  COFINS: /(<COFINS[^>]*>[\s\S]*?)(<CST>)[^<]+(<\/CST>)/i,
} as const;

// ============================================================================
// IMPOSTOS - IPI
// ============================================================================

/**
 * Padrões para manipulação de IPI
 */
export const IPI_PATTERNS = {
  /** Valor do IPI */
  V_IPI: /(<vIPI>)[^<]+(<\/vIPI>)/gi,

  /** Base de cálculo do IPI (dentro do bloco IPI) */
  V_BC_IPI: /(<IPI[^>]*>[\s\S]*?)(<vBC>)[^<]+(<\/vBC>)/i,

  /** Alíquota do IPI */
  P_IPI: /(<pIPI>)[^<]+(<\/pIPI>)/gi,

  /** Valor total de IPI no totalizador */
  V_IPI_TOTAL: /(<ICMSTot[^>]*>[\s\S]*?<vIPI>)[^<]+(<\/vIPI>)/i,

  /** Valor total da nota */
  V_NF_TOTAL: /(<ICMSTot[^>]*>[\s\S]*?<vNF>)[^<]+(<\/vNF>)/i,
} as const;

/**
 * Padrões para captura de valores dos produtos (para recálculo)
 */
export const VALORES_PRODUTO_PATTERNS = {
  V_PROD: /<vProd>([^<]+)<\/vProd>/i,
  V_IPI: /<vIPI>([^<]+)<\/vIPI>/i,
  V_DESC: /<vDesc>([^<]+)<\/vDesc>/i,
  V_FRETE: /<vFrete>([^<]+)<\/vFrete>/i,
  V_SEG: /<vSeg>([^<]+)<\/vSeg>/i,
  V_OUTRO: /<vOutro>([^<]+)<\/vOutro>/i,
} as const;

// ============================================================================
// REFORMA TRIBUTÁRIA - IBS/CBS
// ============================================================================

/**
 * Padrões para manipulação de impostos gerais
 */
export const IMPOSTO_PATTERNS = {
  /** Padrão genérico para tags de imposto (pFCP, pICMS, pPIS, pCOFINS, pIPI, etc) */
  createImpostoFieldRegex: (fieldName: string) =>
    new RegExp(`(<${fieldName}>)[^<]+(<\\/${fieldName}>)`, "gi"),

  /** Captura valor de tag de imposto */
  getImpostoFieldValue: (fieldName: string) =>
    new RegExp(`<${fieldName}>([^<]+)<\\/${fieldName}>`, "i"),

  // Bases de cálculo
  V_BC_ICMS: /<vBC>([^<]+)<\/vBC>/i,
  V_BC_PIS: /<vBC>([^<]+)<\/vBC>/i,
  V_BC_COFINS: /<vBC>([^<]+)<\/vBC>/i,

  // Valores de impostos (dentro dos blocos específicos)
  V_ICMS: /(<ICMS[^>]*>[\s\S]*?<vICMS>)[^<]+(<\/vICMS>)/i,
  V_FCP: /(<vFCP>)[^<]+(<\/vFCP>)/gi,
  V_PIS: /(<PIS[^>]*>[\s\S]*?<vPIS>)[^<]+(<\/vPIS>)/i,
  V_COFINS: /(<COFINS[^>]*>[\s\S]*?<vCOFINS>)[^<]+(<\/vCOFINS>)/i,

  // Totalizadores
  V_ICMS_TOTAL: /(<ICMSTot[^>]*>[\s\S]*?<vICMS>)[^<]+(<\/vICMS>)/i,
  V_FCP_TOTAL: /(<ICMSTot[^>]*>[\s\S]*?<vFCP>)[^<]+(<\/vFCP>)/i,
  V_PIS_TOTAL: /(<ICMSTot[^>]*>[\s\S]*?<vPIS>)[^<]+(<\/vPIS>)/i,
  V_COFINS_TOTAL: /(<ICMSTot[^>]*>[\s\S]*?<vCOFINS>)[^<]+(<\/vCOFINS>)/i,
} as const;

/**
 * Padrões para manipulação de IBS/CBS
 */
export const REFORMA_TRIBUTARIA_PATTERNS = {
  /** Remove bloco IBSCBS existente */
  REMOVE_IBSCBS: /<IBSCBS>[\s\S]*?<\/IBSCBS>/gi,

  /** Remove bloco IBSCBSTot existente */
  REMOVE_IBSCBS_TOT: /<IBSCBSTot>[\s\S]*?<\/IBSCBSTot>/gi,

  /** Identifica fechamento de </imposto> para inserção */
  IMPOSTO_CLOSE: /(<\/imposto>)/i,

  /** Identifica fechamento de </total> para inserção */
  TOTAL_CLOSE: /(<\/total>)/i,
} as const;

// ============================================================================
// INUTILIZAÇÃO
// ============================================================================

/**
 * Padrões para XML de Inutilização
 */
export const INUTILIZACAO_PATTERNS = {
  /** CNPJ dentro de infInut */
  CNPJ_INF_INUT: /(<infInut[^>]*>[\s\S]*?)(<CNPJ>)[^<]+(<\/CNPJ>)/i,

  /** Ano dentro de infInut */
  ANO_INF_INUT: /(<infInut[^>]*>[\s\S]*?)(<ano>)[^<]+(<\/ano>)/i,

  /** cUF dentro de infInut */
  CUF_INF_INUT: /(<infInut[^>]*>[\s\S]*?)(<cUF>)[^<]+(<\/cUF>)/i,

  /** série dentro de infInut */
  SERIE_INF_INUT: /(<infInut[^>]*>[\s\S]*?)(<serie>)[^<]+(<\/serie>)/i,

  /** dhRecbto */
  DH_RECBTO_INUT: /(<dhRecbto>)[^<]+(<\/dhRecbto>)/g,

  /** Atributo Id de infInut */
  ID_INF_INUT: /(<infInut[^>]*\sId=\")[^"]+(\")/i,

  /** Captura Id completo */
  MATCH_ID_FULL: /<infInut[^>]*\sId=\"([^\"]+)\"/i,

  /** Remove espaços do CNPJ */
  REMOVE_NON_DIGITS: /\D/g,
} as const;

// ============================================================================
// EVENTOS (CANCELAMENTO, ETC)
// ============================================================================

/**
 * Padrões para XML de Eventos (Cancelamento, Carta de Correção, etc.)
 */
export const EVENTO_PATTERNS = {
  /** chNFe dentro de infEvento */
  CH_NFE_EVENTO: (chave: string) =>
    new RegExp(
      `(<evento[^>]*>[\\s\\S]*?<infEvento[^>]*>[\\s\\S]*?<chNFe>)${chave}(</chNFe>)`,
      "i"
    ),

  /** dhEvento */
  DH_EVENTO: /(<dhEvento>)[^<]+(<\/dhEvento>)/g,
  DH_EVENTO_REPLACE: /(<dhEvento>)[^<]+(<\/dhEvento>)/g,

  /** dhRecbto no retorno do evento */
  DH_RECBTO_RET_EVENTO:
    /(<retEvento[^>]*>[\s\S]*?<dhRecbto>)[^<]+(<\/dhRecbto>)/g,
  DH_RECBTO_REPLACE: /(<dhRecbto>)[^<]+(<\/dhRecbto>)/g,

  /** dhRegEvento */
  DH_REG_EVENTO_REPLACE: /(<dhRegEvento>)[^<]+(<\/dhRegEvento>)/g,
} as const;

// ============================================================================
// CT-e (CONHECIMENTO DE TRANSPORTE)
// ============================================================================

/**
 * Padrões para XML de CT-e
 */
export const CTE_PATTERNS = {
  /** Bloco de remetente <rem>...</rem> */
  REM_BLOCK: /<rem[^>]*>[\s\S]*?<\/rem>/i,

  /** Bloco de endereço do remetente */
  ENDER_REME_BLOCK: /<enderReme[^>]*>[\s\S]*?<\/enderReme>/i,

  /** infCte */
  INF_CTE: /<infCte[^>]*>/i,

  /** chCTe no protocolo */
  CH_CTE: /(<chCTe>)[^<]+(<\/chCTe>)/i,
} as const;

/**
 * Cria regex para campo do remetente (fora de enderReme)
 */
export function createRemetenteFieldRegex(campo: string): RegExp {
  return new RegExp(
    `(<rem[^>]*>(?:(?!<enderReme>)[\\s\\S])*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
    "i"
  );
}

/**
 * Cria regex para campo do endereço do remetente
 */
export function createEnderRemetenteRegex(campo: string): RegExp {
  return new RegExp(
    `(<enderReme[^>]*>[\\s\\S]*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
    "i"
  );
}

// ============================================================================
// UTILITÁRIOS
// ============================================================================

/**
 * Escapa caracteres especiais de regex
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Cria regex genérico para tag
 */
export function createTagRegex(tagName: string, flags = "i"): RegExp {
  return new RegExp(`<${tagName}>([^<]+)<\\/${tagName}>`, flags);
}

/**
 * Cria regex genérico para substituição de valor de tag
 */
export function createTagReplaceRegex(tagName: string, flags = "i"): RegExp {
  return new RegExp(`(<${tagName}>)[^<]+(<\\/${tagName}>)`, flags);
}

/**
 * Cria regex para capturar bloco completo de uma tag
 */
export function createBlockRegex(tagName: string, flags = "i"): RegExp {
  return new RegExp(`<${tagName}[^>]*>[\\s\\S]*?<\\/${tagName}>`, flags);
}
