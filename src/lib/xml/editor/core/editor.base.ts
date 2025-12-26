/**
 * Classe base abstrata para editores de XML
 * Fornece funcionalidades comuns a todos os tipos de documento
 */

import { XMLParser } from "fast-xml-parser";
import type {
  Result,
  ResultadoEdicao,
  TipoDocumento,
  ErroEdicaoXml,
} from "./types";
import { Ok, Err, isSuccess, TipoErroXml } from "./types";
import type {
  IXmlEditor,
  IValidadorDocumento,
  ContextoEdicao,
} from "./interfaces";

/**
 * Implementação de ContextoEdicao
 */
export class ContextoEdicaoImpl implements ContextoEdicao {
  nomeArquivo: string;
  xmlOriginal: string;
  alteracoes: string[] = [];
  erros: string[] = [];

  constructor(nomeArquivo: string, xmlOriginal: string) {
    this.nomeArquivo = nomeArquivo;
    this.xmlOriginal = xmlOriginal;
  }

  adicionarAlteracao(mensagem: string): void {
    this.alteracoes.push(mensagem);
  }

  adicionarErro(mensagem: string): void {
    this.erros.push(mensagem);
  }

  obterTotalAlteracoes(): number {
    return this.alteracoes.length;
  }

  obterTotalErros(): number {
    return this.erros.length;
  }

  limpar(): void {
    this.alteracoes = [];
    this.erros = [];
  }
}

/**
 * Classe base para todos os editores de XML
 */
export abstract class BaseXmlEditor implements IXmlEditor {
  abstract readonly tipoDocumento: TipoDocumento;

  protected readonly parser: XMLParser;
  protected validador: IValidadorDocumento;

