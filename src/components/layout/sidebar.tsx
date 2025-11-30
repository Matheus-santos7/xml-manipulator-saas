"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileCode,
  Settings,
  FileCog,
  LogOut,
  Users,
  UserCog,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { logoutAction } from "@/app/actions/auth";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import ProfileEditDialog from "@/components/profile/profile-edit-dialog";
import { useState } from "react";

interface SidebarProps {
  userEmail: string;
  userName: string | null;
  isAdmin: boolean;
}

export function Sidebar({ userEmail, userName, isAdmin }: SidebarProps) {
  const pathname = usePathname();

  const routes = [
    {
      href: "/manipulador",
      label: "Manipulador XML",
      icon: FileCode,
      active: pathname.includes("/manipulador"),
      visible: true,
    },
    {
      href: "/configuracoes",
      label: "Configurações",
      icon: Settings,
      active:
        pathname.includes("/configuracoes") && !pathname.includes("/usuarios"),
      visible: true,
    },
    {
      href: "/configuracoes/usuarios",
      label: "Gerenciar Usuários",
      icon: Users,
      active: pathname.includes("/usuarios"),
      visible: isAdmin, // Apenas admins veem
    },
  ];

  const handleLogout = async () => {
    try {
      await logoutAction();
      toast.success("Logout realizado com sucesso!");
    } catch (error) {
      toast.success("Logout realizado com sucesso!");

    }
  };

  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2)
    : userEmail.substring(0, 2).toUpperCase();

  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="flex h-full max-h-screen flex-col gap-2">
      {/* LOGO */}
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6 bg-white">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-xl text-primary"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileCog className="h-5 w-5" />
          </div>
          <span className="">XML SaaS</span>
        </Link>
      </div>

      {/* NAVEGAÇÃO */}
      <div className="flex-1">
        <nav className="grid items-start px-2 text-sm font-medium lg:px-4 mt-4 space-y-1">
          {routes
            .filter((route) => route.visible)
            .map((route) => (
              <Link
                key={route.href}
                href={route.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                  route.active
                    ? "bg-primary/10 text-primary font-semibold border-r-4 border-primary rounded-r-none"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <route.icon className="h-4 w-4" />
                {route.label}
              </Link>
            ))}
        </nav>
      </div>

      {/* USER FOOTER */}
      <div className="mt-auto p-4 border-t bg-slate-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full h-auto flex items-center justify-between p-2 hover:bg-slate-200"
            >
              <div className="flex items-center gap-3 text-left min-w-0">
                <Avatar className="h-9 w-9 border">
                  <AvatarImage src="/avatars/01.png" alt="User" />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col overflow-hidden min-w-0">
                  <span className="text-sm font-medium truncate">
                    {userName || "Usuário"}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {userEmail}
                  </span>
                </div>
              </div>
              <ChevronUp className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            className="w-[--radix-popper-anchor-width] min-w-[240px]"
          >
            <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
              <UserCog className="mr-2 h-4 w-4" />
              Editar Perfil
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={handleLogout}
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ProfileEditDialog
          open={profileOpen}
          onOpenChange={(v) => setProfileOpen(v)}
          initialEmail={userEmail}
        />
      </div>
    </div>
  );
}
