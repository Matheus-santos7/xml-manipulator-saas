import type { LogContext } from "./logger";

/**
 * Helper para criar contexto de log a partir de um usuário
 */
export function createUserContext(user: {
  id: string;
  email?: string | null;
  workspaceId?: string;
}): LogContext {
  return {
    userId: user.id,
    email: user.email || undefined,
    workspaceId: user.workspaceId,
  };
}
