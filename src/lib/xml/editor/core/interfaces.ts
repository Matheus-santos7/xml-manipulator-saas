/**
 * Interface abstrata para edição de XMLs fiscais
 * Define o contrato que todos os editores devem implementar
 */

import type { Result, ResultadoEdicao, TipoDocumento } from "./types";

/**
 * Contrato para editores de XML
 */
export interface IXmlEditor {
  /**
   * Tipo de documento que este editor manipula
   */
  readonly tipoDocumento: TipoDocumento;

  /**
   * Valida se o conteúdo XML é do tipo esperado
   */
  validar(xmlContent: string): Result<boolean>;

  /**
   * Extrai a chave de acesso do XML
   */
  extrairChave(xmlContent: string): Result<string>;

  /**
   * Realiza edição do XML
   */
  editar(
    xmlContent: string,
    fileName: string,
    params: unknown
  ): Promise<Result<ResultadoEdicao>>;

  /**
   * Valida parâmetros de entrada
   */
  validarParametros(params: unknown): Result<true>;
}

/**
 * Estratégia de validação de documento
 */
export interface IValidadorDocumento {
  /**
   * Valida conteúdo XML
   */
  validar(xmlContent: string): Result<boolean>;

  /**
   * Valida estrutura específica
   */
  validarEstrutura(xmlParsed: unknown): Result<boolean>;
}

/**
 * Estratégia de transformação de dados
 */
export interface ITransformador<T, U> {
  /**
   * Transforma dados de um tipo para outro
   */
  transformar(dados: T): Result<U>;

  /**
   * Valida dados antes de transformar
   */
  validar(dados: T): Result<boolean>;
}

/**
 * Contexto de edição com informações de execução
 */
export interface ContextoEdicao {
  nomeArquivo: string;
  xmlOriginal: string;
  alteracoes: string[];
  erros: string[];

  /**
   * Adiciona uma alteração realizada
   */
  adicionarAlteracao(mensagem: string): void;

  /**
   * Adiciona um erro encontrado
   */
  adicionarErro(mensagem: string): void;

  /**
   * Obtém número de alterações
   */
  obterTotalAlteracoes(): number;

  /**
   * Obtém número de erros
   */
  obterTotalErros(): number;

  /**
   * Limpa histórico
   */
  limpar(): void;
}

/**
 * Factory para criar editores
 */
export interface IXmlEditorFactory {
  /**
   * Cria um editor apropriado para o tipo de documento
   */
  criarEditor(xmlContent: string): Result<IXmlEditor>;

  /**
   * Obtém editor por tipo
   */
  obterEditor(tipo: TipoDocumento): Result<IXmlEditor>;
}
