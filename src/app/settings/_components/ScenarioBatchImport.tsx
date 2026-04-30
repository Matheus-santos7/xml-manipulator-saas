"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { importScenariosFromSpreadsheet } from "@/app/actions/scenario";

type ScenarioBatchImportProps = {
  profileId: string;
};

export function ScenarioBatchImport({ profileId }: ScenarioBatchImportProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleImport() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      toast.error("Selecione a planilha preenchida para importar.");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("profileId", profileId);
      fd.append("file", file);

      const result = await importScenariosFromSpreadsheet(fd);
      if (!result.success) {
        toast.error(result.error || result.message || "Falha na importação.");
        return;
      }

      if (result.failed && result.failed > 0) {
        toast.warning(result.message || "Importação concluída com erros.");
      } else {
        toast.success(result.message || "Cenários importados com sucesso.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao importar planilha.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <a href="/templates/cenarios-em-lote-template.xlsx" download>
          <Download className="h-4 w-4 mr-2" />
          Baixar Template
        </a>
      </Button>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={() => {
          // noop - arquivo fica no input para importação
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
      >
        Selecionar Planilha
      </Button>
      <Button type="button" size="sm" onClick={handleImport} disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Upload className="h-4 w-4 mr-2" />
        )}
        Importar Lote
      </Button>
    </div>
  );
}
