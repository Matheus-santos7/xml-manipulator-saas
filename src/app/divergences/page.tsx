import { db } from "@/app/lib/db";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helper";
import { DivergenceCards } from "@/components/divergences/divergence-cards";

export default async function DivergencesPage() {
  const user = await getCurrentUser();

  // Apenas administradores podem acessar esta página
  if (!user || user.role !== "admin") {
    redirect("/");
  }

  // Busca todos os resumos de divergência agrupados por empresa
  const summaries = await db.divergenceSummary.findMany({
    include: {
      Profile: true,
      notes: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Agrupa por empresa (profileId)
  const groupedByCompany = summaries.reduce(
    (acc, summary) => {
      const profileId = summary.profileId || "sem-empresa";
      if (!acc[profileId]) {
        acc[profileId] = {
          profile: summary.Profile,
          summaries: [],
        };
      }
      acc[profileId].summaries.push(summary);
      return acc;
    },
    {} as Record<
      string,
      {
        profile: (typeof summaries)[0]["Profile"];
        summaries: typeof summaries;
      }
    >
  );

  // Transforma em array para o componente
  const companiesData = Object.entries(groupedByCompany).map(
    ([profileId, data]) => {
      const latestSummary = data.summaries[0]; // Já ordenado por data
      const totalDivergencias = latestSummary?.diferenca || 0;
      const totalNotas = latestSummary?.notes.length || 0;

      return {
        profileId,
        companyName: data.profile?.name || "Empresa não identificada",
        cnpj: data.profile?.cnpj || "CNPJ não informado",
        totalErp: latestSummary?.totalErp || 0,
        totalMl: latestSummary?.totalMl || 0,
        diferenca: totalDivergencias,
        totalNotas,
        status:
          totalDivergencias === 0
            ? ("ok" as const)
            : totalDivergencias <= 5
            ? ("warning" as const)
            : ("critical" as const),
        lastUpdate: latestSummary?.createdAt || new Date(),
        notes:
          latestSummary?.notes.map((note) => ({
            nfKey: note.nfKey,
            status_conciliacao: note.status_conciliacao,
          })) || [],
      };
    }
  );

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Divergências</h1>
          <p className="text-muted-foreground mt-1">
            Visualize as divergências de notas fiscais por empresa
          </p>
        </div>
      </div>

      {companiesData.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-muted-foreground text-lg">
              Nenhuma divergência registrada ainda.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Os dados aparecerão aqui quando o webhook receber informações.
            </p>
          </div>
        </div>
      ) : (
        <DivergenceCards companies={companiesData} />
      )}
    </div>
  );
}
