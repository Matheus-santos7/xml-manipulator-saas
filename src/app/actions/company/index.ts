"use server";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import type { CreateProfileInput, UpdateProfileInput } from "@/lib/scenarios";
import { logger } from "@/lib/logging";

/**
 * Cria um novo profile de empresa no workspace do usuário autenticado.
 * Aceita todos os dados da empresa (nome, CNPJ, razão social, endereço) para
 * que ao editar depois não precise buscar o CNPJ novamente.
 */
export async function saveProfile(data: CreateProfileInput) {
  const name = data.name?.trim();
  const cnpj = data.cnpj?.trim();

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, error: "Usuário não autenticado" };
  }

  if (!currentUser.workspaceId) {
    return { success: false, error: "Usuário sem workspace associado" };
  }

  if (!name || !cnpj) {
    return { success: false, error: "Nome e CNPJ são obrigatórios" };
  }

  try {
    const existing = await db.profile.findUnique({
      where: { cnpj },
    });

    if (existing) {
      if (existing.deletedAt) {
        await db.profile.update({
          where: { id: existing.id },
          data: {
            name,
            razaoSocial: data.razaoSocial || null,
            endereco: data.endereco ?? undefined,
            workspaceId: currentUser.workspaceId,
            deletedAt: null,
          },
        });

        revalidatePath("/settings");
        return { success: true };
      }

      return {
        success: false,
        error: "Já existe uma empresa cadastrada com este CNPJ.",
      };
    }

    await db.profile.create({
      data: {
        name,
        cnpj,
        razaoSocial: data.razaoSocial || null,
        endereco: data.endereco ?? undefined,
        workspaceId: currentUser.workspaceId,
      },
    });

    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "Já existe uma empresa cadastrada com este CNPJ.",
      };
    }

    logger.error("Failed to create company profile", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      cnpj,
      workspaceId: currentUser.workspaceId,
    });
    return { success: false, error: "Erro ao criar empresa" };
  }
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
        endereco: data.endereco ?? undefined,
      },
    });

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
