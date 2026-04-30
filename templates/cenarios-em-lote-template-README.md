# Template de cenarios em lote

Arquivo: `templates/cenarios-em-lote-template.csv`

## Como preencher

- Use `;` como separador de colunas (padrao do template).
- Use `TRUE`/`FALSE` para flags booleanas.
- Campos numericos/fiscais devem vir sem mascara quando possivel.
- Um mesmo cenario pode ter varios produtos:
  - repita a linha com o mesmo `scenario_key` e `name`
  - altere `produto_ordem` e os campos `prod_*`
  - marque apenas um item com `produto_isPrincipal=TRUE`

## Campos principais

- Identificacao:
  - `scenario_key`: chave tecnica para agrupamento no importador
  - `profileId`: id da empresa
  - `name`: nome do cenario
- Emitente: colunas `emit_*`
- Destinatario: colunas `dest_*`
- CD ML para remessa/retorno:
  - `editar_destinatario_remessa=TRUE`
  - `destinatarioRemessaMlCdId=<id do CD>`
- Produto: colunas `prod_*`

## Observacoes

- `editar_destinatario_pj` e `editar_destinatario_pf` sao mutuamente exclusivos na maioria dos cenarios.
- `alterar_cUF/novo_cUF` deve ficar coerente com `emit_UF`.
- `emit_cMun` e `dest_cMun` devem ter codigo IBGE de 7 digitos.
