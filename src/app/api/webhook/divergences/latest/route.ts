import { db } from "@/app/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const latestSummary = await db.divergenceSummary.findFirst({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        notes: {
          where: {
            status_conciliacao: "DIVERGENTE",
          },
          orderBy: {
            nfKey: "asc",
          },
        },
      },
    });

    if (!latestSummary) {
      return NextResponse.json(
        { error: "Nenhum dado de divergência encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(latestSummary);
  } catch (error) {
    console.error("Erro ao buscar dados de divergência:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
