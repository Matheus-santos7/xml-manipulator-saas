import { db } from "@/lib/db";
import XmlProcessorClient from "@/components/xml-manipulator/processor-client";

export default async function ManipuladorPage() {
  // Autenticação comentada por enquanto
  // const session = await auth();

  // Busca os cenários disponíveis (sem filtro de usuário por enquanto para teste)
  const scenarios = await db.scenario.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Manipulador XML
        </h1>
        <p className="text-muted-foreground mt-2">
          Carregue seus arquivos fiscais, aplique regras tributárias e baixe os
          resultados corrigidos.
        </p>
      </div>

      <XmlProcessorClient scenarios={scenarios} />
    </div>
  );
}
