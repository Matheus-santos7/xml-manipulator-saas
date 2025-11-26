import { XmlHelper } from "./XmlHelper";
import { editarNfe } from "./nfeHandler";
import { editarCte } from "./cteHandler"; // <--- Certifique-se que este arquivo existe
import { editarInutilizacao, editarCancelamento } from "./eventHandler"; // <--- Importação nova
import {
  renameFileAccordingToRules,
  getXmlInfo,
  getEventoInfo,
} from "./renaming";
import type { ScenarioDB, ProcessingReport } from "../../../types"; // Ajuste o path conforme sua pasta

// Classe que encapsula operações sobre um XML.
// Os métodos originais em inglês foram mantidos para compatibilidade,
// e foram adicionados aliases em português abaixo (ex: `obterInfoXml`).
// Favor usar os métodos em português nas novas implementações.

export class XmlProcessor {
  private helper: XmlHelper;

  constructor(xmlBuffer: Buffer) {
    this.helper = new XmlHelper(xmlBuffer);
  }

  public getXmlInfo() {
    return getXmlInfo(this.helper);
  }

  // Alias em português
  public obterInfoXml() {
    return this.getXmlInfo();
  }

  public getEventoInfo() {
    return getEventoInfo(this.helper);
  }

  // Alias em português
  public obterInfoEvento() {
    return this.getEventoInfo();
  }

  public renameFileAccordingToRules(info: Record<string, any>) {
    return renameFileAccordingToRules(info);
  }

  // Alias em português
  public renomearArquivoPorRegras(info: Record<string, any>) {
    return this.renameFileAccordingToRules(info);
  }

  public serialize(): Buffer {
    return this.helper.serialize();
  }

  // Alias em português
  public serializar(): Buffer {
    return this.serialize();
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
      // Lógica de Inutilização ativada
      const result = editarInutilizacao(this.helper, scenario);
      msg = result.msg;
      alteracoes = result.alteracoes;
    } else if (
      root.tagName.includes("cteProc") ||
      root.tagName.includes("CTe")
    ) {
      // Lógica de CTe ativada
      const result = editarCte(
        this.helper,
        scenario,
        chaveMapping,
        chaveDaVendaNova
      );
      msg = result.msg;
      alteracoes = result.alteracoes;
    } else if (root.tagName.includes("procEventoNFe")) {
      // Lógica de Cancelamento ativada
      alteracoes = editarCancelamento(
        this.helper,
        chaveMapping,
        scenario.editar_data,
        scenario.nova_data ?? undefined
      );
      msg = "Evento de Cancelamento processado";
    } else {
      // NFE (Padrão)
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

  // Alias em português
  public aplicarCenario(
    scenario: ScenarioDB,
    chaveMapping: Record<string, string>,
    referenceMap: Record<string, string>,
    chaveDaVendaNova?: string
  ): ProcessingReport {
    return this.applyScenario(
      scenario,
      chaveMapping,
      referenceMap,
      chaveDaVendaNova
    );
  }
}
