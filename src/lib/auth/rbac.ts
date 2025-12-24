/**
 * Role-Based Access Control (RBAC)
 * Sistema de controle de acesso baseado em roles
 */

export const ROLES = {
  ADMIN: "admin",
  MEMBER: "member",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export interface UserPermissions {
  canManageProfiles: boolean;
  canManageScenarios: boolean;
  canViewProfiles: boolean;
  canViewScenarios: boolean;
  canProcessXml: boolean;
}

/**
 * Retorna as permissões baseadas no role do usuário
 */
export function getPermissions(role: Role): UserPermissions {
  switch (role) {
    case ROLES.ADMIN:
      return {
        canManageProfiles: true,
        canManageScenarios: true,
        canViewProfiles: true,
        canViewScenarios: true,
        canProcessXml: true,
      };
    case ROLES.MEMBER:
      return {
        canManageProfiles: false, // Usuário não pode criar/editar empresas
        canManageScenarios: true, // Mas pode criar cenários da sua empresa
        canViewProfiles: false, // Não vê lista de empresas
        canViewScenarios: true, // Vê apenas cenários da sua empresa
        canProcessXml: true, // Pode processar XML
      };
    default:
      return {
        canManageProfiles: false,
        canManageScenarios: false,
        canViewProfiles: false,
        canViewScenarios: false,
        canProcessXml: false,
      };
  }
}

/**
 * Verifica se o usuário tem uma permissão específica
 */
export function hasPermission(
  role: Role,
  permission: keyof UserPermissions
): boolean {
  const permissions = getPermissions(role);
  return permissions[permission];
}

/**
 * Tipo para o usuário atual com suas permissões.
 * Pode ser usado nos helpers abaixo.
 */
export interface UserWithRole {
  role: Role;
  permissions?: UserPermissions;
}

/**
 * Verifica se o usuário é administrador.
 * Retorna true se o role for ADMIN.
 */
export function isAdmin(user: UserWithRole | null | undefined): boolean {
  return user?.role === ROLES.ADMIN;
}

/**
 * Garante que o usuário é um administrador, lançando erro caso contrário.
 * Útil para validações no início de server actions administrativas.
 */
export function ensureAdmin<T extends UserWithRole>(
  user: T | null | undefined
): asserts user is T {
  if (!user) {
    throw new Error("Usuário não autenticado");
  }
  if (!isAdmin(user)) {
    throw new Error(
      "Acesso negado. Apenas administradores podem executar esta ação."
    );
  }
}

/**
 * Valida se o usuário tem permissão de administrador e retorna erro padronizado.
 * Retorna um objeto { success: false, error: string } se não for admin, ou null se for.
 */
export function requireAdmin(
  user: UserWithRole | null | undefined
): { success: false; error: string } | null {
  if (!user) {
    return {
      success: false,
      error: "Usuário não autenticado",
    };
  }
  if (!isAdmin(user)) {
    return {
      success: false,
      error: "Acesso negado. Apenas administradores podem executar esta ação.",
    };
  }
  return null;
}
