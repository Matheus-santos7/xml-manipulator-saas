/**
 * Factory para criar editores apropriados por tipo de documento
 * Implementa o padrão Factory e Strategy
 */

import type { Result, TipoDocumento } from "./types";
import { Ok, Err, TipoErroXml } from "./types";
import type { IXmlEditor, IXmlEditorFactory } from "./interfaces";
import {
  ValidadorNFe,
  ValidadorCTe,
  ValidadorEvento,
  ValidadorInutilizacao,
} from "../domain/validators";

// Importações dos editores (a serem criados)
// import { NFeEditor } from "../strategies/nfe-editor";
// import { CTeEditor } from "../strategies/cte-editor";
// import { EventoEditor } from "../strategies/evento-editor";
// import { InutilizacaoEditor } from "../strategies/inutilizacao-editor";

/**
 * Factory para criar editores XML
 */
export class XmlEditorFactory implements IXmlEditorFactory {
  private editoresCache = new Map<TipoDocumento, IXmlEditor>();

  /**
   * Cria editor apropriado baseado no conteúdo XML
   */
  criarEditor(xmlContent: string): Result<IXmlEditor> {
    // Testes rápidos por tag
    if (
      xmlContent.includes("<procEventoNFe") ||
      xmlContent.includes("<envEvento")
    ) {
      return this.obterEditor("Cancelamento");
    }

    if (xmlContent.includes("<cteProc") || xmlContent.includes("<CTe")) {
      return this.obterEditor("CTe");
    }

    if (xmlContent.includes("<nfeProc") || xmlContent.includes("<NFe")) {
      return this.obterEditor("NFe");
    }

    if (
      xmlContent.includes("<procInutNFe") ||
      xmlContent.includes("<inutNFe")
    ) {
      return this.obterEditor("Inutilizacao");
    }

    return Err({
      tipo: TipoErroXml.DOCUMENTO_INVALIDO,
      mensagem: "Tipo de documento não reconhecido",
    });
  }

  /**
   * Obtém editor por tipo
   */
  obterEditor(tipo: TipoDocumento): Result<IXmlEditor> {
    // Verifica cache
    const emCache = this.editoresCache.get(tipo);
    if (emCache) {
      return Ok(emCache);
    }

    // Cria novo editor
    const editor = this.criarNovoEditor(tipo);

    if (editor) {
      this.editoresCache.set(tipo, editor);
      return Ok(editor);
    }

    return Err({
      tipo: TipoErroXml.OPERACAO_NAO_PERMITIDA,
      mensagem: `Tipo de documento não suportado: ${tipo}`,
    });
  }

  /**
   * Cria nova instância de editor
   */
  private criarNovoEditor(tipo: TipoDocumento): IXmlEditor | null {
    switch (tipo) {
      // case "NFe":
      //   return new NFeEditor(new ValidadorNFe());
      // case "CTe":
      //   return new CTeEditor(new ValidadorCTe());
      // case "Cancelamento":
      //   return new EventoEditor(new ValidadorEvento());
      // case "Inutilizacao":
      //   return new InutilizacaoEditor(new ValidadorInutilizacao());
      default:
        return null;
    }
  }

  /**
   * Limpa cache
   */
  limparCache(): void {
    this.editoresCache.clear();
  }

  /**
   * Obtém total de editores em cache
   */
  obterTamanhoCache(): number {
    return this.editoresCache.size;
  }
}

/**
 * Instância singleton da factory
 */
export const xmlEditorFactory = new XmlEditorFactory();
