"use server";

import { db } from "@/app/lib/db";
import { getCurrentUser } from "@/lib/auth-helper";
import { ROLES } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

export interface WorkspaceMemberWithDetails {
  id: string;
  role: string;
  profileId: string | null;
  User: {
    id: string;
    name: string | null;
    email: string | null;
  };
  Profile: {
    id: string;
    name: string;
  } | null;
}

/**
 * Lista todos os membros do workspace
 * Apenas admins podem acessar
 */
export async function getWorkspaceMembers(): Promise<
  WorkspaceMemberWithDetails[]
> {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role !== ROLES.ADMIN) {
    throw new Error(
      "Acesso negado. Apenas administradores podem gerenciar usuários."
    );
  }

  const members = await db.workspaceMember.findMany({
    where: {
      workspaceId: currentUser.workspaceId,
    },
    include: {
      User: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      Profile: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      User: {
        name: "asc",
      },
    },
  });

  return members as WorkspaceMemberWithDetails[];
}

/**
 * Atualiza o role de um membro
 * Apenas admins podem acessar
 */
export async function updateMemberRole(
  memberId: string,
  newRole: "admin" | "member"
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      return {
        success: false,
        error:
          "Acesso negado. Apenas administradores podem gerenciar usuários.",
      };
    }

    // Não permitir que o usuário altere seu próprio role
    const member = await db.workspaceMember.findUnique({
      where: { id: memberId },
      include: { User: true },
    });

    if (member?.User.id === currentUser.id) {
      return {
        success: false,
        error: "Você não pode alterar seu próprio role.",
      };
    }

    await db.workspaceMember.update({
      where: { id: memberId },
      data: { role: newRole },
    });

    revalidatePath("/configuracoes/users");
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar role:", error);
    return {
      success: false,
      error: "Erro ao atualizar role do usuário.",
    };
  }
}

/**
 * Associa um membro a um profile
 * Apenas admins podem acessar
 */
export async function updateMemberProfile(
  memberId: string,
  profileId: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      return {
        success: false,
        error:
          "Acesso negado. Apenas administradores podem gerenciar usuários.",
      };
    }

    // Se profileId é null, remover associação
    if (profileId === null) {
      await db.workspaceMember.update({
        where: { id: memberId },
        data: { profileId: null },
      });
    } else {
      // Verificar se o profile existe no mesmo workspace
      const profile = await db.profile.findUnique({
        where: { id: profileId },
      });

      if (!profile || profile.workspaceId !== currentUser.workspaceId) {
        return {
          success: false,
          error: "Empresa não encontrada.",
        };
      }

      await db.workspaceMember.update({
        where: { id: memberId },
        data: { profileId },
      });
    }

    revalidatePath("/configuracoes/users");
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar profile:", error);
    return {
      success: false,
      error: "Erro ao associar empresa ao usuário.",
    };
  }
}

/**
 * Remove um membro do workspace
 * Apenas admins podem acessar
 */
export async function removeMember(
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      return {
        success: false,
        error:
          "Acesso negado. Apenas administradores podem gerenciar usuários.",
      };
    }

    // Não permitir que o usuário remova a si mesmo
    const member = await db.workspaceMember.findUnique({
      where: { id: memberId },
      include: { User: true },
    });

    if (member?.User.id === currentUser.id) {
      return {
        success: false,
        error: "Você não pode remover a si mesmo do workspace.",
      };
    }

    await db.workspaceMember.delete({
      where: { id: memberId },
    });

    revalidatePath("/configuracoes/users");
    return { success: true };
  } catch (error) {
    console.error("Erro ao remover membro:", error);
    return {
      success: false,
      error: "Erro ao remover usuário do workspace.",
    };
  }
}

/**
 * Atualiza dados de um usuário (nome, email, role, senha)
 * Apenas admins podem acessar
 */
export async function updateUserByAdmin(data: {
  memberId: string;
  name: string;
  email: string;
  role: "admin" | "member";
  newPassword?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== ROLES.ADMIN) {
      return {
        success: false,
        error: "Acesso negado. Apenas administradores podem editar usuários.",
      };
    }

    const member = await db.workspaceMember.findUnique({
      where: { id: data.memberId },
      include: { User: true },
    });

    if (!member) {
      return { success: false, error: "Membro não encontrado." };
    }

    // Atualizar role
    if (member.role !== data.role) {
      await db.workspaceMember.update({
        where: { id: data.memberId },
        data: { role: data.role },
      });
    }

    // Atualizar dados do usuário
    const userData: { name?: string; email?: string; password?: string } = {};
    if (data.name && data.name !== member.User.name) {
      userData.name = data.name;
    }
    if (data.email && data.email !== member.User.email) {
      const exists = await db.user.findFirst({
        where: { email: data.email, id: { not: member.userId } },
      });
      if (exists) {
        return { success: false, error: "Email já está em uso." };
      }
      userData.email = data.email;
    }
    if (data.newPassword) {
      userData.password = await bcrypt.hash(data.newPassword, 10);
    }

    if (Object.keys(userData).length > 0) {
      await db.user.update({
        where: { id: member.userId },
        data: userData,
      });
    }

    revalidatePath("/configuracoes/users");
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar usuário pelo admin:", error);
    return {
      success: false,
      error: "Erro interno ao atualizar usuário.",
    };
  }
}
