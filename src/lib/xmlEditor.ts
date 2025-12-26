/**
 * Módulo para edição de chaves de acesso em arquivos XML (NFe, CTe, Eventos)
 * Baseado no modelo Python (funções _editar_nfe, _editar_cte, _editar_cancelamento)
 *
 * IMPORTANTE: Este módulo usa APENAS manipulação de strings (regex) para editar XMLs.
 * NÃO reconstrói o XML, preservando 100% a estrutura, ordem e formatação original.
 * Apenas os valores específicos das tags são alterados, nenhuma tag é adicionada ou removida.
 */

import { XMLParser } from "fast-xml-parser";
import type { ChaveMapping, ReferenceMapping } from "@/lib/xml";
import {
  VENDAS_CFOP,
  DEVOLUCOES_CFOP,
  RETORNOS_CFOP,
  REMESSAS_CFOP,
  type TipoOperacao,
} from "@/lib/data";
import { atualizarProdutosNoXml } from "@/lib/xml/produtoEditor";

/**
 * Dados do Emitente/Remetente para alteração
 */
export interface DadosEmitente {
  // Campos diretos do emitente
  CNPJ?: string;
  xNome?: string;
  xFant?: string;
  IE?: string;
  IEST?: string;
  IM?: string;
  CNAE?: string;
  CRT?: string;

  // Campos do endereço
  xLgr?: string;
  nro?: string;
  xCpl?: string;
  xBairro?: string;
  cMun?: string;
  xMun?: string;
  UF?: string;
  CEP?: string;
  cPais?: string;
  xPais?: string;
  fone?: string;
}

/**
 * Dados do Destinatário para alteração
 * Suporta tanto PJ (CNPJ) quanto PF (CPF)
 */
export interface DadosDestinatario {
  // Campos de identificação (PJ ou PF)
  CNPJ?: string;
  CPF?: string;
  xNome?: string;
  IE?: string;

  // Campos do endereço
  xLgr?: string;
  nro?: string;
  xBairro?: string;
  cMun?: string;
  xMun?: string;
  UF?: string;
  CEP?: string;
  cPais?: string;
  xPais?: string;
  fone?: string;
}

/**
 * Dados do Produto para alteração
 */
export interface DadosProduto {
  xProd?: string; // Descrição do produto
  cEAN?: string; // Código de barras (GTIN)
  cProd?: string; // Código do produto
  NCM?: string; // Nomenclatura Comum do Mercosul
  origem?: string; // Origem: 0 (Nacional Puro), 1 (Importei), 2 (Comprei Importado), 3 (Nacional Misto), 4 (Nacional PPB), 6, 7, 8
}

/**
 * Mapeamento de CST por Tipo de Operação
 * Baseado no modelo Python: mapeamento_cst por grupo de notas
 * Exemplo: { tipoOperacao: "VENDA", icms: "00", pis: "01", cofins: "01", ipi: "50" }
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
 * Baseado no modelo Python: config_reforma_trib
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
 * Resultado da edição de um arquivo XML
 */
export interface ResultadoEdicao {
  nomeArquivo: string;
  tipo: "NFe" | "CTe" | "Cancelamento" | "Inutilizacao" | "Desconhecido";
  sucesso: boolean;
  alteracoes: string[];
  conteudoEditado?: string;
  erro?: string;
}

/**
 * Resultado do cálculo dos valores IBS/CBS por item
 */
interface ValoresIBSCBS {
  vBC: string;
  vIBSUF: string;
  vIBSMun: string;
  vCBS: string;
  vDevTrib: string;
}

/**
 * Formata um número para 2 casas decimais
 */
function formatDecimal(value: number): string {
  return value.toFixed(2);
}

/**
 * Converte string de porcentagem para número (ex: "9,50" ou "9.50" -> 9.50)
 */
function parsePercent(value: string | null | undefined): number {
  if (!value) return 0;
  return parseFloat(value.replace(",", ".")) || 0;
}

/**
 * Cria o bloco XML <IBSCBS> para um item de produto
 * Baseado na função _criar_bloco_ibscbs do Python
 */
