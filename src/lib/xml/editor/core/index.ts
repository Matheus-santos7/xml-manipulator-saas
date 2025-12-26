/**
 * Núcleo da arquitetura de edição XML
 * Exportações públicas e abstrações principais
 */

// Tipos
export * from "./types";

// Interfaces
export * from "./interfaces";

// Classes base
export {
  BaseXmlEditor,
  ContextoEdicaoImpl,
  éErroValidacao,
  obterMensagemErro,
} from "./editor.base";

// Factory
export { XmlEditorFactory, xmlEditorFactory } from "./editor.factory";
