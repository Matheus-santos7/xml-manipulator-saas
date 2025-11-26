"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useForm, useFieldArray, FieldValues } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MaskedInput,
  validateCPF,
  validateCNPJ,
} from "@/components/ui/masked-input";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { saveScenario, deleteScenario } from "@/app/actions/settings";
import type { ScenarioDB } from "@/types";
import { Trash2, Plus, Pencil, Search, Loader2 } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Schema Zod para validação do formulário
// ─────────────────────────────────────────────────────────────────────────────
const cstMappingSchema = z.object({
  cfop: z.string().min(1, "CFOP obrigatório"),
  icms: z.string().optional(),
  ipi: z.string().optional(),
  pis: z.string().optional(),
  cofins: z.string().optional(),
});

const emitenteSchema = z.object({
  cnpj: z.string().optional(),
  xNome: z.string().optional(),
  xLgr: z.string().optional(),
  nro: z.string().optional(),
  xCpl: z.string().optional(),
  xBairro: z.string().optional(),
  xMun: z.string().optional(),
  UF: z.string().optional(),
  CEP: z.string().optional(),
  fone: z.string().optional(),
  IE: z.string().optional(),
});

const destinatarioSchema = z.object({
  tipoPessoa: z.string().optional(),
  cnpj: z.string().optional(),
  cpf: z.string().optional(),
  xNome: z.string().optional(),
  IE: z.string().optional(),
  xLgr: z.string().optional(),
  nro: z.string().optional(),
  xBairro: z.string().optional(),
  xMun: z.string().optional(),
  UF: z.string().optional(),
  CEP: z.string().optional(),
  fone: z.string().optional(),
});

const produtoSchema = z.object({
  xProd: z.string().optional(),
  cEAN: z.string().optional(),
  cProd: z.string().optional(),
  NCM: z.string().optional(),
  CEST: z.string().optional(),
  EXTIPI: z.string().optional(),
  CFOP: z.string().optional(),
});

const impostosSchema = z.object({
  pFCP: z.string().optional(),
  pICMS: z.string().optional(),
  pICMSUFDest: z.string().optional(),
  pICMSInter: z.string().optional(),
  pPIS: z.string().optional(),
  pCOFINS: z.string().optional(),
  pIPI: z.string().optional(),
});

const formSchema = z.object({
  id: z.string().optional(),
  profileId: z.string(),
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  active: z.boolean().default(true),

  // Flags de controle
  editar_emitente: z.boolean().default(false),
  editar_destinatario: z.boolean().default(false),
  editar_produtos: z.boolean().default(false),
  editar_impostos: z.boolean().default(false),
  editar_data: z.boolean().default(false),
  editar_refNFe: z.boolean().default(false),
  editar_cst: z.boolean().default(false),
  zerar_ipi_remessa_retorno: z.boolean().default(false),
  zerar_ipi_venda: z.boolean().default(false),
  reforma_tributaria: z.boolean().default(false),
  alterar_serie: z.boolean().default(false),
  alterar_cUF: z.boolean().default(false),
  aplicar_reducao_aliq: z.boolean().default(false),

  // Dados simples
  nova_data: z.string().optional(),
  nova_serie: z.string().optional(),
  novo_cUF: z.string().optional(),

  // Dados normalizados
  emitenteData: emitenteSchema.optional(),
  destinatarioData: destinatarioSchema.optional(),
  produtoData: produtoSchema.optional(),
  impostosData: impostosSchema.optional(),

  // Mapeamentos CST
  cstMappings: z.array(cstMappingSchema).optional(),
});

type FormValues = z.infer<typeof formSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Props do componente
// ─────────────────────────────────────────────────────────────────────────────
interface ScenarioEditorProps {
  profileId: string;
  scenarioToEdit?: ScenarioDB | null;
  onSaved?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────────────────────────────────────
export function ScenarioEditor({
  profileId,
  scenarioToEdit,
  onSaved,
}: ScenarioEditorProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUnsavedAlert, setShowUnsavedAlert] = useState(false);

  const isEditing = !!scenarioToEdit;

