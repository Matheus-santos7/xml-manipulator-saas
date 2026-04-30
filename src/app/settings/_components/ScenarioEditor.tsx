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
  FormDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { saveScenario, deleteScenario } from "@/app/actions/scenario";
import type { ScenarioDB } from "@/types";
import { ScenarioBatchImport } from "./ScenarioBatchImport";
import {
  Trash2,
  Plus,
  Pencil,
  Search,
  Loader2,
  Copy,
  Shuffle,
} from "lucide-react";
import { DESTINATARIOS_DISPONIVEIS } from "@/lib/constants";
import { MELI_CDS } from "@/lib/constants/meli-cds";

// ─────────────────────────────────────────────────────────────────────────────
// Schema Zod para validação do formulário
// ─────────────────────────────────────────────────────────────────────────────

const emitenteSchema = z.object({
  cnpj: z.string().optional(),
  xNome: z.string().optional(),
  xLgr: z.string().optional(),
  nro: z.string().optional(),
  xCpl: z.string().optional(),
  xBairro: z.string().optional(),
  cMun: z.string().optional(),
  xMun: z.string().optional(),
  UF: z.string().optional(),
  CEP: z.string().optional(),
  fone: z.string().optional(),
  IE: z.string().optional(),
});

const destinatarioSchema = z.object({
  cnpj: z.string().optional(),
  cpf: z.string().optional(),
  centroDistribuicao: z.string().optional(),
  xNome: z.string().optional(),
  IE: z.string().optional(),
  xLgr: z.string().optional(),
  nro: z.string().optional(),
  xBairro: z.string().optional(),
  cMun: z.string().optional(),
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
  regraTributariaNome: z.string().optional(),
  origem: z.string().optional(), // Origem do produto
  vUnComVenda: z.string().optional(),
  vUnComTransferencia: z.string().optional(),
  pesoBruto: z.string().optional(),
  pesoLiquido: z.string().optional(),
  isPrincipal: z.boolean().default(false),
  ordem: z.number().default(0),
});

const formSchema = z.object({
  id: z.string().optional(),
  profileId: z.string(),
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  active: z.boolean().default(true),

  // Flags de controle
  editar_emitente: z.boolean().default(false),
  editar_destinatario_pj: z.boolean().default(false),
  editar_destinatario_pf: z.boolean().default(false),
  editar_destinatario_remessa: z.boolean().default(false),
  destinatarioRemessaMlCdId: z.string().optional(),
  editar_produtos: z.boolean().default(false),
  aplicar_regras_tributarias: z.boolean().default(false),
  editar_data: z.boolean().default(false),
  editar_refNFe: z.boolean().default(false),
  alterar_serie: z.boolean().default(false),
  alterar_cUF: z.boolean().default(false),

  // Dados simples
  nova_data: z.string().optional(),
  nova_serie: z.string().optional(),
  novo_cUF: z.string().optional(),

  // Dados normalizados
  emitenteData: emitenteSchema.optional(),
  destinatarioData: destinatarioSchema.optional(),
  produtoData: z.array(produtoSchema).default([]),
});

type FormValues = z.infer<typeof formSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Props do componente
// ─────────────────────────────────────────────────────────────────────────────
interface ScenarioEditorProps {
  profileId: string;
  scenarioToEdit?: ScenarioDB | null;
  onSaved?: () => void;
  isDuplicating?: boolean; // Quando true, cria um novo cenário baseado no scenarioToEdit
  /**
   * Lista de nomes de regras tributárias importadas para o profile atual.
   * Quando vazia, o campo cai num input de texto livre.
   */
  taxRuleNames?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────────────────────────────────────
export function ScenarioEditor({
  profileId,
  scenarioToEdit,
  onSaved,
  isDuplicating = false,
  taxRuleNames = [],
}: ScenarioEditorProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUnsavedAlert, setShowUnsavedAlert] = useState(false);

  // Se estiver duplicando, não é edição (cria novo cenário)
  const isEditing = !!scenarioToEdit && !isDuplicating;

