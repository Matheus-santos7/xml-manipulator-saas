/**
 * Módulo de manipulação de impostos para XMLs fiscais brasileiros
 * Contém toda a lógica relacionada a impostos (ICMS, IPI, PIS, COFINS, IBS/CBS)
 */

import {
  VENDAS_CFOP,
  DEVOLUCOES_CFOP,
  RETORNOS_CFOP,
  REMESSAS_CFOP,
  type TipoOperacao,
} from "@/lib/data";
import {
  XML_STRUCTURE,
  XML_TAGS,
  CST_PATTERNS,
  IPI_PATTERNS,
  VALORES_PRODUTO_PATTERNS,
  REFORMA_TRIBUTARIA_PATTERNS,
} from "./regexPatterns";

// ============================================================================
// INTERFACES E TIPOS
// ============================================================================

/**
 * Mapeamento de CST por Tipo de Operação
 */
export interface CstMappingData {
  tipoOperacao: TipoOperacao;
  icms?: string | null;
  ipi?: string | null;
  pis?: string | null;
  cofins?: string | null;
}

/**
 * Dados para Reforma Tributária (IBS/CBS)
 */
export interface TaxReformRuleData {
  pIBSUF?: string | null; // Alíquota IBS UF (ex: "9.50")
  pIBSMun?: string | null; // Alíquota IBS Municipal (ex: "3.50")
  pCBS?: string | null; // Alíquota CBS (ex: "8.80")
  vDevTrib?: string | null; // Valor de devolução tributária
  cClassTrib?: string | null; // Código de classificação tributária
  CST?: string | null; // CST do IBS/CBS
}

/**
 * Resultado do cálculo dos valores IBS/CBS por item
 */
export interface ValoresIBSCBS {
  vBC: string;
  vIBSUF: string;
  vIBSMun: string;
  vCBS: string;
  vDevTrib: string;
}

/**
 * Totais acumulados de IBS/CBS
 */
export interface TotaisIBSCBS {
  vBC: number;
  vIBSUF: number;
  vIBSMun: number;
  vCBS: number;
  vDevTrib: number;
}

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

/**
 * Formata um número para 2 casas decimais
 */
export function formatDecimal(value: number): string {
  return value.toFixed(2);
}

/**
 * Formata um número para 4 casas decimais (usado em alíquotas)
 */
export function formatDecimal4(value: number): string {
  return value.toFixed(4);
}

/**
 * Converte string de porcentagem para número
 * @param value - String representando porcentagem ("9,50" ou "9.50")
 * @returns Número decimal
 */
export function parsePercent(value: string | null | undefined): number {
  if (!value) return 0;
  return parseFloat(value.replace(",", ".")) || 0;
}

/**
 * Identifica o tipo de operação baseado no CFOP
 * @param cfop - Código Fiscal de Operações
 * @returns Tipo de operação ou null se não identificado
 */
export function getTipoOperacaoByCfop(cfop: string): TipoOperacao | null {
  if (VENDAS_CFOP.includes(cfop)) return "VENDA";
  if (DEVOLUCOES_CFOP.includes(cfop)) return "DEVOLUCAO";
  if (RETORNOS_CFOP.includes(cfop)) return "RETORNO";
  if (REMESSAS_CFOP.includes(cfop)) return "REMESSA";
  return null;
}

/**
 * Verifica se o CFOP é de remessa ou retorno
 */
export function isRemessaOuRetorno(cfop: string): boolean {
  return REMESSAS_CFOP.includes(cfop) || RETORNOS_CFOP.includes(cfop);
}

/**
 * Verifica se o CFOP é de venda
 */
export function isVenda(cfop: string): boolean {
  return VENDAS_CFOP.includes(cfop);
}

// ============================================================================
// CST - CÓDIGO DE SITUAÇÃO TRIBUTÁRIA
// ============================================================================

/**
 * Cria mapa de CST por tipo de operação para acesso rápido
 */
export function criarMapaCst(cstMappings: CstMappingData[]): Map<
  TipoOperacao,
  {
    icms?: string | null;
    ipi?: string | null;
    pis?: string | null;
    cofins?: string | null;
  }
