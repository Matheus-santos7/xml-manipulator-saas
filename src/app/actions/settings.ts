'use server'

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { z } from "zod"

// --- Schema de Validação do Cenário ---
const scenarioSchema = z.object({
  id: z.string().optional(),
  profileId: z.string(),
  name: z.string().min(3, "Nome deve ter pelo menos 3 letras"),
  active: z.boolean().default(true),
  // Flags
  editar_data: z.boolean(),
  alterar_serie: z.boolean(),
  alterar_cUF: z.boolean(),
  editar_emitente: z.boolean(),
  reforma_tributaria: z.boolean(),
  // Dados Básicos
  nova_data: z.string().optional(),
  nova_serie: z.string().optional(),
  novo_cUF: z.string().optional(),
  // Permitir JSONs como string no form e converter depois
  emitente: z.string().optional(), 
})

export async function saveProfile(data: FormData) {
  const name = data.get('name') as string
  const cnpj = data.get('cnpj') as string
  
  // Em produção, pegue o workspaceId da sessão do usuário!
  // Aqui vamos pegar o primeiro workspace ou criar um dummy para teste
  let workspace = await db.workspace.findFirst();
  if (!workspace) {
    workspace = await db.workspace.create({ data: { name: "Default", slug: "default" }})
  }

  await db.profile.create({
    data: {
      name,
      cnpj,
      workspaceId: workspace.id
    }
  })
  revalidatePath('/dashboard/configuracoes')
}

export async function saveScenario(data: any) {
  // Parsing dos JSONs stringificados
  const emitenteJson = data.emitente ? JSON.parse(data.emitente) : undefined;

  const payload: any = {
    profileId: data.profileId,
    name: data.name,
    active: data.active,
    editar_data: data.editar_data,
    alterar_serie: data.alterar_serie,
    alterar_cUF: data.alterar_cUF,
    editar_emitente: data.editar_emitente,
    reforma_tributaria: data.reforma_tributaria,
    nova_data: data.nova_data,
    nova_serie: data.nova_serie,
    novo_cUF: data.novo_cUF,
    emitente: emitenteJson,
    
    // Flags obrigatórias do schema que não pus no form para simplificar agora
    editar_produtos: false,
    editar_impostos: false,
    editar_refNFe: false,
    editar_cst: false,
    editar_destinatario: false,
    zerar_ipi_remessa_retorno: false,
    zerar_ipi_venda: false,
    aplicar_reducao_aliq: false,
  }

  if (data.id) {
    await db.scenario.update({ where: { id: data.id }, data: payload })
  } else {
    await db.scenario.create({ data: payload })
  }
  revalidatePath('/dashboard/configuracoes')
  return { success: true }
}