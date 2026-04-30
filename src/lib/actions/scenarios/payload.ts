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
  destinatarioObj: Record<string, unknown> | undefined;
};

export function buildScenarioPayload(
  data: SaveScenarioInput
): ScenarioPayloadResult {
  const emitenteObj = parseMaybeJson(data.emitente) || data.emitenteData;
  const produtoObj = parseMaybeJson(data.produto_padrao) || data.produtoData;
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
    aplicar_regras_tributarias: !!data.aplicar_regras_tributarias,
    nova_data: data.nova_data || undefined,
    nova_serie: data.nova_serie || undefined,
    novo_cUF: data.novo_cUF || undefined,
    editar_produtos: !!data.editar_produtos,
    editar_refNFe: !!data.editar_refNFe,
    editar_destinatario_pj: !!data.editar_destinatario_pj,
    editar_destinatario_pf: !!data.editar_destinatario_pf,
    editar_destinatario_remessa: !!data.editar_destinatario_remessa,
    destinatarioRemessaMlCdId: data.destinatarioRemessaMlCdId || null,
  };

  return {
    payload,
    emitenteObj,
    produtoObj,
    destinatarioObj,
  };
}

