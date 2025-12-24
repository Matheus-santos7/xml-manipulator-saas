/**
 * Constantes de autenticação compartilhadas
 */

/**
 * Nome do cookie usado para armazenar a sessão do usuário.
 * Contém o email do usuário autenticado.
 */
export const AUTH_COOKIE = "xml-saas-user";

/**
 * Configurações do cookie de sessão
 */
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 7, // 7 dias
};
