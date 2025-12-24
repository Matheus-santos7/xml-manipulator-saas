/**
 * Módulo para manipulação de dados de produtos em XMLs de NF-e
 * Responsável por atualizar campos de produto e origem (ICMS) nos itens <det>
 */

import {
  VENDAS_CFOP,
  DEVOLUCOES_CFOP,
  RETORNOS_CFOP,
  REMESSAS_CFOP,
} from "@/lib/data";

/**
 * Interface para dados de produto (importada do xmlEditor)
 */
export interface DadosProduto {
  xProd?: string; // Descrição do produto
  cEAN?: string; // Código de barras (GTIN)
  cProd?: string; // Código do produto
  NCM?: string; // Nomenclatura Comum do Mercosul
  origem?: string; // Origem: 0, 1, 2, 3, 4, 6, 7, 8
}

/**
 * Atualiza os dados de produtos em um XML de NFe
 * Substitui valores de xProd, cEAN, cProd, NCM e origem (ICMS) em cada item <det>
 *
 * @param xmlContent - Conteúdo do XML
 * @param produtos - Array de produtos com dados a serem aplicados
 * @param alteracoes - Array para acumular as alterações realizadas
 * @returns XML editado com os dados dos produtos atualizados
 */
export function atualizarProdutosNoXml(
  xmlContent: string,
  produtos: Array<DadosProduto & { isPrincipal?: boolean; ordem?: number }>,
  alteracoes: string[]
): string {
  if (!produtos || produtos.length === 0) {
    return xmlContent;
  }

  let xmlEditado = xmlContent;

  // Determina o tipo de operação pelo CFOP do primeiro item
  // Usa regex para extrair o CFOP do primeiro <det>
  const regexCFOP = /<CFOP>([^<]+)<\/CFOP>/i;
  const matchCFOP = xmlEditado.match(regexCFOP);
  const cfop = matchCFOP ? matchCFOP[1] : "";

  const isVendaRetornoOuDevolucao =
    VENDAS_CFOP.includes(cfop) ||
    DEVOLUCOES_CFOP.includes(cfop) ||
    RETORNOS_CFOP.includes(cfop);

  const isRemessa = REMESSAS_CFOP.includes(cfop);

  // Verifica se é remessa simbólica (tem nota referenciada)
  // Remessa simbólica possui <refNFe> dentro de <NFref>
  const regexRefNFeCheck = /<refNFe>[^<]+<\/refNFe>/i;
  const isRemessaSimbolicaOuRetorno = regexRefNFeCheck.test(xmlEditado);

  // Remessa normal: é remessa E não tem nota referenciada
  const isRemessaNormal = isRemessa && !isRemessaSimbolicaOuRetorno;

  // Regex para encontrar todos os blocos <det>
  const regexDet = /<det[^>]*>[\s\S]*?<\/det>/gi;
  const detBlocks = xmlEditado.match(regexDet);

  if (detBlocks && (isVendaRetornoOuDevolucao || isRemessa)) {
    detBlocks.forEach((detBlock, index) => {
      let detBlockEditado = detBlock;
      let produtoSelecionado: DadosProduto | null = null;

      if (isVendaRetornoOuDevolucao || isRemessaSimbolicaOuRetorno) {
        // Para VENDA/RETORNO/DEVOLUÇÃO e REMESSA SIMBÓLICA: usa o produto principal
        produtoSelecionado = produtos.find((p) => p.isPrincipal) || null;
      } else if (isRemessaNormal) {
        // Para REMESSA NORMAL (sem refNFe): rotaciona pelos produtos usando ordem
        // index % produtos.length garante que sempre haverá um produto válido
        produtoSelecionado = produtos[index % produtos.length];
      }

      if (produtoSelecionado) {
        // Atualiza campos básicos do produto
        detBlockEditado = atualizarCamposProduto(
          detBlockEditado,
          produtoSelecionado,
          index,
          isRemessaNormal,
          alteracoes
        );

        // Atualiza a origem do produto (tag <orig> dentro de <ICMS>)
        detBlockEditado = atualizarOrigemProduto(
          detBlockEditado,
          produtoSelecionado,
          index,
          isRemessaNormal,
          alteracoes
        );

        // Substitui o bloco <det> original pelo editado
        xmlEditado = xmlEditado.replace(detBlock, detBlockEditado);
      }
    });
  }

  return xmlEditado;
}

/**
 * Atualiza os campos básicos do produto (xProd, cEAN, cProd, NCM)
 */
function atualizarCamposProduto(
  detBlock: string,
  produto: DadosProduto,
  index: number,
  isRemessaNormal: boolean,
  alteracoes: string[]
): string {
  let detBlockEditado = detBlock;

  const camposProd = [
    { campo: "xProd", valor: produto.xProd },
    { campo: "cEAN", valor: produto.cEAN },
    { campo: "cProd", valor: produto.cProd },
    { campo: "NCM", valor: produto.NCM },
  ];

  // Atualiza cada campo do produto dentro deste <det>
  for (const { campo, valor } of camposProd) {
    if (valor && valor.trim() !== "") {
      // Regex para encontrar o campo dentro de <prod>
      const regex = new RegExp(
        `(<prod[\\s\\S]*?)(<${campo}>)[^<]+(<\\/${campo}>)`,
        "i"
      );

      if (regex.test(detBlockEditado)) {
        detBlockEditado = detBlockEditado.replace(regex, `$1$2${valor}$3`);

        // Adiciona log apenas na primeira ocorrência
        if (index === 0) {
          const tipoOp = isRemessaNormal
            ? "Remessa (rotação)"
            : "Venda/Retorno/Devolução/Remessa Simbólica (principal)";
          alteracoes.push(
            `Produto ${tipoOp}: <${campo}> alterado para ${valor}`
          );
        }
      }
    }
  }

  return detBlockEditado;
}

/**
 * Atualiza a origem do produto (tag <orig> dentro de <ICMS>)
 */
function atualizarOrigemProduto(
  detBlock: string,
  produto: DadosProduto,
  index: number,
  isRemessaNormal: boolean,
  alteracoes: string[]
): string {
  let detBlockEditado = detBlock;

  if (produto.origem) {
    // Regex para encontrar a tag <orig> dentro do bloco <ICMS> ou <ICMSSN>
    const regexOrig = /(<ICMS[^>]*>[\s\S]*?)(<orig>)[^<]+(<\/orig>)/i;

    if (regexOrig.test(detBlockEditado)) {
      detBlockEditado = detBlockEditado.replace(
        regexOrig,
        `$1$2${produto.origem}$3`
      );

      if (index === 0) {
        const tipoOp = isRemessaNormal
          ? "Remessa (rotação)"
          : "Venda/Retorno/Devolução/Remessa Simbólica (principal)";
        alteracoes.push(
          `Produto ${tipoOp}: Origem (ICMS orig) alterada para ${produto.origem}`
        );
      }
    }
  }

  return detBlockEditado;
}
