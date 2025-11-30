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
