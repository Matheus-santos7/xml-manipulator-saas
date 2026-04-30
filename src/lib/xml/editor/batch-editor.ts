/**
 * Editor em Lote de Chaves XML
 *
 * Módulo para edição de múltiplos arquivos XML em lote.
 * Processa listas de arquivos, aplicando mapeamentos de chaves.
 */

import type { ChaveMapping, ReferenceMapping } from "@/lib/xml";
import type { NormalizedTaxRule } from "@/lib/tax-rules/types";
import { editarChavesXml } from "./xml-core";
import type {
  DadosEmitente,
  DadosDestinatario,
  DadosProduto,
  ResultadoEdicao,
} from "./types";

/**
 * Edita as chaves de acesso em múltiplos arquivos XML
 *
 * Processa lote de arquivos aplicando:
 * - Mapeamentos de chaves
 * - Referências entre notas
 * - Alterações de emitente/destinatário
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
  taxRules: NormalizedTaxRule[] | null = null,
  novoDestinatarioRemessa: DadosDestinatario | null = null
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
      taxRules,
      novoDestinatarioRemessa
    );
    resultados.push(resultado);
  }

  return resultados;
}
