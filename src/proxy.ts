import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";

// Rotas públicas que não precisam de autenticação
const publicRoutes = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Verifica se é rota pública
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Verifica se tem cookie de autenticação
  const authCookie = request.cookies.get(AUTH_COOKIE);
  const isAuthenticated = !!authCookie?.value;

  // Se não está autenticado e tenta acessar rota protegida
  if (!isAuthenticated && !isPublicRoute) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Se está autenticado e tenta acessar página de login
  // Importante: não redirecionar de /login apenas pela presença do cookie,
  // pois o cookie pode estar inválido/expirado e isso causaria loop de redirect.
  // A página /login fará a verificação real via getSession no servidor.
  // if (isAuthenticated && pathname === "/login") {
  //   const homeUrl = new URL("/manipulador", request.url);
  //   return NextResponse.redirect(homeUrl);
  // }

  // Redireciona raiz para manipulador se autenticado
  if (isAuthenticated && pathname === "/") {
    const homeUrl = new URL("/manipulador", request.url);
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
