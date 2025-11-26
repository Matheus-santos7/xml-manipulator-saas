import type { ScenarioDB } from "../../types";

export function getEmitenteMap(
  scenario: ScenarioDB
): Record<string, string> | null {
  if (scenario.emitenteData) {
    const d = scenario.emitenteData;
    const map: Record<string, string> = {};
    if (d.cnpj) map["CNPJ"] = String(d.cnpj);
    if (d.xNome) map["xNome"] = String(d.xNome);
    if (d.xLgr) map["xLgr"] = String(d.xLgr);
    if (d.nro) map["nro"] = String(d.nro);
    if (d.xCpl) map["xCpl"] = String(d.xCpl);
    if (d.xBairro) map["xBairro"] = String(d.xBairro);
    if (d.xMun) map["xMun"] = String(d.xMun);
    if (d.UF) map["UF"] = String(d.UF);
    if (d.fone) map["fone"] = String(d.fone);
    if (d.IE) map["IE"] = String(d.IE);
    return Object.keys(map).length ? map : null;
  }

  if (scenario.emitente) {
    const legacy = scenario.emitente as Record<string, unknown>;
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(legacy)) {
      if (v != null) map[k] = String(v);
    }
    return Object.keys(map).length ? map : null;
  }

  return null;
}

export function getDestinatarioMap(
  scenario: ScenarioDB
): Record<string, string> | null {
  if (scenario.destinatarioData) {
    const d = scenario.destinatarioData;
    const map: Record<string, string> = {};
    if (d.cnpj) map["CNPJ"] = String(d.cnpj);
    if (d.xNome) map["xNome"] = String(d.xNome);
    if (d.IE) map["IE"] = String(d.IE);
    if (d.xLgr) map["xLgr"] = String(d.xLgr);
    if (d.nro) map["nro"] = String(d.nro);
    if (d.xBairro) map["xBairro"] = String(d.xBairro);
    if (d.xMun) map["xMun"] = String(d.xMun);
    if (d.UF) map["UF"] = String(d.UF);
    if (d.CEP) map["CEP"] = String(d.CEP);
    if (d.fone) map["fone"] = String(d.fone);
    return Object.keys(map).length ? map : null;
  }

  if (scenario.destinatario) {
    const legacy = scenario.destinatario as Record<string, unknown>;
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(legacy)) {
      if (v != null) map[k] = String(v);
    }
    return Object.keys(map).length ? map : null;
  }

  return null;
}

export function getProdutoPadraoMap(
  scenario: ScenarioDB
): Record<string, string> | null {
  if (scenario.produtoData) {
    const d = scenario.produtoData;
    const map: Record<string, string> = {};
    if (d.xProd) map["xProd"] = String(d.xProd);
    if (d.cEAN) map["cEAN"] = String(d.cEAN);
    if (d.cProd) map["cProd"] = String(d.cProd);
    if (d.NCM) map["NCM"] = String(d.NCM);
    if (d.CEST) map["CEST"] = String(d.CEST);
    if (d.EXTIPI) map["EXTIPI"] = String(d.EXTIPI);
    if (d.CFOP) map["CFOP"] = String(d.CFOP);
    return Object.keys(map).length ? map : null;
  }

  if (scenario.produto_padrao) {
    const legacy = scenario.produto_padrao as Record<string, unknown>;
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(legacy)) {
      if (v != null) map[k] = String(v);
    }
    return Object.keys(map).length ? map : null;
  }

  return null;
}

export function getImpostosPadraoMap(
  scenario: ScenarioDB
): Record<string, string> | null {
  if (scenario.impostosData) {
    const d = scenario.impostosData;
    const map: Record<string, string> = {};
    if (d.pFCP) map["pFCP"] = String(d.pFCP);
    if (d.pICMS) map["pICMS"] = String(d.pICMS);
    if (d.pICMSUFDest) map["pICMSUFDest"] = String(d.pICMSUFDest);
    if (d.pICMSInter) map["pICMSInter"] = String(d.pICMSInter);
    if (d.pPIS) map["pPIS"] = String(d.pPIS);
    if (d.pCOFINS) map["pCOFINS"] = String(d.pCOFINS);
    if (d.pIPI) map["pIPI"] = String(d.pIPI);
    return Object.keys(map).length ? map : null;
  }

  if (scenario.impostos_padrao) {
    const legacy = scenario.impostos_padrao as Record<string, unknown>;
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(legacy)) {
      if (v != null) map[k] = String(v);
    }
    return Object.keys(map).length ? map : null;
  }

  return null;
}

export default {
  getEmitenteMap,
  getDestinatarioMap,
  getProdutoPadraoMap,
  getImpostosPadraoMap,
};
