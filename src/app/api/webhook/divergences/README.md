# 📋 Webhook de Divergências

## Endpoint para Envio de Dados

```
POST /api/webhook/divergences?profileId={ID_DO_PERFIL}
```

---

## Query Parameter (Obrigatório)

| Parâmetro   | Tipo     | Descrição                       |
| ----------- | -------- | ------------------------------- |
| `profileId` | `string` | ID da empresa/perfil no sistema |

---

## Body (JSON)

```json
{
  "totalErp": 150000.0,
  "totalMl": 148500.0,
  "diferenca": 1500.0,
  "notas": [
    {
      "nfKey": "35241201234567890001550010000012341123456789",
      "status_conciliacao": "DIVERGENTE"
    },
    {
      "nfKey": "35241201234567890001550010000012351987654321",
      "status_conciliacao": "OK"
    }
  ]
}
```

---

## Estrutura dos Campos

| Campo                        | Tipo     | Obrigatório | Descrição                                            |
| ---------------------------- | -------- | ----------- | ---------------------------------------------------- |
| `totalErp`                   | `number` | ✅          | Valor total registrado no ERP                        |
| `totalMl`                    | `number` | ✅          | Valor total registrado no Mercado Livre              |
| `diferenca`                  | `number` | ✅          | Diferença entre ERP e ML                             |
| `notas`                      | `array`  | ✅          | Lista de notas fiscais                               |
| `notas[].nfKey`              | `string` | ✅          | Chave da NF-e (44 dígitos)                           |
| `notas[].status_conciliacao` | `string` | ✅          | Status da conciliação (`"DIVERGENTE"`, `"OK"`, etc.) |

---

## Exemplo de Chamada (cURL)

```bash
curl -X POST "https://seu-dominio.com/api/webhook/divergences?profileId=abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "totalErp": 150000.00,
    "totalMl": 148500.00,
    "diferenca": 1500.00,
    "notas": [
      {"nfKey": "35241201234567890001550010000012341123456789", "status_conciliacao": "DIVERGENTE"},
      {"nfKey": "35241201234567890001550010000012351987654321", "status_conciliacao": "OK"}
    ]
  }'
```

---

## Respostas

| Status | Descrição                                     |
| ------ | --------------------------------------------- |
| `200`  | Sucesso - Webhook processado                  |
| `400`  | `profileId` não informado ou payload inválido |
| `404`  | Perfil não encontrado                         |
| `500`  | Erro interno do servidor                      |

---

## Endpoint para Consulta

```
GET /api/webhook/divergences/latest
```

Retorna o último resumo de divergências com as notas que têm status `"DIVERGENTE"`.

### Resposta de Exemplo

```json
{
  "id": "clxx...",
  "totalErp": 150000.0,
  "totalMl": 148500.0,
  "diferenca": 1500.0,
  "profileId": "abc123",
  "createdAt": "2025-12-01T10:00:00.000Z",
  "notes": [
    {
      "id": "clyy...",
      "nfKey": "35241201234567890001550010000012341123456789",
      "status_conciliacao": "DIVERGENTE",
      "summaryId": "clxx..."
    }
  ]
}
```
