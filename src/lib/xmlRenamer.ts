/**
 * Módulo para identificação de cenários fiscais e renomeação de arquivos XML
 * Equivalente às funções _gerar_novo_nome_nfe(), _renomear_nfe() e _renomear_eventos() do Python
 */

import type {
  NFeInfo,
  EventoInfo,
  CTeInfo,
  RenameResult,
  RenameReport,
} from "@/types";
import {
  VENDAS_CFOP,
  DEVOLUCOES_CFOP,
  RETORNOS_CFOP,
  REMESSAS_CFOP,
} from "./constantes";
import { extrairInfosXmls } from "./xmlExtractor";

/**
 * Gera o novo nome do arquivo NFe baseado no CFOP e informações da nota
 * Equivalente a _gerar_novo_nome_nfe() do Python
 */
export function gerarNovoNomeNfe(info: NFeInfo): string | null {
  const { cfop, natOp, refNFe, xTexto, nfeNumber } = info;

  // Garante que CFOP seja string
  const cfopStr = String(cfop);

  // Extrai o número da nota referenciada (se existir)
  // Garante que refNFe seja string antes de processar
  const refNfeStr =
    typeof refNFe === "string" ? refNFe : refNFe ? String(refNFe) : null;
  const refNfeNum =
    refNfeStr && refNfeStr.length >= 34
      ? refNfeStr.substring(25, 34).replace(/^0+/, "")
      : "";

  // Devoluções (CFOPs de devolução)
  if (DEVOLUCOES_CFOP.includes(cfopStr)) {
    if (refNfeStr) {
      // Insucesso de entrega
      if (natOp === "Retorno de mercadoria nao entregue") {
        return `${nfeNumber} - Insucesso de entrega da venda ${refNfeNum}.xml`;
      }

      // Devolução ao Mercado Livre
      if (
        natOp === "Devolucao de mercadorias" &&
        (xTexto.includes("DEVOLUTION_PLACES") ||
          xTexto.includes("SALE_DEVOLUTION"))
      ) {
        return `${nfeNumber} - Devoluçao pro Mercado Livre da venda - ${refNfeNum}.xml`;
      }

      // Devolução genérica
      if (
        natOp === "Devolucao de mercadorias" &&
        xTexto.includes("DEVOLUTION_devolution")
      ) {
        return `${nfeNumber} - Devolucao da venda ${refNfeNum}.xml`;
      }
    }

    // Devoluções sem referência específica
    if (natOp === "Retorno de mercadoria nao entregue") {
      return `${nfeNumber} - Insucesso de entrega.xml`;
    }

    if (natOp === "Devolucao de mercadorias") {
      return `${nfeNumber} - Devolucao.xml`;
    }

    // Devolução genérica
    return `${nfeNumber} - Devolucao.xml`;
  }

  // Vendas (CFOPs de venda)
  if (VENDAS_CFOP.includes(cfopStr)) {
    return `${nfeNumber} - Venda.xml`;
  }

  // Retornos (CFOPs de retorno)
  if (RETORNOS_CFOP.includes(cfopStr)) {
    if (refNfeStr) {
      // Retorno Simbólico
      if (
        natOp === "Outras Entradas - Retorno Simbolico de Deposito Temporario"
      ) {
        return `${nfeNumber} - Retorno da remessa ${refNfeNum}.xml`;
      }

      // Retorno Efetivo
      if (natOp === "Outras Entradas - Retorno de Deposito Temporario") {
        return `${nfeNumber} - Retorno Efetivo da remessa ${refNfeNum}.xml`;
      }
    }

    // Retorno genérico (sem referência específica)
    if (
      natOp === "Outras Entradas - Retorno Simbolico de Deposito Temporario"
    ) {
      return `${nfeNumber} - Retorno Simbólico.xml`;
    }

    if (natOp === "Outras Entradas - Retorno de Deposito Temporario") {
      return `${nfeNumber} - Retorno Efetivo.xml`;
    }

    // Retorno genérico
    return `${nfeNumber} - Retorno.xml`;
  }

  // Remessas (CFOPs de remessa)
  if (REMESSAS_CFOP.includes(cfopStr)) {
    // Remessa Simbólica (com nota referenciada)
    if (refNfeStr) {
      return `${nfeNumber} - Remessa simbólica da venda ${refNfeNum}.xml`;
    }

    // Identifica tipo de remessa pela natureza da operação
    if (natOp && natOp.includes("Remessa para Deposito Temporario")) {
      return `${nfeNumber} - Remessa.xml`;
    }

    // Remessa genérica
    return `${nfeNumber} - Remessa.xml`;
  }

  // Se não se encaixar em nenhum cenário, retorna null
  return null;
}

