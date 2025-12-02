"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import type { Scenario } from "@prisma/client";
import { getCurrentUser, canAccessProfile } from "@/lib/auth-helper";

// --- Sub-schemas de Validação ---
const emitenteSchema = z
  .object({
    cnpj: z.string().optional().nullable(),
    CNPJ: z.string().optional().nullable(),
    xNome: z.string().optional().nullable(),
    xLgr: z.string().optional().nullable(),
    nro: z.string().optional().nullable(),
    xCpl: z.string().optional().nullable(),
    xBairro: z.string().optional().nullable(),
    xMun: z.string().optional().nullable(),
    UF: z.string().optional().nullable(),
    CEP: z.string().optional().nullable(),
    fone: z.string().optional().nullable(),
    IE: z.string().optional().nullable(),
  })
  .transform((data) => ({
    cnpj: data.cnpj ?? data.CNPJ,
    xNome: data.xNome,
    xLgr: data.xLgr,
    nro: data.nro,
    xCpl: data.xCpl,
    xBairro: data.xBairro,
    xMun: data.xMun,
    UF: data.UF,
    CEP: data.CEP,
    fone: data.fone,
    IE: data.IE,
  }));

const destinatarioSchema = z
  .object({
    cnpj: z.string().optional().nullable(),
    CNPJ: z.string().optional().nullable(),
    cpf: z.string().optional().nullable(),
    CPF: z.string().optional().nullable(),
    xNome: z.string().optional().nullable(),
    IE: z.string().optional().nullable(),
    xLgr: z.string().optional().nullable(),
    nro: z.string().optional().nullable(),
    xBairro: z.string().optional().nullable(),
    xMun: z.string().optional().nullable(),
    UF: z.string().optional().nullable(),
    CEP: z.string().optional().nullable(),
    fone: z.string().optional().nullable(),
  })
  .transform((data) => ({
    cnpj: data.cnpj ?? data.CNPJ,
    cpf: data.cpf ?? data.CPF,
    xNome: data.xNome,
    IE: data.IE,
    xLgr: data.xLgr,
    nro: data.nro,
    xBairro: data.xBairro,
    xMun: data.xMun,
    UF: data.UF,
    CEP: data.CEP,
    fone: data.fone,
  }));

const produtoSchema = z.object({
  xProd: z.string().optional().nullable(),
  cEAN: z.string().optional().nullable(),
  cProd: z.string().optional().nullable(),
  NCM: z.string().optional().nullable(),
  isPrincipal: z.boolean().default(false),
  ordem: z.number().default(0),
});

const impostoSchema = z.object({
  pFCP: z.string().optional().nullable(),
  pICMS: z.string().optional().nullable(),
  pICMSUFDest: z.string().optional().nullable(),
  pICMSInter: z.string().optional().nullable(),
  pPIS: z.string().optional().nullable(),
  pCOFINS: z.string().optional().nullable(),
  pIPI: z.string().optional().nullable(),
});

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
  editar_destinatario_pj: z.boolean().optional(),
  editar_destinatario_pf: z.boolean().optional(),
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

// ─────────────────────────────────────────────────────────────────────────────
// Atualizar Empresa (Profile)
// ─────────────────────────────────────────────────────────────────────────────
export interface UpdateProfileInput {
  id: string;
  name: string;
  cnpj: string;
  razaoSocial?: string;
  endereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
  };
}

export async function updateProfile(data: UpdateProfileInput) {
  if (!data.id) {
    return { success: false, error: "ID da empresa não informado" };
  }

  try {
    // Verifica se a empresa existe
    const existingProfile = await db.profile.findUnique({
      where: { id: data.id },
    });

    if (!existingProfile) {
      return { success: false, error: "Empresa não encontrada" };
    }

    // Verifica se o CNPJ já existe em outra empresa
    if (data.cnpj && data.cnpj !== existingProfile.cnpj) {
      const cnpjExists = await db.profile.findUnique({
        where: { cnpj: data.cnpj },
      });

      if (cnpjExists && cnpjExists.id !== data.id) {
        return { success: false, error: "CNPJ já cadastrado em outra empresa" };
      }
    }

    await db.profile.update({
      where: { id: data.id },
      data: {
        name: data.name,
        cnpj: data.cnpj,
        razaoSocial: data.razaoSocial || null,
        endereco: data.endereco ? data.endereco : Prisma.DbNull,
      },
    });

    revalidatePath("/dashboard/configuracoes");
    revalidatePath("/configuracoes");
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar empresa:", error);
    return { success: false, error: "Erro ao atualizar empresa" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Buscar Empresa por ID
// ─────────────────────────────────────────────────────────────────────────────
export async function getProfileById(profileId: string) {
  if (!profileId) {
    return null;
  }

  try {
    const profile = await db.profile.findUnique({
      where: { id: profileId },
    });

    return profile;
  } catch (error) {
    console.error("Erro ao buscar empresa:", error);
    return null;
  }
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
    tipoOperacao: "VENDA" | "DEVOLUCAO" | "RETORNO" | "REMESSA";
    icms?: string;
    ipi?: string;
    pis?: string;
    cofins?: string;
  }>;
};

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
    editar_destinatario_pj: !!data.editar_destinatario_pj,
    editar_destinatario_pf: !!data.editar_destinatario_pf,
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
    const parsedEmitente = emitenteSchema.safeParse(emitenteObj);
    if (parsedEmitente.success) {
      await db.scenarioEmitente.upsert({
        where: { scenarioId },
        create: { scenarioId, ...parsedEmitente.data },
        update: parsedEmitente.data,
      });
    }
  }

  // Persistir destinatário normalizado
  if (destinatarioObj) {
    const parsedDestinatario = destinatarioSchema.safeParse(destinatarioObj);
    if (parsedDestinatario.success) {
      await db.scenarioDestinatario.upsert({
        where: { scenarioId },
        create: { scenarioId, ...parsedDestinatario.data },
        update: parsedDestinatario.data,
      });
    }
  }

  // Persistir produtos (array)
  if (produtoObj && Array.isArray(produtoObj)) {
    // Remove produtos existentes
    await db.scenarioProduto.deleteMany({ where: { scenarioId } });

    // Cria novos produtos
    const validProdutos = produtoObj
      .map((p) => produtoSchema.safeParse(p))
      .filter((result) => result.success)
      .map((result) => (result.success ? result.data : null))
      .filter((data): data is NonNullable<typeof data> => data !== null);

    if (validProdutos.length > 0) {
      await db.scenarioProduto.createMany({
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
      await db.scenarioProduto.deleteMany({ where: { scenarioId } });
      await db.scenarioProduto.create({
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
      await db.scenarioImposto.upsert({
        where: { scenarioId },
        create: { scenarioId, ...parsedImposto.data },
        update: parsedImposto.data,
      });
    }
  }

  // Persistir cstMappings (substitui os anteriores)
  if (data.cstMappings && Array.isArray(data.cstMappings)) {
    // remover mapeamentos antigos e inserir os novos
    await db.cstMapping.deleteMany({ where: { scenarioId } });
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

    // As relações com onDelete: Cascade cuidam das tabelas filhas
    await db.scenario.delete({
      where: { id: scenarioId },
    });

    revalidatePath("/dashboard/configuracoes");
    revalidatePath("/configuracoes");
    revalidatePath("/settings");
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
