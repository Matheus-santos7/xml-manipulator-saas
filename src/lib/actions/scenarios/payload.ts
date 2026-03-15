import { z } from "zod";
import { scenarioSchema } from "@/lib/scenarios";
import type { SaveScenarioInput } from "@/lib/scenarios";

export function parseMaybeJson(
  v: unknown
): Record<string, unknown> | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
  if (typeof v === "object") return v as Record<string, unknown>;
  return undefined;
}

export type ScenarioPayloadResult = {
  payload: Partial<z.infer<typeof scenarioSchema>> & Record<string, unknown>;
  emitenteObj: Record<string, unknown> | undefined;
  produtoObj: Record<string, unknown> | unknown[] | undefined;
  impostosObj: Record<string, unknown> | undefined;
  destinatarioObj: Record<string, unknown> | undefined;
};

export function buildScenarioPayload(
  data: SaveScenarioInput
): ScenarioPayloadResult {
  const emitenteObj = parseMaybeJson(data.emitente) || data.emitenteData;
  const produtoObj = parseMaybeJson(data.produto_padrao) || data.produtoData;
  const impostosObj = parseMaybeJson(data.impostos_padrao) || data.impostosData;
  const destinatarioObj =
    parseMaybeJson(data.destinatario) || data.destinatarioData;

  const payload: Partial<z.infer<typeof scenarioSchema>> &
    Record<string, unknown> = {
    profileId: data.profileId,
    name: data.name,
    active: data.active,
    editar_data: !!data.editar_data,
    alterar_serie: !!data.alterar_serie,
    alterar_cUF: !!data.alterar_cUF,
    editar_emitente: !!data.editar_emitente,
    reforma_tributaria: !!data.reforma_tributaria,
    nova_data: data.nova_data || undefined,
    nova_serie: data.nova_serie || undefined,
    novo_cUF: data.novo_cUF || undefined,
    editar_produtos: !!data.editar_produtos,
    editar_impostos: !!data.editar_impostos,
    editar_refNFe: !!data.editar_refNFe,
    editar_cst: !!data.editar_cst,
    editar_destinatario_pj: !!data.editar_destinatario_pj,
    editar_destinatario_pf: !!data.editar_destinatario_pf,
    zerar_ipi_remessa_retorno: !!data.zerar_ipi_remessa_retorno,
    zerar_ipi_venda: !!data.zerar_ipi_venda,
    aplicar_reducao_aliq: !!data.aplicar_reducao_aliq,
  };

  return {
    payload,
    emitenteObj,
    produtoObj,
    impostosObj,
    destinatarioObj,
  };
}

