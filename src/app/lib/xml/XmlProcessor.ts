import { XmlHelper } from "./XmlHelper";
import { editarNfe } from "./nfeHandler";
// Importe os outros handlers (cteHandler, eventHandler) quando os criares
// import { editarCte } from './cteHandler';
// import { editarInutilizacao, editarCancelamento } from './eventHandler';
import {
  renameFileAccordingToRules,
  getXmlInfo,
  getEventoInfo,
} from "./renaming";
import type { ScenarioDB, ProcessingReport } from "../types";

export class XmlProcessor {
  private helper: XmlHelper;

  constructor(xmlBuffer: Buffer) {
    this.helper = new XmlHelper(xmlBuffer);
  }

  public getXmlInfo() {
    return getXmlInfo(this.helper);
  }

  public getEventoInfo() {
    return getEventoInfo(this.helper);
  }

  public renameFileAccordingToRules(info: Record<string, any>) {
    return renameFileAccordingToRules(info);
  }

  public serialize(): Buffer {
    return this.helper.serialize();
  }

  public applyScenario(
    scenario: ScenarioDB,
    chaveMapping: Record<string, string>,
    referenceMap: Record<string, string>,
    chaveDaVendaNova?: string
  ): ProcessingReport {
    const root = this.helper.doc.documentElement;
    let msg = "";
    let alteracoes: string[] = [];
    let altered = false;

    // Remove sempre a assinatura antes de processar
    this.helper.removeSignature();

    if (root.tagName.includes("procInutNFe")) {
      // const result = editarInutilizacao(this.helper, scenario);
      // msg = result.msg; alteracoes = result.alteracoes;
    } else if (
      root.tagName.includes("cteProc") ||
      root.tagName.includes("CTe")
    ) {
      // const result = editarCte(this.helper, scenario, chaveMapping, chaveDaVendaNova);
      // msg = result.msg; alteracoes = result.alteracoes;
    } else if (root.tagName.includes("procEventoNFe")) {
      // alteracoes = editarCancelamento(this.helper, chaveMapping, scenario.editar_data, scenario.nova_data);
      msg = "Evento de Cancelamento processado";
    } else {
      // NFE (Já implementado acima)
      const result = editarNfe(
        this.helper,
        scenario,
        chaveMapping,
        referenceMap
      );
      msg = result.msg;
      alteracoes = result.alteracoes;
    }

    altered = alteracoes.length > 0;
    return {
      msg,
      alterations: altered ? alteracoes : [],
      newFileName: undefined,
    };
  }
}
