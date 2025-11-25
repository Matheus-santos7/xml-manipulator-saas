"use server";

import { db } from "@/lib/db";
import { XmlProcessor } from "@/app/lib/xml/XmlProcessor";
import { ScenarioDB } from "@/types";

export async function processXmlBatch(formData: FormData) {
  const scenarioId = formData.get("scenarioId") as string;
  const files = formData.getAll("files") as File[];

  if (!scenarioId || files.length === 0) {
    return { success: false, message: "Cenário ou arquivos faltando." };
  }

  try {
    const scenario = await db.scenario.findUnique({
      where: { id: scenarioId },
      include: {
        cstMappings: true,
        taxReformRules: true,
      },
    });

    if (!scenario)
      return { success: false, message: "Cenário não encontrado." };

    const results = [];

    // Simulação de Mapeamento de Chaves (Para CTe referenciar NFe nova)
    // Em um sistema real, você processaria primeiro as NFes para popular este mapa
    // e depois os CTes. Por enquanto, faremos sequencial simples.
    const chaveMapping: Record<string, string> = {};
    const referenceMap: Record<string, string> = {};

    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const processor = new XmlProcessor(buffer);

        const info = processor.getXmlInfo();
        let novoNome = file.name;

        if (info) {
          const nomeGerado = processor.renameFileAccordingToRules(info);
          if (nomeGerado) novoNome = nomeGerado;
        }

        // Passamos 'as any' porque o retorno do Prisma inclui metadados extras, mas a estrutura bate com ScenarioDB
        const report = processor.applyScenario(
          scenario as unknown as ScenarioDB,
          chaveMapping,
          referenceMap
        );

        results.push({
          originalName: file.name,
          newName: novoNome,
          content: processor.serialize().toString("utf-8"),
          status: "success",
          logs: report.alterations,
          msg: report.msg,
        });
      } catch (error) {
        console.error(`Erro ao processar ${file.name}:`, error);
        results.push({
          originalName: file.name,
          newName: file.name,
          content: "",
          status: "error",
          logs: ["Erro fatal ao ler arquivo: " + (error as Error).message],
          msg: "Falha no processamento",
        });
      }
    }

    return { success: true, results };
  } catch (error) {
    console.error("Erro geral:", error);
    return { success: false, message: "Erro interno no servidor." };
  }
}