> {
  const cstMap = new Map<
    TipoOperacao,
    {
      icms?: string | null;
      ipi?: string | null;
      pis?: string | null;
      cofins?: string | null;
    }
  >();

  for (const mapping of cstMappings) {
    cstMap.set(mapping.tipoOperacao, {
      icms: mapping.icms,
      ipi: mapping.ipi,
      pis: mapping.pis,
      cofins: mapping.cofins,
    });
  }

  return cstMap;
}

/**
 * Aplica CST em um bloco <det> do XML
 * @param detBlock - Conteúdo XML do bloco <det>
 * @param cstMappings - Array de mapeamentos de CST
 * @param alteracoes - Array para registrar alterações
 * @returns XML do bloco <det> modificado
 */
export function aplicarCstNoItem(
  detBlock: string,
  cstMappings: CstMappingData[],
  alteracoes: string[]
): string {
  let detBlockEditado = detBlock;

  // Extrai o CFOP deste item
  const cfopMatch = detBlock.match(XML_TAGS.CFOP);
  const cfopItem = cfopMatch ? cfopMatch[1] : null;

  if (!cfopItem) return detBlock;

  // Determina o tipo de operação pelo CFOP
  const tipoOp = getTipoOperacaoByCfop(cfopItem);
  if (!tipoOp) return detBlock;

  // Cria mapa para acesso rápido
  const cstMapByTipoOp = criarMapaCst(cstMappings);

  if (!cstMapByTipoOp.has(tipoOp)) return detBlock;

  const cstRules = cstMapByTipoOp.get(tipoOp)!;

  // Aplica CST do ICMS (dentro de <ICMS><ICMSxx><CST>)
  if (cstRules.icms) {
    if (CST_PATTERNS.ICMS.test(detBlockEditado)) {
      detBlockEditado = detBlockEditado.replace(
        CST_PATTERNS.ICMS,
        `$1$2${cstRules.icms}$3`
      );
      alteracoes.push(
        `CST ICMS alterado para ${cstRules.icms} (${tipoOp} - CFOP ${cfopItem})`
      );
    }
  }

  // Aplica CST do IPI (dentro de <IPI><IPITrib> ou <IPI><IPINT>)
  if (cstRules.ipi) {
    if (CST_PATTERNS.IPI.test(detBlockEditado)) {
      detBlockEditado = detBlockEditado.replace(
        CST_PATTERNS.IPI,
        `$1$2${cstRules.ipi}$3`
      );
      alteracoes.push(
        `CST IPI alterado para ${cstRules.ipi} (${tipoOp} - CFOP ${cfopItem})`
      );
    }
  }

  // Aplica CST do PIS (dentro de <PIS><PISAliq>, <PIS><PISQtde>, etc.)
  if (cstRules.pis) {
    if (CST_PATTERNS.PIS.test(detBlockEditado)) {
      detBlockEditado = detBlockEditado.replace(
        CST_PATTERNS.PIS,
        `$1$2${cstRules.pis}$3`
      );
      alteracoes.push(
        `CST PIS alterado para ${cstRules.pis} (${tipoOp} - CFOP ${cfopItem})`
      );
    }
  }

  // Aplica CST do COFINS (dentro de <COFINS><COFINSAliq>, etc.)
  if (cstRules.cofins) {
    if (CST_PATTERNS.COFINS.test(detBlockEditado)) {
      detBlockEditado = detBlockEditado.replace(
        CST_PATTERNS.COFINS,
        `$1$2${cstRules.cofins}$3`
      );
      alteracoes.push(
        `CST COFINS alterado para ${cstRules.cofins} (${tipoOp} - CFOP ${cfopItem})`
      );
    }
  }

  return detBlockEditado;
}

/**
 * Aplica CST em todos os itens do XML
 * @param xmlContent - Conteúdo completo do XML
 * @param cstMappings - Array de mapeamentos de CST
 * @param alteracoes - Array para registrar alterações
 * @returns XML modificado
 */
