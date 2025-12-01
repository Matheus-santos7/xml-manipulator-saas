"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Building2,
  Trash2,
  UserCheck,
  UserX,
  Edit,
} from "lucide-react";
import { toast } from "sonner";
import {
  updateMemberRole,
  updateMemberProfile,
  removeMember,
  type WorkspaceMemberWithDetails,
} from "@/app/actions/users";
import AdminEditUserDialog from "@/components/profile/admin-edit-user-dialog";

interface UserManagementProps {
  members: WorkspaceMemberWithDetails[];
  profiles: { id: string; name: string }[];
  currentUserId: string;
}

export function UserManagement({
  members,
  profiles,
  currentUserId,
}: UserManagementProps) {
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingMember, setEditingMember] =
    useState<WorkspaceMemberWithDetails | null>(null);

  const handleRoleChange = async (
    memberId: string,
    newRole: "admin" | "member"
  ) => {
    const result = await updateMemberRole(memberId, newRole);

    if (result.success) {
      toast.success("Role atualizado com sucesso!");
    } else {
      toast.error(result.error || "Erro ao atualizar role");
    }
  };

  const handleProfileChange = async (memberId: string, profileId: string) => {
    const result = await updateMemberProfile(
      memberId,
      profileId === "none" ? null : profileId
    );

    if (result.success) {
      toast.success("Empresa associada com sucesso!");
    } else {
      toast.error(result.error || "Erro ao associar empresa");
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember) return;

    setIsDeleting(true);
    const result = await removeMember(selectedMember);

    if (result.success) {
      toast.success("Usuário removido com sucesso!");
      setSelectedMember(null);
    } else {
      toast.error(result.error || "Erro ao remover usuário");
    }
    setIsDeleting(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Gerenciamento de Usuários
          </CardTitle>
          <CardDescription>
            Gerencie os membros do workspace, seus roles e empresas associadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Empresa Associada</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      Nenhum membro encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((member) => {
                    const isCurrentUser = member.User.id === currentUserId;

                    return (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {member.User.name || "Sem nome"}
                            {isCurrentUser && (
                              <Badge variant="outline" className="text-xs">
                                Você
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{member.User.email || "—"}</TableCell>
                        <TableCell>
                          <Select
                            value={member.role}
                            onValueChange={(value) =>
                              handleRoleChange(
                                member.id,
                                value as "admin" | "member"
                              )
                            }
                            disabled={isCurrentUser}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">
                                <div className="flex items-center gap-2">
                                  <Shield className="h-3 w-3" />
                                  Administrador
                                </div>
                              </SelectItem>
                              <SelectItem value="member">
                                <div className="flex items-center gap-2">
                                  <UserCheck className="h-3 w-3" />
                                  Membro
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {member.role === "admin" ? (
                            <Badge variant="secondary" className="gap-1">
                              <Shield className="h-3 w-3" />
                              Todas
                            </Badge>
                          ) : (
                            <Select
                              value={member.profileId || "none"}
                              onValueChange={(value) =>
                                handleProfileChange(member.id, value)
                              }
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <UserX className="h-3 w-3" />
                                    Nenhuma
                                  </div>
                                </SelectItem>
                                {profiles.map((profile) => (
                                  <SelectItem
                                    key={profile.id}
                                    value={profile.id}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Building2 className="h-3 w-3" />
                                      {profile.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingMember(member)}
                            className="text-black-600 hover:text-black-700"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedMember(member.id)}
                            disabled={isCurrentUser}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 text-sm text-muted-foreground space-y-1">
            <p>
              <strong>Dica:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <strong>Administradores</strong> têm acesso total ao sistema e
                podem gerenciar todas as empresas
              </li>
              <li>
                <strong>Membros</strong> só podem gerenciar cenários da empresa
                associada
              </li>
              <li>Membros sem empresa associada não terão acesso ao sistema</li>
              <li>
                Você não pode alterar seu próprio role ou remover a si mesmo
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={selectedMember !== null}
        onOpenChange={(open) => !open && setSelectedMember(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O usuário será removido do
              workspace e perderá acesso ao sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdminEditUserDialog
        member={editingMember}
        open={editingMember !== null}
        onOpenChange={(open) => !open && setEditingMember(null)}
      />
    </>
  );
}
