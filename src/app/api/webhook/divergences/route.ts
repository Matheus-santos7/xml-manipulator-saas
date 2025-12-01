import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";

// Interface para definir a estrutura esperada para cada nota no payload
interface DivergentNotePayload {
  nfKey: string;
  status_conciliacao: string;
}

export async function POST(req: NextRequest) {
  try {
    const profileId = req.nextUrl.searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json(
        { error: "O ID do perfil (empresa) é obrigatório." },
        { status: 400 }
      );
    }

    const profile = await db.profile.findUnique({ where: { id: profileId } });
    if (!profile) {
      return NextResponse.json(
        { error: "Perfil (empresa) não encontrado." },
        { status: 404 }
      );
    }
    // Lê o corpo da requisição diretamente como JSON
    const body = await req.json();
    console.log("Corpo do webhook recebido (JSON):", body);

    const { totalErp, totalMl, diferenca, notas } = body;

    // Validação básica do payload
    if (
      typeof totalErp !== "number" ||
      typeof totalMl !== "number" ||
      typeof diferenca !== "number" ||
      !Array.isArray(notas)
    ) {
      return NextResponse.json(
        { error: "Payload do webhook inválido ou malformado." },
        { status: 400 }
      );
    }

    // Limpa os dados antigos da tabela de resumo e de notas para este perfil
    await db.divergenceSummary.deleteMany({ where: { profileId } });

    // Cria o novo resumo da divergência no banco de dados
    const summary = await db.divergenceSummary.create({
      data: {
        totalErp,
        totalMl,
        diferenca,
        profileId: profile.id,
      },
    });

    // Se houver notas de divergência, cria os registros correspondentes
    if (notas && notas.length > 0) {
      await (db as any).divergentNote.createMany({
        data: notas.map((nota: DivergentNotePayload) => ({
          // Mapeia os campos do payload para o schema do banco de dados
          nfKey: nota.nfKey,
          status_conciliacao: nota.status_conciliacao,
          summaryId: summary.id, // Adiciona a referência ao resumo
        })),
      });
    }

    // Retorna uma resposta de sucesso
    return NextResponse.json({
      message: "Webhook recebido e processado com sucesso!",
      summary,
    });
  } catch (error) {
    // Tratamento de erros
    if (error instanceof SyntaxError) {
      console.error("Erro de sintaxe JSON:", error.message);
      return NextResponse.json(
        { error: `JSON inválido recebido. Detalhes: ${error.message}` },
        { status: 400 }
      );
    }
    console.error("Erro ao receber webhook:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor ao processar o webhook." },
      { status: 500 }
    );
  }
}
