/**
 * Funções auxiliares para manipulação de Chaves de Acesso de NFe e CTe
 */

/**
 * Calcula o dígito verificador de uma chave de acesso NFe/CTe
 *
 * Algoritmo: Módulo 11
 * - Percorre os 43 dígitos da chave da direita para esquerda
 * - Multiplica cada dígito por valores de 2 a 9 (cíclico)
 * - Soma todos os produtos
 * - Calcula o resto da divisão por 11
 * - DV = 11 - resto (com exceções: se for 0, 1, 10 ou 11, DV = 0)
 *
 * @param chave - Chave de acesso com 43 dígitos (sem o DV)
 * @returns Dígito verificador (string de 1 caractere)
 * @throws Error se a chave não tiver exatamente 43 dígitos
 */
export function calcularDvChave(chave: string): string {
  if (chave.length !== 43) {
    throw new Error(
      `A chave para cálculo do DV deve ter 43 dígitos. Recebeu ${chave.length}.`
    );
  }

  let soma = 0;
  let multiplicador = 2;

  // Percorre a chave da direita para esquerda
  for (let i = chave.length - 1; i >= 0; i--) {
    soma += parseInt(chave[i]) * multiplicador;
    multiplicador++;
    if (multiplicador > 9) {
      multiplicador = 2;
    }
  }

  const resto = soma % 11;
  const dv = 11 - resto;

  // Se o resultado for 0, 1, 10 ou 11, o DV é 0
  return dv === 0 || dv === 1 || dv === 10 || dv === 11 ? "0" : dv.toString();
}

/**
 * Interface para informações de documento fiscal para mapeamento
 */
export interface DocumentoInfo {
  doc_type: "NFe" | "CTe" | "Inutilizacao";
  caminho_completo: string;
  chave: string; // Chave de 44 dígitos (com DV)
  emit_cnpj: string;
  nfe_number?: string | null;
  ref_nfe?: string | null;
}

/**
 * Interface para os dados necessários para gerar uma nova chave
 */
export interface DadosNovaChave {
  cUF: string; // 2 dígitos
  anoMes: string; // 4 dígitos (AAMM)
  cnpj: string; // 14 dígitos
  modelo: string; // 2 dígitos (55 para NFe, 57 para CTe)
  serie: string; // 3 dígitos
  numero: string; // 9 dígitos
  tpEmis: string; // 1 dígito
  cNF: string; // 8 dígitos (código numérico)
}

/**
 * Gera uma nova chave de acesso completa (44 dígitos com DV)
 *
 * Estrutura da chave NFe/CTe:
 * [cUF(2)][AAMM(4)][CNPJ(14)][mod(2)][serie(3)][nNF(9)][tpEmis(1)][cNF(8)][DV(1)]
 *
 * @param dados - Dados para geração da nova chave
 * @returns Nova chave de 44 dígitos (43 + DV)
 */
export function gerarNovaChave(dados: DadosNovaChave): string {
  // Garantir que cada parte tenha o tamanho correto
  const cUF = dados.cUF.padStart(2, "0");
  const anoMes = dados.anoMes.padStart(4, "0");
  const cnpj = dados.cnpj.replace(/\D/g, "").padStart(14, "0");
  const modelo = dados.modelo.padStart(2, "0");
  const serie = dados.serie.padStart(3, "0");
  const numero = dados.numero.padStart(9, "0");
  const tpEmis = dados.tpEmis.padStart(1, "0");
  const cNF = dados.cNF.padStart(8, "0");

  // Monta a chave sem o DV (43 dígitos)
  const chaveSemDv = `${cUF}${anoMes}${cnpj}${modelo}${serie}${numero}${tpEmis}${cNF}`;

  if (chaveSemDv.length !== 43) {
    throw new Error(
      `Erro ao gerar chave: resultado tem ${chaveSemDv.length} dígitos em vez de 43`
    );
  }

  // Calcula o DV e adiciona à chave
  const dv = calcularDvChave(chaveSemDv);
  return chaveSemDv + dv;
}

/**
 * Extrai as partes de uma chave de acesso existente
 *
 * @param chaveCompleta - Chave de 44 dígitos (com DV)
 * @returns Objeto com as partes da chave
 */
export function extrairPartesChave(chaveCompleta: string): DadosNovaChave {
  if (chaveCompleta.length !== 44) {
    throw new Error(
      `Chave deve ter 44 dígitos. Recebeu ${chaveCompleta.length}.`
    );
  }

  return {
    cUF: chaveCompleta.substring(0, 2),
    anoMes: chaveCompleta.substring(2, 6),
    cnpj: chaveCompleta.substring(6, 20),
    modelo: chaveCompleta.substring(20, 22),
    serie: chaveCompleta.substring(22, 25),
    numero: chaveCompleta.substring(25, 34),
    tpEmis: chaveCompleta.substring(34, 35),
    cNF: chaveCompleta.substring(35, 43),
  };
}

/**
 * Interface para o mapeamento de chaves (antiga -> nova)
 */
export interface ChaveMapping {
  [chaveAntiga: string]: string; // chave antiga (44 dígitos) -> chave nova (44 dígitos)
}

