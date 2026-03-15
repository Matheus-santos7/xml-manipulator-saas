/**
 * Especificação OpenAPI 3.0 da API do XML Manipulator SaaS.
 * Usada pela rota /api/openapi e pela página /api-docs (Swagger UI).
 */
export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "XML Manipulator SaaS — API",
    description:
      "Documentação das rotas HTTP da aplicação: consulta CEP/CNPJ.",
    version: "1.0.0",
  },
  servers: [{ url: "/api", description: "API base (relativo ao host atual)" }],
  paths: {
    "/cep": {
      get: {
        summary: "Consultar CEP",
        description:
          "Busca endereço pelo CEP (ViaCEP). Retorna dados no formato usado pelo sistema (xLgr, xBairro, xMun, UF, cMun, etc.).",
        operationId: "getCep",
        tags: ["Consulta"],
        parameters: [
          {
            name: "cep",
            in: "query",
            required: true,
            description: "CEP com 8 dígitos (pode conter hífen ou apenas números)",
            schema: { type: "string", example: "01310100" },
          },
        ],
        responses: {
          "200": {
            description: "Endereço encontrado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    cep: { type: "string" },
                    xLgr: { type: "string" },
                    xCpl: { type: "string" },
                    xBairro: { type: "string" },
                    xMun: { type: "string" },
                    UF: { type: "string" },
                    cMun: { type: "string" },
                  },
                },
              },
            },
          },
          "400": {
            description: "CEP ausente ou inválido (não tem 8 dígitos)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "404": {
            description: "CEP não encontrado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Erro ao consultar serviço de CEP",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/cnpj": {
      get: {
        summary: "Consultar CNPJ",
        description:
          "Busca dados cadastrais na Receita Federal (BrasilAPI ou ReceitaWS). Retorna no formato do sistema (xNome, xFant, endereço, etc.).",
        operationId: "getCnpj",
        tags: ["Consulta"],
        parameters: [
          {
            name: "cnpj",
            in: "query",
            required: true,
            description: "CNPJ com 14 dígitos (pode conter pontuação ou apenas números)",
            schema: { type: "string", example: "00000000000191" },
          },
        ],
        responses: {
          "200": {
            description: "Dados do CNPJ encontrados",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    cnpj: { type: "string" },
                    xNome: { type: "string" },
                    xFant: { type: "string" },
                    xLgr: { type: "string" },
                    nro: { type: "string" },
                    xCpl: { type: "string" },
                    xBairro: { type: "string" },
                    xMun: { type: "string" },
                    UF: { type: "string" },
                    CEP: { type: "string" },
                    fone: { type: "string" },
                    email: { type: "string" },
                    cMun: { type: "string" },
                    situacao: { type: "string" },
                  },
                },
              },
            },
          },
          "400": {
            description: "CNPJ ausente ou inválido (não tem 14 dígitos)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "404": {
            description: "CNPJ não encontrado na base da Receita Federal",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "503": {
            description: "Serviços de consulta indisponíveis",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Erro interno",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string", description: "Mensagem de erro" },
        },
      },
    },
  },
};
