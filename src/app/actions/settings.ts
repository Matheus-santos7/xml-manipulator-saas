"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Scenario, Prisma } from "@prisma/client";

// --- Schema de Validação do Cenário ---
const scenarioSchema = z.object({
  id: z.string().optional(),
  profileId: z.string(),
  name: z.string().min(3, "Nome deve ter pelo menos 3 letras"),
  active: z.boolean().default(true),
  // Flags
  editar_data: z.boolean().optional(),
  alterar_serie: z.boolean().optional(),
  alterar_cUF: z.boolean().optional(),
  editar_emitente: z.boolean().optional(),
  editar_destinatario: z.boolean().optional(),
  editar_produtos: z.boolean().optional(),
  editar_impostos: z.boolean().optional(),
  editar_refNFe: z.boolean().optional(),
  editar_cst: z.boolean().optional(),
  reforma_tributaria: z.boolean().optional(),
  zerar_ipi_remessa_retorno: z.boolean().optional(),
  zerar_ipi_venda: z.boolean().optional(),
  aplicar_reducao_aliq: z.boolean().optional(),
  // Dados Básicos
  nova_data: z.string().optional(),
  nova_serie: z.string().optional(),
  novo_cUF: z.string().optional(),
  // Permitir JSONs como string no form e converter depois
  emitente: z.string().optional(),
});

export async function saveProfile(data: FormData) {
  const name = data.get("name") as string;
  const cnpj = data.get("cnpj") as string;

  // Em produção, pegue o workspaceId da sessão do usuário!
  // Aqui vamos pegar o primeiro workspace ou criar um dummy para teste
  let workspace = await db.workspace.findFirst();
  if (!workspace) {
    workspace = await db.workspace.create({
      data: { name: "Default", slug: "default" },
    });
  }

  await db.profile.create({
    data: {
      name,
      cnpj,
      workspaceId: workspace.id,
    },
  });
  revalidatePath("/dashboard/configuracoes");
}

export type SaveScenarioInput = z.infer<typeof scenarioSchema> & {
  emitente?: string | Record<string, unknown>;
  emitenteData?: Record<string, unknown>;
  produto_padrao?: string | Record<string, unknown>;
  produtoData?: Record<string, unknown>;
  impostos_padrao?: string | Record<string, unknown>;
  impostosData?: Record<string, unknown>;
  destinatario?: string | Record<string, unknown>;
  destinatarioData?: Record<string, unknown>;
  cstMappings?: Array<{
    cfop: string;
    icms?: string;
    ipi?: string;
    pis?: string;
    cofins?: string;
  }>;
};

