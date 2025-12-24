/**
 * Utilitários de formatação
 */

/**
 * Formata um número para o número especificado de casas decimais
 *
 * @param value - Valor numérico a formatar
 * @param places - Número de casas decimais (padrão: 2)
 * @returns String com número formatado
 *
 * @example
 * formatDecimal(10.5, 2) // "10.50"
 * formatDecimal(10.567, 2) // "10.57"
 */
export function formatDecimal(value: number, places: number = 2): string {
  return value.toFixed(places);
}

/**
 * Formata um valor como moeda brasileira
 *
 * @param value - Valor numérico
 * @returns String formatada como moeda
 *
 * @example
 * formatCurrency(1234.56) // "R$ 1.234,56"
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Formata um CNPJ com máscara
 *
 * @param cnpj - CNPJ sem formatação
 * @returns CNPJ formatado
 *
 * @example
 * formatCNPJ("12345678000195") // "12.345.678/0001-95"
 */
export function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return cnpj;

  return cleaned.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

/**
 * Formata um CPF com máscara
 *
 * @param cpf - CPF sem formatação
 * @returns CPF formatado
 *
 * @example
 * formatCPF("12345678909") // "123.456.789-09"
 */
export function formatCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return cpf;

  return cleaned.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

/**
 * Formata um CEP com máscara
 *
 * @param cep - CEP sem formatação
 * @returns CEP formatado
 *
 * @example
 * formatCEP("01310300") // "01310-300"
 */
export function formatCEP(cep: string): string {
  const cleaned = cep.replace(/\D/g, "");
  if (cleaned.length !== 8) return cep;

  return cleaned.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}

/**
 * Converte string de porcentagem para número
 *
 * @param value - String representando porcentagem
 * @returns Número decimal
 *
 * @example
 * parsePercent("9,50") // 9.5
 * parsePercent("9.50") // 9.5
 */
export function parsePercent(value: string | null | undefined): number {
  if (!value) return 0;
  return parseFloat(value.replace(",", ".")) || 0;
}