  constructor(validador: IValidadorDocumento) {
    this.validador = validador;
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseAttributeValue: false,
      trimValues: false,
    });
  }

  /**
   * Valida se o conteúdo é do tipo esperado
   */
  validar(xmlContent: string): Result<boolean> {
    return this.validador.validar(xmlContent);
  }

  /**
   * Extrai a chave de acesso (a ser implementado pelas subclasses)
   */
  abstract extrairChave(xmlContent: string): Result<string>;

  /**
   * Realiza edição (a ser implementado pelas subclasses)
   */
  abstract editar(
    xmlContent: string,
    fileName: string,
    params: unknown
  ): Promise<Result<ResultadoEdicao>>;

  /**
   * Valida parâmetros (a ser implementado pelas subclasses)
   */
  abstract validarParametros(params: unknown): Result<true>;

  // ========================================================================
  // MÉTODOS AUXILIARES PROTEGIDOS
  // ========================================================================

  /**
   * Faz parse seguro do XML
   */
  protected parseXml(xmlContent: string): Result<unknown> {
    try {
      const parsed = this.parser.parse(xmlContent);
      return Ok(parsed);
    } catch (error) {
      return Err(
        this.criarErro(
          TipoErroXml.VALIDACAO_FALHOU,
          `Erro ao fazer parse do XML: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      );
    }
  }

  /**
   * Busca elemento navegando por path
   */
  protected encontrarElemento(obj: unknown, path: string): unknown {
    if (!obj || typeof obj !== "object") return null;

    const partes = path.split("/");
    let atual: unknown = obj;

    for (const parte of partes) {
      if (!atual || typeof atual !== "object") return null;
      if (Array.isArray(atual)) {
        atual = atual[0];
      }
      atual = (atual as Record<string, unknown>)[parte];
    }

    return atual;
  }

  /**
   * Formata data para XML (DD/MM/YYYY -> ISO)
   */
  protected formatarDataParaXml(dataStr: string): string {
    const [dia, mes, ano] = dataStr.split("/");
    const agora = new Date();
    const horas = agora.getHours().toString().padStart(2, "0");
    const minutos = agora.getMinutes().toString().padStart(2, "0");
    const segundos = agora.getSeconds().toString().padStart(2, "0");

    return `${ano}-${mes}-${dia}T${horas}:${minutos}:${segundos}-03:00`;
  }

  /**
   * Valida formato de data
   */
  protected validarData(dataStr: string): boolean {
    const regex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!regex.test(dataStr)) return false;

    const [dia, mes, ano] = dataStr.split("/").map(Number);
    if (dia < 1 || dia > 31) return false;
    if (mes < 1 || mes > 12) return false;
    if (ano < 2000 || ano > 2100) return false;

    return true;
  }

  /**
   * Valida CNPJ
   */
  protected validarCNPJ(cnpj: string): boolean {
    const numeros = cnpj.replace(/\D/g, "");
    return numeros.length === 14 && /^\d+$/.test(numeros);
  }

  /**
   * Valida CPF
   */
  protected validarCPF(cpf: string): boolean {
    const numeros = cpf.replace(/\D/g, "");
    return numeros.length === 11 && /^\d+$/.test(numeros);
  }

  /**
   * Valida UF (2 caracteres)
   */
  protected validarUF(uf: string): boolean {
    const ufsValidos = [
      "AC",
      "AL",
      "AP",
      "AM",
      "BA",
      "CE",
      "DF",
      "ES",
      "GO",
      "MA",
      "MT",
      "MS",
      "MG",
      "PA",
      "PB",
      "PR",
      "PE",
      "PI",
      "RJ",
      "RN",
      "RS",
      "RO",
      "RR",
      "SC",
      "SP",
      "SE",
      "TO",
    ];
    return ufsValidos.includes(uf.toUpperCase());
  }

  /**
   * Cria erro estruturado
   */
  protected criarErro(
    tipo: TipoErroXml,
    mensagem: string,
    detalhes?: Record<string, unknown>
  ): ErroEdicaoXml {
    return { tipo, mensagem, detalhes };
  }

  /**
   * Cria resultado de edição com sucesso
   */
  protected criarResultadoSucesso(
    nomeArquivo: string,
    conteudoEditado: string,
    alteracoes: string[]
  ): ResultadoEdicao {
    return {
      nomeArquivo,
      tipo: this.tipoDocumento,
      sucesso: true,
      alteracoes,
      conteudoEditado,
    };
  }

  /**
   * Cria resultado de edição com erro
   */
  protected criarResultadoErro(
    nomeArquivo: string,
    mensagem: string,
    alteracoes: string[] = []
  ): ResultadoEdicao {
    return {
      nomeArquivo,
      tipo: this.tipoDocumento,
      sucesso: false,
      alteracoes,
      erro: mensagem,
    };
  }

  /**
   * Executa função com tratamento de erro
   */
  protected async executarComTratamento<T>(
    fn: () => Promise<Result<T>>,
    nomeOperacao: string
  ): Promise<Result<T>> {
    try {
      return await fn();
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      return Err(
        this.criarErro(
          TipoErroXml.ERRO_DESCONHECIDO,
          `Erro ao ${nomeOperacao}: ${mensagem}`
        )
      );
    }
  }
}

/**
 * Helper para verificar se erro é de validação
 */
export function éErroValidacao(error: ErroEdicaoXml): boolean {
  return (
    error.tipo === TipoErroXml.VALIDACAO_FALHOU ||
    error.tipo === TipoErroXml.DOCUMENTO_INVALIDO
  );
}

/**
 * Helper para obter mensagem de erro amigável
 */
export function obterMensagemErro(error: ErroEdicaoXml): string {
  const mapeamento: Record<TipoErroXml, string> = {
    [TipoErroXml.DOCUMENTO_INVALIDO]:
      "O documento XML é inválido ou do tipo incorreto",
    [TipoErroXml.CHAVE_NAO_ENCONTRADA]:
      "Chave de acesso não encontrada no documento",
    [TipoErroXml.VALIDACAO_FALHOU]: "Falha na validação do documento",
    [TipoErroXml.OPERACAO_NAO_PERMITIDA]:
      "Operação não permitida para este tipo de documento",
    [TipoErroXml.ERRO_DESCONHECIDO]: "Um erro desconhecido ocorreu",
  };

  return mapeamento[error.tipo] || error.mensagem;
}
