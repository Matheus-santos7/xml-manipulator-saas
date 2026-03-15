 "use client";

 import type { Role } from "@/lib/auth/rbac";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";
import { AddCompanyDialog } from "./AddCompanyDialog";

interface SettingsHeaderProps {
  role: Role;
}

export function SettingsHeader({ role }: SettingsHeaderProps) {
  const isAdmin = role === "admin";

  return (
    <div className="mb-4 flex justify-between items-center">
      <div className="flex items-center gap-2">
        {isAdmin && <AddCompanyDialog />}
       </div>
       <Badge
         variant="outline"
         className={
           isAdmin
             ? "border-role-admin text-role-admin bg-role-admin/10"
             : "border-role-member text-role-member bg-role-member/10"
         }
       >
         <Shield className="h-3 w-3 mr-1" />
         {isAdmin ? "Administrador" : "Usuário"}
       </Badge>
     </div>
   );
 }