/**
 * Interface para o mapeamento de referências (chave -> chave referenciada)
 */
export interface ReferenceMapping {
  [chaveDocumento: string]: string; // chave do documento -> chave que ele referencia
}

/**
 * Interface para o resultado do mapeamento de chaves
 */
export interface ResultadoMapeamento {
  chaveMapping: ChaveMapping;
  referenceMap: ReferenceMapping;
  chaveVendaNova: string | null;
}

/**
 * Calcula as novas chaves de acesso para todos os documentos
 * baseado nas alterações solicitadas (data, UF, CNPJ, série)
 *
 * Esta função implementa a lógica do Python `_prepara_mapeamentos`
 *
 * @param documentos - Array de informações dos documentos
 * @param alterarEmitente - Se deve alterar o CNPJ do emitente
 * @param novoCnpj - Novo CNPJ do emitente (se alterarEmitente = true)
 * @param alterarData - Se deve alterar a data
 * @param novaData - Nova data no formato DD/MM/YYYY
 * @param alterarUF - Se deve alterar a UF
 * @param novoUF - Novo código da UF (2 dígitos)
 * @param alterarSerie - Se deve alterar a série
 * @param novaSerie - Nova série (até 3 dígitos)
 * @returns Objeto com os mapeamentos de chaves
 */
export function prepararMapeamentosDeChaves(
  documentos: DocumentoInfo[],
  alterarEmitente: boolean,
  novoCnpj: string | null,
  alterarData: boolean,
  novaData: string | null, // Formato: DD/MM/YYYY
  alterarUF: boolean,
  novoUF: string | null,
  alterarSerie: boolean,
  novaSerie: string | null
): ResultadoMapeamento {
  const chaveMapping: ChaveMapping = {};
  const referenceMap: ReferenceMapping = {};
  let chaveVendaNova: string | null = null;

  // Mapeamento de número de nota para chave (apenas NFe)
  const nNFtoKeyMap = new Map<string, string>();
  for (const doc of documentos) {
    if (doc.doc_type === "NFe" && doc.nfe_number) {
      nNFtoKeyMap.set(doc.nfe_number, doc.chave);
    }
  }

  // Processa cada documento
  for (const doc of documentos) {
    // Pula inutilizações
    if (doc.doc_type === "Inutilizacao") {
      continue;
    }

    const chaveOriginal = doc.chave;

    // Mapeamento de referências (só NFe referenciando NFe)
    if (doc.doc_type === "NFe" && doc.ref_nfe) {
      // Extrai o número da nota referenciada da chave (posições 25-34)
      const numeroReferenciado = doc.ref_nfe
        .substring(25, 34)
        .replace(/^0+/, "");
      const chaveReferenciada = nNFtoKeyMap.get(numeroReferenciado);
      if (chaveReferenciada) {
        referenceMap[chaveOriginal] = chaveReferenciada;
      }
    }

    // Se não há alterações que impactem a chave, pula
    if (!alterarEmitente && !alterarData && !alterarUF && !alterarSerie) {
      continue;
    }

    // Extrai as partes da chave original
    const partesOriginais = extrairPartesChave(chaveOriginal);

    // Determina os novos valores
    let novoAnoMes = partesOriginais.anoMes;
    if (alterarData && novaData) {
      // Converte DD/MM/YYYY para AAMM
      const [, mes, ano] = novaData.split("/");
      novoAnoMes = ano.substring(2) + mes; // YY + MM
    }

    const novoCnpjNumerico =
      alterarEmitente && novoCnpj
        ? novoCnpj.replace(/\D/g, "").padStart(14, "0")
        : partesOriginais.cnpj;

    const novoUFChave =
      alterarUF && novoUF ? novoUF.padStart(2, "0") : partesOriginais.cUF;

    const novaSerieChave =
      alterarSerie && novaSerie
        ? novaSerie.padStart(3, "0")
        : partesOriginais.serie;

    // Gera a nova chave
    const novaChave = gerarNovaChave({
      cUF: novoUFChave,
      anoMes: novoAnoMes,
      cnpj: novoCnpjNumerico,
      modelo: partesOriginais.modelo,
      serie: novaSerieChave,
      numero: partesOriginais.numero,
      tpEmis: partesOriginais.tpEmis,
      cNF: partesOriginais.cNF,
    });

    // Armazena no mapeamento
    chaveMapping[chaveOriginal] = novaChave;

    // Se for uma venda, guarda a chave para vincular ao CTe
    if (doc.doc_type === "NFe" && doc.caminho_completo.includes("Venda")) {
      chaveVendaNova = novaChave;
    }
  }

  return {
    chaveMapping,
    referenceMap,
    chaveVendaNova,
  };
}

/**
 * Valida se uma chave de acesso tem o DV correto
 *
 * @param chave - Chave completa de 44 dígitos
 * @returns true se o DV está correto, false caso contrário
 */
export function validarChave(chave: string): boolean {
  if (chave.length !== 44) {
    return false;
  }

  const chaveSemDv = chave.substring(0, 43);
  const dvEsperado = calcularDvChave(chaveSemDv);
  const dvAtual = chave.substring(43);

  return dvEsperado === dvAtual;
}
