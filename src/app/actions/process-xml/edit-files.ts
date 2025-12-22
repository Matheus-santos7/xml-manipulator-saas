import { editarChavesEmLote, type ResultadoEdicao } from "@/lib/xmlEditor";
import type { ArquivoParaProcessamento } from "./prepare-files";

/**
 * Resultado consolidado da edição dos arquivos XML, incluindo totais de sucesso/erro.
 */
export type ResultadoEdicaoComTotais = {
  arquivosEditados: ArquivoParaProcessamento[];
  resultadosEdicao: ResultadoEdicao[];
  totalEditados: number;
  totalErros: number;
  totalSemAlteracao: number;
};

/**
 * Aplica as transformações de cenário em todos os arquivos XML (emitente,
 * destinatário, produtos, CST, reforma tributária, data/UF/série) e atualiza
 * referências cruzadas entre as chaves das notas.
 */
export function editarArquivosEAtualizarReferencias(args: {
  filesForProcessing: ArquivoParaProcessamento[];
  scenario: {
    editar_emitente: boolean;
    editar_destinatario_pj: boolean;
    editar_destinatario_pf: boolean;
    editar_produtos: boolean;
    editar_cst: boolean;
    reforma_tributaria: boolean;
    editar_data: boolean;
    alterar_cUF: boolean;
    alterar_serie: boolean;
    nova_data?: string | null;
    novo_cUF?: string | null;
    nova_serie?: string | null;
    ScenarioEmitente?: {
      cnpj?: string | null;
      xNome?: string | null;
      IE?: string | null;
      xLgr?: string | null;
      nro?: string | null;
      xCpl?: string | null;
      xBairro?: string | null;
      xMun?: string | null;
      UF?: string | null;
      CEP?: string | null;
      fone?: string | null;
    } | null;
    ScenarioDestinatario?: {
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
    ScenarioProduto?: Array<{
      xProd?: string | null;
      cEAN?: string | null;
      cProd?: string | null;
      NCM?: string | null;
      isPrincipal: boolean;
      ordem: number;
    }> | null;
    CstMapping?: Array<{
      tipoOperacao: string;
      icms: string | null;
      ipi: string | null;
      pis: string | null;
      cofins: string | null;
    }> | null;
    TaxReformRule?: Array<{
      pIBSUF?: string | null;
      pIBSMun?: string | null;
      pCBS?: string | null;
      vDevTrib?: string | null;
      cClassTrib?: string | null;
      CST?: string | null;
    }> | null;
  };
  chaveMapping: Record<string, string>;
  referenceMap: Record<string, string>;
  chaveVendaNova?: string | null;
}): ResultadoEdicaoComTotais {
  const {
    filesForProcessing,
    scenario,
    chaveMapping,
    referenceMap,
    chaveVendaNova,
  } = args;

  const novoEmitente =
    scenario.editar_emitente && scenario.ScenarioEmitente
      ? {
          CNPJ: (scenario.ScenarioEmitente.cnpj || "").replace(/\D/g, ""),
          xNome: scenario.ScenarioEmitente.xNome || "",
          xFant: scenario.ScenarioEmitente.xNome || "",
          IE: scenario.ScenarioEmitente.IE || "",
          IEST: undefined,
          IM: undefined,
          CNAE: undefined,
          CRT: undefined,
          xLgr: scenario.ScenarioEmitente.xLgr || "",
          nro: scenario.ScenarioEmitente.nro || "",
          xCpl: scenario.ScenarioEmitente.xCpl || "",
          xBairro: scenario.ScenarioEmitente.xBairro || "",
          cMun: undefined,
          xMun: scenario.ScenarioEmitente.xMun || "",
          UF: scenario.ScenarioEmitente.UF || "",
          CEP: (scenario.ScenarioEmitente.CEP || "").replace(/\D/g, ""),
          cPais: undefined,
          xPais: undefined,
          fone: (scenario.ScenarioEmitente.fone || "").replace(/\D/g, ""),
        }
      : null;

  const novoDestinatario =
    (scenario.editar_destinatario_pj || scenario.editar_destinatario_pf) &&
    scenario.ScenarioDestinatario
      ? {
          CNPJ:
            scenario.editar_destinatario_pj &&
            scenario.ScenarioDestinatario.cnpj
              ? scenario.ScenarioDestinatario.cnpj.replace(/\D/g, "")
              : undefined,
          CPF:
            scenario.editar_destinatario_pf && scenario.ScenarioDestinatario.cpf
              ? scenario.ScenarioDestinatario.cpf.replace(/\D/g, "")
              : undefined,
          xNome: scenario.ScenarioDestinatario.xNome || "",
          IE: scenario.ScenarioDestinatario.IE || "",
          xLgr: scenario.ScenarioDestinatario.xLgr || "",
          nro: scenario.ScenarioDestinatario.nro || "",
          xBairro: scenario.ScenarioDestinatario.xBairro || "",
          cMun: undefined,
          xMun: scenario.ScenarioDestinatario.xMun || "",
          UF: scenario.ScenarioDestinatario.UF || "",
          CEP: scenario.ScenarioDestinatario.CEP
            ? scenario.ScenarioDestinatario.CEP.replace(/\D/g, "")
            : "",
          cPais: undefined,
          xPais: undefined,
          fone: scenario.ScenarioDestinatario.fone
            ? scenario.ScenarioDestinatario.fone.replace(/\D/g, "")
            : "",
        }
      : null;

  const produtos =
    scenario.editar_produtos &&
    scenario.ScenarioProduto &&
    scenario.ScenarioProduto.length > 0
      ? scenario.ScenarioProduto.map((p) => ({
          xProd: p.xProd || undefined,
          cEAN: p.cEAN || undefined,
          cProd: p.cProd || undefined,
          NCM: p.NCM || undefined,
          isPrincipal: p.isPrincipal,
          ordem: p.ordem,
        })).sort((a, b) => a.ordem - b.ordem)
      : null;

  const cstMappings =
    scenario.editar_cst && scenario.CstMapping && scenario.CstMapping.length > 0
      ? scenario.CstMapping.map((m) => ({
          tipoOperacao: m.tipoOperacao as
            | "VENDA"
            | "DEVOLUCAO"
            | "RETORNO"
            | "REMESSA",
          icms: m.icms,
          ipi: m.ipi,
          pis: m.pis,
          cofins: m.cofins,
        }))
      : null;

  const taxReformRule =
    scenario.reforma_tributaria &&
    scenario.TaxReformRule &&
    scenario.TaxReformRule.length > 0
      ? {
          pIBSUF: scenario.TaxReformRule[0].pIBSUF || undefined,
          pIBSMun: scenario.TaxReformRule[0].pIBSMun || undefined,
          pCBS: scenario.TaxReformRule[0].pCBS || undefined,
          vDevTrib: scenario.TaxReformRule[0].vDevTrib || "0.00",
          cClassTrib: scenario.TaxReformRule[0].cClassTrib || "000001",
          CST: scenario.TaxReformRule[0].CST || "000",
        }
      : null;

  const resultadosEdicao = editarChavesEmLote(
    filesForProcessing,
    chaveMapping,
    referenceMap,
    chaveVendaNova ?? null,
    scenario.editar_data ? scenario.nova_data || null : null,
    scenario.alterar_cUF ? scenario.novo_cUF || null : null,
    scenario.alterar_serie ? scenario.nova_serie || null : null,
    novoEmitente,
    novoDestinatario,
    produtos,
    cstMappings,
    taxReformRule
  );

  let totalEditados = 0;
  let totalErros = 0;
  let totalSemAlteracao = 0;

  for (const resultado of resultadosEdicao) {
    if (!resultado.sucesso) {
      totalErros++;
    } else if (resultado.alteracoes.includes("Nenhuma alteração necessária")) {
      totalSemAlteracao++;
    } else {
      totalEditados++;
    }
  }

  const arquivosEditados = filesForProcessing.map((file, index) => {
    const resultado = resultadosEdicao[index];
    return {
      ...file,
      content: resultado.conteudoEditado || file.content,
    };
  });

  const chaveMappingMap = new Map(Object.entries(chaveMapping));

  if (chaveMappingMap.size > 0) {
    const resultadosReferenciamento: Array<{
      nomeArquivo: string;
      alteracoes: string[];
    }> = [];

    for (let i = 0; i < arquivosEditados.length; i++) {
      const arquivo = arquivosEditados[i];
      let xmlAtualizado = arquivo.content;
      const alteracoesRef: string[] = [];

      chaveMappingMap.forEach((novaChave, chaveAntiga) => {
        if (xmlAtualizado.includes(chaveAntiga)) {
          const regexChaveEmTags = new RegExp(`(>)${chaveAntiga}(<)`, "g");

          const ocorrenciasBefore = (
            xmlAtualizado.match(regexChaveEmTags) || []
          ).length;

          if (ocorrenciasBefore > 0) {
            xmlAtualizado = xmlAtualizado.replace(
              regexChaveEmTags,
              `$1${novaChave}$2`
            );

            const numNota = chaveAntiga.substring(25, 34).replace(/^0+/, "");
            const numNotaNova = novaChave.substring(25, 34).replace(/^0+/, "");

            alteracoesRef.push(
              `Referência atualizada: nota nº ${numNota} → ${numNotaNova} (${ocorrenciasBefore} ocorrência(s))`
            );
          }
        }
      });

      if (alteracoesRef.length > 0) {
        arquivosEditados[i] = {
          ...arquivo,
          content: xmlAtualizado,
        };

        resultadosReferenciamento.push({
          nomeArquivo: arquivo.name,
          alteracoes: alteracoesRef,
        });

        resultadosEdicao[i].alteracoes.push(...alteracoesRef);
      }
    }

    if (resultadosReferenciamento.length === 0) {
      // Nenhuma referência precisou ser atualizada; mantemos apenas nos resultados
    }
  }

  return {
    arquivosEditados,
    resultadosEdicao,
    totalEditados,
    totalErros,
    totalSemAlteracao,
  };
}
