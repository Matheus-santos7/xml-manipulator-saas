"use server";

import { db } from "@/app/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { revokeAllUserSessions, createSession } from "@/lib/auth";
import { logger } from "@/lib/logging";

/**
 * Busca os dados básicos do usuário atualmente autenticado (nome, email e indicação de senha).
 */
export async function getUserProfile() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: currentUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      password: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    hasPassword: !!user.password,
  };
}

interface UpdateProfileData {
  name?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

export async function updateUserProfile(data: UpdateProfileData) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Usuário não autenticado." };
    }

    // Buscar usuário completo
    const user = await db.user.findUnique({
      where: { id: currentUser.id },
      select: { id: true, name: true, email: true, password: true },
    });

    if (!user) {
      return { success: false, error: "Usuário não encontrado." };
    }

    const updateData: {
      name?: string;
      email?: string;
      password?: string | null;
    } = {};

    // Atualizar nome
    if (data.name && data.name !== user.name) {
      updateData.name = data.name;
    }

    // Atualizar email se mudou
    if (data.email && data.email.toLowerCase() !== user.email) {
      // Verificar se já existe outro usuário com esse email
      const exists = await db.user.findUnique({
        where: { email: data.email.toLowerCase() },
        select: { id: true },
      });

      if (exists && exists.id !== user.id) {
        return { success: false, error: "Email já está em uso." };
      }

      updateData.email = data.email.toLowerCase();
    }

    // Atualizar senha se fornecida
    if (data.newPassword) {
      // Se o usuário já tinha senha, exigir a senha atual
      if (user.password) {
        if (!data.currentPassword) {
          return { success: false, error: "Senha atual é obrigatória." };
        }

        const isValid = await bcrypt.compare(
          data.currentPassword,
          user.password
        );
        if (!isValid) {
          return { success: false, error: "Senha atual incorreta." };
        }
      }

      const hashed = await bcrypt.hash(data.newPassword, 10);
      updateData.password = hashed;
    }

    // Se não há alterações
    if (Object.keys(updateData).length === 0) {
      return { success: true };
    }

    await db.user.update({ where: { id: user.id }, data: updateData });

    // Se mudou a senha, revogar todas as sessões antigas por segurança
    if (updateData.password) {
      await revokeAllUserSessions(user.id);
      // Criar nova sessão para o usuário atual
      await createSession(user.id);
      logger.info("Password changed, all sessions revoked", {
        userId: user.id,
      });
    }

    // Se mudou o email, criar nova sessão
    if (updateData.email && !updateData.password) {
      await createSession(user.id);
    }

    // Revalidar páginas importantes
    revalidatePath("/");
    revalidatePath("/manipulador");
    revalidatePath("/settings");

    logger.info("User profile updated", {
      userId: user.id,
      changedFields: Object.keys(updateData),
    });

    return { success: true };
  } catch (error) {
    logger.error("Failed to update user profile", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { success: false, error: "Erro ao atualizar perfil." };
  }
}

export async function updateCurrentUser(
  email: string,
  newPassword?: string,
  currentPassword?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Atualiza email e/ou senha do usuário autenticado, reaproveitando as mesmas validações de updateUserProfile.
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Usuário não autenticado." };
    }

    // Buscar usuário completo
    const user = await db.user.findUnique({
      where: { id: currentUser.id },
      select: { id: true, email: true, password: true },
    });

    if (!user) {
      return { success: false, error: "Usuário não encontrado." };
    }

    const data: { email?: string; password?: string | null } = {};

    // Atualizar email se mudou
    if (email && email.toLowerCase() !== user.email) {
      // Verificar se já existe outro usuário com esse email
      const exists = await db.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true },
      });

      if (exists && exists.id !== user.id) {
        return { success: false, error: "Email já está em uso." };
      }

      data.email = email.toLowerCase();
    }

    // Atualizar senha se fornecida
    if (newPassword) {
      // Se o usuário já tinha senha, exigir a senha atual
      if (user.password) {
        if (!currentPassword) {
          return { success: false, error: "Senha atual é obrigatória." };
        }

        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
          return { success: false, error: "Senha atual incorreta." };
        }
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      data.password = hashed;
    }

    // Se não há alterações
    if (Object.keys(data).length === 0) {
      return { success: true };
    }

    await db.user.update({ where: { id: user.id }, data });

    // Se mudou a senha, revogar todas as sessões antigas por segurança
    if (data.password) {
      await revokeAllUserSessions(user.id);
      // Criar nova sessão para o usuário atual
      await createSession(user.id);
      logger.info("Password changed, all sessions revoked", {
        userId: user.id,
      });
    }

    // Se mudou o email, criar nova sessão
    if (data.email && !data.password) {
      await createSession(user.id);
    }

    // Revalidar páginas importantes
    revalidatePath("/");
    revalidatePath("/manipulador");
    revalidatePath("/settings");

    logger.info("User data updated", {
      userId: user.id,
      changedFields: Object.keys(data),
    });

    return { success: true };
  } catch (error) {
    logger.error("Failed to update current user", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { success: false, error: "Erro ao atualizar usuário." };
  }
}
