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
import { toast } from "sonner";

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
  const [maskScenarioData, setMaskScenarioData] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedData, setProcessedData] = useState<ProcessedFile[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
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
      description: `${xmls.length} arquivo(s) pronto(s) para processamento.`,
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleProcess = async () => {
    if (!selectedScenario && !maskScenarioData) {
      toast.error("Selecione um cenário", {
        description: "Escolha um cenário de teste antes de processar.",
      });
      return;
    }
    if (files.length === 0) return;

    setIsProcessing(true);
    const formData = new FormData();
    formData.append("scenarioId", selectedScenario);
    formData.append("maskScenarioData", maskScenarioData ? "true" : "false");
    files.forEach((file) => formData.append("files", file));

    try {
      const response = await processarArquivosXml(formData);

      if (response.success) {
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
      toast.error("Erro crítico", {
        description: "Falha ao se comunicar com o servidor.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadZip = async () => {
    try {
      const zip = new JSZip();
      const outputFolder = zip.folder("processed");

      processedData.forEach((item) => {
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

      zip.file("processing_report.txt", logContent);

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `xml_processado_${new Date().getTime()}.zip`);

      setFiles([]);
      setProcessedData([]);

      toast.success("Download iniciado", {
        description: "Arquivos foram limpos para um novo lote.",
      });
    } catch {
      toast.error("Erro ao gerar ZIP");
    }
  };

  const handleClearFiles = () => {
    if (files.length === 0) return;
    setFiles([]);
    setProcessedData([]);
    toast.info("Arquivos removidos", {
      description: "Os arquivos carregados foram limpos.",
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-10rem)]">
      {/* Left column: upload and controls */}
      <div className="md:col-span-1 space-y-4 h-[calc(100vh-10rem)]">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Manipulador de XMLs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <label className="text-sm font-medium">Selecionar cenário</label>
              <Select
                onValueChange={setSelectedScenario}
                value={selectedScenario}
              >
                <SelectTrigger className="w-full mt-1">
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

              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm text-muted-foreground">
                  Mascarar dados sensíveis dos XMLs carregados
                </span>
                <button
                  type="button"
                  onClick={() => setMaskScenarioData((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                    maskScenarioData
                      ? "bg-primary border-primary"
                      : "bg-background border-border"
                  }`}
                  aria-pressed={maskScenarioData}
                  aria-label="Alternar mascaramento de dados sensíveis"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform ${
                      maskScenarioData ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div
              {...getRootProps()}
              className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary dark:hover:border-primary"
              }`}
            >
              <input {...getInputProps()} />
              <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground mb-2" />

              {files.length === 0 ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Arraste os XMLs aqui ou clique para selecionar
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Suporte a múltiplos arquivos
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center gap-3">
                    <p className="text-sm font-medium">
                      {files.length} arquivo(s) importado(s)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearFiles();
                    }}
                    className="absolute top-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs font-semibold text-muted-foreground hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
                    aria-label="Limpar arquivos carregados"
                  >
                    ×
                  </button>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Clique no X para desfazer o upload e enviar outro lote.
                  </p>
                </>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Button
                className="w-full"
                onClick={handleProcess}
                disabled={
                  files.length === 0 ||
                  isProcessing ||
                  (!selectedScenario && !maskScenarioData)
                }
              >
                {isProcessing ? (
                  "Processando..."
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" /> Processar lote
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
      </div>

      {/* Right column: preview and logs */}
      <div className="md:col-span-2">
        <Card className="h-full flex flex-col min-h-[500px]">
          <CardHeader>
            <CardTitle>Resultados e logs</CardTitle>
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
                      const getNumber = (name: string) => {
                        const match = name.match(/^(\d+)/);
                        return match ? parseInt(match[1], 10) : 999999;
                      };

                      return getNumber(a.newName) - getNumber(b.newName);
                    })
                    .map((file) => (
                      <div
                        key={file.originalName}
                        className="py-4 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileCode className="h-4 w-4 text-primary" />
                            <div>
                              <p className="font-medium text-sm">
                                {file.newName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Original: {file.originalName}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant={
                              file.status === "success" ? "default" : "secondary"
                            }
                            className="flex items-center gap-1"
                          >
                            {file.status === "success" ? (
                              <CheckCircle className="h-3 w-3" />
                            ) : (
                              <AlertCircle className="h-3 w-3" />
                            )}
                            {file.status === "success" ? "Editado" : "Ignorado"}
                          </Badge>
                        </div>
                        {file.logs.length > 0 && (
                          <div className="mt-2 rounded-md bg-muted/60 p-3 space-y-1">
                            {file.logs.map((log, idx) => (
                              <p
                                key={idx}
                                className="text-xs text-muted-foreground flex items-start gap-2"
                              >
                                <span className="mt-[3px]">
                                  •
                                </span>
                                <span>{log}</span>
                              </p>
                            ))}
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

