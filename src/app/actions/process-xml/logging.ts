// Centraliza logs de cenário e arquivos para facilitar rastreabilidade.
// Atualmente mantido como no-op para permitir instrumentação futura sem
// poluir o output em ambientes de produção.
export function logScenarioAndFiles(
  // Usamos um tipo estrutural mínimo para evitar `any` amplo
  scenario: {
    id: string;
    name: string;
    editar_emitente: boolean;
    editar_destinatario_pj: boolean;
    editar_destinatario_pf: boolean;
    editar_produtos: boolean;
    editar_impostos: boolean;
    editar_data: boolean;
    editar_refNFe: boolean;
    editar_cst: boolean;
    zerar_ipi_remessa_retorno: boolean;
    zerar_ipi_venda: boolean;
    reforma_tributaria: boolean;
    alterar_serie: boolean;
    alterar_cUF: boolean;
    aplicar_reducao_aliq: boolean;
    nova_serie?: string | null;
    nova_data?: string | null;
    novo_cUF?: string | null;
    ScenarioEmitente?: unknown | null;
    ScenarioDestinatario?: unknown | null;
    ScenarioProduto?: unknown | null;
    ScenarioImposto?: unknown | null;
    CstMapping?: { length: number } | null;
    TaxReformRule?: { length: number } | null;
  },
  files: File[],
  scenarioId: string
) {
  void scenario;
  void files;
  void scenarioId;
}
