export type ScenarioForEditor = {
  editar_emitente: boolean;
  editar_destinatario_pj: boolean;
  editar_destinatario_pf: boolean;
  editar_produtos: boolean;
  editar_impostos: boolean;
  editar_cst: boolean;
  reforma_tributaria: boolean;
  editar_data: boolean;
  alterar_cUF: boolean;
  alterar_serie: boolean;
  nova_data?: string | null;
  novo_cUF?: string | null;
  nova_serie?: string | null;
  ScenarioEmitente?: {
    cnpj?: string | null;
    xNome?: string | null;
    IE?: string | null;
    xLgr?: string | null;
    nro?: string | null;
    xCpl?: string | null;
    xBairro?: string | null;
    xMun?: string | null;
    UF?: string | null;
    CEP?: string | null;
    fone?: string | null;
  } | null;
  ScenarioDestinatario?: {
    cnpj?: string | null;
    cpf?: string | null;
    xNome?: string | null;
    IE?: string | null;
    xLgr?: string | null;
    nro?: string | null;
    xBairro?: string | null;
    xMun?: string | null;
    UF?: string | null;
    CEP?: string | null;
    fone?: string | null;
  } | null;
  ScenarioProduto?: Array<{
    xProd?: string | null;
    cEAN?: string | null;
    cProd?: string | null;
    NCM?: string | null;
    origem?: string | null;
    isPrincipal: boolean;
    ordem: number;
  }> | null;
  ScenarioImposto?: {
    tipoTributacao?: string | null;
    pFCP?: string | null;
    pICMS?: string | null;
    pICMSUFDest?: string | null;
    pICMSInter?: string | null;
    pPIS?: string | null;
    pCOFINS?: string | null;
    pIPI?: string | null;
  } | null;
  CstMapping?: Array<{
    tipoOperacao: string;
    icms: string | null;
    ipi: string | null;
    pis: string | null;
    cofins: string | null;
  }> | null;
  TaxReformRule?: Array<{
    pIBSUF?: string | null;
    pIBSMun?: string | null;
    pCBS?: string | null;
    vDevTrib?: string | null;
    cClassTrib?: string | null;
    CST?: string | null;
  }> | null;
};

export type EditorParams = {
  novoEmitente: {
    CNPJ: string;
    xNome: string;
    xFant: string;
    IE: string;
    IEST?: undefined;
    IM?: undefined;
    CNAE?: undefined;
    CRT?: undefined;
    xLgr: string;
    nro: string;
    xCpl: string;
    xBairro: string;
    cMun?: undefined;
    xMun: string;
    UF: string;
    CEP: string;
    cPais?: undefined;
    xPais?: undefined;
    fone: string;
  } | null;
  novoDestinatario: {
    CNPJ?: string;
    CPF?: string;
    xNome: string;
    IE: string;
    xLgr: string;
    nro: string;
    xBairro: string;
    cMun?: undefined;
    xMun: string;
    UF: string;
    CEP: string;
    cPais?: undefined;
    xPais?: undefined;
    fone: string;
  } | null;
  produtos: Array<{
    xProd?: string;
    cEAN?: string;
    cProd?: string;
    NCM?: string;
    origem?: string;
    isPrincipal: boolean;
    ordem: number;
  }> | null;
  cstMappings: Array<{
    tipoOperacao: "VENDA" | "DEVOLUCAO" | "RETORNO" | "REMESSA";
    icms: string | null;
    ipi: string | null;
    pis: string | null;
    cofins: string | null;
  }> | null;
  taxReformRule: {
    pIBSUF?: string;
    pIBSMun?: string;
    pCBS?: string;
    vDevTrib: string;
    cClassTrib: string;
    CST: string;
  } | null;
  impostosData: {
    tipoTributacao?: string;
    pFCP?: string;
    pICMS?: string;
    pICMSUFDest?: string;
    pICMSInter?: string;
    pPIS?: string;
    pCOFINS?: string;
    pIPI?: string;
  } | null;
};