  const defaultValues: FormValues = useMemo(() => {
    const str = (val: unknown): string => {
      if (val === null || val === undefined) return "";
      if (typeof val === "string") return val;
      return String(val);
    };

    const getEmitenteData = (): Record<string, string> => {
      const data =
        scenarioToEdit?.ScenarioEmitente ||
        scenarioToEdit?.emitenteData ||
        scenarioToEdit?.emitente;
      if (!data) return {};
      const d = data as Record<string, unknown>;
      return {
        cnpj: str(d.cnpj ?? d.CNPJ),
        xNome: str(d.xNome),
        xLgr: str(d.xLgr),
        nro: str(d.nro),
        xCpl: str(d.xCpl),
        xBairro: str(d.xBairro),
        cMun: str(d.cMun),
        xMun: str(d.xMun),
        UF: str(d.UF),
        CEP: str(d.CEP),
        fone: str(d.fone),
        IE: str(d.IE),
      };
    };

    const getDestinatarioData = (): Record<string, string> => {
      const data =
        scenarioToEdit?.ScenarioDestinatario ||
        scenarioToEdit?.destinatarioData ||
        scenarioToEdit?.destinatario;
      if (!data) return {};
      const d = data as Record<string, unknown>;

      return {
        cnpj: str(d.cnpj ?? d.CNPJ),
        cpf: str(d.cpf ?? d.CPF),
        centroDistribuicao: str(d.centroDistribuicao ?? d.nomeFantasia),
        xNome: str(d.xNome),
        IE: str(d.IE),
        xLgr: str(d.xLgr),
        nro: str(d.nro),
        xBairro: str(d.xBairro),
        cMun: str(d.cMun),
        xMun: str(d.xMun),
        UF: str(d.UF),
        CEP: str(d.CEP),
        fone: str(d.fone),
      };
    };

    const getProdutoData = () => {
      const data =
        scenarioToEdit?.ScenarioProduto || scenarioToEdit?.produtoData;

      if (!data) return [];

      if (Array.isArray(data)) {
        return data
          .map((d) => ({
            xProd: str(d.xProd),
            cProd: str(d.cProd),
            cEAN: str(d.cEAN),
            NCM: str(d.NCM),
            regraTributariaNome: str(d.regraTributariaNome),
            origem: str(d.origem),
            vUnComVenda: str(d.vUnComVenda),
            vUnComTransferencia: str(d.vUnComTransferencia),
            pesoBruto: str(d.pesoBruto),
            pesoLiquido: str(d.pesoLiquido),
            isPrincipal: Boolean(d.isPrincipal ?? false),
            ordem: Number(d.ordem ?? 0),
          }))
          .sort((a, b) => a.ordem - b.ordem);
      }

      const d = data as Record<string, unknown>;
      return [
        {
          xProd: str(d.xProd),
          cProd: str(d.cProd),
          cEAN: str(d.cEAN),
          NCM: str(d.NCM),
          regraTributariaNome: str(d.regraTributariaNome),
          origem: str(d.origem),
          vUnComVenda: str(d.vUnComVenda),
          vUnComTransferencia: str(d.vUnComTransferencia),
          pesoBruto: str(d.pesoBruto),
          pesoLiquido: str(d.pesoLiquido),
          isPrincipal: true,
          ordem: 1,
        },
      ];
    };

    const scenarioName = isDuplicating
      ? `${scenarioToEdit?.name ?? ""} (Cópia)`
      : scenarioToEdit?.name ?? "";

    return {
      id: isDuplicating ? undefined : scenarioToEdit?.id,
      profileId,
      name: scenarioName,
      active: scenarioToEdit?.active ?? true,
      editar_emitente: scenarioToEdit?.editar_emitente ?? false,
      editar_destinatario_pj: scenarioToEdit?.editar_destinatario_pj ?? false,
      editar_destinatario_pf: scenarioToEdit?.editar_destinatario_pf ?? false,
      editar_destinatario_remessa:
        scenarioToEdit?.editar_destinatario_remessa ?? false,
      destinatarioRemessaMlCdId:
        scenarioToEdit?.destinatarioRemessaMlCdId ?? "",
      editar_produtos: scenarioToEdit?.editar_produtos ?? false,
      aplicar_regras_tributarias:
        scenarioToEdit?.aplicar_regras_tributarias ?? false,
      editar_data: scenarioToEdit?.editar_data ?? false,
      editar_refNFe: scenarioToEdit?.editar_refNFe ?? false,
      alterar_serie: scenarioToEdit?.alterar_serie ?? false,
      alterar_cUF: scenarioToEdit?.alterar_cUF ?? false,
      nova_data: scenarioToEdit?.nova_data ?? "",
      nova_serie: scenarioToEdit?.nova_serie ?? "",
      novo_cUF: scenarioToEdit?.novo_cUF ?? "",
      emitenteData: getEmitenteData(),
      destinatarioData: getDestinatarioData(),
      produtoData: getProdutoData(),
    };
  }, [profileId, scenarioToEdit, isDuplicating]);

