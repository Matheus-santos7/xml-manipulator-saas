import type { ResultadoEdicao } from "@/lib/xml/editor";
import type { ArquivoParaProcessamento } from "./prepare-files";

export function updateReferencesInFiles(
  arquivosEditados: ArquivoParaProcessamento[],
  resultadosEdicao: ResultadoEdicao[],
  chaveMapping: Record<string, string>
): void {
  const chaveMappingMap = new Map(Object.entries(chaveMapping));
  if (chaveMappingMap.size === 0) return;

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
      arquivosEditados[i] = { ...arquivo, content: xmlAtualizado };
      resultadosEdicao[i].alteracoes.push(...alteracoesRef);
    }
  }
}

