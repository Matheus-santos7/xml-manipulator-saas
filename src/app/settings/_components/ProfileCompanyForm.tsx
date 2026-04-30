"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { deleteProfile } from "@/app/actions/company";
import { Trash2 } from "lucide-react";
import { ProfileEditDialog } from "./ProfileEditDialog";

interface Profile {
  id: string;
  name: string;
  cnpj: string;
  razaoSocial?: string | null;
  endereco?: unknown;
}

interface ProfileFormProps {
  profiles: Profile[];
  selectedProfileId?: string;
  canManage?: boolean; // Indica se o usuário pode criar/editar/excluir
}

export function ProfileForm({
  profiles,
  selectedProfileId,
  canManage = true,
}: ProfileFormProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  async function handleDelete(profileId: string) {
    setIsDeleting(profileId);
    try {
      const result = await deleteProfile(profileId);
      if (result.success) {
        toast.success("Empresa excluída com sucesso!");
        // Se a empresa excluída era a selecionada, redireciona
        if (profileId === selectedProfileId) {
          router.push("/settings");
        }
        router.refresh();
      } else {
        toast.error(result.error || "Erro ao excluir empresa");
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir empresa");
    } finally {
      setIsDeleting(null);
    }
  }

  return (
    <div className="space-y-2">
      {profiles.map((profile) => (
        <div
          key={profile.id}
          className={`group flex items-center gap-2 p-3 rounded-lg border transition-all hover:bg-muted/50 ${
            profile.id === selectedProfileId
              ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
              : "border-border"
          }`}
        >
          <a href={`/settings?profileId=${profile.id}`} className="flex-1">
            <div className="font-medium text-foreground">{profile.name}</div>
            <div className="text-xs text-muted-foreground">{profile.cnpj}</div>
          </a>

          {canManage && (
            <div className="flex items-center gap-1">
              <ProfileEditDialog
                profile={{
                  id: profile.id,
                  name: profile.name,
                  cnpj: profile.cnpj,
                  razaoSocial: profile.razaoSocial,
                  endereco: profile.endereco as {
                    logradouro?: string;
                    numero?: string;
                    complemento?: string;
                    bairro?: string;
                    cidade?: string;
                    uf?: string;
                    cep?: string;
                    cMun?: string;
                  } | null,
                }}
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir Empresa</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir a empresa{" "}
                      <strong>{profile.name}</strong>?
                      <br />
                      <br />
                      <span className="text-destructive font-medium">
                        Esta ação é irreversível e excluirá todos os cenários
                        associados a esta empresa.
                      </span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(profile.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={isDeleting === profile.id}
                    >
                      {isDeleting === profile.id ? "Excluindo..." : "Excluir"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      ))}

    </div>
  );
}