function criarBlocoIBSCBS(
  vProd: string,
  taxRule: TaxReformRuleData
): { xml: string; valores: ValoresIBSCBS } {
  const vBC = parseFloat(vProd) || 0;
  const pIBSUF = parsePercent(taxRule.pIBSUF);
  const pIBSMun = parsePercent(taxRule.pIBSMun);
  const pCBS = parsePercent(taxRule.pCBS);
  const vDevTrib = parsePercent(taxRule.vDevTrib);

  const vIBSUF = (vBC * pIBSUF) / 100;
  const vIBSMun = (vBC * pIBSMun) / 100;
  const vCBS = (vBC * pCBS) / 100;

  const cst = taxRule.CST || "000";
  const cClassTrib = taxRule.cClassTrib || "000001";

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
 * Cria o bloco XML <IBSCBSTot> para a totalização da nota
 * Baseado na função _criar_bloco_ibscbs_tot do Python
 */
function criarBlocoIBSCBSTot(totais: {
  vBC: number;
  vIBSUF: number;
  vIBSMun: number;
  vCBS: number;
  vDevTrib: number;
}): string {
  const vIBS = totais.vIBSUF + totais.vIBSMun;

  return (
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
    `<vIBS>${formatDecimal(vIBS)}</vIBS>` +
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
    `</IBSCBSTot>`
  );
}

/**
 * Aplica a Reforma Tributária (IBS/CBS) em um XML de NFe
 * Adiciona blocos <IBSCBS> em cada item e <IBSCBSTot> nos totais
 */
function aplicarReformaTributaria(
  xmlContent: string,
  taxRule: TaxReformRuleData,
  alteracoes: string[]
): string {
  let xmlEditado = xmlContent;

  // Acumuladores para totalização
  const totais = {
    vBC: 0,
    vIBSUF: 0,
    vIBSMun: 0,
    vCBS: 0,
    vDevTrib: 0,
  };

  // 1. Processa cada item <det> e adiciona <IBSCBS> dentro de <imposto>
  const regexDet = /<det[^>]*>([\s\S]*?)<\/det>/gi;
  let match;
  let itemCount = 0;

  // Primeiro, coletamos todos os blocos <det> e seus valores
  const detBlocks: Array<{ original: string; edited: string }> = [];

  while ((match = regexDet.exec(xmlContent)) !== null) {
    const detBlock = match[0];
    let detBlockEditado = detBlock;

    // Extrai o vProd do item
    const vProdMatch = detBlock.match(/<vProd>([^<]+)<\/vProd>/i);
    if (vProdMatch && vProdMatch[1]) {
      const vProd = vProdMatch[1];

      // Cria o bloco IBSCBS
      const { xml: ibscbsXml, valores } = criarBlocoIBSCBS(vProd, taxRule);

      // Acumula os totais
      totais.vBC += parseFloat(valores.vBC);
      totais.vIBSUF += parseFloat(valores.vIBSUF);
      totais.vIBSMun += parseFloat(valores.vIBSMun);
      totais.vCBS += parseFloat(valores.vCBS);
      totais.vDevTrib += parseFloat(valores.vDevTrib);

      // Remove bloco IBSCBS existente se houver
      detBlockEditado = detBlockEditado.replace(
        /<IBSCBS>[\s\S]*?<\/IBSCBS>/gi,
        ""
      );

      // Insere o novo bloco IBSCBS antes de </imposto>
      detBlockEditado = detBlockEditado.replace(
        /(<\/imposto>)/i,
        `${ibscbsXml}$1`
      );

      itemCount++;
    }

    detBlocks.push({ original: detBlock, edited: detBlockEditado });
  }

  // Aplica as substituições
  for (const block of detBlocks) {
    xmlEditado = xmlEditado.replace(block.original, block.edited);
  }

  if (itemCount > 0) {
    alteracoes.push(
      `Reforma Tributária: <IBSCBS> adicionado em ${itemCount} item(s)`
    );
  }

  // 2. Adiciona ou atualiza <IBSCBSTot> dentro de <total>
  const ibscbsTotXml = criarBlocoIBSCBSTot(totais);

  // Remove bloco IBSCBSTot existente se houver
  xmlEditado = xmlEditado.replace(/<IBSCBSTot>[\s\S]*?<\/IBSCBSTot>/gi, "");

  // Insere o novo bloco IBSCBSTot antes de </total>
  if (xmlEditado.includes("</total>")) {
    xmlEditado = xmlEditado.replace(/(<\/total>)/i, `${ibscbsTotXml}$1`);
    alteracoes.push(
      `Reforma Tributária: <IBSCBSTot> adicionado (vBC: ${formatDecimal(
        totais.vBC
      )}, vIBS: ${formatDecimal(
        totais.vIBSUF + totais.vIBSMun
      )}, vCBS: ${formatDecimal(totais.vCBS)})`
    );
  }

  return xmlEditado;
}

/**
 * Formata uma data no formato ISO para XMLs (YYYY-MM-DDTHH:MM:SS-03:00)
 */
function formatarDataParaXml(dataStr: string): string {
  // dataStr formato: DD/MM/YYYY
  const [dia, mes, ano] = dataStr.split("/");
  const agora = new Date();
  const horas = agora.getHours().toString().padStart(2, "0");
  const minutos = agora.getMinutes().toString().padStart(2, "0");
  const segundos = agora.getSeconds().toString().padStart(2, "0");

  return `${ano}-${mes}-${dia}T${horas}:${minutos}:${segundos}-03:00`;
}

/**
 * Busca um elemento no XML navegando por um path
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findElement(obj: any, path: string): any {
  if (!obj) return null;

  const parts = path.split("/");
  let current = obj;

  for (const part of parts) {
    if (!current) return null;
    if (Array.isArray(current)) {
      current = current[0];
    }
    current = current[part];
  }

  return current;
}

/**
 * Edita as chaves de acesso em um XML de NFe usando APENAS manipulação de strings
 * NÃO reconstrói o XML - preserva 100% a estrutura original
 */
function editarChavesNFe(
  xmlContent: string,
  fileName: string,
  chaveMapping: ChaveMapping,
  referenceMap: ReferenceMapping,
  novaData: string | null = null,
  novoUF: string | null = null,
  novaSerie: string | null = null,
  novoEmitente: DadosEmitente | null = null,
  novoDestinatario: DadosDestinatario | null = null,
  produtos: Array<
    DadosProduto & { isPrincipal: boolean; ordem: number }
  > | null = null,
  cstMappings: CstMappingData[] | null = null,
  taxReformRule: TaxReformRuleData | null = null
): ResultadoEdicao {
  const alteracoes: string[] = [];
  let xmlEditado = xmlContent;

  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseAttributeValue: false,
      trimValues: false,
    });

    const parsed = parser.parse(xmlContent);

    // Verifica se é NFe
    let infNFe = findElement(parsed, "nfeProc/NFe/infNFe");
    if (!infNFe) {
      infNFe = findElement(parsed, "NFe/infNFe");
    }

    if (!infNFe) {
      return {
        nomeArquivo: fileName,
        tipo: "Desconhecido",
        sucesso: false,
        alteracoes: [],
        erro: "Não é um XML de NFe válido",
      };
    }

    // Extrai a chave original
    const idAttr = infNFe["@_Id"] || infNFe["@_id"];
    if (!idAttr) {
      return {
        nomeArquivo: fileName,
        tipo: "NFe",
        sucesso: false,
        alteracoes: [],
        erro: "Chave não encontrada no atributo Id",
      };
    }

    const chaveOriginal = idAttr.replace(/^NFe/, "");

    // 1. Atualiza o atributo Id do infNFe (REGEX - preserva estrutura)
    if (chaveMapping[chaveOriginal]) {
      const novaChave = chaveMapping[chaveOriginal];

      // Regex para Id="NFe..." ou id="NFe..."
      const regexId = new RegExp(
        `(<infNFe[^>]*\\s(?:Id|id)=["'])NFe${chaveOriginal}(["'][^>]*>)`,
        "g"
      );

      if (regexId.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexId, `$1NFe${novaChave}$2`);
        alteracoes.push(`Chave de Acesso ID alterada para: ${novaChave}`);
      }

      // 2. Atualiza a chave no protocolo <chNFe> (REGEX)
      const regexChNFe = new RegExp(`(<chNFe>)${chaveOriginal}(</chNFe>)`, "g");

      if (regexChNFe.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexChNFe, `$1${novaChave}$2`);
        alteracoes.push("Chave de Acesso do Protocolo alterada");
      }
    }

    // 3. Atualiza a referência de NFe (REGEX)
    if (referenceMap[chaveOriginal]) {
      const chaveReferenciada = referenceMap[chaveOriginal];

      if (chaveMapping[chaveReferenciada]) {
        const novaChaveReferenciada = chaveMapping[chaveReferenciada];

        // Regex para <refNFe>chave</refNFe>
        const regexRefNFe = new RegExp(
          `(<refNFe>)${chaveReferenciada}(</refNFe>)`,
          "g"
        );

        if (regexRefNFe.test(xmlEditado)) {
          xmlEditado = xmlEditado.replace(
            regexRefNFe,
            `$1${novaChaveReferenciada}$2`
          );
          alteracoes.push(
            `Chave de Referência alterada para: ${novaChaveReferenciada}`
          );
        }
      }
    }

    // 4. Atualiza UF no IDE (REGEX)
    if (novoUF) {
      const regexCUF = /(<cUF>)[^<]+(<\/cUF>)/g;
      if (regexCUF.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexCUF, `$1${novoUF}$2`);
        alteracoes.push(`UF <cUF> alterado para: ${novoUF}`);
      }
    }

    // 5. Atualiza Série no IDE (REGEX)
    if (novaSerie) {
      const regexSerie = /(<serie>)[^<]+(<\/serie>)/g;
      if (regexSerie.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexSerie, `$1${novaSerie}$2`);
        alteracoes.push(`Série <serie> alterada para: ${novaSerie}`);
      }
    }

    // 6. Atualiza Emitente no <emit> e <enderEmit> (REGEX)
    if (novoEmitente) {
      // Campos diretos do <emit> (fora de enderEmit)
      const camposEmit = [
        { campo: "CNPJ", valor: novoEmitente.CNPJ },
        { campo: "xNome", valor: novoEmitente.xNome },
        { campo: "xFant", valor: novoEmitente.xFant },
        { campo: "IE", valor: novoEmitente.IE },
        { campo: "IEST", valor: novoEmitente.IEST },
        { campo: "IM", valor: novoEmitente.IM },
        { campo: "CNAE", valor: novoEmitente.CNAE },
        { campo: "CRT", valor: novoEmitente.CRT },
      ];

      // Campos do endereço <enderEmit>
      const camposEnderEmit = [
        { campo: "xLgr", valor: novoEmitente.xLgr },
        { campo: "nro", valor: novoEmitente.nro },
        { campo: "xCpl", valor: novoEmitente.xCpl },
        { campo: "xBairro", valor: novoEmitente.xBairro },
        { campo: "cMun", valor: novoEmitente.cMun },
        { campo: "xMun", valor: novoEmitente.xMun },
        { campo: "UF", valor: novoEmitente.UF },
        { campo: "CEP", valor: novoEmitente.CEP },
        { campo: "cPais", valor: novoEmitente.cPais },
        { campo: "xPais", valor: novoEmitente.xPais },
        { campo: "fone", valor: novoEmitente.fone },
      ];

      // Atualiza campos diretos do <emit>
      for (const { campo, valor } of camposEmit) {
        if (valor) {
          // Regex para encontrar tag dentro de <emit> mas fora de <enderEmit>
          const regex = new RegExp(
            `(<emit>(?:(?!<enderEmit>)[\\s\\S])*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
            "i"
          );
          if (regex.test(xmlEditado)) {
            xmlEditado = xmlEditado.replace(regex, `$1$2${valor}$3`);
            alteracoes.push(`Emitente: <${campo}> alterado para ${valor}`);
          }
        }
      }

      // Atualiza campos do <enderEmit>
      for (const { campo, valor } of camposEnderEmit) {
        if (valor) {
          // Regex para encontrar tag dentro de <enderEmit>
          const regex = new RegExp(
            `(<enderEmit[^>]*>[\\s\\S]*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
            "i"
          );
          if (regex.test(xmlEditado)) {
            xmlEditado = xmlEditado.replace(regex, `$1$2${valor}$3`);
            alteracoes.push(
              `Emitente Endereço: <${campo}> alterado para ${valor}`
            );
          }
        }
      }
    }

    // 7. Atualiza Destinatário no <dest> e <enderDest> (REGEX)
    // Apenas para notas de VENDA ou DEVOLUÇÃO (baseado no CFOP)
    if (novoDestinatario) {
      // Extrai o CFOP do primeiro item (det)
      const det = findElement(infNFe, "det");
      const prod = det ? findElement(det, "prod") : null;
      const cfopValue = prod ? findElement(prod, "CFOP") : null;
      const cfop =
        typeof cfopValue === "string" ? cfopValue : String(cfopValue || "");

      const deveAtualizarDestinatario =
        VENDAS_CFOP.includes(cfop) || DEVOLUCOES_CFOP.includes(cfop);

      if (deveAtualizarDestinatario) {
        // Campos diretos do <dest> (fora de enderDest)
        const camposDest = [
          { campo: "CNPJ", valor: novoDestinatario.CNPJ },
          { campo: "CPF", valor: novoDestinatario.CPF },
          { campo: "xNome", valor: novoDestinatario.xNome },
          { campo: "IE", valor: novoDestinatario.IE },
        ];

        // Campos do endereço <enderDest>
        const camposEnderDest = [
          { campo: "xLgr", valor: novoDestinatario.xLgr },
          { campo: "nro", valor: novoDestinatario.nro },
          { campo: "xBairro", valor: novoDestinatario.xBairro },
          { campo: "cMun", valor: novoDestinatario.cMun },
          { campo: "xMun", valor: novoDestinatario.xMun },
          { campo: "UF", valor: novoDestinatario.UF },
          { campo: "CEP", valor: novoDestinatario.CEP },
          { campo: "cPais", valor: novoDestinatario.cPais },
          { campo: "xPais", valor: novoDestinatario.xPais },
          { campo: "fone", valor: novoDestinatario.fone },
        ];

        // Atualiza campos diretos do <dest>
        for (const { campo, valor } of camposDest) {
          if (valor && valor.trim() !== "") {
            // Regex para encontrar tag dentro de <dest> mas fora de <enderDest>
            const regex = new RegExp(
              `(<dest>(?:(?!<enderDest>)[\\s\\S])*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
              "i"
            );
            if (regex.test(xmlEditado)) {
              xmlEditado = xmlEditado.replace(regex, `$1$2${valor}$3`);
              alteracoes.push(
                `Destinatário: <${campo}> alterado para ${valor}`
              );
            }
          }
        }

        // Atualiza campos do <enderDest>
        for (const { campo, valor } of camposEnderDest) {
          if (valor && valor.trim() !== "") {
            // Regex para encontrar tag dentro de <enderDest>
            const regex = new RegExp(
              `(<enderDest[^>]*>[\\s\\S]*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
              "i"
            );
            if (regex.test(xmlEditado)) {
              xmlEditado = xmlEditado.replace(regex, `$1$2${valor}$3`);
              alteracoes.push(
                `Destinatário Endereço: <${campo}> alterado para ${valor}`
              );
            }
          }
        }
      }
    }

    // 8. Atualiza Produtos nos itens <det>
    // A lógica de manipulação de produtos foi extraída para um arquivo separado (produtoEditor.ts)
    if (produtos && produtos.length > 0) {
      xmlEditado = atualizarProdutosNoXml(xmlEditado, produtos, alteracoes);
    }

    // 9. Atualiza CST por Tipo de Operação em cada item <det> (REGEX)
    // Identifica o tipo de operação pelo CFOP e aplica os CSTs configurados
    if (cstMappings && cstMappings.length > 0) {
      // Cria um mapa para acesso rápido: tipoOperacao -> { icms, ipi, pis, cofins }
      const cstMapByTipoOp = new Map<
        TipoOperacao,
        {
          icms?: string | null;
          ipi?: string | null;
          pis?: string | null;
          cofins?: string | null;
        }
      >();
      for (const mapping of cstMappings) {
        cstMapByTipoOp.set(mapping.tipoOperacao, {
          icms: mapping.icms,
          ipi: mapping.ipi,
          pis: mapping.pis,
          cofins: mapping.cofins,
        });
      }

      // Função auxiliar para determinar o tipo de operação pelo CFOP
      const getTipoOperacaoByCfop = (cfop: string): TipoOperacao | null => {
        if (VENDAS_CFOP.includes(cfop)) return "VENDA";
        if (DEVOLUCOES_CFOP.includes(cfop)) return "DEVOLUCAO";
        if (RETORNOS_CFOP.includes(cfop)) return "RETORNO";
        if (REMESSAS_CFOP.includes(cfop)) return "REMESSA";
        return null;
      };

      // Regex para encontrar todos os blocos <det>
      const regexDetCst = /<det[^>]*>[\s\S]*?<\/det>/gi;
      const detBlocksCst = xmlEditado.match(regexDetCst);

      if (detBlocksCst) {
        for (const detBlock of detBlocksCst) {
          let detBlockEditado = detBlock;

          // Extrai o CFOP deste item
          const cfopMatch = detBlock.match(/<CFOP>([^<]+)<\/CFOP>/i);
          const cfopItem = cfopMatch ? cfopMatch[1] : null;

          // Determina o tipo de operação pelo CFOP
          const tipoOp = cfopItem ? getTipoOperacaoByCfop(cfopItem) : null;

          if (tipoOp && cstMapByTipoOp.has(tipoOp)) {
            const cstRules = cstMapByTipoOp.get(tipoOp)!;

            // Aplica CST do ICMS (pode estar em ICMSxx, como ICMS00, ICMS10, etc.)
            if (cstRules.icms) {
              // O CST do ICMS está dentro de <ICMS><ICMSxx><CST>valor</CST>...
              // ou direto em <ICMS><ICMSSN...><CSOSN> para Simples Nacional
              const regexCstIcms =
                /(<ICMS[^>]*>[\s\S]*?)(<CST>)[^<]+(<\/CST>)/i;
              if (regexCstIcms.test(detBlockEditado)) {
                detBlockEditado = detBlockEditado.replace(
                  regexCstIcms,
                  `$1$2${cstRules.icms}$3`
                );
                alteracoes.push(
                  `CST ICMS alterado para ${cstRules.icms} (${tipoOp} - CFOP ${cfopItem})`
                );
              }
            }

            // Aplica CST do IPI (dentro de <IPI><IPITrib> ou <IPI><IPINT>)
            if (cstRules.ipi) {
              const regexCstIpi = /(<IPI[^>]*>[\s\S]*?)(<CST>)[^<]+(<\/CST>)/i;
              if (regexCstIpi.test(detBlockEditado)) {
                detBlockEditado = detBlockEditado.replace(
                  regexCstIpi,
                  `$1$2${cstRules.ipi}$3`
                );
                alteracoes.push(
                  `CST IPI alterado para ${cstRules.ipi} (${tipoOp} - CFOP ${cfopItem})`
                );
              }
            }

            // Aplica CST do PIS (dentro de <PIS><PISAliq>, <PIS><PISQtde>, etc.)
            if (cstRules.pis) {
              const regexCstPis = /(<PIS[^>]*>[\s\S]*?)(<CST>)[^<]+(<\/CST>)/i;
              if (regexCstPis.test(detBlockEditado)) {
                detBlockEditado = detBlockEditado.replace(
                  regexCstPis,
                  `$1$2${cstRules.pis}$3`
                );
                alteracoes.push(
                  `CST PIS alterado para ${cstRules.pis} (${tipoOp} - CFOP ${cfopItem})`
                );
              }
            }

            // Aplica CST do COFINS (dentro de <COFINS><COFINSAliq>, etc.)
            if (cstRules.cofins) {
              const regexCstCofins =
                /(<COFINS[^>]*>[\s\S]*?)(<CST>)[^<]+(<\/CST>)/i;
              if (regexCstCofins.test(detBlockEditado)) {
                detBlockEditado = detBlockEditado.replace(
                  regexCstCofins,
                  `$1$2${cstRules.cofins}$3`
                );
                alteracoes.push(
                  `CST COFINS alterado para ${cstRules.cofins} (${tipoOp} - CFOP ${cfopItem})`
                );
              }
            }

            // Substitui o bloco <det> original pelo editado
            if (detBlockEditado !== detBlock) {
              xmlEditado = xmlEditado.replace(detBlock, detBlockEditado);
            }
          }
        }
      }
    }

    // 10. Atualiza as datas (REGEX)
    if (novaData) {
      const novaDataFormatada = formatarDataParaXml(novaData);

      // dhEmi - Data/Hora de Emissão
      const regexDhEmi = /(<dhEmi>)[^<]+(<\/dhEmi>)/g;
      if (regexDhEmi.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexDhEmi, `$1${novaDataFormatada}$2`);
        alteracoes.push(`Data de Emissão <dhEmi> alterada para ${novaData}`);
      }

      // dhSaiEnt - Data/Hora de Saída/Entrada
      const regexDhSaiEnt = /(<dhSaiEnt>)[^<]+(<\/dhSaiEnt>)/g;
      if (regexDhSaiEnt.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(
          regexDhSaiEnt,
          `$1${novaDataFormatada}$2`
        );
        alteracoes.push(
          `Data de Saída/Entrada <dhSaiEnt> alterada para ${novaData}`
        );
      }

      // dhRecbto no protocolo
      const regexDhRecbto = /(<dhRecbto>)[^<]+(<\/dhRecbto>)/g;
      if (regexDhRecbto.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(
          regexDhRecbto,
          `$1${novaDataFormatada}$2`
        );
        alteracoes.push(
          `Data de Recebimento <dhRecbto> alterada para ${novaData}`
        );
      }
    }

    // 11. Aplica Reforma Tributária (IBS/CBS) se configurado
    if (
      taxReformRule &&
      (taxReformRule.pIBSUF || taxReformRule.pIBSMun || taxReformRule.pCBS)
    ) {
      xmlEditado = aplicarReformaTributaria(
        xmlEditado,
        taxReformRule,
        alteracoes
      );
    }

    if (alteracoes.length === 0) {
      return {
        nomeArquivo: fileName,
        tipo: "NFe",
        sucesso: true,
        alteracoes: ["Nenhuma alteração necessária"],
        conteudoEditado: xmlContent,
      };
    }

    return {
      nomeArquivo: fileName,
      tipo: "NFe",
      sucesso: true,
      alteracoes,
      conteudoEditado: xmlEditado, // Retorna o XML com alterações via regex
    };
  } catch (error) {
    return {
      nomeArquivo: fileName,
      tipo: "NFe",
      sucesso: false,
      alteracoes: [],
      erro: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Edita as chaves de acesso em um XML de CTe usando APENAS manipulação de strings
 * NÃO reconstrói o XML - preserva 100% a estrutura original
 */
function editarChavesCTe(
  xmlContent: string,
  fileName: string,
  chaveMapping: ChaveMapping,
  chaveVendaNova: string | null,
  novaData: string | null = null,
  novoUF: string | null = null,
  novoEmitente: DadosEmitente | null = null,
  novoDestinatario: DadosDestinatario | null = null
): ResultadoEdicao {
  const alteracoes: string[] = [];
  let xmlEditado = xmlContent;

  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseAttributeValue: false,
      trimValues: false,
    });

    const parsed = parser.parse(xmlContent);

    // Verifica se é CTe
    let infCte = findElement(parsed, "cteProc/CTe/infCte");
    if (!infCte) {
      infCte = findElement(parsed, "CTe/infCte");
    }

    if (!infCte) {
      return {
        nomeArquivo: fileName,
        tipo: "Desconhecido",
        sucesso: false,
        alteracoes: [],
        erro: "Não é um XML de CTe válido",
      };
    }

    // Extrai a chave original
    const idAttr = infCte["@_Id"] || infCte["@_id"];
    if (!idAttr) {
      return {
        nomeArquivo: fileName,
        tipo: "CTe",
        sucesso: false,
        alteracoes: [],
        erro: "Chave não encontrada no atributo Id",
      };
    }

    const chaveOriginal = idAttr.replace(/^CTe/, "");

    // 1. Atualiza o atributo Id do infCte (REGEX)
    if (chaveMapping[chaveOriginal]) {
      const novaChave = chaveMapping[chaveOriginal];

      // Regex para Id="CTe..." ou id="CTe..."
      const regexId = new RegExp(
        `(<infCte[^>]*\\s(?:Id|id)=["'])CTe${chaveOriginal}(["'][^>]*>)`,
        "g"
      );

      if (regexId.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexId, `$1CTe${novaChave}$2`);
        alteracoes.push(`Chave de acesso do CTe alterada para: ${novaChave}`);
      }

      // 2. Atualiza a chave no protocolo <chCTe> (REGEX)
      const regexChCTe = new RegExp(`(<chCTe>)${chaveOriginal}(</chCTe>)`, "g");

      if (regexChCTe.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexChCTe, `$1${novaChave}$2`);
        alteracoes.push("protCTe/infProt/chCTe sincronizado");
      }
    }

    // 3. Atualiza a chave da NFe referenciada no CTe (REGEX)
    // Busca a chave atual diretamente no XML usando regex (mais confiável)
    const regexChaveAtual = /<infNFe[^>]*>[\s\S]*?<chave>([^<]+)<\/chave>/i;
    const matchChaveAtual = xmlEditado.match(regexChaveAtual);

    if (matchChaveAtual && matchChaveAtual[1]) {
      const chaveNFeAtual = matchChaveAtual[1];

      // Tenta atualizar pela chave mapeada
      if (chaveMapping[chaveNFeAtual]) {
        const novaChaveNFe = chaveMapping[chaveNFeAtual];

        const regexChaveNFe = new RegExp(
          `(<chave>)${chaveNFeAtual}(</chave>)`,
          "g"
        );

        if (regexChaveNFe.test(xmlEditado)) {
          xmlEditado = xmlEditado.replace(regexChaveNFe, `$1${novaChaveNFe}$2`);
          alteracoes.push(
            `Referência de NFe <chave> atualizada para: ${novaChaveNFe}`
          );
        }
      }
      // Se não encontrou no mapeamento mas tem chaveVendaNova, força a atualização
      else if (chaveVendaNova && chaveNFeAtual !== chaveVendaNova) {
        const regexChaveNFe = new RegExp(
          `(<chave>)${chaveNFeAtual}(</chave>)`,
          "g"
        );

        if (regexChaveNFe.test(xmlEditado)) {
          xmlEditado = xmlEditado.replace(
            regexChaveNFe,
            `$1${chaveVendaNova}$2`
          );
          alteracoes.push(
            `Referência de NFe <chave> FORÇADA para a chave da venda: ${chaveVendaNova}`
          );
        }
      }
    }

    // 4. Atualiza UF no IDE (REGEX) - apenas para CTe
    if (novoUF) {
      const regexCUF = /(<cUF>)[^<]+(<\/cUF>)/g;
      if (regexCUF.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexCUF, `$1${novoUF}$2`);
        alteracoes.push(`UF <cUF> alterado para: ${novoUF}`);
      }
    }

    // 5. Atualiza Remetente no <rem> e <enderReme> (REGEX)
    // No CTe, o remetente (<rem>) corresponde ao emitente da NFe
    if (novoEmitente) {
      // Campos diretos do <rem> (fora de enderReme)
      // Baseado no modelo Python: CNPJ, xNome, xFant, IE
      const camposRem = [
        { campo: "CNPJ", valor: novoEmitente.CNPJ },
        { campo: "xNome", valor: novoEmitente.xNome },
        { campo: "xFant", valor: novoEmitente.xFant },
        { campo: "IE", valor: novoEmitente.IE },
      ];

      // Campos do endereço <enderReme>
      // Inclui: xLgr, nro, xCpl, xBairro, cMun, xMun, CEP, UF, fone
      const camposEnderReme = [
        { campo: "xLgr", valor: novoEmitente.xLgr },
        { campo: "nro", valor: novoEmitente.nro },
        { campo: "xCpl", valor: novoEmitente.xCpl },
        { campo: "xBairro", valor: novoEmitente.xBairro },
        { campo: "cMun", valor: novoEmitente.cMun },
        { campo: "xMun", valor: novoEmitente.xMun },
        { campo: "CEP", valor: novoEmitente.CEP },
        { campo: "UF", valor: novoEmitente.UF },
        { campo: "fone", valor: novoEmitente.fone },
      ];

      // Atualiza campos diretos do <rem> usando regex simples
      // A estratégia é: encontrar o bloco <rem>...</rem> e substituir as tags dentro dele
      for (const { campo, valor } of camposRem) {
        if (valor && valor.trim() !== "") {
          // Regex para encontrar tag dentro de <rem> mas fora de <enderReme>
          const regex = new RegExp(
            `(<rem>(?:(?!<enderReme>)[\\s\\S])*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
            "i"
          );
          if (regex.test(xmlEditado)) {
            xmlEditado = xmlEditado.replace(regex, `$1$2${valor}$3`);
            alteracoes.push(`Remetente: <${campo}> alterado para ${valor}`);
          }
        }
      }

      // Atualiza campos do <enderReme>
      for (const { campo, valor } of camposEnderReme) {
        if (valor && valor.trim() !== "") {
          // Regex para encontrar tag dentro de <enderReme>
          const regex = new RegExp(
            `(<enderReme[^>]*>[\\s\\S]*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
            "i"
          );
          if (regex.test(xmlEditado)) {
            xmlEditado = xmlEditado.replace(regex, `$1$2${valor}$3`);
            alteracoes.push(
              `Remetente Endereço: <${campo}> alterado para ${valor}`
            );
          }
        }
      }
    }

    // 6. Atualiza Destinatário no <dest> e <enderDest> (REGEX)
    if (novoDestinatario) {
      // Campos diretos do <dest>
      const camposDest = [
        { campo: "CNPJ", valor: novoDestinatario.CNPJ },
        { campo: "CPF", valor: novoDestinatario.CPF },
        { campo: "xNome", valor: novoDestinatario.xNome },
        { campo: "IE", valor: novoDestinatario.IE },
      ];

      // Campos do endereço <enderDest>
      const camposEnderDest = [
        { campo: "xLgr", valor: novoDestinatario.xLgr },
        { campo: "nro", valor: novoDestinatario.nro },
        { campo: "xBairro", valor: novoDestinatario.xBairro },
        { campo: "cMun", valor: novoDestinatario.cMun },
        { campo: "xMun", valor: novoDestinatario.xMun },
        { campo: "UF", valor: novoDestinatario.UF },
        { campo: "CEP", valor: novoDestinatario.CEP },
        { campo: "cPais", valor: novoDestinatario.cPais },
        { campo: "xPais", valor: novoDestinatario.xPais },
        { campo: "fone", valor: novoDestinatario.fone },
      ];

      // Atualiza campos diretos do <dest>
      for (const { campo, valor } of camposDest) {
        if (valor && valor.trim() !== "") {
          // Regex para encontrar tag dentro de <dest> mas fora de <enderDest>
          const regex = new RegExp(
            `(<dest>(?:(?!<enderDest>)[\\s\\S])*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
            "i"
          );
          if (regex.test(xmlEditado)) {
            xmlEditado = xmlEditado.replace(regex, `$1$2${valor}$3`);
            alteracoes.push(
              `Destinatário (CTe): <${campo}> alterado para ${valor}`
            );
          }
        }
      }

      // Atualiza campos do <enderDest>
      for (const { campo, valor } of camposEnderDest) {
        if (valor && valor.trim() !== "") {
          // Regex para encontrar tag dentro de <enderDest>
          const regex = new RegExp(
            `(<enderDest[^>]*>[\\s\\S]*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
            "i"
          );
          if (regex.test(xmlEditado)) {
            xmlEditado = xmlEditado.replace(regex, `$1$2${valor}$3`);
            alteracoes.push(
              `Destinatário Endereço (CTe): <${campo}> alterado para ${valor}`
            );
          }
        }
      }
    }

    // 7. Atualiza as datas (REGEX)
    if (novaData) {
      const novaDataFormatada = formatarDataParaXml(novaData);

      // dhEmi
      const regexDhEmi = /(<dhEmi>)[^<]+(<\/dhEmi>)/g;
      if (regexDhEmi.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexDhEmi, `$1${novaDataFormatada}$2`);
        alteracoes.push(`Data de Emissão <dhEmi> alterada para ${novaData}`);
      }

      // dhRecbto no protocolo
      const regexDhRecbto = /(<dhRecbto>)[^<]+(<\/dhRecbto>)/g;
      if (regexDhRecbto.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(
          regexDhRecbto,
          `$1${novaDataFormatada}$2`
        );
        alteracoes.push(
          `Data de Recebimento <dhRecbto> alterada para ${novaData}`
        );
      }
    }

    if (alteracoes.length === 0) {
      return {
        nomeArquivo: fileName,
        tipo: "CTe",
        sucesso: true,
        alteracoes: ["Nenhuma alteração necessária"],
        conteudoEditado: xmlContent,
      };
    }

    return {
      nomeArquivo: fileName,
      tipo: "CTe",
      sucesso: true,
      alteracoes,
      conteudoEditado: xmlEditado, // Retorna o XML com alterações via regex
    };
  } catch (error) {
    return {
      nomeArquivo: fileName,
      tipo: "CTe",
      sucesso: false,
      alteracoes: [],
      erro: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Edita as chaves de acesso em um evento de cancelamento usando APENAS manipulação de strings
 * NÃO reconstrói o XML - preserva 100% a estrutura original
 */
function editarChavesCancelamento(
  xmlContent: string,
  fileName: string,
  chaveMapping: ChaveMapping,
  novaData: string | null = null
): ResultadoEdicao {
  const alteracoes: string[] = [];
  let xmlEditado = xmlContent;

  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseAttributeValue: false,
      trimValues: false,
    });

    const parsed = parser.parse(xmlContent);

    // Verifica se é um evento de cancelamento
    if (!parsed.procEventoNFe) {
      return {
        nomeArquivo: fileName,
        tipo: "Desconhecido",
        sucesso: false,
        alteracoes: [],
        erro: "Não é um evento de cancelamento válido",
      };
    }

    // 1. Atualiza chNFe no evento (REGEX)
    const infEvento = parsed.procEventoNFe?.evento?.infEvento;
    if (infEvento?.chNFe) {
      const chaveAntiga = infEvento.chNFe;
      if (chaveMapping[chaveAntiga]) {
        const novaChave = chaveMapping[chaveAntiga];

        // Atualiza todas as ocorrências de chNFe (evento e retorno)
        const regexChNFe = new RegExp(`(<chNFe>)${chaveAntiga}(</chNFe>)`, "g");

        const ocorrencias = (xmlEditado.match(regexChNFe) || []).length;
        if (ocorrencias > 0) {
          xmlEditado = xmlEditado.replace(regexChNFe, `$1${novaChave}$2`);
          alteracoes.push(
            `chNFe alterado para nova chave em ${ocorrencias} local(is): ${novaChave}`
          );
        }
      }
    }

    // 2. Atualiza as datas (REGEX)
    if (novaData) {
      const novaDataFormatada = formatarDataParaXml(novaData);

      // dhEvento no evento
      const regexDhEvento = /(<dhEvento>)[^<]+(<\/dhEvento>)/g;
      if (regexDhEvento.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(
          regexDhEvento,
          `$1${novaDataFormatada}$2`
        );
        alteracoes.push(`Data do Evento <dhEvento> alterada para ${novaData}`);
      }

      // dhRecbto no retorno
      const regexDhRecbto = /(<dhRecbto>)[^<]+(<\/dhRecbto>)/g;
      if (regexDhRecbto.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(
          regexDhRecbto,
          `$1${novaDataFormatada}$2`
        );
        alteracoes.push(
          `Data de Recebimento <dhRecbto> alterada para ${novaData}`
        );
      }

      // dhRegEvento no retorno
      const regexDhRegEvento = /(<dhRegEvento>)[^<]+(<\/dhRegEvento>)/g;
      if (regexDhRegEvento.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(
          regexDhRegEvento,
          `$1${novaDataFormatada}$2`
        );
        alteracoes.push(
          `Data de Registro <dhRegEvento> alterada para ${novaData}`
        );
      }
    }

    if (alteracoes.length === 0) {
      return {
        nomeArquivo: fileName,
        tipo: "Cancelamento",
        sucesso: true,
        alteracoes: ["Nenhuma alteração necessária"],
        conteudoEditado: xmlContent,
      };
    }

    return {
      nomeArquivo: fileName,
      tipo: "Cancelamento",
      sucesso: true,
      alteracoes,
      conteudoEditado: xmlEditado, // Retorna o XML com alterações via regex
    };
  } catch (error) {
    return {
      nomeArquivo: fileName,
      tipo: "Cancelamento",
      sucesso: false,
      alteracoes: [],
      erro: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Detecta o tipo de documento XML e edita as chaves apropriadamente
 */
export function editarChavesXml(
  xmlContent: string,
  fileName: string,
  chaveMapping: ChaveMapping,
  referenceMap: ReferenceMapping,
  chaveVendaNova: string | null,
  novaData: string | null = null,
  novoUF: string | null = null,
  novaSerie: string | null = null,
  novoEmitente: DadosEmitente | null = null,
  novoDestinatario: DadosDestinatario | null = null,
  produtos: Array<
    DadosProduto & { isPrincipal: boolean; ordem: number }
  > | null = null,
  cstMappings: CstMappingData[] | null = null,
  taxReformRule: TaxReformRuleData | null = null
): ResultadoEdicao {
  // Detecção rápida do tipo de documento
  if (xmlContent.includes("<procEventoNFe")) {
    return editarChavesCancelamento(
      xmlContent,
      fileName,
      chaveMapping,
      novaData
    );
  } else if (xmlContent.includes("<cteProc") || xmlContent.includes("<CTe")) {
    return editarChavesCTe(
      xmlContent,
      fileName,
      chaveMapping,
      chaveVendaNova,
      novaData,
      novoUF,
      novoEmitente,
      novoDestinatario
    );
  } else if (xmlContent.includes("<nfeProc") || xmlContent.includes("<NFe")) {
    return editarChavesNFe(
      xmlContent,
      fileName,
      chaveMapping,
      referenceMap,
      novaData,
      novoUF,
      novaSerie,
      novoEmitente,
      novoDestinatario,
      produtos,
      cstMappings,
      taxReformRule
    );
  } else if (
    xmlContent.includes("<procInutNFe") ||
    xmlContent.includes("<inutNFe")
  ) {
    // Inutilizações não precisam de edição de chave (por enquanto)
    return {
      nomeArquivo: fileName,
      tipo: "Inutilizacao",
      sucesso: true,
      alteracoes: ["Inutilização não requer alteração de chave"],
      conteudoEditado: xmlContent,
    };
  }

  return {
    nomeArquivo: fileName,
    tipo: "Desconhecido",
    sucesso: false,
    alteracoes: [],
    erro: "Tipo de documento não reconhecido",
  };
}

/**
 * Edita as chaves de acesso em múltiplos arquivos XML
 */
export function editarChavesEmLote(
  files: Array<{ name: string; content: string }>,
  chaveMapping: ChaveMapping,
  referenceMap: ReferenceMapping,
  chaveVendaNova: string | null,
  novaData: string | null = null,
  novoUF: string | null = null,
  novaSerie: string | null = null,
  novoEmitente: DadosEmitente | null = null,
  novoDestinatario: DadosDestinatario | null = null,
  produtos: Array<
    DadosProduto & { isPrincipal: boolean; ordem: number }
  > | null = null,
  cstMappings: CstMappingData[] | null = null,
  taxReformRule: TaxReformRuleData | null = null
): ResultadoEdicao[] {
  const resultados: ResultadoEdicao[] = [];

  for (const file of files) {
    const resultado = editarChavesXml(
      file.content,
      file.name,
      chaveMapping,
      referenceMap,
      chaveVendaNova,
      novaData,
      novoUF,
      novaSerie,
      novoEmitente,
      novoDestinatario,
      produtos,
      cstMappings,
      taxReformRule
    );
    resultados.push(resultado);
  }

  return resultados;
}
