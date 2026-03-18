export interface ArquivoParaMascarar {
  name: string;
  content: string;
}

export interface ArquivoMascarado {
  originalName: string;
  newName: string;
  content: string;
  status: "success";
  logs: string[];
}

export function mascararXmls(files: ArquivoParaMascarar[]): ArquivoMascarado[] {
  return files.map((file) => {
    let content = file.content;

    // Mascarar qualquer sequência longa de dígitos (como CNPJ/CPF/chaves) mantendo apenas últimos 4 dígitos
    content = content.replace(/\d{7,}/g, (match) => {
      const visible = match.slice(-4);
      return "*".repeat(match.length - 4) + visible;
    });

    // Para adicionar um novo campo ao mascarador:
    // 1) Inclua o NOME EXATO da tag XML (sem < >) no array `tagNames` abaixo.
    // 2) A regex genérica `(<TAG[^>]*>)[^<]+(</TAG>)` vai substituir TODO o conteúdo interno por `***`.
    // 3) Use isso apenas para campos 100% sensíveis (nomes, certificados, identificadores),
    //    pois o valor original será perdido e não poderá ser recuperado.
    const tagNames = [
      "xNome",
      "xFant",
      "xMun",
      "xLgr",
      "xBairro",
      "xProd",
      "enderEmit",
      "enderDest",
      "SignatureValue",
      "X509Certificate",
    ];

    for (const tag of tagNames) {
      const regex = new RegExp(`(<${tag}[^>]*>)[^<]+(<\\/${tag}>)`, "gi");
      content = content.replace(regex, `$1***$2`);
    }

    return {
      originalName: file.name,
      newName: file.name,
      content,
      status: "success" as const,
      logs: [
        "Dados sensíveis mascarados (CNPJ/CPF, chaves longas, certificados e nomes básicos).",
      ],
    };
  });
}

