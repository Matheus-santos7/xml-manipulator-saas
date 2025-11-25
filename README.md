# XML Manipulator SaaS

Visão geral e arquitetura de alto nível do projeto **xml-manipulator-saas**.

**Objetivo:** plataforma web para processar lote de arquivos XML fiscais (NFe/CTe), aplicar cenários de transformação (regras fiscais, renomeação, alteração de dados) e entregar pacotes processados ao usuário.

**Stack principal:**

- Frontend/Server: `Next.js` (App Router / `src/app`)
- Banco de dados: `Prisma` (`@prisma/client`) com `DATABASE_URL`
- Fila/Workers: possibilidade de uso de `BullMQ` + Redis (depósito no `package.json`)
- XML parsing: `@xmldom/xmldom` + `xpath`

**Pontos de entrada (arquitetura):**

- UI (client): `src/components/xml-manipulator/processor-client.tsx` — componente responsável por upload, seleção de cenário, disparo do processamento e download do ZIP.
- UI (admin/settings): `src/components/settings/scenario-editor.tsx` — criação/edição de cenários que geram regras aplicadas aos processadores.
- Server Actions (Next.js app actions):
  - `src/app/actions/process-batch.ts` — entrada principal de processamento em server-side (recebe FormData com arquivos + cenárioId).
  - `src/app/actions/settings.ts` — endpoints para salvar perfis e cenários no banco (utilizados pelo editor de cenários).
- Processador de domínio:
  - `src/app/lib/xml/XmlProcessor.ts` — orquestrador que usa handlers (`nfeHandler.ts`, `cteHandler.ts`) e utilitários de renomeação/extração.
  - `src/app/lib/xml/XmlHelper.ts` — wrapper DOM/XML (parser, xpath helpers, serialização e utilitários como remoção de assinatura).

**Arquivos-chave (referência rápida):**

- `package.json` — dependências e scripts (`dev`, `build`, `start`).
- `src/app/layout.tsx` — layout global e pontos de navegação.
- `src/app/page.tsx` — página inicial.
- `src/components/xml-manipulator/processor-client.tsx` — UI de processamento (drag/drop, botões, download ZIP).
- `src/components/settings/scenario-editor.tsx` — editor de cenários (client).
- `src/app/actions/process-batch.ts` — ação server que processa lote via `XmlProcessor`.
- `src/app/actions/settings.ts` — ações para salvar cenários e perfis no banco.
- `src/app/lib/xml/*` — `XmlProcessor.ts`, `XmlHelper.ts`, `nfeHandler.ts`, `renaming.ts`, etc.
- `prisma/schema.prisma` — modelo de dados (cenários, perfis, workspaces).

**Fluxograma - pontos de entrada (Mermaid)**

```mermaid
flowchart TD
  subgraph UI
    A[XmlProcessorClient<br/>(/dashboard/manipulador)]
    B[ScenarioEditor<br/>(/dashboard/configuracoes)]
  end

  subgraph Server
    SProc[processXmlBatch<br/>(src/app/actions/process-batch.ts)]
    SSet[saveScenario<br/>(src/app/actions/settings.ts)]
  end

  subgraph Domain
    XProc[XmlProcessor<br/>(src/app/lib/xml/XmlProcessor.ts)]
    XHelp[XmlHelper<br/>(src/app/lib/xml/XmlHelper.ts)]
    Handlers[Handlers<br/>(nfeHandler, cteHandler, renaming)]
  end

  subgraph Infra
    DB[(Prisma DB)]
    Queue[(BullMQ / Redis) - opcional]
  end

  A -->|FormData(files + scenarioId)| SProc
  B -->|Form data JSON| SSet
  SProc --> XProc
  SProc -->|persist/report| DB
  SSet --> DB
  XProc --> XHelp
  XProc --> Handlers
  Handlers --> DB
  XProc -->|long job| Queue
  Queue --> XProc
  XProc -->|processed XMLs| SProc
  SProc -->|response(results)| A
  A -->|client-side zip| Download[User Download]

```

