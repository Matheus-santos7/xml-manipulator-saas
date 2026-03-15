"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getCurrentUser, canAccessProfile } from "@/lib/auth";
import { logger } from "@/lib/logging";
import {
  emitenteSchema,
  destinatarioSchema,
  produtoSchema,
  impostoSchema,
} from "@/lib/scenarios";
import type { SaveScenarioInput } from "@/lib/scenarios";
import { buildScenarioPayload } from "@/lib/actions/scenarios/payload";
import type { ScenarioPayloadResult } from "@/lib/actions/scenarios/payload";

type ScenarioRecord = Awaited<ReturnType<typeof db.scenario.update>>;
type ScenarioUpdateInput = Parameters<typeof db.scenario.update>[0]["data"];
type ScenarioCreateInput = Parameters<typeof db.scenario.create>[0]["data"];
type TransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * Cria ou atualiza um cenário de manipulação de XML e todas
 * as suas relações (emitente, destinatário, produtos, impostos,
 * mapeamentos de CST e regras de reforma tributária).
 *
 * Regras:
 * - Garante que o usuário está autenticado e pode gerenciar cenários.
 * - Garante que o cenário pertence a um profile acessível pelo usuário.
 * - Usa `buildScenarioPayload` para montar o payload "flat" do cenário.
 * - Persiste todas as relações em uma única transação Prisma.
 */
export async function saveScenario(data: SaveScenarioInput) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, error: "Usuário não autenticado" };
  }
  if (!currentUser.permissions.canManageScenarios) {
    return { success: false, error: "Sem permissão para gerenciar cenários" };
  }
  if (!canAccessProfile(currentUser, data.profileId)) {
    return {
      success: false,
      error: "Sem permissão para gerenciar cenários desta empresa",
    };
  }

  const { payload, emitenteObj, produtoObj, impostosObj, destinatarioObj } =
    buildScenarioPayload(data);

  try {
    await db.$transaction(async (tx: TransactionClient) => {
      const scenarioRecord = await upsertScenarioRecord(tx, data, payload);

      await persistScenarioRelations(
        tx,
        scenarioRecord.id,
        data,
        payload,
        emitenteObj,
        destinatarioObj,
        produtoObj,
        impostosObj
      );
    });

    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    logger.error(
      "Erro ao salvar cenário",
      { profileId: data.profileId, name: data.name },
      error as Error
    );
    return {
      success: false,
      error: "Erro ao salvar cenário. Por favor, tente novamente.",
    };
  }
}

/**
 * Realiza soft delete de um cenário (marca como deletado) após checar permissões.
 */
