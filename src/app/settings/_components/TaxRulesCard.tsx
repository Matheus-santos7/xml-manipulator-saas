"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { ChevronDown, ChevronRight, FlaskConical, Trash2, Upload } from "lucide-react";
import {
  deleteTaxRulesPlanilha,
  simulateTaxRulesForXml,
  uploadTaxRulesPlanilha,
} from "@/app/actions/tax-rules";

const FIELD_LABELS: Record<string, string> = {
  icmsCst: "ICMS CST",
  pICMS: "ICMS pICMS",
  vICMS: "ICMS vICMS",
  ipiCst: "IPI CST",
  pIPI: "IPI pIPI",
  vIPI: "IPI vIPI",
  pisCst: "PIS CST",
  pPIS: "PIS pPIS",
  vPIS: "PIS vPIS",
  cofinsCst: "COFINS CST",
  pCOFINS: "COFINS pCOFINS",
  vCOFINS: "COFINS vCOFINS",
  ibsCst: "IBS/CBS CST",
  cClassTrib: "IBS/CBS cClassTrib",
  pIBSUF: "IBS pIBSUF",
  vIBSUF: "IBS vIBSUF",
  pIBSMun: "IBS pIBSMun",
  vIBSMun: "IBS vIBSMun",
  pCBS: "CBS pCBS",
  vCBS: "CBS vCBS",
};

interface TaxRulesCardProps {
  profileId?: string;
  profileName?: string | null;
  canManageScenarios: boolean;
  taxRulesInfo?: {
    fileName: string;
    totalRules: number;
    uploadedAt: Date;
  } | null;
}

