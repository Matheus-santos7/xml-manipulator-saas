"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MaskedInput } from "@/components/ui/masked-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { updateProfile } from "@/app/actions/settings";
import { Pencil, Building2, Loader2 } from "lucide-react";

// Lista de estados brasileiros
const ESTADOS_BR = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
];

interface ProfileEditDialogProps {
  profile: {
    id: string;
    name: string;
    cnpj: string;
    razaoSocial?: string | null;
    endereco?: {
      logradouro?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      cidade?: string;
      uf?: string;
      cep?: string;
    } | null;
  };
}

export function ProfileEditDialog({ profile }: ProfileEditDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);

  // Estados do formulário
  const [name, setName] = useState(profile.name);
  const [cnpj, setCnpj] = useState(profile.cnpj);
  const [razaoSocial, setRazaoSocial] = useState(profile.razaoSocial || "");
  const [cep, setCep] = useState(
    (profile.endereco as { cep?: string })?.cep || ""
  );
  const [logradouro, setLogradouro] = useState(
    (profile.endereco as { logradouro?: string })?.logradouro || ""
  );
  const [numero, setNumero] = useState(
    (profile.endereco as { numero?: string })?.numero || ""
  );
  const [complemento, setComplemento] = useState(
    (profile.endereco as { complemento?: string })?.complemento || ""
  );
  const [bairro, setBairro] = useState(
    (profile.endereco as { bairro?: string })?.bairro || ""
  );
  const [cidade, setCidade] = useState(
    (profile.endereco as { cidade?: string })?.cidade || ""
  );
  const [uf, setUf] = useState((profile.endereco as { uf?: string })?.uf || "");

  // Reset do formulário quando o dialog abrir
  useEffect(() => {
    if (open) {
      setName(profile.name);
      setCnpj(profile.cnpj);
      setRazaoSocial(profile.razaoSocial || "");
      const endereco = profile.endereco as {
        cep?: string;
        logradouro?: string;
        numero?: string;
        complemento?: string;
        bairro?: string;
        cidade?: string;
        uf?: string;
      } | null;
      setCep(endereco?.cep || "");
      setLogradouro(endereco?.logradouro || "");
      setNumero(endereco?.numero || "");
      setComplemento(endereco?.complemento || "");
      setBairro(endereco?.bairro || "");
      setCidade(endereco?.cidade || "");
      setUf(endereco?.uf || "");
    }
  }, [open, profile]);

  // Buscar endereço pelo CEP
  async function handleCepBlur() {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    setLoadingCep(true);
    try {
      const response = await fetch(`/api/cep?cep=${cleanCep}`);
      if (response.ok) {
        const data = await response.json();
        if (!data.erro) {
          setLogradouro(data.logradouro || "");
          setBairro(data.bairro || "");
          setCidade(data.localidade || "");
          setUf(data.uf || "");
        }
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
    } finally {
      setLoadingCep(false);
    }
  }

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
          // Preenche os campos com os dados retornados
          if (data.xFant) setName(data.xFant);
          if (data.xNome) setRazaoSocial(data.xNome);
          if (data.CEP) setCep(data.CEP);
          if (data.xLgr) setLogradouro(data.xLgr);
          if (data.nro) setNumero(data.nro);
          if (data.xCpl) setComplemento(data.xCpl);
          if (data.xBairro) setBairro(data.xBairro);
          if (data.xMun) setCidade(data.xMun);
          if (data.UF) setUf(data.UF);
          toast.success("Dados do CNPJ carregados com sucesso!");
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "CNPJ não encontrado");
      }
    } catch (error) {
      console.error("Erro ao buscar CNPJ:", error);
      toast.error("Erro ao buscar dados do CNPJ");
    } finally {
      setLoadingCnpj(false);
    }
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Nome da empresa é obrigatório");
      return;
    }

    if (!cnpj.trim()) {
      toast.error("CNPJ é obrigatório");
      return;
    }

    setLoading(true);
    try {
      const result = await updateProfile({
        id: profile.id,
        name: name.trim(),
        cnpj: cnpj.trim(),
        razaoSocial: razaoSocial.trim() || undefined,
        endereco: {
          cep: cep.trim() || undefined,
          logradouro: logradouro.trim() || undefined,
          numero: numero.trim() || undefined,
          complemento: complemento.trim() || undefined,
          bairro: bairro.trim() || undefined,
          cidade: cidade.trim() || undefined,
          uf: uf || undefined,
        },
      });

      if (result.success) {
        toast.success("Empresa atualizada com sucesso!");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || "Erro ao atualizar empresa");
      }
    } catch (error) {
      console.error("Erro ao atualizar empresa:", error);
      toast.error("Erro ao atualizar empresa");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary hover:bg-primary/10"
          title="Editar empresa"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Editar Empresa
          </DialogTitle>
          <DialogDescription>
            Atualize as informações da empresa cadastrada.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* ID da Empresa (somente exibição) */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
            <span>ID:</span>
            <code className="font-mono text-xs bg-background px-2 py-0.5 rounded">{profile.id}</code>
          </div>

          {/* Dados Básicos */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Fantasia *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome da empresa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ *</Label>
              <div className="relative">
                <MaskedInput
                  mask="cnpj"
                  value={cnpj}
                  onChange={setCnpj}
                  onBlur={handleCnpjBlur}
                  placeholder="00.000.000/0000-00"
                />
                {loadingCnpj && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Ao sair do campo, os dados serão buscados automaticamente
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="razaoSocial">Razão Social</Label>
            <Input
              id="razaoSocial"
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              placeholder="Razão social da empresa"
            />
          </div>

          {/* Endereço */}
          <div className="border-t pt-4 mt-2">
            <h4 className="text-sm font-semibold mb-4">Endereço</h4>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <div className="relative">
                  <MaskedInput
                    mask="cep"
                    value={cep}
                    onChange={setCep}
                    onBlur={handleCepBlur}
                    placeholder="00000-000"
                  />
                  {loadingCep && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="logradouro">Logradouro</Label>
                <Input
                  id="logradouro"
                  value={logradouro}
                  onChange={(e) => setLogradouro(e.target.value)}
                  placeholder="Rua, Avenida, etc."
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="numero">Número</Label>
                <Input
                  id="numero"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="Nº"
                />
              </div>
              <div className="col-span-3 space-y-2">
                <Label htmlFor="complemento">Complemento</Label>
                <Input
                  id="complemento"
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                  placeholder="Sala, Andar, etc."
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="bairro">Bairro</Label>
                <Input
                  id="bairro"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  placeholder="Bairro"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="Cidade"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uf">UF</Label>
                <Select value={uf} onValueChange={setUf}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_BR.map((estado) => (
                      <SelectItem key={estado.sigla} value={estado.sigla}>
                        {estado.sigla} - {estado.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Alterações"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
