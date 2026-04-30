"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { canAccessProfile, getCurrentUser } from "@/lib/auth";
import { parseTaxRulesWorkbookFromBuffer } from "@/lib/tax-rules/parser";
import type { NormalizedTaxRule } from "@/lib/tax-rules/types";
import { findBestTaxRule, mapTransactionTypeFromCfop } from "@/lib/tax-rules/matcher";
import { applyTaxRuleToDetBlock, extractFiscalSnapshot } from "@/lib/xml/editor/tax-rules";
import { randomUUID } from "node:crypto";

function getProfileTaxRulesDelegate() {
  return (db as unknown as {
    profileTaxRules?: {
      upsert: (...args: unknown[]) => Promise<unknown>;
      findUnique: (...args: unknown[]) => Promise<unknown>;
      delete: (...args: unknown[]) => Promise<unknown>;
      deleteMany: (...args: unknown[]) => Promise<{ count: number }>;
    };
  }).profileTaxRules;
}

async function upsertProfileTaxRulesResilient(args: {
  profileId: string;
  fileName: string;
  rules: NormalizedTaxRule[];
}) {
  const { profileId, fileName, rules } = args;
  const profileTaxRules = getProfileTaxRulesDelegate();
  if (!profileTaxRules) {
    throw new Error(
      "Cliente Prisma desatualizado. Reinicie o servidor de desenvolvimento para carregar o novo schema."
    );
  }

  try {
    await profileTaxRules.upsert({
      where: { profileId },
      create: {
        profileId,
        fileName,
        totalRules: rules.length,
        rules,
      },
      update: {
        fileName,
        totalRules: rules.length,
        rules,
      },
    });
    return;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const isHeadersShapeError =
      msg.includes("Argument `headers` is missing") ||
      msg.includes("Unknown argument `headers`");
    if (!isHeadersShapeError) throw error;

    // Fallback para cenários em que o Next/Prisma Client ficou em cache com
    // schema antigo durante o dev server.
    await db.$executeRawUnsafe(
      `
      INSERT INTO "ProfileTaxRules" ("id", "profileId", "fileName", "totalRules", "rules", "uploadedAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), NOW())
      ON CONFLICT ("profileId")
      DO UPDATE SET
        "fileName" = EXCLUDED."fileName",
        "totalRules" = EXCLUDED."totalRules",
        "rules" = EXCLUDED."rules",
        "updatedAt" = NOW()
      `,
      randomUUID(),
      profileId,
      fileName,
      rules.length,
      JSON.stringify(rules)
    );
  }
}

export async function uploadTaxRulesPlanilha(formData: FormData) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, error: "Usuário não autenticado." };
  }
  if (!currentUser.permissions.canManageScenarios) {
    return { success: false, error: "Sem permissão para gerenciar regras." };
  }

  const profileId = String(formData.get("profileId") ?? "");
  const file = formData.get("file");
  if (!profileId) {
    return { success: false, error: "Perfil não informado." };
  }
  if (!canAccessProfile(currentUser, profileId)) {
    return { success: false, error: "Sem permissão para este perfil." };
  }
  if (!(file instanceof File)) {
    return { success: false, error: "Arquivo inválido." };
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { success: false, error: "Envie um arquivo .xlsx." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseTaxRulesWorkbookFromBuffer(buffer);
    if (parsed.rules.length === 0) {
      return { success: false, error: "Nenhuma regra válida foi encontrada na planilha." };
    }
    console.log(
      "[tax-rules] JSON montado na importação:",
      JSON.stringify(
        {
          profileId,
          fileName: file.name,
          totalRules: parsed.rules.length,
          rules: parsed.rules,
        },
        null,
        2
      )
    );

    await upsertProfileTaxRulesResilient({
      profileId,
      fileName: file.name,
      rules: parsed.rules,
    });

    revalidatePath("/settings");
    return {
      success: true,
      message: `Planilha importada com sucesso (${parsed.rules.length} regras).`,
      totalRules: parsed.rules.length,
    };
  } catch (error) {
    console.error("Erro ao importar planilha tributária", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Falha ao importar planilha tributária.",
    };
  }
}

