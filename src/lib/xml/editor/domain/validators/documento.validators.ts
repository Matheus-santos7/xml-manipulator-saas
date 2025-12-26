/**
 * Validadores para diferentes tipos de documentos XML
 */

import type { Result } from "../../core/types";
import { Ok, Err, TipoErroXml } from "../../core/types";
import type { IValidadorDocumento } from "../../core/interfaces";

/**
 * Validador base para documentos XML
 */
abstract class ValidadorDocumento implements IValidadorDocumento {
  abstract readonly nomeDocumento: string;
  abstract readonly tagsIdentificacao: string[];

  /**
   * Valida presença das tags identificadoras
   */
  validar(xmlContent: string): Result<boolean> {
    if (!xmlContent || typeof xmlContent !== "string") {
      return Err({
        tipo: TipoErroXml.VALIDACAO_FALHOU,
        mensagem: "Conteúdo XML inválido",
      });
    }

    const temTags = this.tagsIdentificacao.some((tag) =>
      xmlContent.includes(tag)
    );

    if (!temTags) {
      return Err({
        tipo: TipoErroXml.DOCUMENTO_INVALIDO,
        mensagem: `Documento não parece ser ${this.nomeDocumento}`,
      });
    }

    return Ok(true);
  }

  /**
   * Valida estrutura do XML parseado
   */
  abstract validarEstrutura(xmlParsed: unknown): Result<boolean>;

  /**
   * Helper para encontrar elemento
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
}

/**
 * Validador para NFe
 */
export class ValidadorNFe extends ValidadorDocumento {
  readonly nomeDocumento = "NFe";
  readonly tagsIdentificacao = ["<nfeProc", "<NFe"];

  validarEstrutura(xmlParsed: unknown): Result<boolean> {
    let infNFe = this.encontrarElemento(xmlParsed, "nfeProc/NFe/infNFe");
    if (!infNFe) {
      infNFe = this.encontrarElemento(xmlParsed, "NFe/infNFe");
    }

    if (!infNFe) {
      return Err({
        tipo: TipoErroXml.DOCUMENTO_INVALIDO,
        mensagem: "Estrutura NFe não encontrada",
      });
    }

    const infNFeObj = infNFe as Record<string, unknown>;
    const idAttr = infNFeObj["@_Id"] || infNFeObj["@_id"];

    if (!idAttr) {
      return Err({
        tipo: TipoErroXml.CHAVE_NAO_ENCONTRADA,
        mensagem: "Atributo Id não encontrado em infNFe",
      });
    }

    return Ok(true);
  }
}

/**
 * Validador para CTe
 */
export class ValidadorCTe extends ValidadorDocumento {
  readonly nomeDocumento = "CTe";
  readonly tagsIdentificacao = ["<cteProc", "<CTe"];

  validarEstrutura(xmlParsed: unknown): Result<boolean> {
    let infCte = this.encontrarElemento(xmlParsed, "cteProc/CTe/infCte");
    if (!infCte) {
      infCte = this.encontrarElemento(xmlParsed, "CTe/infCte");
    }

    if (!infCte) {
      return Err({
        tipo: TipoErroXml.DOCUMENTO_INVALIDO,
        mensagem: "Estrutura CTe não encontrada",
      });
    }

    const infCteObj = infCte as Record<string, unknown>;
    const idAttr = infCteObj["@_Id"] || infCteObj["@_id"];

    if (!idAttr) {
      return Err({
        tipo: TipoErroXml.CHAVE_NAO_ENCONTRADA,
        mensagem: "Atributo Id não encontrado em infCte",
      });
    }

    return Ok(true);
  }
}

/**
 * Validador para Eventos (Cancelamento, etc.)
 */
export class ValidadorEvento extends ValidadorDocumento {
  readonly nomeDocumento = "Evento";
  readonly tagsIdentificacao = ["<procEventoNFe", "<envEvento"];

  validarEstrutura(xmlParsed: unknown): Result<boolean> {
    const procEvento = this.encontrarElemento(xmlParsed, "procEventoNFe");

    if (!procEvento) {
      return Err({
        tipo: TipoErroXml.DOCUMENTO_INVALIDO,
        mensagem: "Estrutura de Evento não encontrada",
      });
    }

    return Ok(true);
  }
}

/**
 * Validador para Inutilização
 */
export class ValidadorInutilizacao extends ValidadorDocumento {
  readonly nomeDocumento = "Inutilização";
  readonly tagsIdentificacao = ["<procInutNFe", "<inutNFe"];

  validarEstrutura(xmlParsed: unknown): Result<boolean> {
    const infInut =
      this.encontrarElemento(xmlParsed, "procInutNFe/inutNFe/infInut") ||
      this.encontrarElemento(xmlParsed, "inutNFe/infInut");

    if (!infInut) {
      return Err({
        tipo: TipoErroXml.DOCUMENTO_INVALIDO,
        mensagem: "Estrutura de Inutilização não encontrada",
      });
    }

    return Ok(true);
  }
}

/**
 * Registry de validadores
 */
export const VALIDADORES_DISPONIVEIS = {
  nfe: new ValidadorNFe(),
  cte: new ValidadorCTe(),
  evento: new ValidadorEvento(),
  inutilizacao: new ValidadorInutilizacao(),
} as const;
