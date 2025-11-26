"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

// ─────────────────────────────────────────────────────────────────────────────
// Funções de Máscara
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remove todos os caracteres não numéricos
 */
function onlyNumbers(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Máscara de CNPJ: 00.000.000/0000-00
 */
function maskCNPJ(value: string): string {
  const nums = onlyNumbers(value).slice(0, 14);
  return nums
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/**
 * Máscara de CPF: 000.000.000-00
 */
function maskCPF(value: string): string {
  const nums = onlyNumbers(value).slice(0, 11);
  return nums
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/**
 * Máscara de Telefone: (00) 00000-0000 ou (00) 0000-0000
 */
function maskPhone(value: string): string {
  const nums = onlyNumbers(value).slice(0, 11);
  if (nums.length <= 10) {
    return nums
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return nums.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

/**
 * Máscara de CEP: 00000-000
 */
function maskCEP(value: string): string {
  const nums = onlyNumbers(value).slice(0, 8);
  return nums.replace(/(\d{5})(\d)/, "$1-$2");
}

/**
 * Máscara de IE (Inscrição Estadual) - Apenas números, máx 14 dígitos
 */
function maskIE(value: string): string {
  return onlyNumbers(value).slice(0, 14);
}

/**
 * Máscara de Data: DD/MM/AAAA
 */
function maskDate(value: string): string {
  const nums = onlyNumbers(value).slice(0, 8);
  return nums.replace(/(\d{2})(\d)/, "$1/$2").replace(/(\d{2})(\d)/, "$1/$2");
}

/**
 * Máscara de NCM: 0000.00.00
 */
function maskNCM(value: string): string {
  const nums = onlyNumbers(value).slice(0, 8);
  return nums
    .replace(/(\d{4})(\d)/, "$1.$2")
    .replace(/(\d{4}\.\d{2})(\d)/, "$1.$2");
}

/**
 * Máscara de CFOP: 0000
 */
function maskCFOP(value: string): string {
  return onlyNumbers(value).slice(0, 4);
}

/**
 * Máscara de Percentual: 00,00 ou 000,00
 */
function maskPercent(value: string): string {
  // Remove tudo exceto números e vírgula
  let cleaned = value.replace(/[^\d,]/g, "");
  // Permite apenas uma vírgula
  const parts = cleaned.split(",");
  if (parts.length > 2) {
    cleaned = parts[0] + "," + parts.slice(1).join("");
  }
  // Limita casas decimais a 2
  if (parts.length === 2 && parts[1].length > 2) {
    cleaned = parts[0] + "," + parts[1].slice(0, 2);
  }
  return cleaned;
}

/**
 * Máscara de UF: XX (2 letras maiúsculas)
 */
function maskUF(value: string): string {
  return value
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Máscara de Código UF: 00 (2 dígitos)
 */
function maskCodUF(value: string): string {
  return onlyNumbers(value).slice(0, 2);
}

/**
 * Máscara de Série NF: até 3 dígitos
 */
function maskSerie(value: string): string {
  return onlyNumbers(value).slice(0, 3);
}

/**
 * Máscara de CEST: 00.000.00
 */
function maskCEST(value: string): string {
  const nums = onlyNumbers(value).slice(0, 7);
  return nums
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{2}\.\d{3})(\d)/, "$1.$2");
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapa de Máscaras
// ─────────────────────────────────────────────────────────────────────────────
export type MaskType =
  | "cnpj"
  | "cpf"
  | "phone"
  | "cep"
  | "ie"
  | "date"
  | "ncm"
  | "cfop"
  | "percent"
  | "uf"
  | "codUf"
  | "serie"
  | "cest"
  | "numbers";

const maskFunctions: Record<MaskType, (value: string) => string> = {
  cnpj: maskCNPJ,
  cpf: maskCPF,
  phone: maskPhone,
  cep: maskCEP,
  ie: maskIE,
  date: maskDate,
  ncm: maskNCM,
  cfop: maskCFOP,
  percent: maskPercent,
  uf: maskUF,
  codUf: maskCodUF,
  serie: maskSerie,
  cest: maskCEST,
  numbers: onlyNumbers,
};

// ─────────────────────────────────────────────────────────────────────────────
// Componente MaskedInput
// ─────────────────────────────────────────────────────────────────────────────
export interface MaskedInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  mask: MaskType;
  value?: string;
  onChange?: (value: string) => void;
}

export const MaskedInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ mask, value = "", onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const maskedValue = maskFunctions[mask](rawValue);
      onChange?.(maskedValue);
    };

    // Aplica a máscara ao valor inicial também
    const displayValue = maskFunctions[mask](value);

    return (
      <Input
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        {...props}
      />
    );
  }
);

MaskedInput.displayName = "MaskedInput";

// ─────────────────────────────────────────────────────────────────────────────
// Funções de Validação
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida CPF matematicamente (dígitos verificadores)
 */
export function validateCPF(cpf: string): boolean {
  const nums = onlyNumbers(cpf);

  // Deve ter 11 dígitos
  if (nums.length !== 11) return false;

  // Verifica se todos os dígitos são iguais (ex: 111.111.111-11)
  if (/^(\d)\1+$/.test(nums)) return false;

  // Cálculo do primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(nums.charAt(i)) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(nums.charAt(9))) return false;

  // Cálculo do segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(nums.charAt(i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(nums.charAt(10))) return false;

  return true;
}

/**
 * Valida CNPJ matematicamente (dígitos verificadores)
 */
export function validateCNPJ(cnpj: string): boolean {
  const nums = onlyNumbers(cnpj);

  // Deve ter 14 dígitos
  if (nums.length !== 14) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(nums)) return false;

  // Cálculo do primeiro dígito verificador
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;
  for (let i = 0; i < 12; i++) {
    soma += parseInt(nums.charAt(i)) * pesos1[i];
  }
  let resto = soma % 11;
  const digito1 = resto < 2 ? 0 : 11 - resto;
  if (digito1 !== parseInt(nums.charAt(12))) return false;

  // Cálculo do segundo dígito verificador
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  soma = 0;
  for (let i = 0; i < 13; i++) {
    soma += parseInt(nums.charAt(i)) * pesos2[i];
  }
  resto = soma % 11;
  const digito2 = resto < 2 ? 0 : 11 - resto;
  if (digito2 !== parseInt(nums.charAt(13))) return false;

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exportar funções de máscara para uso externo
// ─────────────────────────────────────────────────────────────────────────────
export const masks = {
  cnpj: maskCNPJ,
  cpf: maskCPF,
  phone: maskPhone,
  cep: maskCEP,
  ie: maskIE,
  date: maskDate,
  ncm: maskNCM,
  cfop: maskCFOP,
  percent: maskPercent,
  uf: maskUF,
  codUf: maskCodUF,
  serie: maskSerie,
  cest: maskCEST,
  numbers: onlyNumbers,
};