/**
 * Renomeia NFes baseado nas informações extraídas
 * Equivalente a _renomear_nfe() do Python
 */
export function renomearNfes(nfeInfos: Map<string, NFeInfo>): RenameResult[] {
  const results: RenameResult[] = [];

  for (const [, info] of nfeInfos) {
    const novoNome = gerarNovoNomeNfe(info);

    if (!novoNome) {
      results.push({
        originalName: info.caminhoCompleto,
        newName: null,
        status: "skipped",
        message: `Cenário não identificado (CFOP: ${
          info.cfop || "não encontrado"
        }, Nat.Op: ${info.natOp || "não encontrada"})`,
      });
      continue;
    }

    // Verifica se o arquivo já tem o nome correto
    if (info.caminhoCompleto === novoNome) {
      results.push({
        originalName: info.caminhoCompleto,
        newName: novoNome,
        status: "skipped",
        message: "Arquivo já possui o nome correto",
      });
      continue;
    }

    results.push({
      originalName: info.caminhoCompleto,
      newName: novoNome,
      status: "renamed",
      message: `Renomeado para ${novoNome}`,
    });
  }

  return results;
}

/**
 * Renomeia eventos de cancelamento vinculando-os à nota original
 * Equivalente a _renomear_eventos() do Python
 */
export function renomearEventos(
  eventosInfo: EventoInfo[],
  nfeInfos: Map<string, NFeInfo>
): RenameResult[] {
  const results: RenameResult[] = [];

  // Cria mapeamento de chave -> número da nota
  const chaveToNfeMap = new Map<string, string>();
  for (const [, info] of nfeInfos) {
    chaveToNfeMap.set(info.chave, info.nfeNumber);
  }

  for (const evento of eventosInfo) {
    const nfeNumberCancelado = chaveToNfeMap.get(evento.chaveCancelada);

    if (!nfeNumberCancelado) {
      results.push({
        originalName: evento.caminhoCompleto,
        newName: null,
        status: "skipped",
        message: "Nota referenciada não encontrada",
      });
      continue;
    }

    const novoNome = `CAN-${nfeNumberCancelado}.xml`;

    // Verifica se o arquivo já tem o nome correto
    if (evento.caminhoCompleto === novoNome) {
      results.push({
        originalName: evento.caminhoCompleto,
        newName: novoNome,
        status: "skipped",
        message: "Evento já possui o nome correto",
      });
      continue;
    }

    results.push({
      originalName: evento.caminhoCompleto,
      newName: novoNome,
      status: "renamed",
      message: `Evento de cancelamento vinculado à nota ${nfeNumberCancelado}`,
    });
  }

  return results;
}

/**
 * Renomeia CT-e vinculando-os à nota de venda original
 */
