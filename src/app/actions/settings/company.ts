"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import type { UpdateProfileInput } from "@/lib/scenarios";
import { logger } from "@/lib/logging";

/**
 * Cria um novo profile de empresa no workspace do usuário autenticado.
 */
export async function saveProfile(data: FormData) {
  const name = data.get("name") as string;
  const cnpj = data.get("cnpj") as string;

  // Obter usuário autenticado
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    throw new Error("Usuário não autenticado");
  }

  if (!currentUser.workspaceId) {
    throw new Error("Usuário sem workspace associado");
  }

  await db.profile.create({
    data: {
      name,
      cnpj,
      workspaceId: currentUser.workspaceId,
    },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/settings");
}

/**
 * Atualiza os dados cadastrais de uma empresa (profile), incluindo CNPJ e endereço.
 */
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

    revalidatePath("/dashboard/settings");
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    logger.error("Failed to update company profile", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      profileId: data.id,
    });
    return { success: false, error: "Erro ao atualizar empresa" };
  }
}

/**
 * Busca um profile de empresa pelo ID, ignorando registros marcados como deletados.
 */
export async function getProfileById(profileId: string) {
  if (!profileId) {
    return null;
  }

  try {
    const profile = await db.profile.findUnique({
      where: {
        id: profileId,
        deletedAt: null, // Filtrar registros não deletados
      },
    });

    return profile;
  } catch (error) {
    logger.error("Failed to fetch company profile", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      profileId,
    });
    return null;
  }
}

/**
 * Realiza soft delete de um profile de empresa e de todos os cenários associados.
 */
export async function deleteProfile(profileId: string) {
  if (!profileId) {
    return { success: false, error: "ID da empresa não informado" };
  }

  try {
    // Soft delete dos cenários da empresa
    await db.scenario.updateMany({
      where: { profileId },
      data: { deletedAt: new Date() },
    });

    // Soft delete da empresa
    await db.profile.update({
      where: { id: profileId },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    logger.error("Failed to delete company profile", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      profileId,
    });
    return { success: false, error: "Erro ao deletar empresa" };
  }
}