export async function saveScenario(data: SaveScenarioInput) {
  // Utilitário: parseia um JSON string ou retorna o objeto
  const parseMaybeJson = (v: unknown): Record<string, unknown> | undefined => {
    if (v == null) return undefined;
    if (typeof v === "string") {
      try {
        return JSON.parse(v) as Record<string, unknown>;
      } catch (e) {
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
    editar_destinatario: !!data.editar_destinatario,
    zerar_ipi_remessa_retorno: !!data.zerar_ipi_remessa_retorno,
    zerar_ipi_venda: !!data.zerar_ipi_venda,
    aplicar_reducao_aliq: !!data.aplicar_reducao_aliq,
  };

  // Cria ou atualiza o Scenario
  let scenarioRecord: Scenario;
  if (data.id) {
    scenarioRecord = await db.scenario.update({
      where: { id: data.id },
      data: payload as Prisma.ScenarioUpdateInput,
    });
  } else {
    scenarioRecord = await db.scenario.create({
      data: payload as Prisma.ScenarioCreateInput,
    });
  }

  const scenarioId = scenarioRecord.id;

  // Persistir emitente normalizado
  if (emitenteObj) {
    const e = {
      cnpj: emitenteObj.CNPJ ?? emitenteObj.cnpj,
      xNome: emitenteObj.xNome,
      xLgr: emitenteObj.xLgr,
      nro: emitenteObj.nro,
      xCpl: emitenteObj.xCpl,
      xBairro: emitenteObj.xBairro,
      xMun: emitenteObj.xMun,
      UF: emitenteObj.UF,
      CEP: emitenteObj.CEP,
      fone: emitenteObj.fone,
      IE: emitenteObj.IE,
    };
    await db.scenarioEmitente.upsert({
      where: { scenarioId },
      create: { scenarioId, ...e },
      update: { ...e },
    });
  }

  // Persistir destinatário normalizado
  if (destinatarioObj) {
    const d = {
      tipoPessoa: destinatarioObj.tipoPessoa,
      cnpj: destinatarioObj.CNPJ ?? destinatarioObj.cnpj,
      cpf: destinatarioObj.cpf,
      xNome: destinatarioObj.xNome,
      IE: destinatarioObj.IE,
      xLgr: destinatarioObj.xLgr,
      nro: destinatarioObj.nro,
      xBairro: destinatarioObj.xBairro,
      xMun: destinatarioObj.xMun,
      UF: destinatarioObj.UF,
      CEP: destinatarioObj.CEP,
      fone: destinatarioObj.fone,
    };
    await db.scenarioDestinatario.upsert({
      where: { scenarioId },
      create: { scenarioId, ...d },
      update: { ...d },
    });
  }

  // Persistir produto padrão
  if (produtoObj) {
    const p = {
      xProd: produtoObj.xProd,
      cEAN: produtoObj.cEAN,
      cProd: produtoObj.cProd,
      NCM: produtoObj.NCM,
      CEST: produtoObj.CEST,
      EXTIPI: produtoObj.EXTIPI,
      CFOP: produtoObj.CFOP,
    };
    await db.scenarioProduto.upsert({
      where: { scenarioId },
      create: { scenarioId, ...p },
      update: { ...p },
    });
  }

  // Persistir impostos padrão
  if (impostosObj) {
    const i = {
      pFCP: impostosObj.pFCP,
      pICMS: impostosObj.pICMS,
      pICMSUFDest: impostosObj.pICMSUFDest,
      pICMSInter: impostosObj.pICMSInter,
      pPIS: impostosObj.pPIS,
      pCOFINS: impostosObj.pCOFINS,
      pIPI: impostosObj.pIPI,
    };
    await db.scenarioImposto.upsert({
      where: { scenarioId },
      create: { scenarioId, ...i },
      update: { ...i },
    });
  }

  // Persistir cstMappings (substitui os anteriores)
  if (data.cstMappings && Array.isArray(data.cstMappings)) {
    // remover mapeamentos antigos e inserir os novos
    await db.cstMapping.deleteMany({ where: { scenarioId } });
    // createMany aceita um array de objetos
    const toCreate = data.cstMappings.map((m) => ({
      scenarioId,
      cfop: m.cfop,
      icms: m.icms || undefined,
      ipi: m.ipi || undefined,
      pis: m.pis || undefined,
      cofins: m.cofins || undefined,
    }));
    if (toCreate.length > 0) {
      await db.cstMapping.createMany({ data: toCreate });
    }
  }

  revalidatePath("/dashboard/configuracoes");
  revalidatePath("/configuracoes");
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Deletar Cenário
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteScenario(scenarioId: string) {
  if (!scenarioId) {
    return { success: false, error: "ID do cenário não informado" };
  }

  try {
    // As relações com onDelete: Cascade cuidam das tabelas filhas
    await db.scenario.delete({
      where: { id: scenarioId },
    });

    revalidatePath("/dashboard/configuracoes");
    revalidatePath("/configuracoes");
    return { success: true };
  } catch (error) {
    console.error("Erro ao deletar cenário:", error);
    return { success: false, error: "Erro ao deletar cenário" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Deletar Empresa (Profile)
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteProfile(profileId: string) {
  if (!profileId) {
    return { success: false, error: "ID da empresa não informado" };
  }

  try {
    // Primeiro deletar todos os cenários da empresa (e suas relações em cascata)
    await db.scenario.deleteMany({
      where: { profileId },
    });

    // Depois deletar a empresa
    await db.profile.delete({
      where: { id: profileId },
    });

    revalidatePath("/dashboard/configuracoes");
    revalidatePath("/configuracoes");
    return { success: true };
  } catch (error) {
    console.error("Erro ao deletar empresa:", error);
    return { success: false, error: "Erro ao deletar empresa" };
  }
}
