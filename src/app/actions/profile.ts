"use server";

import { db } from "@/app/lib/db";
import { getCurrentUser } from "@/lib/auth-helper";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

const AUTH_COOKIE = "xml-saas-user";

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

    // Se mudou o email, atualizar cookie de sessão
    if (updateData.email) {
      const cookieStore = await cookies();
      cookieStore.set(AUTH_COOKIE, updateData.email, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    // Revalidar páginas importantes
    revalidatePath("/");
    revalidatePath("/manipulador");
    revalidatePath("/configuracoes");

    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    return { success: false, error: "Erro ao atualizar perfil." };
  }
}

export async function updateCurrentUser(
  email: string,
  newPassword?: string,
  currentPassword?: string
): Promise<{ success: boolean; error?: string }> {
  try {
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

    // Se mudou o email, atualizar cookie de sessão
    if (data.email) {
      const cookieStore = await cookies();
      cookieStore.set(AUTH_COOKIE, data.email, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    // Revalidar páginas importantes
    revalidatePath("/");
    revalidatePath("/manipulador");
    revalidatePath("/configuracoes");

    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    return { success: false, error: "Erro ao atualizar usuário." };
  }
}