export async function deleteScenario(scenarioId: string) {
  if (!scenarioId) {
    return { success: false, error: "ID do cenário não informado" };
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, error: "Usuário não autenticado" };
  }
  if (!currentUser.permissions.canManageScenarios) {
    return { success: false, error: "Sem permissão para gerenciar cenários" };
  }

  try {
    const scenario = await db.scenario.findUnique({
      where: { id: scenarioId },
      select: { profileId: true },
    });
    if (!scenario) {
      return { success: false, error: "Cenário não encontrado" };
    }
    if (!canAccessProfile(currentUser, scenario.profileId)) {
      return {
        success: false,
        error: "Sem permissão para deletar cenários desta empresa",
      };
    }

    await db.scenario.update({
      where: { id: scenarioId },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    logger.error("Erro ao deletar cenário", { scenarioId }, error as Error);
    return { success: false, error: "Erro ao deletar cenário" };
  }
}

/**
 * Upsert do registro principal de `Scenario`.
 *
 * - Se `data.id` existir, faz `update` por ID.
 * - Caso contrário, faz `upsert` usando a constraint única `profileId_name`,
 *   garantindo que não haja cenários duplicados por empresa + nome.
 */
async function upsertScenarioRecord(
  tx: TransactionClient,
  data: SaveScenarioInput,
  payload: ScenarioPayloadResult["payload"]
): Promise<ScenarioRecord> {
  if (data.id) {
    return tx.scenario.update({
      where: { id: data.id },
      data: payload as ScenarioUpdateInput,
    });
  }

  return tx.scenario.upsert({
    where: {
      profileId_name: {
        profileId: data.profileId,
        name: data.name,
      },
    },
    create: payload as ScenarioCreateInput,
    update: {
      ...(payload as ScenarioUpdateInput),
      deletedAt: null,
    },
  });
}

/**
 * Persiste todas as relações do cenário (emitente, destinatário, produtos,
 * impostos, CST mappings, regras de reforma) dentro da transação.
 *
 * Cada bloco valida os dados com os schemas de `@/lib/scenarios` antes
 * de gravar no banco.
 */
async function persistScenarioRelations(
  tx: TransactionClient,
  scenarioId: string,
  data: SaveScenarioInput,
  payload: ScenarioPayloadResult["payload"],
  emitenteObj: ScenarioPayloadResult["emitenteObj"],
  destinatarioObj: ScenarioPayloadResult["destinatarioObj"],
  produtoObj: ScenarioPayloadResult["produtoObj"],
  impostosObj: ScenarioPayloadResult["impostosObj"]
): Promise<void> {
  if (emitenteObj) {
    const parsedEmitente = emitenteSchema.safeParse(emitenteObj);
    if (parsedEmitente.success) {
      await tx.scenarioEmitente.upsert({
        where: { scenarioId },
        create: { scenarioId, ...parsedEmitente.data },
        update: parsedEmitente.data,
      });
    }
  }

  if (destinatarioObj) {
    const parsedDestinatario = destinatarioSchema.safeParse(destinatarioObj);
    if (parsedDestinatario.success) {
      await tx.scenarioDestinatario.upsert({
        where: { scenarioId },
        create: { scenarioId, ...parsedDestinatario.data },
        update: parsedDestinatario.data,
      });
    }
  }

  if (produtoObj && Array.isArray(produtoObj)) {
    await tx.scenarioProduto.deleteMany({ where: { scenarioId } });
    const validProdutos = produtoObj
      .map((p) => produtoSchema.safeParse(p))
      .filter((result) => result.success)
      .map((result) => (result.success ? result.data : null))
      .filter((d): d is NonNullable<typeof d> => d !== null);
    if (validProdutos.length > 0) {
      await tx.scenarioProduto.createMany({
        data: validProdutos.map((p) => ({ scenarioId, ...p })),
      });
    }
  } else if (produtoObj && !Array.isArray(produtoObj)) {
    const parsedProduto = produtoSchema.safeParse(produtoObj);
    if (parsedProduto.success) {
      await tx.scenarioProduto.deleteMany({ where: { scenarioId } });
      await tx.scenarioProduto.create({
        data: {
          scenarioId,
          ...parsedProduto.data,
          isPrincipal: true,
          ordem: 1,
        },
      });
    }
  }

  if (impostosObj) {
    const parsedImposto = impostoSchema.safeParse(impostosObj);
    if (parsedImposto.success) {
      await tx.scenarioImposto.upsert({
        where: { scenarioId },
        create: { scenarioId, ...parsedImposto.data },
        update: parsedImposto.data,
      });
    }
  }

  if (data.cstMappings && Array.isArray(data.cstMappings)) {
    await tx.cstMapping.deleteMany({ where: { scenarioId } });
    const toCreate = data.cstMappings.map((m) => ({
      scenarioId,
      tipoOperacao: m.tipoOperacao,
      icms: m.icms || undefined,
      ipi: m.ipi || undefined,
      pis: m.pis || undefined,
      cofins: m.cofins || undefined,
    }));
    if (toCreate.length > 0) {
      await tx.cstMapping.createMany({ data: toCreate });
    }
  }

  if (data.taxReformRule && payload.reforma_tributaria) {
    const taxRule = data.taxReformRule;
    await tx.taxReformRule.deleteMany({ where: { scenarioId } });
    const hasValues = taxRule.pIBSUF || taxRule.pIBSMun || taxRule.pCBS;
    if (hasValues) {
      await tx.taxReformRule.create({
        data: {
          scenarioId,
          pIBSUF: taxRule.pIBSUF || null,
          pIBSMun: taxRule.pIBSMun || null,
          pCBS: taxRule.pCBS || null,
          vDevTrib: taxRule.vDevTrib || "0.00",
          cClassTrib: taxRule.cClassTrib || "000001",
          CST: taxRule.CST || "000",
        },
      });
    }
  } else if (!payload.reforma_tributaria) {
    await tx.taxReformRule.deleteMany({ where: { scenarioId } });
  }
}

