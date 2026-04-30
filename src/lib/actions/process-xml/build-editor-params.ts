import type { NormalizedTaxRule } from "@/lib/tax-rules/types";
import { getMeliCdById } from "@/lib/constants/meli-cds";

export type ScenarioForEditor = {
  editar_emitente: boolean;
  editar_destinatario_pj: boolean;
  editar_destinatario_pf: boolean;
  editar_destinatario_remessa: boolean;
  destinatarioRemessaMlCdId?: string | null;
  editar_produtos: boolean;
  aplicar_regras_tributarias: boolean;
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
    cMun?: string | null;
    xMun?: string | null;
    UF?: string | null;
    CEP?: string | null;
    fone?: string | null;
  } | null;
  ScenarioDestinatario?: {
    cnpj?: string | null;
    cpf?: string | null;
    centroDistribuicao?: string | null;
    xNome?: string | null;
    IE?: string | null;
    xLgr?: string | null;
    nro?: string | null;
    xBairro?: string | null;
    cMun?: string | null;
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
    regraTributariaNome?: string | null;
    origem?: string | null;
    vUnComVenda?: string | null;
    vUnComTransferencia?: string | null;
    pesoBruto?: string | null;
    pesoLiquido?: string | null;
    isPrincipal: boolean;
    ordem: number;
  }> | null;
  Profile?: {
    ProfileTaxRules?: {
      rules: unknown;
    } | null;
  } | null;
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
    cMun?: string;
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
    cMun?: string;
    xMun: string;
    UF: string;
    CEP: string;
    cPais?: undefined;
    xPais?: undefined;
    fone: string;
  } | null;
  /**
   * Destinatário específico para CFOPs de remessa/retorno (Centro de
   * Distribuição do Mercado Livre). Quando preenchido, sobrescreve `<dest>`
   * apenas para NFes cujo primeiro item seja remessa/retorno.
   */
  novoDestinatarioRemessa: {
    CNPJ: string;
    xNome: string;
    IE: string;
    xLgr: string;
    nro: string;
    xBairro: string;
    cMun?: string;
    xMun: string;
    UF: string;
    CEP: string;
  } | null;
  produtos: Array<{
    xProd?: string;
    cEAN?: string;
    cProd?: string;
    NCM?: string;
    regraTributariaNome?: string;
    origem?: string;
    vUnComVenda?: string;
    vUnComTransferencia?: string;
    pesoBruto?: string;
    pesoLiquido?: string;
    isPrincipal: boolean;
    ordem: number;
  }> | null;
  taxRules: NormalizedTaxRule[] | null;
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
          cMun: scenario.ScenarioEmitente.cMun || "",
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
          cMun: scenario.ScenarioDestinatario.cMun || "",
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

  const cdEscolhido =
    scenario.editar_destinatario_remessa && scenario.destinatarioRemessaMlCdId
      ? getMeliCdById(scenario.destinatarioRemessaMlCdId)
      : null;

  const novoDestinatarioRemessa = cdEscolhido
    ? {
        CNPJ: cdEscolhido.cnpj,
        xNome: "EBAZAR.COM.BR LTDA",
        IE: cdEscolhido.ie || "",
        xLgr: cdEscolhido.xLgr,
        nro: cdEscolhido.nro,
        xBairro: cdEscolhido.cidade,
        cMun: cdEscolhido.cMun || "",
        xMun: cdEscolhido.cidade,
        UF: cdEscolhido.uf,
        CEP: cdEscolhido.cep,
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
          regraTributariaNome: p.regraTributariaNome || undefined,
          origem: p.origem || undefined,
          vUnComVenda: p.vUnComVenda || undefined,
          vUnComTransferencia: p.vUnComTransferencia || undefined,
          pesoBruto: p.pesoBruto || undefined,
          pesoLiquido: p.pesoLiquido || undefined,
          isPrincipal: p.isPrincipal,
          ordem: p.ordem,
        })).sort((a, b) => a.ordem - b.ordem)
      : null;

  const taxRules =
    scenario.aplicar_regras_tributarias &&
    scenario.Profile?.ProfileTaxRules?.rules &&
    Array.isArray(scenario.Profile.ProfileTaxRules.rules)
      ? (scenario.Profile.ProfileTaxRules.rules as NormalizedTaxRule[])
      : null;

  return {
    novoEmitente,
    novoDestinatario,
    novoDestinatarioRemessa,
    produtos,
    taxRules,
  };
}

