"use client";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, FileCog } from "lucide-react";
import { Sidebar } from "./sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface MobileHeaderProps {
  userEmail: string;
  userName: string | null;
  isAdmin: boolean;
}

export function MobileHeader({
  userEmail,
  userName,
  isAdmin,
}: MobileHeaderProps) {
  return (
    <header className="flex h-14 items-center gap-4 border-b px-4 lg:h-[60px] lg:px-6 md:hidden bg-card">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Menu de navegação</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col p-0 w-[280px]">
          {/* Reutilizamos o componente Sidebar aqui dentro, mas sem a borda direita */}
          <Sidebar
            userEmail={userEmail}
            userName={userName}
            isAdmin={isAdmin}
          />
        </SheetContent>
      </Sheet>

      {/* Logo visível apenas no mobile header */}
      <div className="flex items-center gap-2 font-bold text-lg md:hidden">
        <FileCog className="h-5 w-5 text-primary" />
        ToolsMS
      </div>

      {/* Theme Toggle no mobile */}
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}
