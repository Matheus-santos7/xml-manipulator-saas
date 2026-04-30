import { z } from "zod";

/**
 * Schema de validação para dados do emitente.
 * Aceita tanto 'cnpj' quanto 'CNPJ' e normaliza para 'cnpj'.
 */
export const emitenteSchema = z
  .object({
    cnpj: z.string().optional().nullable(),
    CNPJ: z.string().optional().nullable(),
    xNome: z.string().optional().nullable(),
    xLgr: z.string().optional().nullable(),
    nro: z.string().optional().nullable(),
    xCpl: z.string().optional().nullable(),
    xBairro: z.string().optional().nullable(),
    cMun: z.string().optional().nullable(),
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
    cMun: data.cMun,
    xMun: data.xMun,
    UF: data.UF,
    CEP: data.CEP,
    fone: data.fone,
    IE: data.IE,
  }));

/**
 * Schema de validação para dados do destinatário.
 * Suporta tanto CNPJ (PJ) quanto CPF (PF).
 */
export const destinatarioSchema = z
  .object({
    cnpj: z.string().optional().nullable(),
    CNPJ: z.string().optional().nullable(),
    cpf: z.string().optional().nullable(),
    CPF: z.string().optional().nullable(),
    centroDistribuicao: z.string().optional().nullable(),
    xNome: z.string().optional().nullable(),
    IE: z.string().optional().nullable(),
    xLgr: z.string().optional().nullable(),
    nro: z.string().optional().nullable(),
    xBairro: z.string().optional().nullable(),
    cMun: z.string().optional().nullable(),
    xMun: z.string().optional().nullable(),
    UF: z.string().optional().nullable(),
    CEP: z.string().optional().nullable(),
    fone: z.string().optional().nullable(),
  })
  .transform((data) => ({
    cnpj: data.cnpj ?? data.CNPJ,
    cpf: data.cpf ?? data.CPF,
    centroDistribuicao: data.centroDistribuicao,
    xNome: data.xNome,
    IE: data.IE,
    xLgr: data.xLgr,
    nro: data.nro,
    xBairro: data.xBairro,
    cMun: data.cMun,
    xMun: data.xMun,
    UF: data.UF,
    CEP: data.CEP,
    fone: data.fone,
  }));

/**
 * Schema de validação para dados de produto.
 */
export const produtoSchema = z.object({
  xProd: z.string().optional().nullable(),
  cEAN: z.string().optional().nullable(),
  cProd: z.string().optional().nullable(),
  NCM: z.string().optional().nullable(),
  regraTributariaNome: z.string().optional().nullable(),
  origem: z.string().optional().nullable(), // Origem do produto: "0", "1", "2", "3", "4", "6", "7", "8"
  vUnComVenda: z.string().optional().nullable(),
  vUnComTransferencia: z.string().optional().nullable(),
  pesoBruto: z.string().optional().nullable(),
  pesoLiquido: z.string().optional().nullable(),
  isPrincipal: z.boolean().default(false),
  ordem: z.number().default(0),
});

/**
 * Schema de validação do cenário de manipulação de XML.
 * Define os campos de configuração de um cenário.
 */
export const scenarioSchema = z.object({
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
  editar_destinatario_remessa: z.boolean().optional(),
  destinatarioRemessaMlCdId: z.string().optional().nullable(),
  editar_produtos: z.boolean().optional(),
  aplicar_regras_tributarias: z.boolean().optional(),
  editar_refNFe: z.boolean().optional(),
  // Dados Básicos
  nova_data: z.string().optional(),
  nova_serie: z.string().optional(),
  novo_cUF: z.string().optional(),
  // Permitir JSONs como string no form e converter depois
  emitente: z.string().optional(),
});
