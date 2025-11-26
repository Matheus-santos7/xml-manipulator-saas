import { NextRequest, NextResponse } from "next/server";

interface BrasilApiResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  ddd_telefone_1: string;
  ddd_telefone_2: string;
  email: string;
  situacao_cadastral: string;
  data_situacao_cadastral: string;
  codigo_municipio: string;
  codigo_municipio_ibge: string;
  message?: string;
  type?: string;
}

export interface CnpjData {
  cnpj: string;
  xNome: string;
  xFant: string;
  xLgr: string;
  nro: string;
  xCpl: string;
  xBairro: string;
  xMun: string;
  UF: string;
  CEP: string;
  fone: string;
  email: string;
  cMun: string;
  situacao: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cnpj = searchParams.get("cnpj");

  if (!cnpj) {
    return NextResponse.json({ error: "CNPJ é obrigatório" }, { status: 400 });
  }

  // Remove caracteres não numéricos
  const cnpjLimpo = cnpj.replace(/\D/g, "");

  if (cnpjLimpo.length !== 14) {
    return NextResponse.json(
      { error: "CNPJ deve ter 14 dígitos" },
      { status: 400 }
    );
  }

  try {
    // Tentativa 1: BrasilAPI
    let data: BrasilApiResponse | null = null;

    try {
      const response = await fetch(
        `https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (response.ok) {
        data = await response.json();
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.log("BrasilAPI error:", response.status, errorData);

        if (
          response.status === 404 ||
          errorData?.message?.includes("não encontrado")
        ) {
          return NextResponse.json(
            { error: "CNPJ não encontrado na base da Receita Federal" },
            { status: 404 }
          );
        }
      }
    } catch (brasilApiError) {
      console.error("BrasilAPI falhou:", brasilApiError);
    }

    // Se BrasilAPI falhou, tenta API alternativa (ReceitaWS)
    if (!data) {
      try {
        const response = await fetch(
          `https://receitaws.com.br/v1/cnpj/${cnpjLimpo}`,
          {
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (response.ok) {
          const receitaData = await response.json();

          if (receitaData.status === "ERROR") {
            return NextResponse.json(
              { error: receitaData.message || "CNPJ não encontrado" },
              { status: 404 }
            );
          }

          // Converte formato ReceitaWS para nosso formato
          data = {
            cnpj: receitaData.cnpj,
            razao_social: receitaData.nome,
            nome_fantasia: receitaData.fantasia,
            logradouro: receitaData.logradouro,
            numero: receitaData.numero,
            complemento: receitaData.complemento,
            bairro: receitaData.bairro,
            municipio: receitaData.municipio,
            uf: receitaData.uf,
            cep: receitaData.cep,
            ddd_telefone_1: receitaData.telefone,
            ddd_telefone_2: "",
            email: receitaData.email,
            situacao_cadastral: receitaData.situacao,
            data_situacao_cadastral: receitaData.data_situacao,
            codigo_municipio: "",
            codigo_municipio_ibge: "",
          };
        }
      } catch (receitaError) {
        console.error("ReceitaWS também falhou:", receitaError);
      }
    }

    if (!data) {
      return NextResponse.json(
        {
          error:
            "Não foi possível consultar o CNPJ. Tente novamente mais tarde.",
        },
        { status: 503 }
      );
    }

    // Formata o telefone
    let telefone = "";
    if (data.ddd_telefone_1) {
      telefone = data.ddd_telefone_1.replace(/\D/g, "");
    }

    // Transforma para o formato usado no sistema
    const result: CnpjData = {
      cnpj: cnpjLimpo,
      xNome: data.razao_social || "",
      xFant: data.nome_fantasia || "",
      xLgr: data.logradouro || "",
      nro: data.numero || "",
      xCpl: data.complemento || "",
      xBairro: data.bairro || "",
      xMun: data.municipio || "",
      UF: data.uf || "",
      CEP: (data.cep || "").replace(/\D/g, ""),
      fone: telefone,
      email: data.email || "",
      cMun: data.codigo_municipio_ibge || data.codigo_municipio || "",
      situacao: data.situacao_cadastral || "",
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Erro ao buscar CNPJ:", error);
    return NextResponse.json(
      { error: "Erro interno ao consultar CNPJ" },
      { status: 500 }
    );
  }
}
