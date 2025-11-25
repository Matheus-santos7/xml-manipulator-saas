import Decimal from 'decimal.js';
import type { XmlHelper } from './XmlHelper';
import type { TaxReformRuleDB } from '../../types'; // Ajuste o import

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export function criarBlocoIBSCBS(
  helper: XmlHelper,
  impostoTag: Element,
  prodTag: Element,
  config: TaxReformRuleDB,
  alteracoes: string[],
  aplicarReducao: boolean
) {
  const vProdTag = helper.findElement(prodTag, 'vProd');
  if (!vProdTag || !vProdTag.textContent) {
    return { 
      vBC: new Decimal(0), vIBSUF: new Decimal(0), vIBSMun: new Decimal(0), 
      vCBS: new Decimal(0), vDevTrib: new Decimal(0) 
    };
  }

  const vBC = new Decimal(vProdTag.textContent);
  const pIBSUF = new Decimal(config.pIBSUF || '0');
  const pIBSMun = new Decimal(config.pIBSMun || '0');
  const pCBS = new Decimal(config.pCBS || '0');
  const vDevTrib = new Decimal(config.vDevTrib || '0');

  const vIBSUF = vBC.mul(pIBSUF).div(100).toDecimalPlaces(2);
  const vIBSMun = vBC.mul(pIBSMun).div(100).toDecimalPlaces(2);
  const vCBS = vBC.mul(pCBS).div(100).toDecimalPlaces(2);

  const ibscbs = helper.doc.createElement('IBSCBS');
  impostoTag.appendChild(ibscbs);
  helper.createAndSetText(ibscbs, 'CST', config.CST || '000');
  helper.createAndSetText(ibscbs, 'cClassTrib', config.cClassTrib || '000001');

  // Bloco gIBSCBS
  const gIBSCBS = helper.doc.createElement('gIBSCBS');
  ibscbs.appendChild(gIBSCBS);
  helper.createAndSetText(gIBSCBS, 'vBC', vBC.toFixed(2));

  // Função auxiliar interna para gerar grupos (UF, Mun, CBS)
  const createSubGroup = (parent: Element, name: string, aliquota: Decimal, valor: Decimal, gRedConfig: any, redName: string) => {
    const group = helper.doc.createElement(name);
    parent.appendChild(group);
    helper.createAndSetText(group, `p${name.slice(1)}`, aliquota.toFixed(2));

    if (aplicarReducao && gRedConfig) {
        const gRed = helper.doc.createElement('gRed');
        group.appendChild(gRed);
        helper.createAndSetText(gRed, 'pRedAliq', gRedConfig.pRedAliq || '0.00');
        helper.createAndSetText(gRed, 'pAliqEfet', gRedConfig.pAliqEfet || '0.00');
        alteracoes.push(`Imposto: Bloco <gRed> (${redName}) aplicado`);
    } else {
        const gDevTrib = helper.doc.createElement('gDevTrib');
        group.appendChild(gDevTrib);
        helper.createAndSetText(gDevTrib, 'vDevTrib', vDevTrib.toFixed(2));
    }
    helper.createAndSetText(group, `v${name.slice(1)}`, valor.toFixed(2));
  };

  createSubGroup(gIBSCBS, 'gIBSUF', pIBSUF, vIBSUF, config.gIBSUF_gRed, 'IBSUF');
  createSubGroup(gIBSCBS, 'gIBSMun', pIBSMun, vIBSMun, config.gIBSMun_gRed, 'IBSMun');
  createSubGroup(gIBSCBS, 'gCBS', pCBS, vCBS, config.gCBS_gRed, 'CBS');

  return { vBC, vIBSUF, vIBSMun, vCBS, vDevTrib };
}

export function criarBlocoIBSCBSTot(
  helper: XmlHelper,
  totalTag: Element,
  vBC: Decimal, vIBSUF: Decimal, vIBSMun: Decimal, vCBS: Decimal, vDevTrib: Decimal,
  alteracoes: string[]
) {
  const ibscbsTot = helper.doc.createElement('IBSCBSTot');
  totalTag.appendChild(ibscbsTot);
  helper.createAndSetText(ibscbsTot, 'vBC', vBC.toFixed(2));
  helper.createAndSetText(ibscbsTot, 'vIBSUF', vIBSUF.toFixed(2));
  helper.createAndSetText(ibscbsTot, 'vIBSMun', vIBSMun.toFixed(2));
  helper.createAndSetText(ibscbsTot, 'vCBS', vCBS.toFixed(2));
  helper.createAndSetText(ibscbsTot, 'vDevTrib', vDevTrib.toFixed(2));
  alteracoes.push('Total: Bloco <IBSCBSTot> criado');
}

export function recalculaTotaisIpi(helper: XmlHelper, infNFe: Element, alteracoes: string[]) {
  const icmsTotTag = helper.findElementDeep(infNFe, 'total/ICMSTot');
  if (!icmsTotTag) return;

  let somas = { vProd: new Decimal(0), vIPI: new Decimal(0), vDesc: new Decimal(0), vFrete: new Decimal(0), vSeg: new Decimal(0), vOutro: new Decimal(0) };

  const safeGetDecimal = (element: Element | null, tagName: string): Decimal => {
    const tag = helper.findElement(element, tagName);
    return tag && tag.textContent ? new Decimal(tag.textContent) : new Decimal(0);
  };

  const dets = helper.findAllElements(infNFe, 'det');
  for (const det of dets) {
    const prod = helper.findElement(det, 'prod');
    const imposto = helper.findElement(det, 'imposto');
    
    Object.keys(somas).forEach(k => {
      // @ts-ignore - iteração segura pelas chaves
      if (k !== 'vIPI') somas[k] = somas[k].add(safeGetDecimal(prod, k));
    });

    const ipiTag = helper.findElement(imposto, 'IPI');
    if (ipiTag) {
      somas.vIPI = somas.vIPI.add(safeGetDecimal(helper.findElementDeep(ipiTag, 'IPITrib/vIPI'), 'vIPI'));
    }
  }

  const novoVnf = Object.values(somas).reduce((acc, v) => acc.add(v), new Decimal(0)).sub(somas.vDesc);

  const vipiTotalTag = helper.findElement(icmsTotTag, 'vIPI');
  if (vipiTotalTag) {
    vipiTotalTag.textContent = somas.vIPI.toFixed(2);
    alteracoes.push('Total vIPI recalculado');
  }
  const vnfTotalTag = helper.findElement(icmsTotTag, 'vNF');
  if (vnfTotalTag) {
    vnfTotalTag.textContent = novoVnf.toFixed(2);
    alteracoes.push('Total vNF recalculado');
  }
}