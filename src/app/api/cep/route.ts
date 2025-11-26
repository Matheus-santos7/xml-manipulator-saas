import { NextRequest, NextResponse } from "next/server";

export interface CepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}

export interface CepData {
  cep: string;
  xLgr: string;
  xCpl: string;
  xBairro: string;
  xMun: string;
  UF: string;
  cMun: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cep = searchParams.get("cep");

  if (!cep) {
    return NextResponse.json({ error: "CEP é obrigatório" }, { status: 400 });
  }

  // Remove caracteres não numéricos
  const cepLimpo = cep.replace(/\D/g, "");

  if (cepLimpo.length !== 8) {
    return NextResponse.json(
      { error: "CEP deve ter 8 dígitos" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`, {
      next: { revalidate: 86400 }, // Cache por 24 horas
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Erro ao consultar CEP" },
        { status: 500 }
      );
    }

    const data: CepResponse = await response.json();

    if (data.erro) {
      return NextResponse.json(
        { error: "CEP não encontrado" },
        { status: 404 }
      );
    }

    // Transforma para o formato usado no sistema
    const result: CepData = {
      cep: data.cep.replace("-", ""),
      xLgr: data.logradouro,
      xCpl: data.complemento,
      xBairro: data.bairro,
      xMun: data.localidade,
      UF: data.uf,
      cMun: data.ibge, // Código IBGE do município
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Erro ao buscar CEP:", error);
    return NextResponse.json(
      { error: "Erro ao consultar CEP" },
      { status: 500 }
    );
  }
}
