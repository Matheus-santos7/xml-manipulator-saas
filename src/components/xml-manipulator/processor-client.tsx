'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { UploadCloud, CheckCircle, AlertCircle, Download, Play, FileCode } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { processXmlBatch } from '@/app/actions/process-batch'
import { toast } from "sonner" // <--- Importação nova

interface ScenarioOption {
  id: string;
  name: string;
}

export default function XmlProcessorClient({ scenarios }: { scenarios: ScenarioOption[] }) {
  const [files, setFiles] = useState<File[]>([])
  const [selectedScenario, setSelectedScenario] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processedData, setProcessedData] = useState<any[]>([])

  // Configuração do Drag & Drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Filtra apenas XMLs
    const xmls = acceptedFiles.filter(f => f.type === 'text/xml' || f.name.endsWith('.xml'));
    
    if (xmls.length === 0 && acceptedFiles.length > 0) {
      toast.warning("Arquivo inválido", { description: "Apenas arquivos XML são permitidos." });
      return;
    }

    setFiles(prev => [...prev, ...xmls]);
    setProcessedData([]); // Limpa resultados anteriores
    toast.info("Arquivos adicionados", { description: `${xmls.length} arquivos prontos.` });
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  // Função de Processamento
  const handleProcess = async () => {
    if (!selectedScenario) {
      toast.error("Atenção", { description: "Selecione um cenário de teste antes de continuar." });
      return;
    }
    if (files.length === 0) return;

    setIsProcessing(true);
    const formData = new FormData();
    formData.append('scenarioId', selectedScenario);
    files.forEach(file => formData.append('files', file));

    try {
      const response = await processXmlBatch(formData);
      
      if (response.success && response.results) {
        setProcessedData(response.results);
        toast.success("Processamento concluído", { 
          description: `${response.results.length} arquivos processados com sucesso.` 
        });
      } else {
        toast.error("Erro no processamento", { description: response.message });
      }
    } catch (error) {
      toast.error("Erro Crítico", { description: "Falha na comunicação com o servidor." });
    } finally {
      setIsProcessing(false);
    }
  }

  // Função para gerar ZIP
  const handleDownloadZip = async () => {
    try {
      const zip = new JSZip();
      const outputFolder = zip.folder("processados");
      
      processedData.forEach(item => {
        if (item.status === 'success') {
          outputFolder?.file(item.newName, item.content);
        }
      });

      const logContent = processedData.map(item => 
        `Arquivo: ${item.originalName} -> ${item.newName}\nStatus: ${item.status}\nAlterações:\n${item.logs.map((l: string) => ` - ${l}`).join('\n')}\n---`
      ).join('\n\n');
      
      zip.file("relatorio_processamento.txt", logContent);

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `xmls_processados_${new Date().getTime()}.zip`);
      toast.success("Download iniciado!");
    } catch (e) {
      toast.error("Erro ao gerar ZIP");
    }
  }

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
              <Select onValueChange={setSelectedScenario} value={selectedScenario}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um cenário..." />
                </SelectTrigger>
                <SelectContent>
                  {scenarios.map(sc => (
                    <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div 
              {...getRootProps()} 
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-primary bg-primary/10' : 'border-gray-200 hover:border-primary'
              }`}
            >
              <input {...getInputProps()} />
              <UploadCloud className="mx-auto h-10 w-10 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">
                Arraste XMLs aqui ou clique para selecionar
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Suporta múltiplos arquivos
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button 
                className="w-full" 
                onClick={handleProcess} 
                disabled={files.length === 0 || isProcessing || !selectedScenario}
              >
                {isProcessing ? 'Processando...' : (
                  <><Play className="mr-2 h-4 w-4" /> Processar Lote</>
                )}
              </Button>

              {processedData.length > 0 && (
                <Button variant="outline" className="w-full border-green-600 text-green-700 hover:bg-green-50" onClick={handleDownloadZip}>
                  <Download className="mr-2 h-4 w-4" /> Baixar ZIP
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {files.length > 0 && (
          <div className="text-sm text-gray-500 text-center flex items-center justify-center gap-2">
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
              <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 space-y-2">
                <UploadCloud className="h-12 w-12 opacity-20" />
                <p>Os resultados aparecerão aqui após o processamento.</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px] w-full px-4">
                <div className="divide-y divide-gray-100 pb-4">
                  {processedData.map((item, idx) => (
                    <div key={idx} className="py-4 hover:bg-slate-50 transition-colors rounded px-2">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {item.status === 'success' ? (
                            <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                          )}
                          <div className="flex flex-col">
                            <span className="font-medium text-sm text-gray-900">{item.newName}</span>
                            {item.newName !== item.originalName && (
                              <span className="text-xs text-gray-400 line-through">{item.originalName}</span>
                            )}
                          </div>
                        </div>
                        <Badge variant={item.status === 'success' ? 'default' : 'destructive'}>
                          {item.status === 'success' ? 'Sucesso' : 'Erro'}
                        </Badge>
                      </div>
                      
                      {item.logs.length > 0 && (
                        <div className="mt-2 ml-8 bg-slate-100 p-2 rounded text-xs font-mono text-slate-600 border border-slate-200">
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
  )
}