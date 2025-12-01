/**
 * Constantes utilizadas no sistema de manipulação de XMLs
 */

// Tipos de operação fiscal para mapeamento de CST
export type TipoOperacao = "VENDA" | "DEVOLUCAO" | "RETORNO" | "REMESSA";

export const TIPOS_OPERACAO: TipoOperacao[] = [
  "VENDA",
  "DEVOLUCAO",
  "RETORNO",
  "REMESSA",
];

// CFOPs utilizados para identificar tipos de operações fiscais
export const CFOP_LISTS = {
  VENDAS: [
    "5404",
    "6404",
    "5108",
    "6108",
    "5405",
    "6405",
    "5102",
    "6102",
    "5105",
    "6105",
    "5106",
    "6106",
    "5551",
  ],
  DEVOLUCOES: ["1201", "2201", "1202", "1410", "2410", "2102", "2202", "2411"],
  RETORNOS: ["1949", "2949", "5902", "6902"],
  REMESSAS: ["5949", "5156", "6152", "6949", "6905", "5901", "6901"],
};

// Exporta também as listas individuais para compatibilidade
export const VENDAS_CFOP = CFOP_LISTS.VENDAS as readonly string[];
export const DEVOLUCOES_CFOP = CFOP_LISTS.DEVOLUCOES as readonly string[];
export const RETORNOS_CFOP = CFOP_LISTS.RETORNOS as readonly string[];
export const REMESSAS_CFOP = CFOP_LISTS.REMESSAS as readonly string[];
