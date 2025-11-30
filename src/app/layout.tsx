import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { getCurrentUser } from "@/lib/auth-helper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SaaS XML Manipulator",
  description: "Manipulador fiscal de XMLs",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Busca usuário autenticado
  const currentUser = await getCurrentUser();
  const isLoginPage = true; // Será verificado no cliente

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        {currentUser ? (
          /* LAYOUT AUTENTICADO: Sidebar + Conteúdo */
          <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
            {/* SIDEBAR DESKTOP (Escondida no mobile) */}
            <div className="hidden border-r md:block bg-slate-50/50">
              <div className="flex h-full max-h-screen flex-col gap-2 sticky top-0">
                <Sidebar
                  userEmail={currentUser.email || ""}
                  userName={currentUser.name}
                  isAdmin={currentUser.role === "admin"}
                />
              </div>
            </div>

            {/* ÁREA DE CONTEÚDO */}
            <div className="flex flex-col">
              {/* HEADER MOBILE (Aparece só no mobile) */}
              <MobileHeader
                userEmail={currentUser.email || ""}
                userName={currentUser.name}
                isAdmin={currentUser.role === "admin"}
              />

              {/* CONTEÚDO PRINCIPAL (Páginas) */}
              <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-white">
                {children}
              </main>
            </div>
          </div>
        ) : (
          /* LAYOUT NÃO AUTENTICADO: Sem Sidebar */
          <main className="min-h-screen">{children}</main>
        )}

        <Toaster />
      </body>
    </html>
  );
}
