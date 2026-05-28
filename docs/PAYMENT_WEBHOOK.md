# Webhook de Pagamento — UniverReviews

Contrato do webhook que a plataforma de pagamento (externa, **não Stripe**)
chama no UniverReviews quando um comprador conclui um pagamento. Esse
webhook é o ponto de entrada da operação de provisionamento: criamos o
usuário no Better Auth, criamos o workspace, e enviamos um magic-link de
24 h para o comprador entrar sem senha.

- **Endpoint** — `POST https://api.univerreviews.com/api/v1/webhooks/payment`
- **Autenticação** — assinatura HMAC-SHA256 no header `X-Payment-Signature`
- **Content-Type** — `application/json` (rejeitamos outros)
- **Tamanho máximo** — 64 KB
- **Idempotência** — `transaction_id` único; retries devolvem
  `{ ok: true, idempotent: true }` sem reprocessar

## 1. Payload esperado

```json
{
  "transaction_id": "ext_tx_abc123",
  "event": "payment.succeeded",
  "buyer": {
    "email": "buyer@example.com",
    "name": "Buyer Name",
    "country": "BR"
  },
  "plan": "entry",
  "amount_cents": 19900,
  "currency": "BRL",
  "occurred_at": "2026-05-28T17:00:00Z"
}
```

### Campos

| Campo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `transaction_id` | string | sim | ID único da transação no provedor. Usado como chave de idempotência. |
| `event` | string | sim | `payment.succeeded` é o único evento que dispara provisionamento hoje. Outros (`refund`, `chargeback`) são apenas registrados. |
| `buyer.email` | string | sim | Será **lowercased** antes de qualquer lookup. |
| `buyer.name` | string | recomendado | Usado como nome do workspace + nome do `workspace_user`. Fallback: local-part do e-mail. |
| `buyer.country` | string | não | ISO-3166 alpha-2. Hoje só armazenado no `payload`. |
| `plan` | string | sim | Um de `entry \| medium \| ultra`. Plano inválido devolve 422. |
| `amount_cents` | integer | sim | Valor em centavos. Apenas log/audit, não usado para cobrança. |
| `currency` | string | sim | ISO-4217 (`BRL`, `USD`...). Apenas log. |
| `occurred_at` | string | recomendado | ISO-8601 UTC, quando o pagamento aconteceu no provedor. |

### Eventos suportados

| Evento | Comportamento |
|---|---|
| `payment.succeeded` | Provisionamento completo (usuário, workspace, magic-link). |
| `refund`, `chargeback`, demais | Apenas registrados em `payment_events`. Resposta `200 OK`. |

## 2. Assinatura HMAC

- **Algoritmo** — HMAC-SHA256
- **Chave** — `ENV['PAYMENT_WEBHOOK_SECRET']` no servidor (string compartilhada com a plataforma de pagamento)
- **Body assinado** — o corpo bruto da requisição (UTF-8, antes de qualquer
  parsing JSON, sem normalizações)
- **Header** — `X-Payment-Signature: sha256=<hex_lowercase>`
- **Comparação** — `ActiveSupport::SecurityUtils.secure_compare`
  (tempo constante)

### Geração no provedor (pseudo-código)

```python
import hmac, hashlib
sig = hmac.new(
    key=PAYMENT_WEBHOOK_SECRET.encode("utf-8"),
    msg=raw_body_bytes,
    digestmod=hashlib.sha256
).hexdigest()
headers["X-Payment-Signature"] = f"sha256={sig}"
```

```ruby
sig = OpenSSL::HMAC.hexdigest("SHA256", ENV["PAYMENT_WEBHOOK_SECRET"], raw_body)
headers["X-Payment-Signature"] = "sha256=#{sig}"
```

```bash
# bash + openssl
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$PAYMENT_WEBHOOK_SECRET" -r | awk '{print $1}')
echo "X-Payment-Signature: sha256=$SIG"
```

## 3. Respostas