  const form = useForm({
    defaultValues,
  });

  const {
    fields: produtoFields,
    append: appendProduto,
    remove: removeProduto,
    move: moveProduto,
  } = useFieldArray({
    control: form.control,
    name: "produtoData",
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
  const watchEditarDestinatarioPJ = form.watch("editar_destinatario_pj");
  const watchEditarDestinatarioPF = form.watch("editar_destinatario_pf");
  const watchEditarDestinatarioRemessa = form.watch(
    "editar_destinatario_remessa"
  );
  const watchEditarProdutos = form.watch("editar_produtos");

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
      if (tipo === "emitente" || tipo === "destinatario") {
        form.setValue(
          `${prefix}.cMun` as keyof FormValues,
          String(data.cMun || "")
        );
      }
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
      if (tipo === "emitente" || tipo === "destinatario") {
        form.setValue(
          `${prefix}.cMun` as keyof FormValues,
          String(data.cMun || "")
        );
      }
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
    const emitenteData = (values.emitenteData || {}) as Record<string, unknown>;
    const destinatarioData = (values.destinatarioData ||
      {}) as Record<string, unknown>;

    const cMunEmitente = String(emitenteData.cMun || "").trim();
    const cMunDestinatario = String(destinatarioData.cMun || "").trim();
    const ufEmitente = String(emitenteData.UF || "")
      .trim()
      .toUpperCase();
    const ieEmitente = String(emitenteData.IE || "").trim();

    const cMunEmitenteValido = /^\d{7}$/.test(cMunEmitente);
    const cMunDestinatarioValido = /^\d{7}$/.test(cMunDestinatario);

    if (values.editar_emitente && !cMunEmitente) {
      toast.error(
        "Preencha o cMun (código IBGE) do emitente para salvar o cenário."
      );
      return;
    }
    if (values.editar_emitente && !cMunEmitenteValido) {
      toast.error("O cMun do emitente deve conter exatamente 7 dígitos.");
      return;
    }
    if (values.editar_emitente && ufEmitente && !ieEmitente) {
      toast.error(
        `Para saída em ${ufEmitente}, preencha a Inscrição Estadual (IE) do emitente.`
      );
      return;
    }

    if (
      (values.editar_destinatario_pj || values.editar_destinatario_pf) &&
      !cMunDestinatario
    ) {
      toast.error(
        "Preencha o cMun (código IBGE) do destinatário para salvar o cenário."
      );
      return;
    }
    if (
      (values.editar_destinatario_pj || values.editar_destinatario_pf) &&
      !cMunDestinatarioValido
    ) {
      toast.error("O cMun do destinatário deve conter exatamente 7 dígitos.");
      return;
    }

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
            variant={isEditing || isDuplicating ? "outline" : "default"}
            size={isEditing || isDuplicating ? "sm" : "default"}
            title={
              isDuplicating
                ? "Duplicar cenário"
                : isEditing
                ? "Editar cenário"
                : "Criar novo cenário"
            }
          >
            {isDuplicating ? (
              <Copy className="h-4 w-4" />
            ) : isEditing ? (
              <Pencil className="h-4 w-4" />
            ) : (
              "Novo Cenário"
            )}
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-[90vw] w-[1200px] max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>
              {isDuplicating
                ? "Duplicar Cenário"
                : isEditing
                ? "Editar Cenário"
                : "Novo Cenário"}
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
                      desfeita.
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
          {!isEditing && !isDuplicating && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground mb-2">
                Importação rápida por planilha (opcional)
              </p>
              <ScenarioBatchImport profileId={profileId} />
            </div>
          )}

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <Tabs
                defaultValue="geral"
                className="flex-1 flex flex-col overflow-hidden"
              >
                <TabsList className="grid w-full grid-cols-4 gap-1">
                  <TabsTrigger value="geral">Geral</TabsTrigger>
                  <TabsTrigger value="emitente">Emitente</TabsTrigger>
                  <TabsTrigger value="destinatario">Destinatário</TabsTrigger>
                  <TabsTrigger value="produto">Produto</TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-y-auto pr-4 mt-4 max-h-[calc(90vh-220px)]">
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
                        name="editar_destinatario_pj"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-2">
                            <FormLabel className="text-sm">
                              Editar Destinatário PJ
                            </FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  field.onChange(checked);
                                  // Se ativar PJ, desativa PF
                                  if (checked) {
                                    form.setValue(
                                      "editar_destinatario_pf",
                                      false
                                    );
                                  }
                                }}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="editar_destinatario_pf"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-2">
                            <FormLabel className="text-sm">
                              Editar Destinatário PF
                            </FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  field.onChange(checked);
                                  // Se ativar PF, desativa PJ
                                  if (checked) {
                                    form.setValue(
                                      "editar_destinatario_pj",
                                      false
                                    );
                                  }
                                }}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="editar_destinatario_remessa"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-2">
                            <FormLabel className="text-sm">
                              Destinatário Remessa (CD ML)
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
                        name="aplicar_regras_tributarias"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-2">
                            <FormLabel className="text-sm">
                              Aplicar regras tributárias
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

                        <div className="grid grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="emitenteData.cMun"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>cMun (IBGE)</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="3550308"
                                    inputMode="numeric"
                                    maxLength={7}
                                    {...field}
                                    onChange={(e) =>
                                      field.onChange(
                                        e.target.value.replace(/\D/g, "").slice(0, 7)
                                      )
                                    }
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
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
                    {watchEditarDestinatarioRemessa && (
                      <div className="space-y-3 rounded-lg border p-4 bg-blue-50/40 dark:bg-blue-950/20">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-semibold">
                              Destinatário de Remessa (CD Mercado Livre)
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              Quando ativo, NFes com CFOP de remessa/retorno
                              (5901-5949 / 6901-6949) terão a tag{" "}
                              <code>&lt;dest&gt;</code> reescrita com os dados
                              do CD selecionado abaixo. Isso garante que a UF
                              de destino bata com a regra tributária aplicada.
                            </p>
                          </div>
                        </div>

                        <FormField
                          control={form.control}
                          name="destinatarioRemessaMlCdId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm">
                                Centro de Distribuição
                              </FormLabel>
                              <Select
                                value={field.value || ""}
                                onValueChange={field.onChange}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione o CD do Mercado Livre" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="max-h-80">
                                  {MELI_CDS.map((cd) => (
                                    <SelectItem key={cd.id} value={cd.id}>
                                      {cd.uf} • {cd.name} ({cd.cidade})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormDescription className="text-xs">
                                Os dados de CNPJ, IE, endereço e UF do CD
                                selecionado substituem os do destinatário
                                original em notas de remessa/retorno.
                              </FormDescription>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {!watchEditarDestinatarioPJ &&
                      !watchEditarDestinatarioPF &&
                      !watchEditarDestinatarioRemessa && (
                        <p className="text-sm text-muted-foreground p-4 border rounded-lg">
                          Ative a opção &quot;Editar Destinatário PJ&quot;,
                          &quot;Editar Destinatário PF&quot; ou
                          &quot;Destinatário Remessa (CD ML)&quot; na aba
                          Geral para configurar os dados.
                        </p>
                      )}

                    {(watchEditarDestinatarioPJ ||
                      watchEditarDestinatarioPF) && (
                      <div className="space-y-4">
                        {/* Indicador do tipo selecionado + Botão Sortear */}
                        <div className="p-3 bg-muted rounded-lg flex items-center justify-between">
                          <span className="text-sm font-medium">
                            Tipo:{" "}
                            {watchEditarDestinatarioPJ
                              ? "Pessoa Jurídica (CNPJ)"
                              : "Pessoa Física (CPF)"}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              // Filtra destinatários pelo tipo selecionado
                              const tipoFiltro = watchEditarDestinatarioPJ
                                ? "PJ"
                                : "PF";
                              const destinatariosFiltrados =
                                DESTINATARIOS_DISPONIVEIS.filter(
                                  (d) => d.tipo === tipoFiltro
                                );

                              if (destinatariosFiltrados.length === 0) {
                                toast.error(
                                  `Nenhum destinatário ${
                                    tipoFiltro === "PJ"
                                      ? "Pessoa Jurídica"
                                      : "Pessoa Física"
                                  } disponível para sorteio.`
                                );
                                return;
                              }

                              // Sorteia um destinatário aleatório
                              const sorteado =
                                destinatariosFiltrados[
                                  Math.floor(
                                    Math.random() *
                                      destinatariosFiltrados.length
                                  )
                                ];

                              let cMunSorteado = String(sorteado.cMun || "");
                              if (!/^\d{7}$/.test(cMunSorteado)) {
                                try {
                                  const cepRes = await fetch(
                                    `/api/cep?cep=${sorteado.CEP}`
                                  );
                                  if (cepRes.ok) {
                                    const cepData = await cepRes.json();
                                    cMunSorteado = String(cepData.cMun || "");
                                  }
                                } catch {
                                  // mantém vazio para edição manual/validação
                                }
                              }

                              // Preenche os campos do formulário
                              if (watchEditarDestinatarioPJ && sorteado.CNPJ) {
                                form.setValue(
                                  "destinatarioData.cnpj",
                                  sorteado.CNPJ
                                );
                                form.setValue(
                                  "destinatarioData.IE",
                                  sorteado.IE || ""
                                );
                              }
                              if (watchEditarDestinatarioPF && sorteado.CPF) {
                                form.setValue(
                                  "destinatarioData.cpf",
                                  sorteado.CPF
                                );
                              }

                              form.setValue(
                                "destinatarioData.xNome",
                                sorteado.xNome
                              );
                              form.setValue(
                                "destinatarioData.centroDistribuicao",
                                sorteado.centroDistribuicao ||
                                  sorteado.nomeFantasia ||
                                  ""
                              );
                              form.setValue(
                                "destinatarioData.xLgr",
                                sorteado.xLgr
                              );
                              form.setValue(
                                "destinatarioData.nro",
                                sorteado.nro
                              );
                              form.setValue(
                                "destinatarioData.xBairro",
                                sorteado.xBairro
                              );
                              form.setValue("destinatarioData.cMun", cMunSorteado);
                              form.setValue(
                                "destinatarioData.xMun",
                                sorteado.xMun
                              );
                              form.setValue("destinatarioData.UF", sorteado.UF);
                              form.setValue(
                                "destinatarioData.CEP",
                                sorteado.CEP
                              );
                              form.setValue(
                                "destinatarioData.fone",
                                sorteado.fone
                              );

                              toast.success(
                                `Destinatário sorteado: ${
                                  sorteado.nomeFantasia || sorteado.xNome
                                }`
                              );
                            }}
                            title="Sortear destinatário aleatório"
                          >
                            <Shuffle className="h-4 w-4 mr-2" />
                            Sortear Destinatário
                          </Button>
                        </div>

                        {/* Campos para PJ */}
                        <div className="grid grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="destinatarioData.centroDistribuicao"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Centro de Distribuição</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Ex: RC01 (Perus)"
                                    {...field}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          {watchEditarDestinatarioPJ && (
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
                          {watchEditarDestinatarioPF && (
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
                                  {watchEditarDestinatarioPJ
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
                          {watchEditarDestinatarioPJ && (
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

                        <div className="grid grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="destinatarioData.cMun"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>cMun (IBGE)</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="3550308"
                                    inputMode="numeric"
                                    maxLength={7}
                                    {...field}
                                    onChange={(e) =>
                                      field.onChange(
                                        e.target.value.replace(/\D/g, "").slice(0, 7)
                                      )
                                    }
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
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
                      <div className="space-y-3 border rounded-lg p-4">
                        {/* Cabeçalho - só mostra botão se não houver produtos */}
                        <div className="flex items-center justify-between">
                          <div>
                            <FormLabel className="text-base">
                              Produtos
                            </FormLabel>
                            <p className="text-sm text-muted-foreground mt-1">
                              Configure os produtos que serão usados. Para
                              Remessa, os produtos serão rotacionados por ordem.
                              Para Venda/Retorno/Devolução, use o produto
                              marcado como principal.
                            </p>
                          </div>
                          {produtoFields.length === 0 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const nextOrdem = produtoFields.length + 1;
                                appendProduto({
                                  xProd: "",
                                  cEAN: "",
                                  cProd: "",
                                  NCM: "",
                                  regraTributariaNome: "",
                                  origem: "",
                                  vUnComVenda: "",
                                  vUnComTransferencia: "",
                                  pesoBruto: "",
                                  pesoLiquido: "",
                                  isPrincipal: produtoFields.length === 0,
                                  ordem: nextOrdem,
                                });
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" /> Adicionar
                              Produto
                            </Button>
                          )}
                        </div>

                        {produtoFields.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            Nenhum produto configurado
                          </p>
                        )}

                        {produtoFields.map((field, index) => (
                          <div
                            key={field.id}
                            className="border rounded-lg p-4 space-y-3 bg-muted/50"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  Produto {index + 1}
                                </span>
                                <FormField
                                  control={form.control}
                                  name={`produtoData.${index}.isPrincipal`}
                                  render={({ field }) => (
                                    <FormItem className="flex items-center gap-2 space-y-0">
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={(checked) => {
                                            // Ao marcar como principal, desmarca todos os outros
                                            if (checked) {
                                              produtoFields.forEach((_, i) => {
                                                if (i !== index) {
                                                  form.setValue(
                                                    `produtoData.${i}.isPrincipal`,
                                                    false
                                                  );
                                                }
                                              });
                                            }
                                            field.onChange(checked);
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="text-xs font-normal cursor-pointer">
                                        Principal (Venda/Retorno/Devolução)
                                      </FormLabel>
                                    </FormItem>
                                  )}
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                {/* Botões de reordenação */}
                                {index > 0 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      moveProduto(index, index - 1);
                                      // Atualiza ordem após mover
                                      setTimeout(() => {
                                        produtoFields.forEach((_, i) => {
                                          form.setValue(
                                            `produtoData.${i}.ordem`,
                                            i + 1
                                          );
                                        });
                                      }, 0);
                                    }}
                                    title="Mover para cima"
                                  >
                                    ↑
                                  </Button>
                                )}
                                {index < produtoFields.length - 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      moveProduto(index, index + 1);
                                      // Atualiza ordem após mover
                                      setTimeout(() => {
                                        produtoFields.forEach((_, i) => {
                                          form.setValue(
                                            `produtoData.${i}.ordem`,
                                            i + 1
                                          );
                                        });
                                      }, 0);
                                    }}
                                    title="Mover para baixo"
                                  >
                                    ↓
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    removeProduto(index);
                                    // Atualiza ordem após remover
                                    setTimeout(() => {
                                      const remainingFields =
                                        form.getValues("produtoData");
                                      remainingFields.forEach((_, i) => {
                                        form.setValue(
                                          `produtoData.${i}.ordem`,
                                          i + 1
                                        );
                                      });
                                    }, 0);
                                  }}
                                  className="text-destructive"
                                  title="Remover produto"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <FormField
                                control={form.control}
                                name={`produtoData.${index}.xProd`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">
                                      Descrição do Produto
                                    </FormLabel>
                                    <FormControl>
                                      <Input {...field} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`produtoData.${index}.cProd`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">
                                      Código do Produto
                                    </FormLabel>
                                    <FormControl>
                                      <Input {...field} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`produtoData.${index}.cEAN`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">
                                      Código EAN/GTIN
                                    </FormLabel>
                                    <FormControl>
                                      <Input {...field} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`produtoData.${index}.NCM`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">
                                      NCM
                                    </FormLabel>
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
                                name={`produtoData.${index}.regraTributariaNome`}
                                render={({ field }) => {
                                  const currentValue = field.value || "";
                                  const optionExists =
                                    !currentValue ||
                                    taxRuleNames.includes(currentValue);

                                  if (taxRuleNames.length === 0) {
                                    return (
                                      <FormItem>
                                        <FormLabel className="text-xs">
                                          Nome da Regra Tributária
                                        </FormLabel>
                                        <FormControl>
                                          <Input
                                            placeholder="Importe a planilha de regras"
                                            {...field}
                                          />
                                        </FormControl>
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                          Nenhuma planilha de regras importada
                                          ainda.
                                        </p>
                                      </FormItem>
                                    );
                                  }

                                  return (
                                    <FormItem>
                                      <FormLabel className="text-xs">
                                        Nome da Regra Tributária
                                      </FormLabel>
                                      <Select
                                        value={currentValue || "__none__"}
                                        onValueChange={(v) =>
                                          field.onChange(
                                            v === "__none__" ? "" : v
                                          )
                                        }
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Selecione a regra" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="__none__">
                                            — (sem regra fixa)
                                          </SelectItem>
                                          {!optionExists && currentValue && (
                                            <SelectItem value={currentValue}>
                                              {currentValue} (não está mais na
                                              planilha)
                                            </SelectItem>
                                          )}
                                          {taxRuleNames.map((name) => (
                                            <SelectItem
                                              key={name}
                                              value={name}
                                            >
                                              {name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <p className="text-[10px] text-muted-foreground mt-1">
                                        Deixe em branco para usar a melhor
                                        regra automaticamente.
                                      </p>
                                    </FormItem>
                                  );
                                }}
                              />
                              <FormField
                                control={form.control}
                                name={`produtoData.${index}.origem`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">
                                      Origem
                                    </FormLabel>
                                    <Select
                                      value={field.value || ""}
                                      onValueChange={field.onChange}
                                    >
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Selecione a origem" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="0">
                                          0 - Nacional Puro
                                        </SelectItem>
                                        <SelectItem value="1">
                                          1 - Importei (com DI)
                                        </SelectItem>
                                        <SelectItem value="2">
                                          2 - Comprei Importado
                                        </SelectItem>
                                        <SelectItem value="3">
                                          3 - Nacional Misto
                                        </SelectItem>
                                        <SelectItem value="4">
                                          4 - Nacional PPB
                                        </SelectItem>
                                        <SelectItem value="6">
                                          6 - Importei
                                        </SelectItem>
                                        <SelectItem value="7">
                                          7 - Comprei Importado (alt)
                                        </SelectItem>
                                        <SelectItem value="8">
                                          8 - Nacional Misto (alt)
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="grid grid-cols-4 gap-3 pt-2 border-t">
                              <FormField
                                control={form.control}
                                name={`produtoData.${index}.vUnComVenda`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">
                                      Vl. Unit. Venda
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        inputMode="decimal"
                                        placeholder="69.99"
                                        {...field}
                                      />
                                    </FormControl>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                      Aplicado em CFOPs de venda/devolução
                                    </p>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`produtoData.${index}.vUnComTransferencia`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">
                                      Vl. Unit. Transf./Remessa
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        inputMode="decimal"
                                        placeholder="17.70"
                                        {...field}
                                      />
                                    </FormControl>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                      Aplicado em CFOPs de remessa/retorno (custo)
                                    </p>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`produtoData.${index}.pesoBruto`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">
                                      Peso Bruto (kg)
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        inputMode="decimal"
                                        placeholder="0.580"
                                        {...field}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`produtoData.${index}.pesoLiquido`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">
                                      Peso Líquido (kg)
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        inputMode="decimal"
                                        placeholder="0.570"
                                        {...field}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>

                            {/* Campo oculto para ordem */}
                            <FormField
                              control={form.control}
                              name={`produtoData.${index}.ordem`}
                              render={({ field }) => (
                                <input type="hidden" {...field} />
                              )}
                            />
                          </div>
                        ))}

                        {/* Botão adicionar produto - aparece abaixo quando há produtos */}
                        {produtoFields.length > 0 && (
                          <div className="flex justify-end pt-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const nextOrdem = produtoFields.length + 1;
                                appendProduto({
                                  xProd: "",
                                  cEAN: "",
                                  cProd: "",
                                  NCM: "",
                                  regraTributariaNome: "",
                                  origem: "",
                                  vUnComVenda: "",
                                  vUnComTransferencia: "",
                                  pesoBruto: "",
                                  pesoLiquido: "",
                                  isPrincipal: false,
                                  ordem: nextOrdem,
                                });
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" /> Adicionar
                              Produto
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>

                </div>
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
