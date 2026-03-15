"use client";

import { useState } from "react";
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
import { saveProfile } from "@/app/actions/company";
import { Building2, Loader2, Plus, Search } from "lucide-react";
import { ESTADOS_BR } from "@/lib/constants";

function formatCep(cep: string): string {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return cep;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function AddCompanyDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");

  function resetForm() {
    setName("");
    setCnpj("");
    setRazaoSocial("");
    setCep("");
    setLogradouro("");
    setNumero("");
    setComplemento("");
    setBairro("");
    setCidade("");
    setUf("");
  }

  async function handleSearchCnpj() {
    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) {
      toast.error("Informe um CNPJ válido com 14 dígitos");
      return;
    }

    setLoadingCnpj(true);
    try {
      const response = await fetch(`/api/cnpj?cnpj=${cleanCnpj}`);
      if (response.ok) {
        const data = await response.json();
        if (!data.error) {
          setName(data.xFant || data.xNome || "");
          setRazaoSocial(data.xNome || "");
          setLogradouro(data.xLgr || "");
          setNumero(data.nro || "");
          setComplemento(data.xCpl || "");
          setBairro(data.xBairro || "");
          setCidade(data.xMun || "");
          setUf(data.UF || "");
          if (data.CEP) {
            setCep(formatCep(data.CEP));
          }
          toast.success("Dados do CNPJ carregados!");
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nome da empresa é obrigatório");
      return;
    }
    if (!cnpj.trim()) {
      toast.error("CNPJ é obrigatório");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await saveProfile({
        name: name.trim(),
        cnpj: cnpj.replace(/\D/g, ""),
        razaoSocial: razaoSocial.trim() || undefined,
        endereco: {
          cep: cep.replace(/\D/g, "") || undefined,
          logradouro: logradouro.trim() || undefined,
          numero: numero.trim() || undefined,
          complemento: complemento.trim() || undefined,
          bairro: bairro.trim() || undefined,
          cidade: cidade.trim() || undefined,
          uf: uf || undefined,
        },
      });

      if (result?.success) {
        toast.success("Empresa cadastrada com sucesso!");
        setOpen(false);
        resetForm();
        router.refresh();
      } else {
        toast.error(result?.error || "Erro ao salvar empresa");
      }
    } catch (error) {
      console.error("Erro ao salvar empresa:", error);
      toast.error("Erro ao salvar empresa");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (isOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nova empresa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Cadastrar nova empresa
            </DialogTitle>
            <DialogDescription>
              Informe o CNPJ e clique em Pesquisar para carregar os dados. Preencha
              todos os campos necessários antes de salvar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* CNPJ + Botão Pesquisar */}
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ *</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <MaskedInput
                    id="cnpj"
                    mask="cnpj"
                    value={cnpj}
                    onChange={setCnpj}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleSearchCnpj}
                  disabled={loadingCnpj || cnpj.replace(/\D/g, "").length !== 14}
                >
                  {loadingCnpj ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-1" />
                      Pesquisar
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Dados básicos */}
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
                <Label htmlFor="razaoSocial">Razão Social</Label>
                <Input
                  id="razaoSocial"
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  placeholder="Razão social da empresa"
                />
              </div>
            </div>

            {/* Endereço */}
            <div className="border-t pt-4 mt-2">
              <h4 className="text-sm font-semibold mb-4">Endereço</h4>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cep">CEP</Label>
                  <div className="relative">
                    <MaskedInput
                      id="cep"
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

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar empresa"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
