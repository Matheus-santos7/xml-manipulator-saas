'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileCode, Settings, FileCog, LogOut, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function Sidebar() {
  const pathname = usePathname()

  const routes = [
    {
      href: "/manipulador",
      label: "Processador XML",
      icon: FileCode,
      active: pathname.includes("/manipulador"),
    },
    {
      href: "/configuracoes",
      label: "Configurações",
      icon: Settings,
      active: pathname.includes("/configuracoes"),
    },
  ]

  return (
    <div className="flex h-full max-h-screen flex-col gap-2">
      {/* LOGO */}
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6 bg-white">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileCog className="h-5 w-5" />
          </div>
          <span className="">XML SaaS</span>
        </Link>
      </div>

      {/* NAVEGAÇÃO */}
      <div className="flex-1">
        <nav className="grid items-start px-2 text-sm font-medium lg:px-4 mt-4 space-y-1">
          {routes.map((route) => (
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
        <div className="flex items-center gap-3 mb-4">
          <Avatar className="h-9 w-9 border">
            <AvatarImage src="/avatars/01.png" alt="User" />
            <AvatarFallback>AD</AvatarFallback>
          </Avatar>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-medium truncate">Admin User</span>
            <span className="text-xs text-muted-foreground truncate">admin@empresa.com</span>
          </div>
        </div>
        <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" size="sm">
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  )
}