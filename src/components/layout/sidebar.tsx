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
  Shield,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { logoutAction } from "@/app/actions/auth";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import ProfileEditDialog from "@/components/profile/user-edit-dialog";
import { useState } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Badge } from "@/components/ui/badge";

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
      href: "/settings",
      label: "Configurações",
      icon: Settings,
      active: pathname.includes("/settings") && !pathname.includes("/users"),
      visible: true,
    },
    {
      href: "/settings/users",
      label: "Gerenciar Usuários",
      icon: Users,
      active: pathname.includes("/users"),
      visible: isAdmin,
    },
    {
      href: "/divergences",
      label: "Divergências",
      icon: FileCog,
      active: pathname.includes("/divergences"),
      visible: isAdmin,
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
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6 bg-card">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-xl text-primary"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileCog className="h-5 w-5" />
          </div>
          <span className="">ToolsMS</span>
        </Link>
        {/* Theme Toggle */}
        <div className="ml-auto">
          <ThemeToggle />
        </div>
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
      <div className="mt-auto p-4 border-t bg-muted/50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full h-auto flex items-center justify-between p-2 hover:bg-accent"
            >
              <div className="flex items-center gap-3 text-left min-w-0">
                <Avatar
                  className={cn(
                    "h-9 w-9 border-2",
                    isAdmin ? "border-role-admin" : "border-role-member"
                  )}
                >
                  <AvatarFallback
                    className={cn(
                      isAdmin
                        ? "bg-role-admin/10 text-role-admin"
                        : "bg-role-member/10 text-role-member"
                    )}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col overflow-hidden min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {userName || "Usuário"}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        isAdmin
                          ? "border-role-admin text-role-admin bg-role-admin/10"
                          : "border-role-member text-role-member bg-role-member/10"
                      )}
                    >
                      {isAdmin ? (
                        <>
                          <Shield className="h-2.5 w-2.5 mr-0.5" /> Admin
                        </>
                      ) : (
                        <>
                          <User className="h-2.5 w-2.5 mr-0.5" /> Membro
                        </>
                      )}
                    </Badge>
                  </div>
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
            className="w-[--radix-popper-anchor-width] min-w-60"
          >
            <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
              <UserCog className="mr-2 h-4 w-4" />
              Editar Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={handleLogout}
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
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