export function TaxRulesCard({
  profileId,
  profileName,
  canManageScenarios,
  taxRulesInfo,
}: TaxRulesCardProps) {
  const uploadInputId = `tax-rules-upload-${profileId ?? "none"}`;
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [xmlForSimulation, setXmlForSimulation] = useState("");
  const [showUploadSection, setShowUploadSection] = useState(false);
  const [showSimulationSection, setShowSimulationSection] = useState(false);
  const [simulationItems, setSimulationItems] = useState<
    Array<{
      item: number;
      cfop: string;
      origin: string;
      productOrigin?: string;
      transactionType?: string;
      matchedRule: string | null;
      before: Record<string, string>;
      after: Record<string, string>;
      logs: string[];
    }>
  >([]);

  const onUpload = () => {
    if (!profileId) {
      toast.error("Selecione uma empresa para importar as regras.");
      return;
    }
    if (!file) {
      toast.error("Selecione um arquivo .xlsx.");
      return;
    }

    const formData = new FormData();
    formData.append("profileId", profileId);
    formData.append("file", file);

    startTransition(async () => {
      const result = await uploadTaxRulesPlanilha(formData);
      if (!result.success) {
        toast.error(result.error ?? "Falha ao importar planilha.");
        return;
      }
      toast.success(result.message ?? "Regras tributárias importadas.");
      setFile(null);
    });
  };

  const onSimulate = () => {
    if (!profileId) {
      toast.error("Selecione uma empresa para simular.");
      return;
    }
    if (!xmlForSimulation.trim()) {
      toast.error("Cole o XML para simulação.");
      return;
    }

    const formData = new FormData();
    formData.append("profileId", profileId);
    formData.append("xmlContent", xmlForSimulation);

    startTransition(async () => {
      const result = await simulateTaxRulesForXml(formData);
      if (!result.success) {
        toast.error(result.error ?? "Falha ao simular regra.");
        return;
      }
      setSimulationItems(result.items ?? []);
      toast.success(result.message ?? "Simulação concluída.");
    });
  };

  const onDeletePlanilha = () => {
    if (!profileId) {
      toast.error("Selecione uma empresa.");
      return;
    }
    if (!taxRulesInfo) {
      toast.error("Não há planilha vinculada para remover.");
      return;
    }

    const formData = new FormData();
    formData.append("profileId", profileId);

    startTransition(async () => {
      const result = await deleteTaxRulesPlanilha(formData);
      if (!result.success) {
        toast.error(result.error ?? "Falha ao remover planilha.");
        return;
      }
      setSimulationItems([]);
      toast.success(result.message ?? "Planilha removida.");
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Regras Tributárias (Mercado Livre)</CardTitle>
        <CardDescription>
          Empresa selecionada: <span className="font-semibold">{profileName ?? "Nenhuma"}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {taxRulesInfo ? (
          <div className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Ativa</Badge>
              <span className="text-sm text-muted-foreground">
                {taxRulesInfo.fileName} · {taxRulesInfo.totalRules} regras
              </span>
            </div>
            {canManageScenarios && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    disabled={isPending || !profileId}
                    title="Apagar planilha vinculada"
                    aria-label="Apagar planilha vinculada"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover planilha tributária?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação vai apagar a planilha vinculada da empresa{" "}
                      <span className="font-semibold">{profileName ?? "selecionada"}</span>.
                      Você poderá importar novamente depois.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDeletePlanilha}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Apagar planilha
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma planilha importada para esta empresa.</p>
        )}

        {canManageScenarios && (
          <div className="space-y-3">
            <div className="rounded-md border">
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                onClick={() => setShowUploadSection((v) => !v)}
              >
                <span className="inline-flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Adicionar / substituir planilha
                </span>
                {showUploadSection ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {showUploadSection && (
                <div className="border-t p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      id={uploadInputId}
                      type="file"
                      accept=".xlsx"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      className="sr-only"
                      disabled={isPending || !profileId}
                    />
                    <label htmlFor={uploadInputId}>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isPending || !profileId}
                        asChild
                      >
                        <span>Selecionar planilha</span>
                      </Button>
                    </label>
                    <span className="text-sm text-muted-foreground truncate max-w-[280px]">
                      {file ? file.name : "Nenhum arquivo selecionado"}
                    </span>
                    <Button onClick={onUpload} disabled={isPending || !profileId || !file}>
                      {isPending ? "Importando..." : "Importar"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-md border">
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                onClick={() => setShowSimulationSection((v) => !v)}
              >
                <span className="inline-flex items-center gap-2">
                  <FlaskConical className="h-4 w-4" />
                  Simulação rápida da regra
                </span>
                {showSimulationSection ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {showSimulationSection && (
                <div className="border-t p-3 space-y-2">
                  <Textarea
                    value={xmlForSimulation}
                    onChange={(e) => setXmlForSimulation(e.target.value)}
                    placeholder="Cole aqui o XML da NFe para simular regra tributária..."
                    className="min-h-40"
                    disabled={isPending || !profileId}
                  />
                  <Button
                    variant="outline"
                    onClick={onSimulate}
                    disabled={isPending || !profileId || !xmlForSimulation.trim()}
                  >
                    {isPending ? "Simulando..." : "Simular Regra"}
                  </Button>
                </div>
              )}
            </div>

            {simulationItems.length > 0 && (
              <div className="space-y-2 rounded-md border p-3">
                <p className="text-sm font-medium">Resultado da simulação</p>
                {simulationItems.map((item) => (
                  <div key={item.item} className="rounded-md border p-2 text-sm space-y-1">
                    <p>
                      <span className="font-semibold">Item {item.item}</span> · CFOP {item.cfop}
                      {" · "}
                      Emit. {item.origin || "?"}
                      {item.productOrigin ? ` · orig=${item.productOrigin}` : ""}
                      {item.transactionType
                        ? ` · ${item.transactionType.toLowerCase()}`
                        : ""}
                      {" · Regra: "}
                      <span className="font-medium">{item.matchedRule ?? "não encontrada"}</span>
                    </p>
                    <div className="rounded border overflow-hidden">
                      <div className="grid grid-cols-3 text-xs font-medium bg-muted/60 px-2 py-1">
                        <span>Campo</span>
                        <span>Antes</span>
                        <span>Depois</span>
                      </div>
                      {Object.keys(FIELD_LABELS).map((fieldKey) => {
                        const beforeVal = item.before[fieldKey] || "-";
                        const afterVal = item.after[fieldKey] || "-";
                        const changed = beforeVal !== afterVal;
                        return (
                          <div
                            key={`${item.item}-${fieldKey}`}
                            className={`grid grid-cols-3 text-xs px-2 py-1 border-t ${
                              changed ? "bg-emerald-50 dark:bg-emerald-950/30" : ""
                            }`}
                          >
                            <span className={changed ? "font-semibold" : "text-muted-foreground"}>
                              {FIELD_LABELS[fieldKey]}
                            </span>
                            <span className="text-muted-foreground">{beforeVal}</span>
                            <span className={changed ? "font-semibold text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}>
                              {afterVal}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {item.logs.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {item.logs.join(" | ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
