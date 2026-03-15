import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import XmlProcessorClient from "./_components/XmlProcessorClient";

export const dynamic = "force-dynamic";

export default async function XmlManipulatorPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const { role, profileId: userProfileId, workspaceId } = currentUser;

  let scenarios;

  if (role === "admin") {
    scenarios = await db.scenario.findMany({
      where: {
        active: true,
        deletedAt: null,
        Profile: {
          is: {
            workspaceId,
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

    scenarios = scenarios.map((s) => ({
      id: s.id,
      name: `${s.Profile.name} - ${s.name}`,
    }));
  } else {
    if (!userProfileId) {
      return (
        <div className="container mx-auto py-8">
          <div className="text-center text-muted-foreground">
            <p>Você não possui uma empresa associada.</p>
            <p>Entre em contato com um administrador.</p>
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

  const isAdmin = role === "admin";

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1
          className={`text-3xl font-bold ${
            isAdmin ? "text-role-admin" : "text-role-member"
          }`}
        >
          Manipulador de XML
        </h1>
        <p className="text-muted-foreground mt-2">
          Envie seus arquivos XML fiscais, aplique cenários de transformação e
          faça o download dos resultados ajustados.
        </p>
      </div>

      <XmlProcessorClient scenarios={scenarios} />
    </div>
  );
}

