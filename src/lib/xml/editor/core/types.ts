/**
 * Tipos centralizados para o módulo de edição XML
 * Fonte única de verdade para todas as interfaces
 */

// ============================================================================
// IDENTIFICAÇÃO DE DOCUMENTOS
// ============================================================================

export type TipoDocumento = "NFe" | "CTe" | "Cancelamento" | "Inutilizacao";
export type TipoOperacao = "VENDA" | "DEVOLUCAO" | "RETORNO" | "REMESSA";

// ============================================================================
// DADOS DE PESSOAS
// ============================================================================

/**
 * Dados de identificação de pessoa (base)
 */
export interface DadosPessoa {
  xNome: string;
  IE?: string;
}

/**
 * Dados de pessoa jurídica
 */
export interface PessoaJuridica extends DadosPessoa {
  CNPJ: string;
}

/**
 * Dados de pessoa física
 */
export interface PessoaFisica extends DadosPessoa {
  CPF: string;
}

/**
 * Dados de endereço
 */
export interface DadosEndereco {
  xLgr: string;
  nro: string;
  xCpl?: string;
  xBairro: string;
  cMun: string;
  xMun: string;
  UF: string;
  CEP: string;
  cPais?: string;
  xPais?: string;
  fone?: string;
}

/**
 * Dados do Emitente (PJ com endereço)
 */
export interface DadosEmitente extends PessoaJuridica {
  xFant?: string;
  IEST?: string;
  IM?: string;
  CNAE?: string;
  CRT?: string;
  enderEmit: DadosEndereco;
}

/**
 * Dados do Destinatário (PJ ou PF com endereço)
 */
export interface DadosDestinatario {
  identificacao: PessoaJuridica | PessoaFisica;
  enderDest: DadosEndereco;
}

/**
 * Dados do Produto
 */
export interface DadosProduto {
  xProd?: string;
  cEAN?: string;
  cProd?: string;
  NCM?: string;
  origem?: "0" | "1" | "2" | "3" | "4" | "6" | "7" | "8";
}

// ============================================================================
// OPERAÇÕES FISCAIS
// ============================================================================

/**
 * Mapeamento de CST por tipo de operação
 */
export interface CstMappingData {
  tipoOperacao: TipoOperacao;
  icms?: string | null;
  ipi?: string | null;
  pis?: string | null;
  cofins?: string | null;
}

/**
 * Dados da reforma tributária (IBS/CBS)
 */
export interface TaxReformRuleData {
  pIBSUF?: string | null;
  pIBSMun?: string | null;
  pCBS?: string | null;
  vDevTrib?: string | null;
  cClassTrib?: string | null;
  CST?: string | null;
}

/**
 * Valores IBS/CBS calculados para um item
 */
export interface ValoresIBSCBS {
  vBC: string;
  vIBSUF: string;
  vIBSMun: string;
  vCBS: string;
  vDevTrib: string;
}

/**
 * Totais IBS/CBS acumulados
 */
export interface TotaisIBSCBS {
  vBC: number;
  vIBSUF: number;
  vIBSMun: number;
  vCBS: number;
  vDevTrib: number;
}

// ============================================================================
// MAPEAMENTOS
// ============================================================================

/**
 * Mapeamento de chaves de acesso (de -> para)
 */
export type ChaveMapping = Record<string, string>;

/**
 * Mapeamento de referências entre documentos
 */
export type ReferenceMapping = Record<string, string>;

// ============================================================================
// RESULTADO DE OPERAÇÕES
// ============================================================================

/**
 * Resultado de edição de um arquivo XML
 */
export interface ResultadoEdicao {
  nomeArquivo: string;
  tipo: TipoDocumento;
  sucesso: boolean;
  alteracoes: string[];
  conteudoEditado?: string;
  erro?: string;
}

/**
 * Parâmetros para edição de NFe
 */