export function aplicarCstEmTodosItens(
  xmlContent: string,
  cstMappings: CstMappingData[],
  alteracoes: string[]
): string {
  let xmlEditado = xmlContent;

  // Regex para encontrar todos os blocos <det>
  const regexDet = /<det[^>]*>[\s\S]*?<\/det>/gi;
  const detBlocks = xmlContent.match(regexDet);

  if (!detBlocks || detBlocks.length === 0) {
    return xmlContent;
  }

  for (const detBlock of detBlocks) {
    const detBlockEditado = aplicarCstNoItem(detBlock, cstMappings, alteracoes);
    if (detBlockEditado !== detBlock) {
      xmlEditado = xmlEditado.replace(detBlock, detBlockEditado);
    }
  }

  return xmlEditado;
}

// ============================================================================
// IPI - IMPOSTO SOBRE PRODUTOS INDUSTRIALIZADOS
// ============================================================================

/**
 * Zera valores de IPI em um bloco <det>
 * @param detBlock - Conteúdo XML do bloco <det>
 * @param motivo - Motivo para zerar (ex: "remessa/retorno" ou "venda")
 * @param alteracoes - Array para registrar alterações
 * @returns XML do bloco <det> modificado
 */
export function zerarIpiNoItem(
  detBlock: string,
  motivo: "remessa-retorno" | "venda",
  alteracoes: string[]
): string {
  let detBlockEditado = detBlock;

  // Zera vIPI (valor do IPI)
  if (IPI_PATTERNS.V_IPI.test(detBlockEditado)) {
    detBlockEditado = detBlockEditado.replace(IPI_PATTERNS.V_IPI, "$10.00$2");
  }

  // Zera vBC (base de cálculo do IPI)
  if (IPI_PATTERNS.V_BC_IPI.test(detBlockEditado)) {
    detBlockEditado = detBlockEditado.replace(
      IPI_PATTERNS.V_BC_IPI,
      "$1$20.00$3"
    );
  }

  // Zera pIPI (alíquota do IPI)
  if (IPI_PATTERNS.P_IPI.test(detBlockEditado)) {
    detBlockEditado = detBlockEditado.replace(IPI_PATTERNS.P_IPI, "$10.0000$2");
  }

  if (detBlockEditado !== detBlock) {
    const mensagem =
      motivo === "remessa-retorno"
        ? "Valores de IPI zerados para remessa/retorno"
        : "Valores de IPI zerados para venda";

    // Adiciona mensagem apenas uma vez
    if (!alteracoes.includes(mensagem)) {
      alteracoes.push(mensagem);
    }
  }

  return detBlockEditado;
}

/**
 * Zera IPI em todos os itens conforme regras
 * @param xmlContent - Conteúdo completo do XML
 * @param zerarIpiRemessaRetorno - Se deve zerar IPI em remessa/retorno
 * @param zerarIpiVenda - Se deve zerar IPI em venda
 * @param alteracoes - Array para registrar alterações
 * @returns XML modificado
 */
export function zerarIpiEmTodosItens(
  xmlContent: string,
  zerarIpiRemessaRetorno: boolean,
  zerarIpiVenda: boolean,
  alteracoes: string[]
): string {
  if (!zerarIpiRemessaRetorno && !zerarIpiVenda) {
    return xmlContent;
  }

  let xmlEditado = xmlContent;

  // Regex para encontrar todos os blocos <det>
  const detBlocks = xmlContent.match(XML_STRUCTURE.DET_BLOCK);

  if (!detBlocks || detBlocks.length === 0) {
    return xmlContent;
  }

  for (const detBlock of detBlocks) {
    let detBlockEditado = detBlock;

    // Extrai o CFOP deste item
    const cfopMatch = detBlock.match(XML_TAGS.CFOP);
    const cfopItem = cfopMatch ? cfopMatch[1] : null;

    if (!cfopItem) continue;

    // Zera IPI em remessa/retorno
    if (zerarIpiRemessaRetorno && isRemessaOuRetorno(cfopItem)) {
      detBlockEditado = zerarIpiNoItem(
        detBlockEditado,
        "remessa-retorno",
        alteracoes
      );
    }

    // Zera IPI em venda
    if (zerarIpiVenda && isVenda(cfopItem)) {
      detBlockEditado = zerarIpiNoItem(detBlockEditado, "venda", alteracoes);
    }

    if (detBlockEditado !== detBlock) {
      xmlEditado = xmlEditado.replace(detBlock, detBlockEditado);
    }
  }

  return xmlEditado;
}

