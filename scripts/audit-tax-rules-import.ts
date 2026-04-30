import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { parseTaxRulesWorkbookFromBuffer } from "@/lib/tax-rules/parser";

type JsonLike = null | boolean | number | string | JsonLike[] | { [k: string]: JsonLike };

type DiffEntry = {
  path: string;
  expected: JsonLike | undefined;
  actual: JsonLike | undefined;
  kind: "missing_in_db" | "extra_in_db" | "type_mismatch" | "value_mismatch";
};

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function normalize(value: unknown): JsonLike {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value.trim();
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const out: Record<string, JsonLike> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = normalize(v);
    }
    return out;
  }
  return String(value);
}

function deepEqual(a: JsonLike, b: JsonLike): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a == null || b == null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!deepEqual((a as Record<string, JsonLike>)[key], (b as Record<string, JsonLike>)[key])) {
        return false;
      }
    }
    return true;
  }
  return false;
}

function collectDiffs(
  expected: JsonLike | undefined,
  actual: JsonLike | undefined,
  basePath: string,
  out: DiffEntry[],
  maxDiffs: number
): void {
  if (out.length >= maxDiffs) return;
  if (expected === undefined && actual !== undefined) {
    out.push({ path: basePath, expected, actual, kind: "extra_in_db" });
    return;
  }
  if (expected !== undefined && actual === undefined) {
    out.push({ path: basePath, expected, actual, kind: "missing_in_db" });
    return;
  }
  if (expected === undefined || actual === undefined) return;

  if (typeof expected !== typeof actual) {
    out.push({ path: basePath, expected, actual, kind: "type_mismatch" });
    return;
  }
  if (expected == null || actual == null) {
    if (expected !== actual) {
      out.push({ path: basePath, expected, actual, kind: "value_mismatch" });
    }
    return;
  }
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) {
      out.push({ path: basePath, expected, actual, kind: "type_mismatch" });
      return;
    }
    const max = Math.max(expected.length, actual.length);
    for (let i = 0; i < max && out.length < maxDiffs; i++) {
      collectDiffs(expected[i], actual[i], `${basePath}[${i}]`, out, maxDiffs);
    }
    return;
  }
  if (typeof expected === "object" && typeof actual === "object") {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    for (const key of keys) {
      if (out.length >= maxDiffs) break;
      collectDiffs(
        (expected as Record<string, JsonLike>)[key],
        (actual as Record<string, JsonLike>)[key],
        `${basePath}.${key}`,
        out,
        maxDiffs
      );
    }
    return;
  }
  if (expected !== actual) {
    out.push({ path: basePath, expected, actual, kind: "value_mismatch" });
  }
}

async function main() {
  const profileId = readArg("--profileId") ?? readArg("--profile");
  const workbookPathArg = readArg("--file");
  const maxDiffs = Number(readArg("--maxDiffs") ?? "300");
  const outPathArg = readArg("--out");

  if (!profileId) {
    console.error("Uso: pnpm tax-rules:audit -- --profileId <id> --file \"<planilha.xlsx>\" [--out tmp/tax-rules-audit.json]");
    process.exit(1);
  }

  const workbookPath = workbookPathArg
    ? path.resolve(workbookPathArg)
    : path.resolve("Regras_Tributarias-2026_4_9-1775747309630 vanessa.xlsx");

  if (!fs.existsSync(workbookPath)) {
    console.error(`Planilha não encontrada: ${workbookPath}`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const buffer = fs.readFileSync(workbookPath);
    const parsed = parseTaxRulesWorkbookFromBuffer(buffer);

    const dbRecord = await prisma.profileTaxRules.findUnique({
      where: { profileId },
      select: {
        profileId: true,
        fileName: true,
        totalRules: true,
        uploadedAt: true,
        updatedAt: true,
        rules: true,
      },
    });

    if (!dbRecord) {
      console.error(`Nenhum ProfileTaxRules encontrado para profileId=${profileId}`);
      process.exit(1);
    }

    const expectedRules = normalize(parsed.rules);
    const actualRules = normalize(dbRecord.rules);

    const diffs: DiffEntry[] = [];
    collectDiffs(expectedRules, actualRules, "rules", diffs, maxDiffs);

    const summary = {
      profileId,
      workbookPath,
      dbFileName: dbRecord.fileName,
      dbUploadedAt: dbRecord.uploadedAt.toISOString(),
      dbUpdatedAt: dbRecord.updatedAt.toISOString(),
      expectedRulesCount: Array.isArray(expectedRules) ? expectedRules.length : 0,
      actualRulesCount: Array.isArray(actualRules) ? actualRules.length : 0,
      isExactMatch: deepEqual(expectedRules, actualRules),
      diffsFound: diffs.length,
      maxDiffsReported: maxDiffs,
    };

    const report = {
      summary,
      sampleDiffs: diffs,
    };

    const outPath = outPathArg ? path.resolve(outPathArg) : path.resolve("tmp/tax-rules-audit-report.json");
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

    console.log("=== Auditoria Planilha x Banco ===");
    console.log(`Profile: ${profileId}`);
    console.log(`Planilha: ${workbookPath}`);
    console.log(`Registro DB: ${dbRecord.fileName}`);
    console.log(`Rules esperadas: ${summary.expectedRulesCount} | Rules no banco: ${summary.actualRulesCount}`);
    console.log(`Match exato: ${summary.isExactMatch ? "SIM" : "NAO"}`);
    console.log(`Diferenças reportadas: ${summary.diffsFound}`);
    console.log(`Relatório: ${outPath}`);

    if (diffs.length > 0) {
      console.log("\nPrimeiras divergências:");
      for (const d of diffs.slice(0, 15)) {
        console.log(`- [${d.kind}] ${d.path}`);
        console.log(`  expected: ${JSON.stringify(d.expected)}`);
        console.log(`  actual  : ${JSON.stringify(d.actual)}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Falha na auditoria:", err);
  process.exit(1);
});

