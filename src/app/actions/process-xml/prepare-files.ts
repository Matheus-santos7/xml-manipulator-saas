import { processarRenomeacao } from "@/lib/xml";

/**
 * Representa um arquivo XML em memória pronto para ser processado.
 */
export type ArquivoParaProcessamento = {
  name: string;
  content: string;
};

/**
 * Lê o conteúdo dos arquivos recebidos do frontend e prepara a estrutura
 * em memória para processamento, além de executar a etapa de renomeação.
 */
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
      // Erros de leitura são ignorados silenciosamente para não poluir o terminal
    }
  }

  const renameReport = processarRenomeacao(filesForProcessing);

  return {
    filesForProcessing,
    renameReport,
  };
}