export function renomearCtes(
  cteInfos: Map<string, CTeInfo>,
  nfeInfos: Map<string, NFeInfo>
): RenameResult[] {
  const results: RenameResult[] = [];

  // Cria mapeamento de chave -> número da nota
  const chaveToNfeMap = new Map<string, string>();
  for (const [, info] of nfeInfos) {
    chaveToNfeMap.set(info.chave, info.nfeNumber);
  }

  for (const [, cteInfo] of cteInfos) {
    let novoNome: string | null = null;

    // Se tem NFe referenciada, vincula ao número da venda
    if (cteInfo.nfeChave) {
      const nfeNumberRef = chaveToNfeMap.get(cteInfo.nfeChave);
      if (nfeNumberRef) {
        novoNome = `${cteInfo.cteNumber} - CT-e da venda ${nfeNumberRef}.xml`;
      } else {
        // Extrai o número da NFe da chave (posição 25-34)
        const nfeNum = cteInfo.nfeChave.substring(25, 34).replace(/^0+/, "");
        novoNome = `${cteInfo.cteNumber} - CT-e da venda ${nfeNum}.xml`;
      }
    } else {
      // CT-e sem referência
      novoNome = `${cteInfo.cteNumber} - CT-e.xml`;
    }

    // Verifica se o arquivo já tem o nome correto
    if (cteInfo.caminhoCompleto === novoNome) {
      results.push({
        originalName: cteInfo.caminhoCompleto,
        newName: novoNome,
        status: "skipped",
        message: "CT-e já possui o nome correto",
      });
      continue;
    }

    results.push({
      originalName: cteInfo.caminhoCompleto,
      newName: novoNome,
      status: "renamed",
      message: `CT-e renomeado para ${novoNome}`,
    });
  }

  return results;
}

/**
 * Processa a renomeação de todos os arquivos (NFes, CT-e e eventos)
 * Equivalente à parte de renomeação de processar_arquivos() do Python
 */
export function processarRenomeacao(
  files: Array<{ name: string; content: string }>
): RenameReport {
  // Extrai informações dos XMLs
  const { nfeInfos, eventosInfo, cteInfos, arquivosNaoReconhecidos } =
    extrairInfosXmls(files);

  // Renomeia NFes
  const resultadosNfe = renomearNfes(nfeInfos);

  // Renomeia CT-e
  const resultadosCte = renomearCtes(cteInfos, nfeInfos);

  // Renomeia eventos
  const resultadosEventos = renomearEventos(eventosInfo, nfeInfos);

  // Adiciona arquivos não reconhecidos aos resultados
  const resultadosNaoReconhecidos = arquivosNaoReconhecidos.map((fileName) => ({
    originalName: fileName,
    newName: null,
    status: "error" as const,
    message: "Arquivo XML não reconhecido ou estrutura inválida",
  }));

  // Combina todos os resultados
  const allResults = [
    ...resultadosNfe,
    ...resultadosCte,
    ...resultadosEventos,
    ...resultadosNaoReconhecidos,
  ];

  // Calcula totais
  const totalRenamed = allResults.filter((r) => r.status === "renamed").length;
  const totalSkipped = allResults.filter((r) => r.status === "skipped").length;
  const totalErrors = allResults.filter((r) => r.status === "error").length;

  return {
    totalRenamed,
    totalSkipped,
    totalErrors,
    details: allResults,
  };
}

/**
 * Gera um resumo textual da renomeação
 * Equivalente a _resumir_renomeacao() do Python
 */
export function gerarResumoRenomeacao(report: RenameReport): string {
  const lines: string[] = [];

  lines.push("========== RESUMO DA RENOMEAÇÃO ==========");
  lines.push(
    `Total: ${report.totalRenamed} renomeados, ${report.totalSkipped} pulados, ${report.totalErrors} erros`
  );
  lines.push("");

  if (report.details.length > 0) {
    lines.push("Detalhes:");
    for (const detail of report.details) {
      const status =
        detail.status === "renamed"
          ? "[OK]"
          : detail.status === "skipped"
          ? "[PULADO]"
          : "[ERRO]";
      lines.push(
        `  ${status} ${detail.originalName} ${
          detail.newName ? `-> ${detail.newName}` : ""
        }`
      );
      if (detail.message) {
        lines.push(`      ${detail.message}`);
      }
    }
  }

  lines.push("==========================================");

  return lines.join("\n");
}
