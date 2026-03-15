import { processarRenomeacao } from "@/lib/xml";

export type ArquivoParaProcessamento = {
  name: string;
  content: string;
};

export async function prepararArquivosParaProcessamento(files: File[]) {
  const filesForProcessing: ArquivoParaProcessamento[] = [];

  for (const file of files) {
    try {
      const content = await file.text();
      filesForProcessing.push({
        name: file.name,
        content,
      });
    } catch {
      // erros de leitura são ignorados para não quebrar o lote inteiro
    }
  }

  const renameReport = processarRenomeacao(filesForProcessing);

  return {
    filesForProcessing,
    renameReport,
  };
}