export async function simulateTaxRulesForXml(formData: FormData) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, error: "Usuário não autenticado." };
  }

  const profileId = String(formData.get("profileId") ?? "");
  const xmlContent = String(formData.get("xmlContent") ?? "");
  if (!profileId || !xmlContent) {
    return { success: false, error: "Perfil e XML são obrigatórios." };
  }
  if (!canAccessProfile(currentUser, profileId)) {
    return { success: false, error: "Sem permissão para este perfil." };
  }

  const profileTaxRules = getProfileTaxRulesDelegate();
  if (!profileTaxRules) {
    return {
      success: false,
      error:
        "Cliente Prisma desatualizado. Reinicie o servidor de desenvolvimento para carregar o novo schema.",
    };
  }

  const rulesRecord = (await profileTaxRules.findUnique({
    where: { profileId },
    select: { rules: true },
  })) as { rules: unknown } | null;
  if (!rulesRecord) {
    return { success: false, error: "Nenhuma planilha tributária ativa para este perfil." };
  }

  const rules = Array.isArray(rulesRecord.rules)
    ? (rulesRecord.rules as unknown as NormalizedTaxRule[])
    : [];
  if (!rules.length) {
    return { success: false, error: "Nenhuma regra disponível para simulação." };
  }

  const detBlocks = xmlContent.match(/<det\b[\s\S]*?<\/det>/gi) ?? [];
  if (!detBlocks.length) {
    return { success: false, error: "XML sem itens <det> para simular." };
  }

  const destinationUf = (xmlContent.match(/<dest>[\s\S]*?<UF>([^<]+)<\/UF>/i)?.[1] ?? "")
    .trim()
    .toUpperCase();
  const emitUf = (xmlContent.match(/<emit>[\s\S]*?<UF>([^<]+)<\/UF>/i)?.[1] ?? "")
    .trim()
    .toUpperCase();
  const isContributor =
    (xmlContent.match(/<dest>[\s\S]*?<indIEDest>([^<]+)<\/indIEDest>/i)?.[1] ?? "").trim() ===
    "1";
  const isFinalConsumer =
    (xmlContent.match(/<ide>[\s\S]*?<indFinal>([^<]+)<\/indFinal>/i)?.[1] ?? "").trim() ===
    "1";

  const items = detBlocks.slice(0, 10).map((detBlock, idx) => {
    const cfop = (detBlock.match(/<CFOP>([^<]+)<\/CFOP>/i)?.[1] ?? "").trim();
    const productOrigin = (detBlock.match(/<orig>([^<]+)<\/orig>/i)?.[1] ?? "").trim();
    const transactionType = mapTransactionTypeFromCfop(cfop, isContributor);
    const rule = findBestTaxRule(rules, {
      destinationUf,
      transactionType,
      origin: emitUf,
      isContributor,
      productOrigin,
    });
    if (!rule) {
      return {
        item: idx + 1,
        cfop,
        origin: emitUf,
        productOrigin,
        transactionType,
        matchedRule: null,
        before: extractFiscalSnapshot(detBlock),
        after: extractFiscalSnapshot(detBlock),
        logs: [
          `Nenhuma regra compatível encontrada (origem ${emitUf || "?"}, destino ${destinationUf || "?"}, ${transactionType}).`,
        ],
      };
    }

    const applied = applyTaxRuleToDetBlock(
      detBlock,
      rule,
      destinationUf,
      emitUf,
      productOrigin,
      isContributor,
      isFinalConsumer
    );
    return {
      item: idx + 1,
      cfop,
      origin: emitUf,
      productOrigin,
      transactionType,
      matchedRule: rule.ruleName,
      before: extractFiscalSnapshot(detBlock),
      after: extractFiscalSnapshot(applied.detBlock),
      logs: applied.logs,
    };
  });

  return {
    success: true,
    message: `Simulação concluída para ${items.length} item(ns).`,
    items,
  };
}

export async function deleteTaxRulesPlanilha(formData: FormData) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, error: "Usuário não autenticado." };
  }
  if (!currentUser.permissions.canManageScenarios) {
    return { success: false, error: "Sem permissão para gerenciar regras." };
  }

  const profileId = String(formData.get("profileId") ?? "");
  if (!profileId) {
    return { success: false, error: "Perfil não informado." };
  }
  if (!canAccessProfile(currentUser, profileId)) {
    return { success: false, error: "Sem permissão para este perfil." };
  }

  const profileTaxRules = getProfileTaxRulesDelegate();
  if (!profileTaxRules) {
    return {
      success: false,
      error:
        "Cliente Prisma desatualizado. Reinicie o servidor de desenvolvimento para carregar o novo schema.",
    };
  }

  try {
    const result = await profileTaxRules.deleteMany({
      where: { profileId },
    });
    if (!result || result.count === 0) {
      return { success: false, error: "Não há planilha vinculada para remover." };
    }
    revalidatePath("/settings");
    return { success: true, message: "Planilha tributária removida da empresa." };
  } catch (error) {
    // P2025: registro não encontrado
    const maybeCode = (error as { code?: string })?.code;
    if (maybeCode === "P2025") {
      return { success: false, error: "Não há planilha vinculada para remover." };
    }
    console.error("Erro ao remover planilha tributária", error);
    return { success: false, error: "Falha ao remover planilha tributária." };
  }
}
