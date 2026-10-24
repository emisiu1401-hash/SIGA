# 10 — Referências oficiais para consulta pelo Codex

Verificar a versão corrente das APIs, autenticação, limites e preços antes de implementação/produção. Estes links são orientação técnica, não substituem aprovação institucional.

## Gmail API

- Listagem e paginação de mensagens: https://developers.google.com/workspace/gmail/api/guides/list-messages
- Sincronização inicial, parcial e 404 de `historyId`: https://developers.google.com/workspace/gmail/api/guides/sync
- Histórico incremental: https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.history/list
- Envio de e-mails: https://developers.google.com/workspace/gmail/api/guides/sending
- Threads, `threadId`, `In-Reply-To` e `References`: https://developers.google.com/workspace/gmail/api/guides/threads
- Notificações push opcionais: https://developers.google.com/workspace/gmail/api/guides/push
- Escopos OAuth: https://developers.google.com/workspace/gmail/api/auth/scopes

## Cloudflare

- Workers e Cron Triggers (UTC): https://developers.cloudflare.com/workers/configuration/cron-triggers/
- D1 e migrações: https://developers.cloudflare.com/d1/reference/migrations/
- Workflows duráveis e aprovações: https://developers.cloudflare.com/workflows/
- Workers AI e saída JSON: https://developers.cloudflare.com/workers-ai/features/json-mode/
- Secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Cloudflare Queues: https://developers.cloudflare.com/queues/

## Observações técnicas

- Gmail `history.list` não é arquivo histórico infinito. Pode perder disponibilidade de cursor e precisar ressincronização idempotente.
- Gmail push exige Pub/Sub, `watch` periódico e tratamento de notificação perdida; não é pré-requisito do MVP.
- Workers AI oferece formatos estruturados em modelos compatíveis, mas **não garante toda saída válida**: validar JSON e os estados em código e aceitar falhas sem mutação.
- Cron Triggers executam em UTC; cron pode falhar/repetir, e deve ser protegido por idempotência.
