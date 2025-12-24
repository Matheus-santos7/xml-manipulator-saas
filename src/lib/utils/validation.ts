/**
 * Utilitários de validação
 */

/**
 * Valida se uma string é um CNPJ válido
 *
 * @param cnpj - String com CNPJ (com ou sem formatação)
 * @returns true se válido, false caso contrário
 *
 * @example
 * isValidCNPJ("12.345.678/0001-95") // true
 * isValidCNPJ("00.000.000/0000-00") // false
 */
export function isValidCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, "");

  if (cleaned.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false; // Todos dígitos iguais

  // Validação do primeiro dígito verificador
  let sum = 0;
  let weight = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  const digit1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);

  // Validação do segundo dígito verificador
  sum = 0;
  weight = 6;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i]) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  const digit2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);

  return parseInt(cleaned[12]) === digit1 && parseInt(cleaned[13]) === digit2;
}

/**
 * Valida se uma string é um CPF válido
 *
 * @param cpf - String com CPF (com ou sem formatação)
 * @returns true se válido, false caso contrário
 *
 * @example
 * isValidCPF("123.456.789-09") // Depende do cálculo
 */
export function isValidCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, "");

  if (cleaned.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false; // Todos dígitos iguais

  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }
  const digit1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);

  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i);
  }
  const digit2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);

  return parseInt(cleaned[9]) === digit1 && parseInt(cleaned[10]) === digit2;
}

/**
 * Valida se uma string é um CEP válido (formato brasileiro)
 *
 * @param cep - String com CEP
 * @returns true se válido, false caso contrário
 *
 * @example
 * isValidCEP("01310-300") // true
 * isValidCEP("01310300") // true
 */
export function isValidCEP(cep: string): boolean {
  const cleaned = cep.replace(/\D/g, "");
  return cleaned.length === 8 && /^\d+$/.test(cleaned);
}

/**
 * Valida se um email é válido
 *
 * @param email - String com email
 * @returns true se válido, false caso contrário
 *
 * @example
 * isValidEmail("user@example.com") // true
 * isValidEmail("invalid-email") // false
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
