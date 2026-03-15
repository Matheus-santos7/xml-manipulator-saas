"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic<any>(
  () => import("swagger-ui-react").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 dark:bg-neutral-900">
        <p className="text-neutral-600 dark:text-neutral-400">
          Carregando documentação…
        </p>
      </div>
    ),
  }
);

/**
 * Página de documentação da API (Swagger UI).
 * Acesse /api/api-docs para visualizar e testar os endpoints.
 */
export default function ApiDocsApiRoutePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <SwaggerUI url="/api/openapi" />
    </div>
  );
}

