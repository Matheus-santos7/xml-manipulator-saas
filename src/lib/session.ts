/**
 * Sistema de gerenciamento de sessão robusto usando banco de dados.
 * Substitui o cookie baseado em email por sessionToken seguro.
 */

import { db } from "@/app/lib/db";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { AUTH_COOKIE, AUTH_COOKIE_OPTIONS } from "./auth-constants";
import { logger, logAuthEvent } from "./logger";

// Duração padrão da sessão (7 dias em milissegundos)
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Gera um token de sessão seguro e único
 */
function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Cria uma nova sessão no banco de dados para o usuário
 */
export async function createSession(userId: string): Promise<string> {
  try {
    const sessionToken = generateSessionToken();
    const expires = new Date(Date.now() + SESSION_DURATION_MS);

    await db.session.create({
      data: {
        sessionToken,
        userId,
        expires,
      },
    });

    // Armazenar sessionToken no cookie
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE, sessionToken, AUTH_COOKIE_OPTIONS);

    // Log da criação de sessão
    logAuthEvent("session_created", { userId, sessionId: sessionToken });

    return sessionToken;
  } catch (error) {
    logger.error("Erro ao criar sessão", { userId }, error as Error);
    throw new Error("Falha ao criar sessão");
  }
}

/**
 * Valida e retorna a sessão ativa do cookie
 */
export async function getSession(): Promise<{
  session: { id: string; sessionToken: string; userId: string; expires: Date };
  user: { id: string; email: string | null; name: string | null };
} | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(AUTH_COOKIE)?.value;

    if (!sessionToken) {
      return null;
    }

    // Buscar sessão no banco com dados do usuário
    const session = await db.session.findUnique({
      where: { sessionToken },
      include: {
        User: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });

    if (!session) {
      // Token inválido - apenas retorna null
      // Não podemos deletar o cookie em Server Components
      return null;
    }

    // Verificar se a sessão expirou
    if (session.expires < new Date()) {
      await deleteSession(sessionToken);
      logAuthEvent("session_expired", {
        userId: session.userId,
        sessionId: sessionToken,
      });
      // Sessão expirada - apenas retorna null
      return null;
    }

    return {
      session: {
        id: session.id,
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires,
      },
      user: session.User,
    };
  } catch (error) {
    logger.error("Erro ao validar sessão", {}, error as Error);
    return null;
  }
}

/**
 * Deleta uma sessão específica do banco
 */
export async function deleteSession(sessionToken: string): Promise<void> {
  try {
    await db.session.delete({
      where: { sessionToken },
    });
  } catch {
    // Sessão já foi deletada ou não existe
    logger.debug("Sessão não encontrada para deletar", {
      sessionId: sessionToken,
    });
  }
}

/**
 * Remove o cookie de sessão
 */
export async function deleteSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
}

/**
 * Encerra a sessão atual (logout)
 */
export async function endSession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_COOKIE)?.value;

  if (sessionToken) {
    const session = await db.session.findUnique({
      where: { sessionToken },
      select: { userId: true },
    });

    await deleteSession(sessionToken);

    if (session) {
      logAuthEvent("logout", {
        userId: session.userId,
        sessionId: sessionToken,
      });
    }
  }

  await deleteSessionCookie();
}

/**
 * Renova a expiração de uma sessão (útil para keep-alive)
 */
export async function renewSession(sessionToken: string): Promise<void> {
  try {
    const newExpires = new Date(Date.now() + SESSION_DURATION_MS);

    await db.session.update({
      where: { sessionToken },
      data: { expires: newExpires },
    });

    logger.debug("Sessão renovada", { sessionId: sessionToken });
  } catch (error) {
    logger.warn(
      "Erro ao renovar sessão",
      { sessionId: sessionToken },
      error as Error
    );
  }
}

/**
 * Limpa sessões expiradas do banco (pode ser executado periodicamente)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await db.session.deleteMany({
      where: {
        expires: {
          lt: new Date(),
        },
      },
    });

    logger.info("Sessões expiradas limpas", { count: result.count });
    return result.count;
  } catch (error) {
    logger.error("Erro ao limpar sessões expiradas", {}, error as Error);
    return 0;
  }
}

/**
 * Lista todas as sessões ativas de um usuário
 */
export async function getUserSessions(userId: string) {
  try {
    return await db.session.findMany({
      where: {
        userId,
        expires: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        sessionToken: true,
        expires: true,
      },
      orderBy: {
        expires: "desc",
      },
    });
  } catch (error) {
    logger.error(
      "Erro ao buscar sessões do usuário",
      { userId },
      error as Error
    );
    return [];
  }
}

/**
 * Revoga todas as sessões de um usuário (útil para mudança de senha)
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  try {
    const result = await db.session.deleteMany({
      where: { userId },
    });

    logger.info("Todas as sessões do usuário foram revogadas", {
      userId,
      count: result.count,
    });
  } catch (error) {
    logger.error(
      "Erro ao revogar sessões do usuário",
      { userId },
      error as Error
    );
  }
}
