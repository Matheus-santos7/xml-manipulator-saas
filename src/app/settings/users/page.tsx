import { db } from "@/app/lib/db";
import { getCurrentUser } from "@/lib/auth-helper";
import { redirect } from "next/navigation";
import { UserManagement } from "@/components/settings/user-management";
import { AddMemberDialog } from "@/components/settings/add-member-dialog";
import { getWorkspaceMembers } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function usersPage() {
  // Verificar autenticação e permissões
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/");
  }

  // Apenas admins podem acessar
  if (currentUser.role !== "admin") {
    redirect("/settings");
  }

  // Buscar dados
  const members = await getWorkspaceMembers();
  const profiles = await db.profile.findMany({
    where: {
      workspaceId: currentUser.workspaceId,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
            <p className="text-muted-foreground">
              Gerencie membros, roles e empresas associadas
            </p>
          </div>
        </div>
        <AddMemberDialog profiles={profiles} />
      </div>

      <UserManagement
        members={members}
        profiles={profiles}
        currentUserId={currentUser.id}
      />
    </div>
  );
}