/**
 * Recalcula os totais de IPI na nota
 * @param xmlContent - Conteúdo completo do XML
 * @param alteracoes - Array para registrar alterações
 * @returns XML modificado
 */
export function recalcularTotaisIpi(
  xmlContent: string,
  alteracoes: string[]
): string {
  let xmlEditado = xmlContent;

  // Extrair todos os valores dos itens
  const detBlocks = xmlContent.match(XML_STRUCTURE.DET_BLOCK);

  if (!detBlocks || detBlocks.length === 0) {
    return xmlContent;
  }

  let totalVProd = 0;
  let totalVIPI = 0;
  let totalVDesc = 0;
  let totalVFrete = 0;
  let totalVSeg = 0;
  let totalVOutro = 0;

  // Soma todos os valores dos itens
  for (const detBlock of detBlocks) {
    // vProd
    const vProdMatch = detBlock.match(VALORES_PRODUTO_PATTERNS.V_PROD);
    if (vProdMatch) {
      totalVProd += parseFloat(vProdMatch[1]) || 0;
    }

    // vIPI
    const vIPIMatch = detBlock.match(VALORES_PRODUTO_PATTERNS.V_IPI);
    if (vIPIMatch) {
      totalVIPI += parseFloat(vIPIMatch[1]) || 0;
    }

    // vDesc
    const vDescMatch = detBlock.match(VALORES_PRODUTO_PATTERNS.V_DESC);
    if (vDescMatch) {
      totalVDesc += parseFloat(vDescMatch[1]) || 0;
    }

    // vFrete
    const vFreteMatch = detBlock.match(VALORES_PRODUTO_PATTERNS.V_FRETE);
    if (vFreteMatch) {
      totalVFrete += parseFloat(vFreteMatch[1]) || 0;
    }

    // vSeg
    const vSegMatch = detBlock.match(VALORES_PRODUTO_PATTERNS.V_SEG);
    if (vSegMatch) {
      totalVSeg += parseFloat(vSegMatch[1]) || 0;
    }

    // vOutro
    const vOutroMatch = detBlock.match(VALORES_PRODUTO_PATTERNS.V_OUTRO);
    if (vOutroMatch) {
      totalVOutro += parseFloat(vOutroMatch[1]) || 0;
    }
  }

  // Calcula o novo valor total da nota
  const novoVNF =
    totalVProd + totalVIPI + totalVFrete + totalVSeg + totalVOutro - totalVDesc;

  // Atualiza vIPI no totalizador
  if (IPI_PATTERNS.V_IPI_TOTAL.test(xmlEditado)) {
    xmlEditado = xmlEditado.replace(
      IPI_PATTERNS.V_IPI_TOTAL,
      `$1${formatDecimal(totalVIPI)}$2`
    );
    alteracoes.push("Total vIPI recalculado");
  }

  // Atualiza vNF no totalizador
  if (IPI_PATTERNS.V_NF_TOTAL.test(xmlEditado)) {
    xmlEditado = xmlEditado.replace(
      IPI_PATTERNS.V_NF_TOTAL,
      `$1${formatDecimal(novoVNF)}$2`
    );
    alteracoes.push("Total vNF recalculado");
  }

  return xmlEditado;
}

// ============================================================================
// REFORMA TRIBUTÁRIA - IBS/CBS
// ============================================================================

/**
 * Cria o bloco XML <IBSCBS> para um item
 * @param vProd - Valor do produto (base de cálculo)
 * @param taxRule - Regras da reforma tributária
 * @returns Objeto com XML e valores calculados
 */