  // Valores padrão baseados no cenário existente ou vazios
  // Usa useMemo com scenarioToEdit completo como dependência
  const defaultValues: FormValues = useMemo(() => {
    // Helper para converter valores para string vazia
    const str = (val: unknown): string => {
      if (val === null || val === undefined) return "";
      if (typeof val === "string") return val;
      return String(val);
    };

    // Extrair dados do emitente
    const getEmitenteData = (): Record<string, string> => {
      const data = scenarioToEdit?.emitenteData || scenarioToEdit?.emitente;
      if (!data) return {};
      const d = data as Record<string, unknown>;
      return {
        cnpj: str(d.cnpj ?? d.CNPJ),
        xNome: str(d.xNome),
        xLgr: str(d.xLgr),
        nro: str(d.nro),
        xCpl: str(d.xCpl),
        xBairro: str(d.xBairro),
        xMun: str(d.xMun),
        UF: str(d.UF),
        fone: str(d.fone),
        IE: str(d.IE),
      };
    };

    // Extrair dados do destinatário
    const getDestinatarioData = (): Record<string, string> => {
      const data =
        scenarioToEdit?.destinatarioData || scenarioToEdit?.destinatario;
      if (!data) return {};
      const d = data as Record<string, unknown>;
      return {
        cnpj: str(d.cnpj ?? d.CNPJ),
        xNome: str(d.xNome),
        IE: str(d.IE),
        xLgr: str(d.xLgr),
        nro: str(d.nro),
        xBairro: str(d.xBairro),
        xMun: str(d.xMun),
        UF: str(d.UF),
        CEP: str(d.CEP),
        fone: str(d.fone),
      };
    };

    // Extrair dados do produto
    const getProdutoData = (): Record<string, string> => {
      const data =
        scenarioToEdit?.produtoData || scenarioToEdit?.produto_padrao;
      if (!data) return {};
      const d = data as Record<string, unknown>;
      return {
        xProd: str(d.xProd),
        cProd: str(d.cProd),
        cEAN: str(d.cEAN),
        NCM: str(d.NCM),
        CEST: str(d.CEST),
        EXTIPI: str(d.EXTIPI),
        CFOP: str(d.CFOP),
      };
    };

    // Extrair dados dos impostos
    const getImpostosData = (): Record<string, string> => {
      const data =
        scenarioToEdit?.impostosData || scenarioToEdit?.impostos_padrao;
      if (!data) return {};
      const d = data as Record<string, unknown>;
      return {
        pFCP: str(d.pFCP),
        pICMS: str(d.pICMS),
        pICMSUFDest: str(d.pICMSUFDest),
        pICMSInter: str(d.pICMSInter),
        pPIS: str(d.pPIS),
        pCOFINS: str(d.pCOFINS),
        pIPI: str(d.pIPI),
      };
    };

    return {
      id: scenarioToEdit?.id,
      profileId,
      name: scenarioToEdit?.name ?? "",
      active: scenarioToEdit?.active ?? true,

      // Flags
      editar_emitente: scenarioToEdit?.editar_emitente ?? false,
      editar_destinatario: scenarioToEdit?.editar_destinatario ?? false,
      editar_produtos: scenarioToEdit?.editar_produtos ?? false,
      editar_impostos: scenarioToEdit?.editar_impostos ?? false,
      editar_data: scenarioToEdit?.editar_data ?? false,
      editar_refNFe: scenarioToEdit?.editar_refNFe ?? false,
      editar_cst: scenarioToEdit?.editar_cst ?? false,
      zerar_ipi_remessa_retorno:
        scenarioToEdit?.zerar_ipi_remessa_retorno ?? false,
      zerar_ipi_venda: scenarioToEdit?.zerar_ipi_venda ?? false,
      reforma_tributaria: scenarioToEdit?.reforma_tributaria ?? false,
      alterar_serie: scenarioToEdit?.alterar_serie ?? false,
      alterar_cUF: scenarioToEdit?.alterar_cUF ?? false,
      aplicar_reducao_aliq: scenarioToEdit?.aplicar_reducao_aliq ?? false,

      // Dados simples
      nova_data: scenarioToEdit?.nova_data ?? "",
      nova_serie: scenarioToEdit?.nova_serie ?? "",
      novo_cUF: scenarioToEdit?.novo_cUF ?? "",

      // Dados normalizados
      emitenteData: getEmitenteData(),
      destinatarioData: getDestinatarioData(),
      produtoData: getProdutoData(),
      impostosData: getImpostosData(),

      // CST Mappings
      cstMappings:
        scenarioToEdit?.cstMappings?.map((m) => ({
          cfop: m.cfop,
          icms: m.icms ?? "",
          ipi: m.ipi ?? "",
          pis: m.pis ?? "",
          cofins: m.cofins ?? "",
        })) ?? [],
    };
  }, [profileId, scenarioToEdit]); // Agora depende do objeto completo

