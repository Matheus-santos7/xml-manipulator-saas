import { cache } from "react";
import { db } from "@/lib/db";
import { ROLES, getPermissions, type Role, type UserPermissions } from "./rbac";
import { getAuthenticatedUserEmail } from "@/app/actions/auth";

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
 * Implementação interna: busca o usuário no DB.
 * Envolvida em cache() para deduplicar no mesmo request (layout + page).
 */
async function getCurrentUserImpl(): Promise<CurrentUser | null> {
  try {
    // Busca email do cookie de autenticação
    const userEmail = await getAuthenticatedUserEmail();
    console.debug("User email retrieved from cookie", { userEmail });

    if (!userEmail) {
      console.debug("No user email found in cookie");
      return null;
    }

    let user: {
      id: string;
      name: string | null;
      email: string | null;
      role: string;
    } | null = null;
    try {
      user = await db.user.findFirst({
        where: {
          email: userEmail,
          deletedAt: null, // Filtrar usuários não deletados
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });
    } catch (error) {
      const missingColumn =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2022";
      if (missingColumn) {
        user = await db.user.findFirst({
          where: {
            email: userEmail,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        });
      } else {
        throw error;
      }
    }

    console.debug("User record retrieved", {
      userId: user?.id,
      userEmail: user?.email,
    });

    if (!user) {
      console.debug("No user record found in database");
      return null;
    }

    let workspaceMember: {
      id: string;
      workspaceId: string;
      role: string;
      profileId?: string | null;
    } | null = null;
    try {
      workspaceMember = await db.workspaceMember.findFirst({
        where: {
          userId: user.id,
          deletedAt: null, // Filtrar membros não deletados
        },
        select: {
          id: true,
          workspaceId: true,
          role: true,
          profileId: true,
        },
      });
    } catch (error) {
      const missingColumn =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2022";
      if (missingColumn) {
        workspaceMember = await db.workspaceMember.findFirst({
          where: {
            userId: user.id,
          },
          select: {
            id: true,
            workspaceId: true,
            role: true,
            profileId: true,
          },
        });
      } else {
        throw error;
      }
    }

    console.debug("Workspace member retrieved", {
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
    let profileId: string | undefined;
    if (role === ROLES.MEMBER && workspaceMember.profileId) {
      profileId = workspaceMember.profileId;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      workspaceId: workspaceMember.workspaceId,
      role,
      profileId,
      permissions,
    };
  } catch (error) {
    console.error("Failed to get current user", { error });
    return null;
  }
}

/**
 * Obtém o usuário atual e suas permissões (com cache por request).
 * Layout e página compartilham o mesmo resultado no mesmo request, evitando queries duplicadas.
 */
export const getCurrentUser = cache(getCurrentUserImpl);

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
