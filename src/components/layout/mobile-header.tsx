'use client'

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Menu, FileCog } from "lucide-react"
import { Sidebar } from "./sidebar" // Reutilizamos a sidebar dentro do menu móvel

export function MobileHeader() {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6 md:hidden bg-white">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Menu de navegação</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col p-0 w-[280px]">
          {/* Reutilizamos o componente Sidebar aqui dentro, mas sem a borda direita */}
          <Sidebar />
        </SheetContent>
      </Sheet>
      
      {/* Logo visível apenas no mobile header */}
      <div className="flex items-center gap-2 font-bold text-lg md:hidden">
         <FileCog className="h-5 w-5 text-primary" />
         XML SaaS
      </div>
    </header>
  )
}