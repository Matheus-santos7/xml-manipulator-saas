"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { loginAction } from "@/app/actions/auth";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Por favor, insira seu email");
      return;
    }

    setIsLoading(true);

    try {
      const result = await loginAction(email, password);

      if (result.success) {
        toast.success("Login realizado com sucesso!");
        router.push("/manipulador");
        router.refresh();
      } else {
        toast.error(result.error || "Erro ao realizar login");
      }
    } catch {
      toast.error("Erro ao realizar login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-4">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileCog className="h-7 w-7" />
          </div>
        </div>
        <div className="text-center">
          <CardTitle className="text-2xl font-bold">ToolsMS</CardTitle>
          <CardDescription className="mt-2">
            Entre com seu email para acessar o sistema
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="current-password"
              autoFocus
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="mt-6 text-xs text-center text-muted-foreground">
          Sistema de gerenciamento e manipulação de XMLs fiscais
        </p>
      </CardContent>
    </Card>
  );
}
