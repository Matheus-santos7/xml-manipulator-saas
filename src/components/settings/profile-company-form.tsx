"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
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
import { saveProfile, deleteProfile } from "@/app/actions/settings";
import { Trash2, Loader2 } from "lucide-react";
import { ProfileEditDialog } from "./profile-edit-dialog";

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
  const [cnpj, setCnpj] = useState("");
  const [name, setName] = useState("");
  const [loadingCnpj, setLoadingCnpj] = useState(false);

  // Buscar dados pelo CNPJ
  async function handleCnpjBlur() {
    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) return;

    setLoadingCnpj(true);
    try {
      const response = await fetch(`/api/cnpj?cnpj=${cleanCnpj}`);
      if (response.ok) {
        const data = await response.json();
        if (!data.error) {
          // Preenche o nome fantasia ou razão social
          if (data.xFant) {
            setName(data.xFant);
          } else if (data.xNome) {
            setName(data.xNome);
          }
          toast.success("Dados do CNPJ carregados!");
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "CNPJ não encontrado");
      }
    } catch (error) {
      console.error("Erro ao buscar CNPJ:", error);
    } finally {
      setLoadingCnpj(false);
    }
  }

  async function handleDelete(profileId: string) {
    setIsDeleting(profileId);
    try {
      const result = await deleteProfile(profileId);
      if (result.success) {
        toast.success("Empresa excluída com sucesso!");
        // Se a empresa excluída era a selecionada, redireciona
        if (profileId === selectedProfileId) {
          router.push("/configuracoes");
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

  async function handleSubmit(formData: FormData) {
    // Adicionar o CNPJ com máscara ao formData
    formData.set("cnpj", cnpj);
    formData.set("name", name);
    await saveProfile(formData);
    setCnpj("");
    setName("");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {profiles.map((profile) => (
        <div
          key={profile.id}
          className={`group flex items-center gap-2 p-3 rounded-lg border transition-all hover:bg-slate-50 ${
            profile.id === selectedProfileId
              ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
              : "border-gray-100"
          }`}
        >
          <a href={`/configuracoes?profileId=${profile.id}`} className="flex-1">
            <div className="font-medium">{profile.name}</div>
            <div className="text-xs text-gray-500">{profile.cnpj}</div>
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

      {/* Formulário para adicionar empresa - apenas para admins */}
      {canManage && (
        <form action={handleSubmit} className="mt-4 pt-4 border-t space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase">
            Adicionar Nova Empresa
          </p>
          <div className="space-y-2">
            <div className="relative">
              <MaskedInput
                mask="cnpj"
                value={cnpj}
                onChange={setCnpj}
                onBlur={handleCnpjBlur}
                placeholder="00.000.000/0000-00"
                className="h-8 text-sm"
              />
              {loadingCnpj && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <Input
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da Empresa"
              required
              className="h-8 text-sm"
            />
          </div>
          <Button size="sm" type="submit" className="w-full">
            Salvar
          </Button>
        </form>
      )}
    </div>
  );
}
