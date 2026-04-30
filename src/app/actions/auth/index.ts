"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createSession, endSession, getSession } from "@/lib/auth";

function createUserContext(user: {
  id: string;
  email?: string | null;
  workspaceId?: string;
}) {
  return {
    userId: user.id,
    email: user.email || undefined,
    workspaceId: user.workspaceId,
  };
}

function logAuthEvent(
  event:
    | "login_success"
    | "login_failure"
    | "logout"
    | "session_created"
    | "session_expired",
  context: Record<string, unknown>
) {
  console.info(`[auth:${event}]`, context);
}

async function bootstrapIfEmptyDatabase(email: string, password?: string) {
  const [userCount, workspaceCount] = await Promise.all([
    db.user.count(),
    db.workspace.count(),
  ]);

  if (userCount > 0 || workspaceCount > 0) {
    return null;
  }

  if (!password) {
    return null;
  }

  const workspace = await db.workspace.create({
    data: {
      name: "Workspace Principal",
      slug: "workspace-principal",
    },
  });

  const user = await db.user.create({
    data: {
      email: email.toLowerCase(),
      name: "Administrador",
      role: "admin",
      password: await bcrypt.hash(password, 10),
    },
  });

  await db.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      role: "admin",
    },
  });

  return user;
}

function isMissingColumnError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2022"
  );
}

type LoginUser = {
  id: string;
  name: string | null;
  email: string | null;
  password: string | null;
  role: string;
};

async function findUserForLogin(email: string): Promise<LoginUser | null> {
  return db.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      name: true,
      email: true,
      password: true,
      role: true,
    },
  });
}

async function findWorkspaceMembershipCount(userId: string): Promise<number> {
  try {
    return await db.workspaceMember.count({
      where: {
        userId,
        deletedAt: null,
      },
    });
  } catch (error) {
    if (isMissingColumnError(error)) {
      return db.workspaceMember.count({
        where: { userId },
      });
    }
    throw error;
  }
}

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

    // Buscar usuário (sem incluir relações para evitar quebra em bancos legados)
    let user = await findUserForLogin(email);

    // Banco vazio (ambiente de teste novo): bootstrap automático no primeiro login.
    if (!user) {
      const bootstrappedUser = await bootstrapIfEmptyDatabase(email, password);
      if (bootstrappedUser) {
        user = await findUserForLogin(email);
      }
    }

    let hasWorkspace = user ? (await findWorkspaceMembershipCount(user.id)) > 0 : false;
    const isSystemAdmin = user?.role === "admin";

    // Ambiente de teste/bootstrap: tenta vincular o usuário ao primeiro workspace disponível
    // para evitar bloqueio de login quando o usuário existe mas ainda não foi associado.
    if (user && !hasWorkspace && !isSystemAdmin) {
      let defaultWorkspace: { id: string } | null = null;
      try {
        defaultWorkspace = await db.workspace.findFirst({
          where: { deletedAt: null },
          select: { id: true },
        });
      } catch (error) {
        if (isMissingColumnError(error)) {
          defaultWorkspace = await db.workspace.findFirst({
            select: { id: true },
          });
        } else {
          throw error;
        }
      }

      if (defaultWorkspace) {
        try {
          await db.workspaceMember.create({
            data: {
              workspaceId: defaultWorkspace.id,
              userId: user.id,
              role: "member",
            },
          });
          hasWorkspace = true;
          logAuthEvent("session_created", {
            userId: user.id,
            workspaceId: defaultWorkspace.id,
            reason: "auto_association_on_login",
          });
        } catch (associationError) {
          console.warn(
            "Falha ao associar usuário ao workspace automaticamente",
            { userId: user.id },
            associationError
          );
        }
      }
    }

    if (!user || (!hasWorkspace && !isSystemAdmin)) {
      logAuthEvent("login_failure", { email });
      return {
        success: false,
        error: "Usuário sem workspace associado. Solicite associação a uma empresa.",
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
    console.error("Erro no login", { email }, error as Error);
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