| Status | Body | Quando |
|---|---|---|
| `200 OK` | `{"ok": true, "idempotent": false}` | Primeiro recebimento — provisionou ou atualizou |
| `200 OK` | `{"ok": true, "idempotent": true}` | Retentativa do mesmo `transaction_id` |
| `400 Bad Request` | — | JSON inválido ou `transaction_id`/`event` ausente |
| `401 Unauthorized` | — | Assinatura ausente ou inválida |
| `413 Payload Too Large` | — | Body acima de 64 KB |
| `415 Unsupported Media Type` | — | `Content-Type` diferente de `application/json` |
| `422 Unprocessable` | `{"ok": false}` | `plan` inválido ou `email` mal-formado |
| `500 Internal Server Error` | — | Erro inesperado (retentar com backoff) |
| `503 Service Unavailable` | — | `PAYMENT_WEBHOOK_SECRET` não configurado no servidor |

**Garantia de tempo de resposta** — o handler escreve um `PaymentEvent`
*antes* de processar, então qualquer 5xx subsequente vira `idempotent:
true` na próxima retentativa, sem efeito colateral duplicado.

## 4. Provisionamento

Para `event == "payment.succeeded"`:

1. **Better Auth user (`auth.user`)** — find-or-create por `LOWER(email)`.
   Quando criado, `email_verified=true` (o pagamento já valida o e-mail)
   e `role='user'`.
2. **WorkspaceUser** —
   - Sem match → cria um novo `workspaces` (slug = `local-part-XXXXXX`,
     status `active`, plano vindo do payload) + `workspace_users` com
     `role='owner'` e `better_auth_user_id` linkado.
   - Match com `better_auth_user_id` nulo → atualiza para apontar para o
     Better Auth user.
   - Match com plano diferente → faz upgrade da `workspaces.plan` e
     registra `workspace.plan_changed` no audit log.
3. **Magic-link** — insere uma `auth.verification` row
   (`identifier=<token>`, `value=JSON{email,name}`, `expires_at=NOW()+24h`)
   e envia o link `${ADMIN_URL}/api/auth/magic-link/verify?token=<token>`
   via Resend.
4. **Audit log** — uma row `payment.processed` com `transaction_id`,
   `plan`, `amount_cents`, `currency`, `provisioned` (`new|linked|upgraded|noop`).

> **Por que inserir direto em `auth.verification`?** O JS API do Better Auth
> não é alcançável do Rails (processo + runtime diferentes). Reproduzimos
> exatamente o contrato do schema usado pelo plugin `magic-link`
> (`apps/admin/src/lib/auth.ts`).

## 5. Teste com `curl`

```bash
SECRET="$PAYMENT_WEBHOOK_SECRET"
BODY=$(cat <<'JSON'
{
  "transaction_id": "ext_tx_test_001",
  "event": "payment.succeeded",
  "buyer": { "email": "qa@univerreviews.com", "name": "QA Tester", "country": "BR" },
  "plan": "entry",
  "amount_cents": 19900,
  "currency": "BRL",
  "occurred_at": "2026-05-28T17:00:00Z"
}
JSON
)

SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -r | awk '{print $1}')

curl -i \
  -X POST "https://api.univerreviews.com/api/v1/webhooks/payment" \
  -H "Content-Type: application/json" \
  -H "X-Payment-Signature: sha256=$SIG" \
  --data "$BODY"
```

Esperado em primeiro recebimento:

```
HTTP/2 200
content-type: application/json

{"ok":true,"idempotent":false}
```

Repetir o mesmo `curl` (com mesma `transaction_id`):

```
HTTP/2 200
content-type: application/json

{"ok":true,"idempotent":true}
```

## 6. Configuração do servidor

Defina no Coolify (ou outro orquestrador):

```
PAYMENT_WEBHOOK_SECRET=<openssl rand -hex 32>
```

Sem essa variável o endpoint devolve `503 Service Unavailable` em
qualquer ambiente. Isso é deliberado — **fail-closed** é a postura padrão
de webhooks neste codebase.

## 7. Erros operacionais

| Sintoma | Causa provável | Onde olhar |
|---|---|---|
| 401 toda hora | Secret diferente entre provedor e servidor | `ENV['PAYMENT_WEBHOOK_SECRET']` + dashboard do provedor |
| 503 | Secret não configurado | Coolify env vars |
| 422 `invalid_plan:*` | Provedor enviou um plano fora de `entry/medium/ultra` | Mapping no provedor |
| 5xx repetidos | Erro inesperado durante provisionamento | `payment_events.error` da row mais recente |

`grep "[payment-webhook] tx=<transaction_id>"` no log Rails reconstrói o
ciclo de vida de uma transação específica (logamos o `transaction_id`,
nunca o e-mail, para diagnóstico amigo de grep sem vazar PII).