export function criarBlocoIBSCBS(
  vProd: string,
  taxRule: TaxReformRuleData
): { xml: string; valores: ValoresIBSCBS } {
  const vBC = parseFloat(vProd) || 0;
  const pIBSUF = parsePercent(taxRule.pIBSUF);
  const pIBSMun = parsePercent(taxRule.pIBSMun);
  const pCBS = parsePercent(taxRule.pCBS);
  const vDevTrib = parsePercent(taxRule.vDevTrib);

  // Cálculo dos valores
  const vIBSUF = (vBC * pIBSUF) / 100;
  const vIBSMun = (vBC * pIBSMun) / 100;
  const vCBS = (vBC * pCBS) / 100;

  const cst = taxRule.CST || "000";
  const cClassTrib = taxRule.cClassTrib || "000001";

  // Constrói o XML
  const xml =
    `<IBSCBS>` +
    `<CST>${cst}</CST>` +
    `<cClassTrib>${cClassTrib}</cClassTrib>` +
    `<gIBSCBS>` +
    `<vBC>${formatDecimal(vBC)}</vBC>` +
    `<gIBSUF>` +
    `<pIBSUF>${formatDecimal(pIBSUF)}</pIBSUF>` +
    `<gDevTrib><vDevTrib>${formatDecimal(vDevTrib)}</vDevTrib></gDevTrib>` +
    `<vIBSUF>${formatDecimal(vIBSUF)}</vIBSUF>` +
    `</gIBSUF>` +
    `<gIBSMun>` +
    `<pIBSMun>${formatDecimal(pIBSMun)}</pIBSMun>` +
    `<gDevTrib><vDevTrib>0.00</vDevTrib></gDevTrib>` +
    `<vIBSMun>${formatDecimal(vIBSMun)}</vIBSMun>` +
    `</gIBSMun>` +
    `<gCBS>` +
    `<pCBS>${formatDecimal(pCBS)}</pCBS>` +
    `<gDevTrib><vDevTrib>0.00</vDevTrib></gDevTrib>` +
    `<vCBS>${formatDecimal(vCBS)}</vCBS>` +
    `</gCBS>` +
    `</gIBSCBS>` +
    `</IBSCBS>`;

  return {
    xml,
    valores: {
      vBC: formatDecimal(vBC),
      vIBSUF: formatDecimal(vIBSUF),
      vIBSMun: formatDecimal(vIBSMun),
      vCBS: formatDecimal(vCBS),
      vDevTrib: formatDecimal(vDevTrib),
    },
  };
}

/**
 * Cria o bloco XML <IBSCBSTot> para totalização
 * @param totais - Totais acumulados
 * @returns XML do totalizador
 */
export function criarBlocoIBSCBSTot(totais: TotaisIBSCBS): string {
  const vIBS_total = totais.vIBSUF + totais.vIBSMun;

  const xml =
    `<IBSCBSTot>` +
    `<vBCIBSCBS>${formatDecimal(totais.vBC)}</vBCIBSCBS>` +
    `<gIBS>` +
    `<gIBSUF>` +
    `<vDif>0.00</vDif>` +
    `<vDevTrib>${formatDecimal(totais.vDevTrib)}</vDevTrib>` +
    `<vIBSUF>${formatDecimal(totais.vIBSUF)}</vIBSUF>` +
    `</gIBSUF>` +
    `<gIBSMun>` +
    `<vDif>0.00</vDif>` +
    `<vDevTrib>0.00</vDevTrib>` +
    `<vIBSMun>${formatDecimal(totais.vIBSMun)}</vIBSMun>` +
    `</gIBSMun>` +
    `<vIBS>${formatDecimal(vIBS_total)}</vIBS>` +
    `<vCredPres>0.00</vCredPres>` +
    `<vCredPresCondSus>0.00</vCredPresCondSus>` +
    `</gIBS>` +
    `<gCBS>` +
    `<vDif>0.00</vDif>` +
    `<vDevTrib>0.00</vDevTrib>` +
    `<vCBS>${formatDecimal(totais.vCBS)}</vCBS>` +
    `<vCredPres>0.00</vCredPres>` +
    `<vCredPresCondSus>0.00</vCredPresCondSus>` +
    `</gCBS>` +
    `</IBSCBSTot>`;

  return xml;
}

/**
 * Aplica reforma tributária (IBS/CBS) em todos os itens do XML
 * @param xmlContent - Conteúdo completo do XML
 * @param taxRule - Regras da reforma tributária
 * @param alteracoes - Array para registrar alterações
 * @returns XML modificado
 */
