"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  UploadCloud,
  CheckCircle,
  AlertCircle,
  Download,
  Play,
  FileCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { processarArquivosXml } from "@/app/actions/process-xml";
import { toast } from "sonner"; // <--- Importação nova

interface ScenarioOption {
  id: string;
  name: string;
}

interface ProcessedFile {
  originalName: string;
  newName: string;
  content: string;
  status: string;
  logs: string[];
}

export default function XmlProcessorClient({
  scenarios,
}: {
  scenarios: ScenarioOption[];
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedData, setProcessedData] = useState<ProcessedFile[]>([]);

  // Configuração do Drag & Drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Filtra apenas XMLs
    const xmls = acceptedFiles.filter(
      (f) => f.type === "text/xml" || f.name.endsWith(".xml")
    );

    if (xmls.length === 0 && acceptedFiles.length > 0) {
      toast.warning("Arquivo inválido", {
        description: "Apenas arquivos XML são permitidos.",
      });
      return;
    }

    setFiles((prev) => [...prev, ...xmls]);
    setProcessedData([]);
    toast.info("Arquivos adicionados", {
      description: `${xmls.length} arquivos prontos.`,
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  // Função de Processamento
  const handleProcess = async () => {
    if (!selectedScenario) {
      toast.error("Atenção", {
        description: "Selecione um cenário de teste antes de continuar.",
      });
      return;
    }
    if (files.length === 0) return;

    setIsProcessing(true);
    const formData = new FormData();
    formData.append("scenarioId", selectedScenario);
    files.forEach((file) => formData.append("files", file));

    try {
      const response = await processarArquivosXml(formData);

      if (response.success) {
        // Atualiza os dados processados com os novos nomes dos arquivos
        if (response.processedFiles) {
          setProcessedData(response.processedFiles);
        }

        toast.success("Processamento concluído", {
          description: response.message,
        });
      } else {
        toast.error("Erro no processamento", { description: response.message });
      }
    } catch {
      toast.error("Erro Crítico", {
        description: "Falha na comunicação com o servidor.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Função para gerar ZIP
  const handleDownloadZip = async () => {
    try {
      const zip = new JSZip();
      const outputFolder = zip.folder("processados");

      processedData.forEach((item) => {
        // Usa o novo nome se foi renomeado, senão usa o nome original
        const fileName = item.newName || item.originalName;
        outputFolder?.file(fileName, item.content);
      });

      const logContent = processedData
        .map(
          (item) =>
            `Arquivo: ${item.originalName} -> ${item.newName}\nStatus: ${
              item.status
            }\nAlterações:\n${item.logs
              .map((l: string) => ` - ${l}`)
              .join("\n")}\n---`
        )
        .join("\n\n");

      zip.file("relatorio_processamento.txt", logContent);

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `xmls_processados_${new Date().getTime()}.zip`);

      // Reseta os arquivos e dados processados após o download
      setFiles([]);
      setProcessedData([]);

      toast.success("Download iniciado!", {
        description: "Os arquivos foram limpos para um novo lote.",
      });
    } catch {
      toast.error("Erro ao gerar ZIP");
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
      {/* Coluna da Esquerda: Upload e Controles */}
      <div className="md:col-span-1 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Configuração</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Selecione o Cenário</label>
              <Select
                onValueChange={setSelectedScenario}
                value={selectedScenario}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha um cenário..." />
                </SelectTrigger>
                <SelectContent>
                  {scenarios.map((sc) => (
                    <SelectItem key={sc.id} value={sc.id}>
                      {sc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary dark:hover:border-primary"
              }`}
            >
              <input {...getInputProps()} />
              <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Arraste XMLs aqui ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Suporta múltiplos arquivos
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                className="w-full"
                onClick={handleProcess}
                disabled={
                  files.length === 0 || isProcessing || !selectedScenario
                }
              >
                {isProcessing ? (
                  "Processando..."
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" /> Manipular Lote
                  </>
                )}
              </Button>

              {processedData.length > 0 && (
                <Button
                  variant="outline"
                  className="w-full border-green-600 text-green-700 hover:bg-green-50 dark:border-green-500 dark:text-green-400 dark:hover:bg-green-500/10"
                  onClick={handleDownloadZip}
                >
                  <Download className="mr-2 h-4 w-4" /> Baixar ZIP
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {files.length > 0 && (
          <div className="text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
            <FileCode className="h-4 w-4" />
            {files.length} arquivos na fila
          </div>
        )}
      </div>

      {/* Coluna da Direita: Preview e Logs */}
      <div className="md:col-span-2">
        <Card className="h-full flex flex-col min-h-[500px]">
          <CardHeader>
            <CardTitle>Resultados e Logs</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {processedData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 space-y-2">
                <UploadCloud className="h-12 w-12 opacity-20" />
                <p>Os resultados aparecerão aqui após o processamento.</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px] w-full px-4">
                <div className="divide-y divide-border pb-4">
                  {processedData
                    .sort((a, b) => {
                      // Extrai o número da nota do nome do arquivo (primeira parte antes do hífen)
                      const getNumero = (name: string) => {
                        const match = name.match(/^(\d+)/);
                        return match ? parseInt(match[1], 10) : 999999;
                      };

                      const numA = getNumero(a.newName || a.originalName);
                      const numB = getNumero(b.newName || b.originalName);

                      return numA - numB;
                    })
                    .map((item, idx) => (
                      <div
                        key={idx}
                        className="py-4 hover:bg-muted/50 transition-colors rounded px-2"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            {item.status === "success" ? (
                              <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                            ) : item.status === "error" ? (
                              <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0" />
                            )}
                            <div className="flex flex-col">
                              <span className="font-medium text-sm text-foreground">
                                {item.newName || item.originalName}
                              </span>
                              {item.newName &&
                                item.newName !== item.originalName && (
                                  <span className="text-xs text-muted-foreground line-through">
                                    {item.originalName}
                                  </span>
                                )}
                            </div>
                          </div>
                          <Badge
                            variant={
                              item.status === "success"
                                ? "default"
                                : item.status === "error"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {item.status === "success"
                              ? "Sucesso"
                              : item.status === "error"
                              ? "Erro"
                              : "Pulado"}
                          </Badge>
                        </div>

                        {item.logs.length > 0 && (
                          <div
                            className={`mt-2 ml-8 p-3 rounded-lg text-xs font-mono border ${
                              item.status === "error"
                                ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30"
                                : item.status === "skipped"
                                ? "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/30"
                                : "bg-muted/50 text-muted-foreground border-border dark:bg-muted/30"
                            }`}
                          >
                            <ul className="list-disc pl-4 space-y-1">
                              {item.logs.map((log: string, i: number) => (
                                <li key={i}>{log}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
