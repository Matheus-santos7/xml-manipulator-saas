import { db } from "@/app/lib/db";
import { getCurrentUser } from "@/lib/auth-helper";
import { redirect } from "next/navigation";
import XmlProcessorClient from "@/components/xml-manipulator/processor-client";

export default async function ManipuladorPage() {
  // Verificar autenticação
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const { role, profileId: userProfileId, workspaceId } = currentUser;

  // Busca os cenários disponíveis baseado nas permissões
  let scenarios;

  if (role === "admin") {
    // Admin vê todos os cenários ativos do workspace (não deletados)
    scenarios = await db.scenario.findMany({
      where: {
        active: true,
        deletedAt: null,
        Profile: {
          is: {
            workspaceId: workspaceId,
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
        name: true,
        Profile: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ Profile: { name: "asc" } }, { name: "asc" }],
    });

    // Formata para incluir nome da empresa
    scenarios = scenarios.map((s) => ({
      id: s.id,
      name: `${s.Profile.name} - ${s.name}`,
    }));
  } else {
    // Membro vê apenas cenários da sua empresa (não deletados)
    if (!userProfileId) {
      return (
        <div className="container mx-auto py-8">
          <div className="text-center text-muted-foreground">
            <p>Você não possui uma empresa associada.</p>
            <p>Entre em contato com o administrador.</p>
          </div>
        </div>
      );
    }

    scenarios = await db.scenario.findMany({
      where: {
        active: true,
        deletedAt: null,
        profileId: userProfileId,
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

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