  const form = useForm({
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "cstMappings",
  });

  // Resetar formulário quando o modal é aberto com novos dados
  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultValues]);

  // Watch das flags para mostrar/esconder campos condicionais
  const watchEditarData = form.watch("editar_data");
  const watchAlterarSerie = form.watch("alterar_serie");
  const watchAlterarCuf = form.watch("alterar_cUF");
  const watchEditarEmitente = form.watch("editar_emitente");
  const watchEditarDestinatario = form.watch("editar_destinatario");
  const watchEditarProdutos = form.watch("editar_produtos");
  const watchEditarImpostos = form.watch("editar_impostos");
  const watchEditarCst = form.watch("editar_cst");
  const watchTipoPessoa = form.watch("destinatarioData.tipoPessoa") || "PJ";

  // Estados para loading das buscas
  const [loadingCep, setLoadingCep] = useState<
    "emitente" | "destinatario" | null
  >(null);
  const [loadingCnpj, setLoadingCnpj] = useState<
    "emitente" | "destinatario" | null
  >(null);

  // Função para buscar dados pelo CEP
  async function buscarCep(tipo: "emitente" | "destinatario") {
    const cepField =
      tipo === "emitente" ? "emitenteData.CEP" : "destinatarioData.CEP";
    const cep = form.getValues(cepField as keyof FormValues);

    if (!cep || String(cep).replace(/\D/g, "").length !== 8) {
      toast.error("Digite um CEP válido com 8 dígitos");
      return;
    }

    setLoadingCep(tipo);
    try {
      const response = await fetch(`/api/cep?cep=${cep}`);
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Erro ao buscar CEP");
        return;
      }

      // Preenche os campos de endereço
      const prefix = tipo === "emitente" ? "emitenteData" : "destinatarioData";
      form.setValue(`${prefix}.xLgr` as keyof FormValues, data.xLgr || "");
      form.setValue(
        `${prefix}.xBairro` as keyof FormValues,
        data.xBairro || ""
      );
      form.setValue(`${prefix}.xMun` as keyof FormValues, data.xMun || "");
      form.setValue(`${prefix}.UF` as keyof FormValues, data.UF || "");
      if (data.xCpl) {
        form.setValue(`${prefix}.xCpl` as keyof FormValues, data.xCpl);
      }

      toast.success("Endereço preenchido!");
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      toast.error("Erro ao buscar CEP");
    } finally {
      setLoadingCep(null);
    }
  }

  // Função para buscar dados pelo CNPJ
  async function buscarCnpj(tipo: "emitente" | "destinatario") {
    const cnpjField =
      tipo === "emitente" ? "emitenteData.cnpj" : "destinatarioData.cnpj";
    const cnpj = form.getValues(cnpjField as keyof FormValues);

    if (!cnpj || String(cnpj).replace(/\D/g, "").length !== 14) {
      toast.error("Digite um CNPJ válido com 14 dígitos");
      return;
    }

    setLoadingCnpj(tipo);
    try {
      const response = await fetch(`/api/cnpj?cnpj=${cnpj}`);
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Erro ao buscar CNPJ");
        return;
      }

      // Preenche os campos
      const prefix = tipo === "emitente" ? "emitenteData" : "destinatarioData";
      form.setValue(`${prefix}.xNome` as keyof FormValues, data.xNome || "");
      form.setValue(`${prefix}.xLgr` as keyof FormValues, data.xLgr || "");
      form.setValue(`${prefix}.nro` as keyof FormValues, data.nro || "");
      form.setValue(`${prefix}.xCpl` as keyof FormValues, data.xCpl || "");
      form.setValue(
        `${prefix}.xBairro` as keyof FormValues,
        data.xBairro || ""
      );
      form.setValue(`${prefix}.xMun` as keyof FormValues, data.xMun || "");
      form.setValue(`${prefix}.UF` as keyof FormValues, data.UF || "");
      form.setValue(`${prefix}.CEP` as keyof FormValues, data.CEP || "");
      form.setValue(`${prefix}.fone` as keyof FormValues, data.fone || "");

      toast.success("Dados da empresa preenchidos!");
    } catch (error) {
      console.error("Erro ao buscar CNPJ:", error);
      toast.error("Erro ao buscar CNPJ");
    } finally {
      setLoadingCnpj(null);
    }
  }

  async function onSubmit(values: FieldValues) {
    setIsSubmitting(true);
    try {
      await saveScenario(values as Parameters<typeof saveScenario>[0]);
      toast.success(isEditing ? "Cenário atualizado!" : "Cenário criado!");
      setOpen(false);
      form.reset(defaultValues);
      onSaved?.();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar cenário");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!scenarioToEdit?.id) return;

    setIsSubmitting(true);
    try {
      await deleteScenario(scenarioToEdit.id);
      toast.success("Cenário excluído com sucesso!");
      setOpen(false);
      onSaved?.();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir cenário");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Função para lidar com tentativa de fechar o modal
  function handleOpenChange(newOpen: boolean) {
    if (!newOpen && form.formState.isDirty) {
      // Há alterações não salvas, mostrar alerta
      setShowUnsavedAlert(true);
    } else {
      setOpen(newOpen);
      if (!newOpen) {
        form.reset(defaultValues);
      }
    }
  }

  // Função para descartar alterações e fechar
  function handleDiscardChanges() {
    setShowUnsavedAlert(false);
    form.reset(defaultValues);
    setOpen(false);
  }

  // Função para salvar e fechar
  async function handleSaveAndClose() {
    setShowUnsavedAlert(false);
    await form.handleSubmit(onSubmit)();
  }

  return (
    <>
      {/* AlertDialog para alterações não salvas */}
      <AlertDialog open={showUnsavedAlert} onOpenChange={setShowUnsavedAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem alterações não salvas. Deseja salvar antes de fechar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setShowUnsavedAlert(false)}>
              Continuar editando
            </AlertDialogCancel>
            <Button variant="outline" onClick={handleDiscardChanges}>
              Descartar
            </Button>
            <AlertDialogAction
              onClick={handleSaveAndClose}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Salvando..." : "Salvar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            variant={isEditing ? "outline" : "default"}
            size={isEditing ? "sm" : "default"}
          >
            {isEditing ? <Pencil className="h-4 w-4" /> : "Novo Cenário"}
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-[90vw] w-[1200px] max-h-[90vh] h-auto flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>
              {isEditing ? "Editar Cenário" : "Novo Cenário"}
            </DialogTitle>
            {isEditing && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    type="button"
                    disabled={isSubmitting}
                    className="mr-8"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir o cenário &quot;
                      {scenarioToEdit?.name}&quot;? Esta ação não pode ser
                      desfeita e todos os mapeamentos CST associados serão
                      removidos.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <Tabs
                defaultValue="geral"
                className="flex-1 flex flex-col overflow-hidden"
              >
                <TabsList className="grid w-full grid-cols-6 gap-1">
                  <TabsTrigger value="geral">Geral</TabsTrigger>
                  <TabsTrigger value="emitente">Emitente</TabsTrigger>
                  <TabsTrigger value="destinatario">Destinatário</TabsTrigger>
                  <TabsTrigger value="produto">Produto</TabsTrigger>
                  <TabsTrigger value="impostos">Impostos</TabsTrigger>
                  <TabsTrigger value="cst">Mapeamento CST</TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1 pr-4 mt-4">
                  {/* ─────────────── ABA GERAL ─────────────── */}
                  <TabsContent value="geral" className="space-y-4 mt-0">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome do Cenário *</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: Venda SP" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="active"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3">
                            <FormLabel>Ativo</FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {/* Flags de edição */}
                      <FormField
                        control={form.control}
                        name="editar_data"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-2">
                            <FormLabel className="text-sm">
                              Editar Data
                            </FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="alterar_serie"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-2">
                            <FormLabel className="text-sm">
                              Alterar Série
                            </FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="alterar_cUF"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-2">
                            <FormLabel className="text-sm">
                              Alterar UF
                            </FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="editar_emitente"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-2">
                            <FormLabel className="text-sm">
                              Editar Emitente
                            </FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="editar_destinatario"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-2">
                            <FormLabel className="text-sm">
                              Editar Destinatário
                            </FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="editar_produtos"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-2">
                            <FormLabel className="text-sm">
                              Editar Produtos
                            </FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="editar_impostos"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-2">
                            <FormLabel className="text-sm">
                              Editar Impostos
                            </FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="editar_cst"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-2">
                            <FormLabel className="text-sm">
                              Editar CST
                            </FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="zerar_ipi_remessa_retorno"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-2">
                            <FormLabel className="text-sm">
                              Zerar IPI Rem/Ret
                            </FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="zerar_ipi_venda"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-2">
                            <FormLabel className="text-sm">
                              Zerar IPI Venda
                            </FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="reforma_tributaria"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-2">
                            <FormLabel className="text-sm">
                              Reforma Tributária
                            </FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="aplicar_reducao_aliq"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-2">
                            <FormLabel className="text-sm">
                              Redução Alíquota
                            </FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Campos condicionais em grid */}
                    <div className="grid grid-cols-3 gap-4">
                      {watchEditarData && (
                        <FormField
                          control={form.control}
                          name="nova_data"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nova Data</FormLabel>
                              <FormControl>
                                <MaskedInput
                                  mask="date"
                                  placeholder="01/01/2025"
                                  {...field}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}

                      {watchAlterarSerie && (
                        <FormField
                          control={form.control}
                          name="nova_serie"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nova Série</FormLabel>
                              <FormControl>
                                <Input placeholder="1" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}

                      {watchAlterarCuf && (
                        <FormField
                          control={form.control}
                          name="novo_cUF"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Novo Código UF</FormLabel>
                              <FormControl>
                                <Input placeholder="35" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </TabsContent>

                  {/* ─────────────── ABA MAPEAMENTO CST ─────────────── */}
                  <TabsContent value="cst" className="space-y-4 mt-0">
                    {!watchEditarCst && (
                      <p className="text-sm text-muted-foreground p-4 border rounded-lg">
                        Ative a opção &quot;Editar CST&quot; na aba Geral para
                        configurar os mapeamentos.
                      </p>
                    )}

                    {watchEditarCst && (
                      <div className="space-y-3 border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-base">
                            Mapeamentos CST por CFOP
                          </FormLabel>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              append({
                                cfop: "",
                                icms: "",
                                ipi: "",
                                pis: "",
                                cofins: "",
                              })
                            }
                          >
                            <Plus className="h-4 w-4 mr-1" /> Adicionar
                          </Button>
                        </div>

                        {fields.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            Nenhum mapeamento configurado
                          </p>
                        )}

                        {fields.map((field, index) => (
                          <div
                            key={field.id}
                            className="grid grid-cols-6 gap-2 items-end"
                          >
                            <FormField
                              control={form.control}
                              name={`cstMappings.${index}.cfop`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">
                                    CFOP
                                  </FormLabel>
                                  <FormControl>
                                    <MaskedInput
                                      mask="cfop"
                                      placeholder="5102"
                                      {...field}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`cstMappings.${index}.icms`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">
                                    ICMS
                                  </FormLabel>
                                  <FormControl>
                                    <Input placeholder="00" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`cstMappings.${index}.ipi`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">IPI</FormLabel>
                                  <FormControl>
                                    <Input placeholder="50" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`cstMappings.${index}.pis`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">PIS</FormLabel>
                                  <FormControl>
                                    <Input placeholder="01" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`cstMappings.${index}.cofins`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">
                                    COFINS
                                  </FormLabel>
                                  <FormControl>
                                    <Input placeholder="01" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* ─────────────── ABA EMITENTE ─────────────── */}
                  <TabsContent value="emitente" className="space-y-4 mt-0">
                    {!watchEditarEmitente && (
                      <p className="text-sm text-muted-foreground p-4 border rounded-lg">
                        Ative a opção &quot;Editar Emitente&quot; na aba Geral
                        para configurar os dados.
                      </p>
                    )}

                    {watchEditarEmitente && (
                      <div className="space-y-4">
                        {/* Linha com CNPJ e botão de busca */}
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="emitenteData.cnpj"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>CNPJ</FormLabel>
                                <div className="flex gap-2">
                                  <FormControl>
                                    <MaskedInput
                                      mask="cnpj"
                                      placeholder="00.000.000/0000-00"
                                      {...field}
                                      onBlur={(e) => {
                                        const cnpj = e.target.value;
                                        if (
                                          cnpj &&
                                          cnpj.replace(/\D/g, "").length === 14
                                        ) {
                                          if (!validateCNPJ(cnpj)) {
                                            toast.error(
                                              "CNPJ inválido! Verifique os dígitos."
                                            );
                                          }
                                        }
                                      }}
                                    />
                                  </FormControl>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => buscarCnpj("emitente")}
                                    disabled={loadingCnpj === "emitente"}
                                    title="Buscar dados pelo CNPJ"
                                  >
                                    {loadingCnpj === "emitente" ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Search className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="emitenteData.xNome"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Razão Social</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="emitenteData.IE"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Inscrição Estadual</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="emitenteData.fone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Telefone</FormLabel>
                                <FormControl>
                                  <MaskedInput mask="phone" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Linha com CEP e botão de busca */}
                        <div className="grid grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="emitenteData.CEP"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>CEP</FormLabel>
                                <div className="flex gap-2">
                                  <FormControl>
                                    <MaskedInput
                                      mask="cep"
                                      placeholder="00000-000"
                                      {...field}
                                    />
                                  </FormControl>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => buscarCep("emitente")}
                                    disabled={loadingCep === "emitente"}
                                    title="Buscar endereço pelo CEP"
                                  >
                                    {loadingCep === "emitente" ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Search className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="emitenteData.xLgr"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Logradouro</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="emitenteData.nro"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Número</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="emitenteData.xCpl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Complemento</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="emitenteData.xBairro"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Bairro</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="emitenteData.xMun"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Município</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="emitenteData.UF"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>UF</FormLabel>
                                <FormControl>
                                  <MaskedInput
                                    mask="uf"
                                    maxLength={2}
                                    {...field}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* ─────────────── ABA DESTINATÁRIO ─────────────── */}
                  <TabsContent value="destinatario" className="space-y-4 mt-0">
                    {!watchEditarDestinatario && (
                      <p className="text-sm text-muted-foreground p-4 border rounded-lg">
                        Ative a opção &quot;Editar Destinatário&quot; na aba
                        Geral para configurar os dados.
                      </p>
                    )}

                    {watchEditarDestinatario && (
                      <div className="space-y-4">
                        {/* Seletor PJ/PF */}
                        <div className="grid grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="destinatarioData.tipoPessoa"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tipo de Pessoa</FormLabel>
                                <FormControl>
                                  <select
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    value={field.value || "PJ"}
                                    onChange={field.onChange}
                                  >
                                    <option value="PJ">
                                      Pessoa Jurídica (CNPJ)
                                    </option>
                                    <option value="PF">
                                      Pessoa Física (CPF)
                                    </option>
                                  </select>
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          {/* CNPJ - apenas para PJ */}
                          {watchTipoPessoa === "PJ" && (
                            <FormField
                              control={form.control}
                              name="destinatarioData.cnpj"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>CNPJ</FormLabel>
                                  <div className="flex gap-2">
                                    <FormControl>
                                      <MaskedInput
                                        mask="cnpj"
                                        placeholder="00.000.000/0000-00"
                                        {...field}
                                        onBlur={(e) => {
                                          const cnpj = e.target.value;
                                          if (
                                            cnpj &&
                                            cnpj.replace(/\D/g, "").length ===
                                              14
                                          ) {
                                            if (!validateCNPJ(cnpj)) {
                                              toast.error(
                                                "CNPJ inválido! Verifique os dígitos."
                                              );
                                            }
                                          }
                                        }}
                                      />
                                    </FormControl>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      onClick={() => buscarCnpj("destinatario")}
                                      disabled={loadingCnpj === "destinatario"}
                                      title="Buscar dados pelo CNPJ"
                                    >
                                      {loadingCnpj === "destinatario" ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Search className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                </FormItem>
                              )}
                            />
                          )}

                          {/* CPF - apenas para PF */}
                          {watchTipoPessoa === "PF" && (
                            <FormField
                              control={form.control}
                              name="destinatarioData.cpf"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>CPF</FormLabel>
                                  <FormControl>
                                    <MaskedInput
                                      mask="cpf"
                                      placeholder="000.000.000-00"
                                      {...field}
                                      onBlur={(e) => {
                                        const cpf = e.target.value;
                                        if (
                                          cpf &&
                                          cpf.replace(/\D/g, "").length === 11
                                        ) {
                                          if (!validateCPF(cpf)) {
                                            toast.error(
                                              "CPF inválido! Verifique os dígitos."
                                            );
                                          }
                                        }
                                      }}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          )}

                          <FormField
                            control={form.control}
                            name="destinatarioData.xNome"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  {watchTipoPessoa === "PJ"
                                    ? "Razão Social"
                                    : "Nome Completo"}
                                </FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {watchTipoPessoa === "PJ" && (
                            <FormField
                              control={form.control}
                              name="destinatarioData.IE"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Inscrição Estadual</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          )}
                          <FormField
                            control={form.control}
                            name="destinatarioData.fone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Telefone</FormLabel>
                                <FormControl>
                                  <MaskedInput mask="phone" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Linha com CEP e botão de busca */}
                        <div className="grid grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="destinatarioData.CEP"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>CEP</FormLabel>
                                <div className="flex gap-2">
                                  <FormControl>
                                    <MaskedInput
                                      mask="cep"
                                      placeholder="00000-000"
                                      {...field}
                                    />
                                  </FormControl>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => buscarCep("destinatario")}
                                    disabled={loadingCep === "destinatario"}
                                    title="Buscar endereço pelo CEP"
                                  >
                                    {loadingCep === "destinatario" ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Search className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="destinatarioData.xLgr"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Logradouro</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="destinatarioData.nro"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Número</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="destinatarioData.xBairro"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Bairro</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="destinatarioData.xMun"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Município</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="destinatarioData.UF"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>UF</FormLabel>
                                <FormControl>
                                  <MaskedInput
                                    mask="uf"
                                    maxLength={2}
                                    {...field}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* ─────────────── ABA PRODUTO ─────────────── */}
                  <TabsContent value="produto" className="space-y-4 mt-0">
                    {!watchEditarProdutos && (
                      <p className="text-sm text-muted-foreground p-4 border rounded-lg">
                        Ative a opção &quot;Editar Produtos&quot; na aba Geral
                        para configurar os dados.
                      </p>
                    )}

                    {watchEditarProdutos && (
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="produtoData.xProd"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Descrição do Produto</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="produtoData.cProd"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Código do Produto</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="produtoData.cEAN"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Código EAN/GTIN</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="produtoData.NCM"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>NCM</FormLabel>
                              <FormControl>
                                <MaskedInput
                                  mask="ncm"
                                  placeholder="0000.00.00"
                                  {...field}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="produtoData.CEST"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CEST</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </TabsContent>

                  {/* ─────────────── ABA IMPOSTOS ─────────────── */}
                  <TabsContent value="impostos" className="space-y-4 mt-0">
                    {!watchEditarImpostos && (
                      <p className="text-sm text-muted-foreground p-4 border rounded-lg">
                        Ative a opção &quot;Editar Impostos&quot; na aba Geral
                        para configurar os dados.
                      </p>
                    )}

                    {watchEditarImpostos && (
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="impostosData.pICMS"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Alíquota ICMS (%)</FormLabel>
                              <FormControl>
                                <MaskedInput
                                  mask="percent"
                                  placeholder="18,00"
                                  {...field}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="impostosData.pFCP"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Alíquota FCP (%)</FormLabel>
                              <FormControl>
                                <MaskedInput
                                  mask="percent"
                                  placeholder="2,00"
                                  {...field}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="impostosData.pICMSUFDest"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>ICMS UF Destino (%)</FormLabel>
                              <FormControl>
                                <MaskedInput
                                  mask="percent"
                                  placeholder="0,00"
                                  {...field}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="impostosData.pICMSInter"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>ICMS Interestadual (%)</FormLabel>
                              <FormControl>
                                <MaskedInput
                                  mask="percent"
                                  placeholder="0,00"
                                  {...field}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="impostosData.pPIS"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Alíquota PIS (%)</FormLabel>
                              <FormControl>
                                <MaskedInput
                                  mask="percent"
                                  placeholder="1,65"
                                  {...field}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="impostosData.pCOFINS"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Alíquota COFINS (%)</FormLabel>
                              <FormControl>
                                <MaskedInput
                                  mask="percent"
                                  placeholder="7,60"
                                  {...field}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="impostosData.pIPI"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Alíquota IPI (%)</FormLabel>
                              <FormControl>
                                <MaskedInput
                                  mask="percent"
                                  placeholder="5,00"
                                  {...field}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </TabsContent>
                </ScrollArea>
              </Tabs>

              <DialogFooter className="mt-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? "Salvando..."
                    : isEditing
                    ? "Atualizar"
                    : "Criar Cenário"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
