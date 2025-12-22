"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import type { Scenario } from "@prisma/client";
import { getCurrentUser, canAccessProfile } from "@/lib/auth-helper";
import {
  emitenteSchema,
  destinatarioSchema,
  produtoSchema,
  impostoSchema,
  scenarioSchema,
} from "@/lib/scenario-schemas";
import type { SaveScenarioInput } from "@/lib/scenario-types";

/**
 * Cria ou atualiza um cenário de manipulação de XML, incluindo emitente,
 * destinatário, produtos, impostos, mapeamentos de CST e regras de reforma tributária.
 */
export async function saveScenario(data: SaveScenarioInput) {
  // Verificar autenticação e permissão
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, error: "Usuário não autenticado" };
  }

  if (!currentUser.permissions.canManageScenarios) {
    return { success: false, error: "Sem permissão para gerenciar cenários" };
  }

  // Verificar se o usuário tem acesso ao profile
  if (!canAccessProfile(currentUser, data.profileId)) {
    return {
      success: false,
      error: "Sem permissão para gerenciar cenários desta empresa",
    };
  }

  // Utilitário: parseia um JSON string ou retorna o objeto
  const parseMaybeJson = (v: unknown): Record<string, unknown> | undefined => {
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
  };

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

    // Flags do formulário
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

  try {
    // Usa transação para garantir atomicidade
    await db.$transaction(async (tx) => {
      // Cria ou atualiza o Scenario
      let scenarioRecord: Scenario;
      if (data.id) {
        scenarioRecord = await tx.scenario.update({
          where: { id: data.id },
          data: payload as Prisma.ScenarioUpdateInput,
        });
      } else {
        scenarioRecord = await tx.scenario.create({
          data: payload as Prisma.ScenarioCreateInput,
        });
      }

      const scenarioId = scenarioRecord.id;

      // Persistir emitente normalizado
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

      // Persistir destinatário normalizado
      if (destinatarioObj) {
        const parsedDestinatario =
          destinatarioSchema.safeParse(destinatarioObj);
        if (parsedDestinatario.success) {
          await tx.scenarioDestinatario.upsert({
            where: { scenarioId },
            create: { scenarioId, ...parsedDestinatario.data },
            update: parsedDestinatario.data,
          });
        }
      }

      // Persistir produtos (array)
      if (produtoObj && Array.isArray(produtoObj)) {
        // Remove produtos existentes
        await tx.scenarioProduto.deleteMany({ where: { scenarioId } });

        // Cria novos produtos
        const validProdutos = produtoObj
          .map((p) => produtoSchema.safeParse(p))
          .filter((result) => result.success)
          .map((result) => (result.success ? result.data : null))
          .filter((data): data is NonNullable<typeof data> => data !== null);

        if (validProdutos.length > 0) {
          await tx.scenarioProduto.createMany({
            data: validProdutos.map((p) => ({
              scenarioId,
              ...p,
            })),
          });
        }
      } else if (produtoObj && !Array.isArray(produtoObj)) {
        // Compatibilidade com formato antigo (objeto único)
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

      // Persistir impostos padrão
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

      // Persistir cstMappings (substitui os anteriores)
      if (data.cstMappings && Array.isArray(data.cstMappings)) {
        // remover mapeamentos antigos e inserir os novos
        await tx.cstMapping.deleteMany({ where: { scenarioId } });
        // createMany aceita um array de objetos
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

      // Persistir TaxReformRule (regras de Reforma Tributária IBS/CBS)
      if (data.taxReformRule && payload.reforma_tributaria) {
        const taxRule = data.taxReformRule;
        // Remove regras antigas e cria nova (apenas 1 regra por cenário)
        await tx.taxReformRule.deleteMany({ where: { scenarioId } });

        // Só cria se houver pelo menos uma alíquota preenchida
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
        // Se a flag foi desativada, remove as regras existentes
        await tx.taxReformRule.deleteMany({ where: { scenarioId } });
      }

      return scenarioId;
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Erro ao salvar cenário:", error);
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

  // Verificar autenticação e permissão
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, error: "Usuário não autenticado" };
  }

  if (!currentUser.permissions.canManageScenarios) {
    return { success: false, error: "Sem permissão para gerenciar cenários" };
  }

  try {
    // Buscar o cenário para verificar o profileId
    const scenario = await db.scenario.findUnique({
      where: { id: scenarioId },
      select: { profileId: true },
    });

    if (!scenario) {
      return { success: false, error: "Cenário não encontrado" };
    }

    // Verificar se o usuário tem acesso ao profile do cenário
    if (!canAccessProfile(currentUser, scenario.profileId)) {
      return {
        success: false,
        error: "Sem permissão para deletar cenários desta empresa",
      };
    }

    // Soft delete - marca como deletado ao invés de remover permanentemente
    await db.scenario.update({
      where: { id: scenarioId },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/settings");
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Erro ao deletar cenário:", error);
    return { success: false, error: "Erro ao deletar cenário" };
  }
}