Observações do diagrama:

- O client (`XmlProcessorClient`) envia `FormData` para a Server Action `processXmlBatch`. A ação instancia `XmlProcessor` para cada arquivo, que usa `XmlHelper` para parsing e handlers para aplicar regras do cenário.
- O `ScenarioEditor` grava regras e perfis via `saveScenario` diretamente no banco; `processXmlBatch` lê essas regras antes de aplicar.
- Para cargas maiores a arquitetura deve caminhar para `process-batch` enfileirado: a Server Action aceitaria upload, armazenaria arquivos temporários (S3/minio ou storage local), enfileiraria job em `BullMQ` e retornaria jobId. Workers consumiriam e processariam usando `XmlProcessor`.

**Fluxos de entrada descritos (detalhado):**

- Upload e processamento síncrono (atual):

  - Usuário faz upload de vários XMLs no `XmlProcessorClient` e seleciona um cenário.
  - `processor-client` chama `processXmlBatch` (server action) com `FormData`.
  - `processXmlBatch` carrega o cenário do DB (`db.scenario.findUnique`) e instancia `XmlProcessor` para cada arquivo.
  - `XmlProcessor` aplica o cenário, gera conteúdo processado e logs.
  - `processXmlBatch` retorna `results` com arquivos processados (conteúdo, novo nome, logs).
  - O client empacota em ZIP e inicia download via `file-saver`.

- Criação/edição de cenário (admin):
  - `ScenarioEditor` chama `saveScenario` (server action) que persiste configurações no DB via `Prisma`.

**Como rodar localmente**

- Pré-requisitos: `node` (v18+), `pnpm`, `postgres` (ou outro DB compatível com Prisma), `Redis` (opcional para fila).

Comandos rápidos:

```
pnpm install
pnpm run dev
```

Banco e migrations (exemplo):

```
# definir DATABASE_URL
npx prisma migrate dev --name init
```

Variáveis de ambiente recomendadas:

- `DATABASE_URL` — string de conexão do Prisma
- `REDIS_URL` — conexão do Redis (se usar BullMQ)
- `NEXTAUTH_URL` / `SUPABASE_URL` / `SUPABASE_KEY` — se estiver usando autenticação/integração

**Operação e escalabilidade (recomendações sênior)**

- Isolar processamento pesado: mover processamento de arquivos grandes para workers (BullMQ + Redis). Server Actions ficam responsáveis por validar e enfileirar.
- Storage escalável: usar S3/MinIO para arquivos temporários grandes (evita timeout HTTP em uploads/processamento).
- Observabilidade: adicionar logs estruturados (pino/winston), traces (OpenTelemetry) e métricas (Prometheus/Grafana).
- Segurança: validar e sanitizar XMLs (size limits, schemas), usar scanned AV para uploads, limitar tipos MIME e tempo de execução.
- Confiabilidade: adicionar retries idempotentes nos workers, checkpoints e armazenamento de relatório por arquivo/processo.

**Melhorias arquiteturais sugeridas (prioritárias)**

- Implementar fila + workers para processamentos longos.
- Migrar serialização dos resultados para armazenar em storage e retornar apenas o `downloadUrl` ao client.
- Adicionar testes unitários para `XmlProcessor` e handlers (mock `XmlHelper`).
- Centralizar transformações complexas em módulos testáveis e pequenos (Single Responsibility).

**Onde procurar para entender o fluxo no código**

- `src/components/xml-manipulator/processor-client.tsx` — UI + trigger de processamento
- `src/app/actions/process-batch.ts` — lógica de orquestração do processamento
- `src/app/lib/xml/XmlProcessor.ts` — aplicar cenários e handlers
- `src/app/lib/xml/XmlHelper.ts` — parsing/serialização/utilitários XML
- `src/components/settings/scenario-editor.tsx` & `src/app/actions/settings.ts` — criação/edição de cenários

---

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