export function buildEditorParams(scenario: ScenarioForEditor): EditorParams {
  const novoEmitente =
    scenario.editar_emitente && scenario.ScenarioEmitente
      ? {
          CNPJ: (scenario.ScenarioEmitente.cnpj || "").replace(/\D/g, ""),
          xNome: scenario.ScenarioEmitente.xNome || "",
          xFant: scenario.ScenarioEmitente.xNome || "",
          IE: scenario.ScenarioEmitente.IE || "",
          IEST: undefined,
          IM: undefined,
          CNAE: undefined,
          CRT: undefined,
          xLgr: scenario.ScenarioEmitente.xLgr || "",
          nro: scenario.ScenarioEmitente.nro || "",
          xCpl: scenario.ScenarioEmitente.xCpl || "",
          xBairro: scenario.ScenarioEmitente.xBairro || "",
          cMun: undefined,
          xMun: scenario.ScenarioEmitente.xMun || "",
          UF: scenario.ScenarioEmitente.UF || "",
          CEP: (scenario.ScenarioEmitente.CEP || "").replace(/\D/g, ""),
          cPais: undefined,
          xPais: undefined,
          fone: (scenario.ScenarioEmitente.fone || "").replace(/\D/g, ""),
        }
      : null;

  const novoDestinatario =
    (scenario.editar_destinatario_pj || scenario.editar_destinatario_pf) &&
    scenario.ScenarioDestinatario
      ? {
          CNPJ:
            scenario.editar_destinatario_pj &&
            scenario.ScenarioDestinatario.cnpj
              ? scenario.ScenarioDestinatario.cnpj.replace(/\D/g, "")
              : undefined,
          CPF:
            scenario.editar_destinatario_pf && scenario.ScenarioDestinatario.cpf
              ? scenario.ScenarioDestinatario.cpf.replace(/\D/g, "")
              : undefined,
          xNome: scenario.ScenarioDestinatario.xNome || "",
          IE: scenario.ScenarioDestinatario.IE || "",
          xLgr: scenario.ScenarioDestinatario.xLgr || "",
          nro: scenario.ScenarioDestinatario.nro || "",
          xBairro: scenario.ScenarioDestinatario.xBairro || "",
          cMun: undefined,
          xMun: scenario.ScenarioDestinatario.xMun || "",
          UF: scenario.ScenarioDestinatario.UF || "",
          CEP: scenario.ScenarioDestinatario.CEP
            ? scenario.ScenarioDestinatario.CEP.replace(/\D/g, "")
            : "",
          cPais: undefined,
          xPais: undefined,
          fone: scenario.ScenarioDestinatario.fone
            ? scenario.ScenarioDestinatario.fone.replace(/\D/g, "")
            : "",
        }
      : null;

  const produtos =
    scenario.editar_produtos &&
    scenario.ScenarioProduto &&
    scenario.ScenarioProduto.length > 0
      ? scenario.ScenarioProduto.map((p) => ({
          xProd: p.xProd || undefined,
          cEAN: p.cEAN || undefined,
          cProd: p.cProd || undefined,
          NCM: p.NCM || undefined,
          origem: p.origem || undefined,
          isPrincipal: p.isPrincipal,
          ordem: p.ordem,
        })).sort((a, b) => a.ordem - b.ordem)
      : null;

  const cstMappings =
    scenario.editar_cst && scenario.CstMapping && scenario.CstMapping.length > 0
      ? scenario.CstMapping.map((m) => ({
          tipoOperacao: m.tipoOperacao as
            | "VENDA"
            | "DEVOLUCAO"
            | "RETORNO"
            | "REMESSA",
          icms: m.icms,
          ipi: m.ipi,
          pis: m.pis,
          cofins: m.cofins,
        }))
      : null;

  const taxReformRule =
    scenario.reforma_tributaria &&
    scenario.TaxReformRule &&
    scenario.TaxReformRule.length > 0
      ? {
          pIBSUF: scenario.TaxReformRule[0].pIBSUF || undefined,
          pIBSMun: scenario.TaxReformRule[0].pIBSMun || undefined,
          pCBS: scenario.TaxReformRule[0].pCBS || undefined,
          vDevTrib: scenario.TaxReformRule[0].vDevTrib || "0.00",
          cClassTrib: scenario.TaxReformRule[0].cClassTrib || "000001",
          CST: scenario.TaxReformRule[0].CST || "000",
        }
      : null;

  const impostosData =
    scenario.editar_impostos && scenario.ScenarioImposto
      ? {
          tipoTributacao: scenario.ScenarioImposto.tipoTributacao || undefined,
          pFCP: scenario.ScenarioImposto.pFCP || undefined,
          pICMS: scenario.ScenarioImposto.pICMS || undefined,
          pICMSUFDest: scenario.ScenarioImposto.pICMSUFDest || undefined,
          pICMSInter: scenario.ScenarioImposto.pICMSInter || undefined,
          pPIS: scenario.ScenarioImposto.pPIS || undefined,
          pCOFINS: scenario.ScenarioImposto.pCOFINS || undefined,
          pIPI: scenario.ScenarioImposto.pIPI || undefined,
        }
      : null;

  return {
    novoEmitente,
    novoDestinatario,
    produtos,
    cstMappings,
    taxReformRule,
    impostosData,
  };
}

