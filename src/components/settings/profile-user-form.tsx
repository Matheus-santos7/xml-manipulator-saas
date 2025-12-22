"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { updateUserProfile } from "@/app/actions/user-account";
import { User, Mail, Lock, Eye, EyeOff } from "lucide-react";

interface ProfileEditFormProps {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    hasPassword: boolean;
  };
}

export function ProfileEditForm({ user }: ProfileEditFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Dados pessoais
  const [name, setName] = useState(user.name || "");
  const [email, setEmail] = useState(user.email || "");

  // Senha
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (newPassword && newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (newPassword && newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setIsLoading(true);

    try {
      const result = await updateUserProfile({
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });

      if (result.success) {
        toast.success("Perfil atualizado com sucesso!");

        // Limpar campos de senha
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");

        // Recarregar dados
        router.refresh();

        // Se o email foi alterado, fazer logout e redirecionar
        if (email.toLowerCase() !== user.email?.toLowerCase()) {
          toast.info("Email alterado. Faça login novamente.");
          setTimeout(() => {
            router.push("/login");
          }, 2000);
        }
      } else {
        toast.error(result.error || "Erro ao atualizar perfil");
      }
    } catch {
      toast.error("Erro ao atualizar perfil");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Dados Pessoais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Dados Pessoais
          </CardTitle>
          <CardDescription>Atualize suas informações básicas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              type="text"
              placeholder="Seu nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">
              <Mail className="h-4 w-4 inline mr-1" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              ⚠️ Alterar o email exigirá novo login
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Segurança - Senha */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Segurança
          </CardTitle>
          <CardDescription>
            {user.hasPassword
              ? "Altere sua senha de acesso"
              : "Configure uma senha para maior segurança"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user.hasPassword && (
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Senha Atual</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="Digite sua senha atual"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isLoading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="newPassword">
              {user.hasPassword ? "Nova Senha" : "Senha"}
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                placeholder="Digite a nova senha (mín. 6 caracteres)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirme a nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {!user.hasPassword && (
            <p className="text-xs text-muted-foreground">
              💡 Configurar uma senha aumentará a segurança da sua conta
            </p>
          )}
        </CardContent>
      </Card>

      {/* Botões de Ação */}
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>
    </form>
  );
}
