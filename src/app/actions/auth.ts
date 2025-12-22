"use server";

import { redirect } from "next/navigation";
import { db } from "@/app/lib/db";
import bcrypt from "bcryptjs";
import { createSession, endSession, getSession } from "@/lib/session";
import { logger, logAuthEvent, createUserContext } from "@/lib/logger";

/**
 * Efetua o login do usuário a partir de email e senha.
 * Valida credenciais (quando houver senha cadastrada) e grava o cookie de sessão.
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
      logAuthEvent("login_failure", { email });
      return {
        success: false,
        error: "Usuário não encontrado ou sem workspace associado",
      };
    }

    // Se o usuário tem senha configurada, validar
    if (user.password) {
      if (!password) {
        logAuthEvent("login_failure", { email, userId: user.id });
        return { success: false, error: "Senha é obrigatória" };
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        logAuthEvent("login_failure", { email, userId: user.id });
        return { success: false, error: "Senha incorreta" };
      }
    }

    // Criar sessão no banco de dados
    await createSession(user.id);

    logAuthEvent("login_success", createUserContext(user));

    return { success: true };
  } catch (error) {
    logger.error("Erro no login", { email }, error as Error);
    return { success: false, error: "Erro ao realizar login" };
  }
}

/**
 * Encerra a sessão do usuário autenticado removendo a sessão do banco e redirecionando para /login.
 */
export async function logoutAction() {
  await endSession();
  redirect("/login");
}

/**
 * Verifica se existe uma sessão válida para o usuário atual.
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return !!session;
}

/**
 * Retorna o email do usuário autenticado a partir da sessão, ou null caso não haja sessão ativa.
 */
export async function getAuthenticatedUserEmail(): Promise<string | null> {
  const session = await getSession();
  return session?.user.email || null;
}
