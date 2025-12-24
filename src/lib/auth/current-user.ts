import { db } from "@/app/lib/db";
import { ROLES, getPermissions, type Role, type UserPermissions } from "./rbac";
import { getAuthenticatedUserEmail } from "@/app/actions/auth";
import { logger } from "@/lib/logging";

export interface CurrentUser {
  id: string;
  name: string | null;
  email: string | null;
  workspaceId: string;
  role: Role;
  profileId?: string; // ID do profile associado (para membros)
  permissions: UserPermissions;
}

/**
 * Obtém o usuário atual e suas permissões
 * Busca o usuário autenticado via cookie de sessão
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    // Busca email do cookie de autenticação
    const userEmail = await getAuthenticatedUserEmail();
    logger.debug("User email retrieved from cookie", { userEmail });

    if (!userEmail) {
      logger.debug("No user email found in cookie");
      return null;
    }

    const user = await db.user.findUnique({
      where: {
        email: userEmail,
        deletedAt: null, // Filtrar usuários não deletados
      },
    });

    logger.debug("User record retrieved", {
      userId: user?.id,
      userEmail: user?.email,
    });

    if (!user) {
      logger.debug("No user record found in database");
      return null;
    }

    const workspaceMember = await db.workspaceMember.findFirst({
      include: {
        User: true,
        Workspace: true,
      },
      where: {
        userId: user.id,
        deletedAt: null, // Filtrar membros não deletados
      },
    });

    logger.debug("Workspace member retrieved", {
      workspaceMemberId: workspaceMember?.id,
    });

    // Se não tem workspace mas é admin do sistema, tenta encontrar qualquer workspace
    // ou cria um contexto de admin global (usando o primeiro workspace disponível)
    if (!workspaceMember && user.role === "admin") {
      const anyWorkspace = await db.workspace.findFirst();
      if (anyWorkspace) {
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          workspaceId: anyWorkspace.id,
          role: ROLES.ADMIN,
          permissions: getPermissions(ROLES.ADMIN),
        };
      }
    }

    if (!workspaceMember) {
      return null;
    }

    const role = (
      user.role === "admin" ? ROLES.ADMIN : workspaceMember.role
    ) as Role;
    const permissions = getPermissions(role);

    // Para membros, busca o profileId diretamente do registro
    // Nota: Usado any temporariamente até Prisma Client ser totalmente regenerado
    const memberWithProfile = workspaceMember as typeof workspaceMember & {
      profileId?: string;
    };
    let profileId: string | undefined;
    if (role === ROLES.MEMBER && memberWithProfile.profileId) {
      profileId = memberWithProfile.profileId;
    }

    return {
      id: workspaceMember.User.id,
      name: workspaceMember.User.name,
      email: workspaceMember.User.email,
      workspaceId: workspaceMember.workspaceId,
      role,
      profileId,
      permissions,
    };
  } catch (error) {
    logger.error("Failed to get current user", { error });
    return null;
  }
}

/**
 * Verifica se o usuário tem acesso a um profile específico
 */
export function canAccessProfile(
  user: CurrentUser,
  profileId: string
): boolean {
  // Admin pode acessar qualquer profile
  if (user.role === ROLES.ADMIN) {
    return true;
  }

  // Membro só pode acessar o profile associado
  return user.profileId === profileId;
}
