import type { ResultadoEdicao, DadosEmitente } from "./types";
import { INUTILIZACAO_PATTERNS, IDENTIFICACAO_PATTERNS } from "./regexPatterns";

export function editarInutilizacao(
  xmlContent: string,
  fileName: string,
  params?: {
    alterarEmitente?: boolean;
    novoEmitente?: DadosEmitente | null;
    alterarData?: boolean;
    novaData?: string | null; // DD/MM/YYYY
    alterarCUF?: boolean;
    novoCUF?: string | null; // 2 dígitos
    alterarSerie?: boolean;
    novaSerie?: string | null; // até 3 dígitos
  }
): ResultadoEdicao {
  if (
    !xmlContent.includes("<procInutNFe") &&
    !xmlContent.includes("<inutNFe")
  ) {
    return {
      nomeArquivo: fileName,
      tipo: "Desconhecido",
      sucesso: false,
      alteracoes: [],
      erro: "Conteúdo não parece ser uma Inutilização",
    };
  }

  let xmlEditado = xmlContent;
  const alteracoes: string[] = [];

  const opts = params || {};
  const {
    alterarEmitente = false,
    novoEmitente = null,
    alterarData = false,
    novaData = null,
    alterarCUF = false,
    novoCUF = null,
    alterarSerie = false,
    novaSerie = null,
  } = opts;

  // 1) Atualiza CNPJ dentro de <infInut>
  if (alterarEmitente && novoEmitente?.CNPJ) {
    const cnpjNumerico = novoEmitente.CNPJ.replace(/\D/g, "");
    const regexCnpj = INUTILIZACAO_PATTERNS.CNPJ_INF_INUT;
    if (regexCnpj.test(xmlEditado)) {
      xmlEditado = xmlEditado.replace(regexCnpj, `$1$2${cnpjNumerico}$3`);
      alteracoes.push("Inutilização: <CNPJ> alterado");
    }
  }

  // 2) Atualiza <ano> com base em novaData (YY)
  let anoNovo: string | null = null;
  if (alterarData && novaData) {
    const m = IDENTIFICACAO_PATTERNS.VALIDATE_DATE.exec(novaData);
    if (m) {
      const ano = m[3].slice(2);
      anoNovo = ano;
      const regexAno = INUTILIZACAO_PATTERNS.ANO_INF_INUT;
      if (regexAno.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexAno, `$1$2${ano}$3`);
        alteracoes.push("Inutilização: <ano> alterado");
      }
    }
  }

  // 3) Atualiza <cUF>
  let cUFNovo: string | null = null;
  if (alterarCUF && novoCUF) {
    cUFNovo = novoCUF.padStart(2, "0");
    const regexCUF = INUTILIZACAO_PATTERNS.CUF_INF_INUT;
    if (regexCUF.test(xmlEditado)) {
      xmlEditado = xmlEditado.replace(regexCUF, `$1$2${cUFNovo}$3`);
      alteracoes.push("Inutilização: <cUF> alterado");
    }
  }

  // 4) Atualiza <serie>
  let serieNova: string | null = null;
  if (alterarSerie && novaSerie) {
    serieNova = novaSerie.padStart(3, "0");
    const regexSerie = INUTILIZACAO_PATTERNS.SERIE_INF_INUT;
    if (regexSerie.test(xmlEditado)) {
      xmlEditado = xmlEditado.replace(regexSerie, `$1$2${serieNova}$3`);
      alteracoes.push("Inutilização: <serie> alterada");
    }
  }

  // 5) Atualiza <dhRecbto>
  if (alterarData && novaData) {
    const m = IDENTIFICACAO_PATTERNS.VALIDATE_DATE.exec(novaData);
    if (m) {
      const [_, dd, mm, yyyy] = m;
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const min = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      const iso = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}-03:00`;
      const regexDhRecbto = IDENTIFICACAO_PATTERNS.DH_RECBTO;
      if (regexDhRecbto.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexDhRecbto, `$1${iso}$2`);
        alteracoes.push("Inutilização: <dhRecbto> alterado");
      }
    }
  }

  // 6) Recalcula o atributo Id de <infInut Id="..."></infInut>
  const regexId = INUTILIZACAO_PATTERNS.ID_INF_INUT;
  const matchIdFull = xmlEditado.match(/<infInut[^>]*\sId=\"([^\"]+)\"/i);
  if (matchIdFull && matchIdFull[1].startsWith("ID")) {
    const idAtual = matchIdFull[1];
    const idRaw = idAtual.substring(2);
    const m = idRaw.match(
      /^(\d{2})(\d{2})(\d{14})(\d{2})(\d{3})(\d{9})(\d{9})$/
    );
    if (m) {
      let [_, uf, ano, cnpj, mod, serie, nNFIni, nNFFin] = m;
      if (cUFNovo) uf = cUFNovo;
      if (anoNovo) ano = anoNovo;
      if (alterarEmitente && novoEmitente?.CNPJ) {
        cnpj = novoEmitente.CNPJ.replace(/\D/g, "").padStart(14, "0");
      }
      if (serieNova) serie = serieNova;
      const novoId = `ID${uf}${ano}${cnpj}${mod}${serie}${nNFIni}${nNFFin}`;
      if (regexId.test(xmlEditado)) {
        xmlEditado = xmlEditado.replace(regexId, `$1${novoId}$2`);
        alteracoes.push(`Inutilização: <Id> alterado para ${novoId}`);
      }
    }
  }

  if (alteracoes.length === 0) {
    return {
      nomeArquivo: fileName,
      tipo: "Inutilizacao",
      sucesso: true,
      alteracoes: ["Nenhuma alteração necessária"],
      conteudoEditado: xmlContent,
    };
  }

  return {
    nomeArquivo: fileName,
    tipo: "Inutilizacao",
    sucesso: true,
    alteracoes,
    conteudoEditado: xmlEditado,
  };
}
