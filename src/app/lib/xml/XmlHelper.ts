import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import xpath from "xpath";
import { NS } from "./constants";

export class XmlHelper {
  public doc: Document;
  private select: xpath.XPathEvaluator["select"];

  constructor(xmlBuffer: Buffer) {
    const parser = new DOMParser();
    // Parse inicial
    this.doc = parser.parseFromString(
      xmlBuffer.toString("utf-8"),
      "application/xml"
    );
    this.select = xpath.useNamespaces(NS);
  }

  public serialize(): Buffer {
    const serializer = new XMLSerializer();
    let xmlStr = serializer.serializeToString(this.doc);
    
    // Limpeza de namespaces e formatação para ficar igual ao Python
    xmlStr = xmlStr.replace(
      /xmlns:ds="http:\/\/www.w3.org\/2000\/09\/xmldsig#"/g,
      ""
    );
    xmlStr = xmlStr.replace(
      /<ds:Signature>/g,
      '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">'
    );
    xmlStr = xmlStr.replace(/<\/ds:Signature>/g, "</Signature>");
    xmlStr = xmlStr.replace(/<ds:/g, "<").replace(/<\/ds:/g, "</");
    xmlStr = xmlStr.replace(/\s+/g, " ").trim().replace(/> </g, "><");
    xmlStr = xmlStr.replace(/<ns0:/g, "<").replace(/<\/ns0:/g, "</");
    xmlStr = xmlStr.replace(
      /xmlns:ns0="http:\/\/www.portalfiscal.inf.br\/cte"/g,
      ""
    );
    return Buffer.from(xmlStr, "utf-8");
  }

  /**
   * Método auxiliar para garantir que retornamos um Elemento único
   * A lib xpath retorna Array ou Node, precisamos normalizar isso.
   */
  private getFirstElement(result: any): Element | null {
    if (Array.isArray(result)) {
      return result.length > 0 ? (result[0] as Element) : null;
    }
    return result ? (result as Element) : null;
  }

  public findElement(parent: Node | null, path: string): Element | null {
    if (!parent) return null;
    try {
      // Tenta nfe:
      let res = this.select(`nfe:${path}` as any, parent);
      let elem = this.getFirstElement(res);
      if (elem) return elem;
      
      // Tenta cte:
      res = this.select(`cte:${path}` as any, parent);
      elem = this.getFirstElement(res);
      if (elem) return elem;

      // Tenta sem namespace
      res = this.select(path as any, parent);
      return this.getFirstElement(res);
    } catch (err) {
      // Fallback de contexto global se falhar no parente
      try {
         let res = this.select(`.//nfe:${path}` as any, this.doc);
         let elem = this.getFirstElement(res);
         if (elem) return elem;
         
         res = this.select(`.//cte:${path}` as any, this.doc);
         elem = this.getFirstElement(res);
         if (elem) return elem;
         
         res = this.select(`.//${path}` as any, this.doc);
         return this.getFirstElement(res);
      } catch (err2) {
        return null;
      }
    }
  }

  public findAllElements(parent: Node | null, path: string): Element[] {
    if (!parent) return [];
    try {
      let result = this.select(`nfe:${path}` as any, parent);
      let elems = Array.isArray(result) ? result : [result];
      if (elems && elems.length > 0 && elems[0]) return elems as Element[];

      result = this.select(`cte:${path}` as any, parent);
      elems = Array.isArray(result) ? result : [result];
      if (elems && elems.length > 0 && elems[0]) return elems as Element[];

      result = this.select(path as any, parent);
      elems = Array.isArray(result) ? result : [result];
      return (elems && elems.length > 0 && elems[0]) ? elems as Element[] : [];
    } catch (err) {
      return [];
    }
  }

  public findElementDeep(parent: Node | null, path: string): Element | null {
    if (!parent) return null;
    try {
      let res = this.select(`.//nfe:${path}` as any, parent);
      let elem = this.getFirstElement(res);
      if (elem) return elem;

      res = this.select(`.//cte:${path}` as any, parent);
      elem = this.getFirstElement(res);
      if (elem) return elem;

      res = this.select(`.//${path}` as any, parent);
      return this.getFirstElement(res);
    } catch (err) {
       return null;
    }
  }

  public createAndSetText(
    parent: Element,
    tagName: string,
    text: string
  ): Element {
    const tag = this.doc.createElement(tagName);
    tag.textContent = text;
    parent.appendChild(tag);
    return tag;
  }

  public removeSignature(): void {
    const signature = this.findElementDeep(this.doc, "Signature");
    if (signature && signature.parentNode) {
        signature.parentNode.removeChild(signature);
    }
  }

  public calcularDvChave(chave: string): string {
    if (chave.length !== 43)
      throw new Error(`Chave deve ter 43 dígitos: ${chave.length}`);
    let soma = 0;
    let multiplicador = 2;
    for (let i = 42; i >= 0; i--) {
      soma += parseInt(chave[i], 10) * multiplicador;
      multiplicador = multiplicador === 9 ? 2 : multiplicador + 1;
    }
    const resto = soma % 11;
    const dv = 11 - resto;
    return [0, 1, 10, 11].includes(dv) ? "0" : dv.toString();
  }
}