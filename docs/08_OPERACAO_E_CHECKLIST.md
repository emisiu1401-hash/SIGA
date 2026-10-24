# 08 — Operação, segurança, monitoração e checklist de implantação

## Teste em sandbox (sem dados reais)

- [ ] `SIMULATION_MODE=true` e `EMAIL_PROVIDER=mock`, `AI_PROVIDER=mock` por padrão.
- [ ] Bloqueio efetivo de rede para Gmail, IA externa e envio em ambiente de teste.
- [ ] Arquivo de dados sintéticos, banco local migrado, relógio fixo em 2026-10-23.
- [ ] Executor CLI/API que mostre e-mails recebidos/enviados, estados, decisões e eventos após cada etapa.
- [ ] Testes negativos: e-mails externos/forjados, duplicados, opções fora de contexto, ataques de prompt, corridas de decisão.
- [ ] Atualização de `docs/09_REGISTRO_DE_EVOLUCAO.md` com resultados reais.

## Checklist de preparação de piloto institucional (não autoriza implantação)

- [ ] Aprovação da DTI / Administração para uso de Cloudflare e serviços de IA com dados do TJMSP.
- [ ] Política de segurança, privacidade e retenção estabelecida e publicada internamente.
- [ ] Caixa Gmail específica autorizada, sem acesso indiscriminado a caixas pessoais.
- [ ] Projeto Google Cloud habilitado, configuração OAuth/grant aprovado, escopos mínimos e credenciais secretas.
- [ ] Política de envio do e-mail institucional e proteção contra spoofing/auto-loop aprovada.
- [ ] Gestor cadastrado e autenticado; papéis de executor, gestor, SDG, admin configurados com mínimo privilégio.
- [ ] Mecanismo de auditoria protegido contra edição ordinária; políticas de backup e restauração testadas.
- [ ] Filtros anti-duplicata, cursor Gmail, `history.list` e recuperação de 404 testados com caixa de teste.
- [ ] Envio de e-mails bloqueado até ativação explícita do modo produção.
- [ ] Limites e custos de Cloudflare Workers/D1/Workers AI/Cron e Gmail conferidos na modalidade contratada.
- [ ] Capacidade operacional de triagem, falhas e supervisão humana dimensionada.
- [ ] Implementação do monitoramento D-2 com calendário em horário de São Paulo, feriados e expediente definidos.
- [ ] Plano de rollback e mecanismo de desativação rápida da leitura e do envio.

## Monitoramento operacional

Indicadores técnicos: `last_successful_sync_at`, `sync_lag_minutes`, `incoming_unprocessed`, `quarantine_count`, `AI_validation_error_rate`, `outbox_pending_age`, `notification_duplicate_prevented`, `request_waiting_manager`, `approval_rejected_as_stale`, `job_failure_count`.

Alarmes: sincronização interrompida, fila de saída presa, falhas repetidas de interpretação, alto número de mensagens sem correlação, autenticação expirada e mudança não autorizada rejeitada. Não inserir corpos completos de e-mails em logs de sistema.

## Recuperação e segurança de reprocessamento

1. Falha de Gmail: manter cursor anterior enquanto lote não persistir; retry com backoff; se cursor expirar, reconciliar mensagens já vistas antes de continuar.
2. Falha de IA: manter e-mail `REVISAO` ou `ERRO`, preservando entrada; pode ser reprocessado com mesmo ID após intervenção.
3. Falha de envio: preservar outbox e chave de deduplicação; prevenir envio duplicado em tentativas concorrentes e registrar confirmação do fornecedor.
4. Falha de cron: reexecutar; chave de notificação única evita duplicidade.
5. Mudança concorrente: checar versão, rejeitar solicitação obsoleta, solicitar nova decisão com estados atualizados.
6. Contato não identificado: manter pendência de triagem; **nunca** criar e-mail por suposição.
7. Anexos ou número de processo: preservar relato, verificar apenas por integração específica e autorizada. Sem tal integração, status `DECLARADO`/`NÃO_VERIFICADO`.
