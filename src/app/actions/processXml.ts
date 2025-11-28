"use server";

/**
 * Função responsável por receber os arquivos XML do frontend e logar no console.
 *
 * @param formData - Dados do formulário contendo o ID do cenário e os arquivos.
 */
export async function processarArquivosXml(formData: FormData) {
  const scenarioId = formData.get("scenarioId") as string;
  const files = formData.getAll("files") as File[];

  if (!scenarioId || files.length === 0) {
    return { success: false, message: "Cenário ou arquivos faltando." };
  }

  console.log(`\n=== RECEBENDO ARQUIVOS NO BACKEND ===\n`);
  console.log(`Scenario ID: ${scenarioId}`);
  console.log(`Quantidade de arquivos: ${files.length}`);

  for (const file of files) {
    console.log(`- Arquivo: ${file.name} (${file.size} bytes)`);
  }

  return {
    success: true,
    message: "Arquivos recebidos e logados com sucesso.",
  };
}