export interface ParametrosEdicaoNFe {
  chaveMapping: ChaveMapping;
  referenceMap: ReferenceMapping;
  novaData?: string | null;
  novoUF?: string | null;
  novaSerie?: string | null;
  novoEmitente?: Partial<DadosEmitente> | null;
  novoDestinatario?: Partial<DadosDestinatario> | null;
  produtos?: Array<
    DadosProduto & { isPrincipal: boolean; ordem: number }
  > | null;
  cstMappings?: CstMappingData[] | null;
  taxReformRule?: TaxReformRuleData | null;
}

/**
 * Parâmetros para edição de CTe
 */
export interface ParametrosEdicaoCTe {
  chaveMapping: ChaveMapping;
  chaveVendaNova?: string | null;
  novaData?: string | null;
  novoUF?: string | null;
  novoEmitente?: Partial<DadosEmitente> | null;
  novoDestinatario?: Partial<DadosDestinatario> | null;
}

/**
 * Parâmetros para edição de Evento
 */
export interface ParametrosEdicaoEvento {
  chaveMapping: ChaveMapping;
  novaData?: string | null;
}

/**
 * Parâmetros para edição de Inutilização
 */
export interface ParametrosEdicaoInutilizacao {
  alterarEmitente?: boolean;
  novoEmitente?: Partial<DadosEmitente> | null;
  alterarData?: boolean;
  novaData?: string | null;
  alterarCUF?: boolean;
  novoCUF?: string | null;
  alterarSerie?: boolean;
  novaSerie?: string | null;
}

// ============================================================================
// ERROS
// ============================================================================

/**
 * Tipos de erro de validação XML
 */
export enum TipoErroXml {
  DOCUMENTO_INVALIDO = "DOCUMENTO_INVALIDO",
  CHAVE_NAO_ENCONTRADA = "CHAVE_NAO_ENCONTRADA",
  VALIDACAO_FALHOU = "VALIDACAO_FALHOU",
  OPERACAO_NAO_PERMITIDA = "OPERACAO_NAO_PERMITIDA",
  ERRO_DESCONHECIDO = "ERRO_DESCONHECIDO",
}

/**
 * Erro estruturado de edição XML
 */
export interface ErroEdicaoXml {
  tipo: TipoErroXml;
  mensagem: string;
  detalhes?: Record<string, unknown>;
}

// ============================================================================
// RESULT PATTERN
// ============================================================================

/**
 * Resultado sucesso/erro pattern
 */
export type Result<T, E = ErroEdicaoXml> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Helper para criar Result bem-sucedido
 */
export function Ok<T>(data: T): Result<T> {
  return { success: true, data };
}

/**
 * Helper para criar Result com erro
 */
export function Err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Verifica se um resultado é bem-sucedido (type guard)
 */
export function isSuccess<T, E>(
  result: Result<T, E>
): result is { success: true; data: T } {
  return result.success === true;
}

/**
 * Verifica se um resultado é erro (type guard)
 */
export function isError<T, E>(
  result: Result<T, E>
): result is { success: false; error: E } {
  return result.success === false;
}

/**
 * Desempacota um Result ou lança erro
 */
export function unwrap<T, E extends Error>(result: Result<T, E>): T {
  if (isSuccess(result)) return result.data;
  throw result.error;
}

/**
 * Obtém valor ou valor padrão
 */
export function getOrElse<T, E>(result: Result<T, E>, defaultValue: T): T {
  return isSuccess(result) ? result.data : defaultValue;
}

/**
 * Mapeia resultado bem-sucedido
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => U
): Result<U, E> {
  return isSuccess(result)
    ? ({ success: true, data: fn(result.data) } as Result<U, E>)
    : result;
}

/**
 * Mapeia resultado com erro
 */
export function mapError<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  return isError(result)
    ? ({ success: false, error: fn(result.error) } as Result<T, F>)
    : (result as Result<T, F>);
}
