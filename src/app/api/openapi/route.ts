import { NextResponse } from "next/server";
import { openApiSpec } from "@/lib/openapi/spec";

/**
 * GET /api/openapi — retorna a especificação OpenAPI 3.0 em JSON.
 * Consumida pela página /api-docs (Swagger UI).
 */
export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