export function aplicarReformaTributaria(
  xmlContent: string,
  taxRule: TaxReformRuleData,
  alteracoes: string[]
): string {
  let xmlEditado = xmlContent;

  // Totais acumulados
  const totais: TotaisIBSCBS = {
    vBC: 0,
    vIBSUF: 0,
    vIBSMun: 0,
    vCBS: 0,
    vDevTrib: 0,
  };

  // Regex para encontrar todos os blocos <det>
  const detBlocks = xmlContent.match(XML_STRUCTURE.DET_BLOCK);

  if (detBlocks && detBlocks.length > 0) {
    for (const detBlock of detBlocks) {
      // Extrai o valor do produto
      const vProdMatch = detBlock.match(XML_TAGS.V_PROD);
      if (!vProdMatch) continue;

      const vProd = vProdMatch[1];

      // Remove bloco IBSCBS existente (se houver)
      let detBlockEditado = detBlock.replace(
        REFORMA_TRIBUTARIA_PATTERNS.REMOVE_IBSCBS,
        ""
      );

      // Cria novo bloco IBSCBS
      const { xml: blocoIBSCBS, valores } = criarBlocoIBSCBS(vProd, taxRule);

      // Insere o bloco antes do fechamento de </imposto>
      detBlockEditado = detBlockEditado.replace(
        REFORMA_TRIBUTARIA_PATTERNS.IMPOSTO_CLOSE,
        `${blocoIBSCBS}$1`
      );

      // Atualiza o XML
      xmlEditado = xmlEditado.replace(detBlock, detBlockEditado);

      // Acumula totais
      totais.vBC += parseFloat(valores.vBC);
      totais.vIBSUF += parseFloat(valores.vIBSUF);
      totais.vIBSMun += parseFloat(valores.vIBSMun);
      totais.vCBS += parseFloat(valores.vCBS);
      totais.vDevTrib += parseFloat(valores.vDevTrib);
    }

    alteracoes.push(
      "Reforma Tributária: Blocos <IBSCBS> adicionados aos itens"
    );

    // Remove totalizador existente (se houver)
    xmlEditado = xmlEditado.replace(/<IBSCBSTot>[\s\S]*?<\/IBSCBSTot>/gi, "");

    // Cria novo totalizador
    const blocoTotalizador = criarBlocoIBSCBSTot(totais);

    // Insere o totalizador antes do fechamento de </total>
    xmlEditado = xmlEditado.replace(
      REFORMA_TRIBUTARIA_PATTERNS.TOTAL_CLOSE,
      `${blocoTotalizador}$1`
    );

    alteracoes.push(
      "Reforma Tributária: Bloco <IBSCBSTot> adicionado aos totais"
    );
  }

  return xmlEditado;
}

// ============================================================================
// FUNÇÃO PRINCIPAL - PROCESSAR IMPOSTOS
// ============================================================================

/**
 * Processa todos os impostos de um XML de NFe
 * @param xmlContent - Conteúdo completo do XML
 * @param opcoes - Opções de processamento
 * @param alteracoes - Array para registrar alterações
 * @returns XML modificado
 */
export function processarImpostos(
  xmlContent: string,
  opcoes: {
    cstMappings?: CstMappingData[] | null;
    taxReformRule?: TaxReformRuleData | null;
    zerarIpiRemessaRetorno?: boolean;
    zerarIpiVenda?: boolean;
  },
  alteracoes: string[]
): string {
  let xmlEditado = xmlContent;

  // 1. Aplica mapeamento de CST
  if (opcoes.cstMappings && opcoes.cstMappings.length > 0) {
    xmlEditado = aplicarCstEmTodosItens(
      xmlEditado,
      opcoes.cstMappings,
      alteracoes
    );
  }

  // 2. Zera IPI conforme regras
  if (opcoes.zerarIpiRemessaRetorno || opcoes.zerarIpiVenda) {
    xmlEditado = zerarIpiEmTodosItens(
      xmlEditado,
      opcoes.zerarIpiRemessaRetorno || false,
      opcoes.zerarIpiVenda || false,
      alteracoes
    );

    // 3. Recalcula totais de IPI
    xmlEditado = recalcularTotaisIpi(xmlEditado, alteracoes);
  }

  // 4. Aplica Reforma Tributária (IBS/CBS)
  if (
    opcoes.taxReformRule &&
    (opcoes.taxReformRule.pIBSUF ||
      opcoes.taxReformRule.pIBSMun ||
      opcoes.taxReformRule.pCBS)
  ) {
    xmlEditado = aplicarReformaTributaria(
      xmlEditado,
      opcoes.taxReformRule,
      alteracoes
    );
  }

  return xmlEditado;
}
