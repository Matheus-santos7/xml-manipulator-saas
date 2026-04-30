"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getCurrentUser, canAccessProfile } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import {
  emitenteSchema,
  destinatarioSchema,
  produtoSchema,
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
 * as suas relações (emitente, destinatário e produtos).
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

  const { payload, emitenteObj, produtoObj, destinatarioObj } =
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
        produtoObj
      );
    });

    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return {
          success: false,
          error:
            "Já existe um cenário com este nome para esta empresa. Use outro nome.",
        };
      }
    }
    console.error(
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

function parseBooleanLike(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  return v === "true" || v === "1" || v === "sim" || v === "yes";
}

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

type SpreadsheetRow = Record<string, unknown>;

export async function importScenariosFromSpreadsheet(formData: FormData) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, error: "Usuário não autenticado." };
  }
  if (!currentUser.permissions.canManageScenarios) {
    return { success: false, error: "Sem permissão para gerenciar cenários." };
  }

  const selectedProfileId = cleanString(formData.get("profileId"));
  const file = formData.get("file");
  if (!selectedProfileId) {
    return { success: false, error: "Profile não informado." };
  }
  if (!canAccessProfile(currentUser, selectedProfileId)) {
    return { success: false, error: "Sem permissão para este profile." };
  }
  if (!(file instanceof File) || file.size <= 0) {
    return { success: false, error: "Arquivo não informado." };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: "array" });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) {
      return { success: false, error: "Planilha sem abas." };
    }
    const ws = wb.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(ws, { defval: "" });
    if (!rows.length) {
      return { success: false, error: "Planilha vazia." };
    }

    const grouped = new Map<string, SpreadsheetRow[]>();
    for (const row of rows) {
      const key =
        cleanString(row.scenario_key) ||
        `${cleanString(row.profileId || selectedProfileId)}::${cleanString(
          row.name
        )}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)?.push(row);
    }

    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const [groupKey, groupRows] of grouped.entries()) {
      const base = groupRows[0];
      const profileId = cleanString(base.profileId) || selectedProfileId;
      const name = cleanString(base.name);
      if (!name) {
        failed += 1;
        errors.push(`[${groupKey}] Nome do cenário não informado.`);
        continue;
      }

      const produtoData = groupRows
        .filter((r) => cleanString(r.produto_ordem) || cleanString(r.prod_xProd))
        .map((r, idx) => ({
          ordem: Number(cleanString(r.produto_ordem) || idx + 1),
          isPrincipal: parseBooleanLike(r.produto_isPrincipal),
          xProd: cleanString(r.prod_xProd) || undefined,
          cEAN: cleanString(r.prod_cEAN) || undefined,
          cProd: cleanString(r.prod_cProd) || undefined,
          NCM: cleanString(r.prod_NCM) || undefined,
          origem: cleanString(r.prod_origem) || undefined,
          regraTributariaNome: cleanString(r.prod_regraTributariaNome) || undefined,
          vUnComVenda: cleanString(r.prod_vUnComVenda) || undefined,
          vUnComTransferencia:
            cleanString(r.prod_vUnComTransferencia) || undefined,
          pesoBruto: cleanString(r.prod_pesoBruto) || undefined,
          pesoLiquido: cleanString(r.prod_pesoLiquido) || undefined,
        }));

      const payload: SaveScenarioInput = {
        profileId,
        name,
        active: parseBooleanLike(base.active),
        editar_data: parseBooleanLike(base.editar_data),
        nova_data: cleanString(base.nova_data) || undefined,
        alterar_serie: parseBooleanLike(base.alterar_serie),
        nova_serie: cleanString(base.nova_serie) || undefined,
        alterar_cUF: parseBooleanLike(base.alterar_cUF),
        novo_cUF: cleanString(base.novo_cUF) || undefined,
        editar_emitente: parseBooleanLike(base.editar_emitente),
        editar_destinatario_pj: parseBooleanLike(base.editar_destinatario_pj),
        editar_destinatario_pf: parseBooleanLike(base.editar_destinatario_pf),
        editar_destinatario_remessa: parseBooleanLike(base.editar_destinatario_remessa),
        destinatarioRemessaMlCdId:
          cleanString(base.destinatarioRemessaMlCdId) || null,
        editar_produtos: parseBooleanLike(base.editar_produtos),
        aplicar_regras_tributarias: parseBooleanLike(base.aplicar_regras_tributarias),
        editar_refNFe: parseBooleanLike(base.editar_refNFe),
        emitenteData: {
          cnpj: cleanString(base.emit_cnpj) || undefined,
          xNome: cleanString(base.emit_xNome) || undefined,
          IE: cleanString(base.emit_IE) || undefined,
          xLgr: cleanString(base.emit_xLgr) || undefined,
          nro: cleanString(base.emit_nro) || undefined,
          xCpl: cleanString(base.emit_xCpl) || undefined,
          xBairro: cleanString(base.emit_xBairro) || undefined,
          cMun: cleanString(base.emit_cMun) || undefined,
          xMun: cleanString(base.emit_xMun) || undefined,
          UF: cleanString(base.emit_UF) || undefined,
          CEP: cleanString(base.emit_CEP) || undefined,
          fone: cleanString(base.emit_fone) || undefined,
        },
        destinatarioData: {
          cnpj: cleanString(base.dest_cnpj) || undefined,
          cpf: cleanString(base.dest_cpf) || undefined,
          xNome: cleanString(base.dest_xNome) || undefined,
          IE: cleanString(base.dest_IE) || undefined,
          xLgr: cleanString(base.dest_xLgr) || undefined,
          nro: cleanString(base.dest_nro) || undefined,
          xBairro: cleanString(base.dest_xBairro) || undefined,
          cMun: cleanString(base.dest_cMun) || undefined,
          xMun: cleanString(base.dest_xMun) || undefined,
          UF: cleanString(base.dest_UF) || undefined,
          CEP: cleanString(base.dest_CEP) || undefined,
          fone: cleanString(base.dest_fone) || undefined,
        },
        produtoData,
      };

      const result = await saveScenario(payload);
      if (result.success) {
        imported += 1;
      } else {
        failed += 1;
        errors.push(`[${name}] ${result.error || "Falha ao importar cenário."}`);
      }
    }

    revalidatePath("/settings");
    return {
      success: failed === 0,
      imported,
      failed,
      errors,
      message: `Importação concluída: ${imported} cenário(s) importado(s), ${failed} com erro.`,
    };
  } catch (error) {
    console.error("Erro ao importar planilha de cenários", error);
    return {
      success: false,
      error: "Erro ao processar planilha. Verifique o formato do arquivo.",
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
    console.error("Erro ao deletar cenário", { scenarioId }, error as Error);
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
  // Em `update`, o Prisma 6 rejeita o escalar `profileId` quando a relação
  // `Profile` é obrigatória — só aceita criar/atualizar a relação aninhada.
  // Como nunca queremos mover um cenário entre profiles, removemos o campo
  // do payload de update.
  const { profileId: _profileId, ...payloadForUpdate } =
    payload as Record<string, unknown>;
  void _profileId;
  const targetName = String((payload as { name?: string }).name ?? data.name ?? "");

  // Libera o nome quando o conflito for com cenário já deletado (soft delete).
  const conflictingSoftDeleted = await tx.scenario.findFirst({
    where: {
      profileId: data.profileId,
      name: targetName,
      ...(data.id ? { id: { not: data.id } } : {}),
      NOT: { deletedAt: null },
    },
    select: { id: true, name: true },
  });
  if (conflictingSoftDeleted) {
    await tx.scenario.update({
      where: { id: conflictingSoftDeleted.id },
      data: {
        name: `${conflictingSoftDeleted.name}__deleted_${Date.now()}`,
      },
    });
  }

  if (data.id) {
    return tx.scenario.update({
      where: { id: data.id },
      data: payloadForUpdate as ScenarioUpdateInput,
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
      ...(payloadForUpdate as ScenarioUpdateInput),
      deletedAt: null,
    },
  });
}

/**
 * Persiste todas as relações do cenário (emitente, destinatário e produtos)
 * dentro da transação.
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
  produtoObj: ScenarioPayloadResult["produtoObj"]
): Promise<void> {
  const isUnknownFieldError = (error: unknown, field: string): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes(`Unknown argument \`${field}\``) ||
      message.includes(`Argument \`${field}\` is missing`)
    );
  };

  if (emitenteObj) {
    const parsedEmitente = emitenteSchema.safeParse(emitenteObj);
    if (parsedEmitente.success) {
      try {
        await tx.scenarioEmitente.upsert({
          where: { scenarioId },
          create: { scenarioId, ...parsedEmitente.data },
          update: parsedEmitente.data,
        });
      } catch (error) {
        if (isUnknownFieldError(error, "cMun")) {
          const { cMun: _cMun, ...emitenteSemCMun } = parsedEmitente.data;
          void _cMun;
          await tx.scenarioEmitente.upsert({
            where: { scenarioId },
            create: { scenarioId, ...emitenteSemCMun },
            update: emitenteSemCMun,
          });
        } else {
          throw error;
        }
      }
    }
  }

  if (destinatarioObj) {
    const parsedDestinatario = destinatarioSchema.safeParse(destinatarioObj);
    if (parsedDestinatario.success) {
      try {
        await tx.scenarioDestinatario.upsert({
          where: { scenarioId },
          create: { scenarioId, ...parsedDestinatario.data },
          update: parsedDestinatario.data,
        });
      } catch (error) {
        const removeCMun = isUnknownFieldError(error, "cMun");
        const removeCentro = isUnknownFieldError(error, "centroDistribuicao");
        if (removeCMun || removeCentro) {
          const { cMun: _cMun, centroDistribuicao: _centro, ...destSemCampos } =
            parsedDestinatario.data;
          void _cMun;
          void _centro;
          await tx.scenarioDestinatario.upsert({
            where: { scenarioId },
            create: { scenarioId, ...destSemCampos },
            update: destSemCampos,
          });
        } else {
          throw error;
        }
      }
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
        data: validProdutos.map((p) => ({
          scenarioId,
          ...p,
        })),
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

}

