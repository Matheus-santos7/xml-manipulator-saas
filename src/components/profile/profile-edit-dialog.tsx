"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { updateCurrentUser } from "@/app/actions/user-account";
import { useRouter } from "next/navigation";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEmail: string;
}

export default function ProfileEditDialog({
  open,
  onOpenChange,
  initialEmail,
}: Props) {
  const [email, setEmail] = useState(initialEmail || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword && newPassword !== confirmPassword) {
      toast.error("A nova senha e a confirmação não conferem.");
      return;
    }

    setLoading(true);
    try {
      const res = await updateCurrentUser(
        email,
        newPassword || undefined,
        currentPassword || undefined
      );

      if (!res.success) {
        toast.error(res.error || "Erro ao atualizar perfil.");
        return;
      }

      toast.success("Perfil atualizado com sucesso.");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar perfil.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Perfil</DialogTitle>
          <DialogDescription>Atualize seu email ou senha.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div>
            <Label>Email</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </div>

          <div>
            <Label>Senha atual (necessária ao alterar senha)</Label>
            <Input
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              type="password"
            />
          </div>

          <div>
            <Label>Nova senha</Label>
            <Input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              type="password"
            />
          </div>

          <div>
            <Label>Confirmar nova senha</Label>
            <Input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
