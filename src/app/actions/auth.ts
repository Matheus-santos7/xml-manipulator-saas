"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/app/lib/db";
import bcrypt from "bcryptjs";

const AUTH_COOKIE = "xml-saas-user";

/**
 * Realiza login do usuário
 * Suporta login com senha (se configurada) ou sem senha (para desenvolvimento)
 */
export async function loginAction(
  email: string,
  password?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!email) {
      return { success: false, error: "Email é obrigatório" };
    }

    // Buscar usuário e workspace member
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
        WorkspaceMember: {
          include: {
            Workspace: true,
          },
        },
      },
    });

    const hasWorkspace =
      user?.WorkspaceMember && user.WorkspaceMember.length > 0;
    const isSystemAdmin = user?.role === "admin";

    if (!user || (!hasWorkspace && !isSystemAdmin)) {
      return {
        success: false,
        error: "Usuário não encontrado ou sem workspace associado",
      };
    }

    // Se o usuário tem senha configurada, validar
    if (user.password) {
      if (!password) {
        return { success: false, error: "Senha é obrigatória" };
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return { success: false, error: "Senha incorreta" };
      }
    }

    // Salvar email no cookie (simulação de sessão)
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE, email.toLowerCase(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 dias
    });

    return { success: true };
  } catch (error) {
    console.error("Erro no login:", error);
    return { success: false, error: "Erro ao realizar login" };
  }
}

/**
 * Realiza logout do usuário
 */
export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
  redirect("/login");
}

/**
 * Verifica se usuário está autenticado
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const userEmail = cookieStore.get(AUTH_COOKIE);
  return !!userEmail?.value;
}

/**
 * Obtém email do usuário autenticado
 */
export async function getAuthenticatedUserEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const userEmail = cookieStore.get(AUTH_COOKIE);
  return userEmail?.value || null;
}
