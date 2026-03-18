type ScenarioEmitenteLike = {
  cnpj?: string | null;
  xNome?: string | null;
  xLgr?: string | null;
  nro?: string | null;
  xCpl?: string | null;
  xBairro?: string | null;
  xMun?: string | null;
  UF?: string | null;
  CEP?: string | null;
  fone?: string | null;
  IE?: string | null;
} | null;

type ScenarioDestinatarioLike = {
  cnpj?: string | null;
  cpf?: string | null;
  xNome?: string | null;
  IE?: string | null;
  xLgr?: string | null;
  nro?: string | null;
  xBairro?: string | null;
  xMun?: string | null;
  UF?: string | null;
  CEP?: string | null;
  fone?: string | null;
} | null;

type ScenarioProdutoLike = {
  xProd?: string | null;
  cEAN?: string | null;
  cProd?: string | null;
  NCM?: string | null;
  origem?: string | null;
} | null;

type ScenarioImpostoLike = {
  tipoTributacao?: string | null;
  pFCP?: string | null;
  pICMS?: string | null;
  pICMSUFDest?: string | null;
  pICMSInter?: string | null;
  pPIS?: string | null;
  pCOFINS?: string | null;
  pIPI?: string | null;
} | null;

type ScenarioForLogging = {
  id: string;
  name: string;
  editar_emitente: boolean;
  editar_destinatario_pj: boolean;
  editar_destinatario_pf: boolean;
  editar_produtos: boolean;
  editar_impostos: boolean;
  editar_data: boolean;
  editar_refNFe: boolean;
  editar_cst: boolean;
  zerar_ipi_remessa_retorno: boolean;
  zerar_ipi_venda: boolean;
  reforma_tributaria: boolean;
  alterar_serie: boolean;
  alterar_cUF: boolean;
  aplicar_reducao_aliq: boolean;
  nova_serie?: string | null;
  nova_data?: string | null;
  novo_cUF?: string | null;
  ScenarioEmitente?: ScenarioEmitenteLike;
  ScenarioDestinatario?: ScenarioDestinatarioLike;
  ScenarioProduto?: ScenarioProdutoLike[] | ScenarioProdutoLike;
  ScenarioImposto?: ScenarioImpostoLike;
  CstMapping?: { length: number } | null;
  TaxReformRule?: { length: number } | null;
};

function maskNumericId(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) {
    return "*".repeat(digits.length);
  }
  const visible = digits.slice(-4);
  return `${"*".repeat(digits.length - 4)}${visible}`;
}

function maskText(value: string | null | undefined): string | null {
  if (!value) return null;
  return "***";
}

function maskEmitente(emitente: ScenarioEmitenteLike) {
  if (!emitente) return null;
  return {
    cnpj: maskNumericId(emitente.cnpj ?? null),
    xNome: maskText(emitente.xNome ?? null),
    xMun: maskText(emitente.xMun ?? null),
    UF: emitente.UF ?? null,
  };
}

function maskDestinatario(destinatario: ScenarioDestinatarioLike) {
  if (!destinatario) return null;
  return {
    cnpj: maskNumericId(destinatario.cnpj ?? null),
    cpf: maskNumericId(destinatario.cpf ?? null),
    xNome: maskText(destinatario.xNome ?? null),
    xMun: maskText(destinatario.xMun ?? null),
    UF: destinatario.UF ?? null,
  };
}

function maskProduto(produto: ScenarioProdutoLike) {
  if (!produto) return null;
  return {
    xProd: maskText(produto.xProd ?? null),
    cEAN: maskNumericId(produto.cEAN ?? null),
    cProd: maskText(produto.cProd ?? null),
    NCM: maskText(produto.NCM ?? null),
    origem: produto.origem ?? null,
  };
}

function maskImpostos(impostos: ScenarioImpostoLike) {
  if (!impostos) return null;
  return {
    tipoTributacao: impostos.tipoTributacao ?? null,
    possuiAliquotasDefinidas: Boolean(
      impostos.pFCP ||
        impostos.pICMS ||
        impostos.pICMSUFDest ||
        impostos.pICMSInter ||
        impostos.pPIS ||
        impostos.pCOFINS ||
        impostos.pIPI
    ),
  };
}

function buildFilesSummary(files: File[]) {
  const total = files.length;
  const extensions: Record<string, number> = {};
  for (const file of files) {
    const parts = file.name.split(".");
    const ext =
      parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "sem_extensao";
    extensions[ext] = (extensions[ext] || 0) + 1;
  }
  return { total, extensions };
}

export function logScenarioAndFiles(
  scenario: ScenarioForLogging,
  files: File[],
  scenarioId: string
) {
  const maskedEmitente = maskEmitente(scenario.ScenarioEmitente ?? null);
  const maskedDestinatario = maskDestinatario(
    scenario.ScenarioDestinatario ?? null
  );

  const produtos = Array.isArray(scenario.ScenarioProduto)
    ? scenario.ScenarioProduto
    : scenario.ScenarioProduto
    ? [scenario.ScenarioProduto]
    : [];

  const maskedProdutos = produtos.slice(0, 3).map((p) => maskProduto(p));

  const maskedImpostos = maskImpostos(scenario.ScenarioImposto ?? null);

  const filesSummary = buildFilesSummary(files);

  console.info("Iniciando processamento de XML com cenário", {
    scenarioId,
    scenarioName: scenario.name,
    flags: {
      editar_emitente: scenario.editar_emitente,
      editar_destinatario_pj: scenario.editar_destinatario_pj,
      editar_destinatario_pf: scenario.editar_destinatario_pf,
      editar_produtos: scenario.editar_produtos,
      editar_impostos: scenario.editar_impostos,
      editar_data: scenario.editar_data,
      editar_refNFe: scenario.editar_refNFe,
      editar_cst: scenario.editar_cst,
      zerar_ipi_remessa_retorno: scenario.zerar_ipi_remessa_retorno,
      zerar_ipi_venda: scenario.zerar_ipi_venda,
      reforma_tributaria: scenario.reforma_tributaria,
      alterar_serie: scenario.alterar_serie,
      alterar_cUF: scenario.alterar_cUF,
      aplicar_reducao_aliq: scenario.aplicar_reducao_aliq,
    },
    scenarioResumo: {
      emitente: maskedEmitente,
      destinatario: maskedDestinatario,
      produtosExemplo: maskedProdutos,
      impostos: maskedImpostos,
      quantidadeProdutos: produtos.length,
      quantidadeCstMappings: scenario.CstMapping?.length ?? 0,
      quantidadeTaxReformRules: scenario.TaxReformRule?.length ?? 0,
    },
    files: filesSummary,
  });
}

