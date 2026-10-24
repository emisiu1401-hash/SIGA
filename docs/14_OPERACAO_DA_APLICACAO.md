# Operação — 24/10/2026

> **Atualização de privacidade:** o ambiente público abaixo tornou-se somente consulta, sem senhas, tokens ou cron. O uso real foi separado em `siga-private`, protegido por Access e MFA, com banco próprio vazio de demandas. A configuração atual e as instruções de acesso/rotação estão em [16_PRIVACIDADE_E_AMBIENTES.md](16_PRIVACIDADE_E_AMBIENTES.md). As contas e a criptografia derivada de sessão descritas a seguir registram a primeira demonstração; não se aplicam ao novo ambiente privado. Novos tokens do painel usam `SECRET_ENCRYPTION_KEY` independente.

## Acesso e ambiente

Aplicação: https://siga.emisiu1401.workers.dev. Repositório: https://github.com/emisiu1401-hash/SIGA. Worker e D1: `siga`.

Flags publicadas: `SIMULATION_MODE=true`, `PUBLIC_DEMO=true`, `AI_PROVIDER=mock`, `EMAIL_SEND_ENABLED=false`. Senhas/chave de sessão estão em Cloudflare Secrets, com cópia local privada em `.dev.vars`. O guia `.local/ACESSO_SIGA.md` contém as contas fornecidas e está ignorado pelo Git.

Consulta pública exige **ambas** as flags de simulação/demonstração. Mutações exigem sessão ativa, origem correta, CSRF e autorização de domínio. ADMIN não é GESTOR. As contas fornecidas são de demonstração; autenticação individual/SSO precisa de implantação institucional.

## IA

Entrar como Administrador → Configurações → inserir token OpenAI → Salvar. A API criptografa o token com AES-GCM/IV aleatório, usando chave derivada de `SESSION_SECRET`, e armazena somente ciphertext no D1. Nenhum GET retorna o segredo. Alternativa: Cloudflare Secret `AI_API_KEY`, que tem precedência.

`AI_MODEL` configura o modelo; o endpoint é fixo para OpenAI. Tokens de outros fornecedores exigem adaptador correspondente. Em simulação, o motor continua local. Ativação real exige `AI_PROVIDER=openai`, `SIMULATION_MODE=false`, credenciais e aprovação institucional. `POST /api/interpret` autenticado extrai propostas sem executar mudanças. A fila real do Gmail também pode anexar propostas de extração validadas pelo schema.

Rotacionar `SESSION_SECRET` invalida sessões e impede ler tokens antigos criptografados. Reapresentar o token ou usar `AI_API_KEY`. Nunca colocar segredos em variáveis públicas ou no Git.

## Gmail

A conta institucional do conector foi identificada sem ler mensagens e sem enviar e-mails. A autorização desse conector pertence à conversa, não ao Worker.

Para a aplicação, configurar projeto Google Cloud com Gmail API, cliente/consentimento OAuth e refresh token offline para a caixa aprovada. Configurar Secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` e `MAILBOX_ID` com a caixa exata. Solicitar os escopos mínimos de leitura; envio somente se ativado. A [documentação oficial de sincronização](https://developers.google.com/workspace/gmail/api/guides/sync) descreve histórico e recuperação.

Primeira coleta verifica `profile.emailAddress` e registra marco do histórico, sem importar acervo anterior em massa. Depois pagina histórico; cursor expirado usa reconciliação limitada à janela registrada, com deduplicação. Falhas temporárias preservam cursor. Mensagem excessiva/JSON inválido recebe revisão durável e não impede as seguintes.

**Fluxo real atual:** Gmail → texto novo → classificação/autenticidade → proposta de IA opcional → revisão. Em Correspondência, Emerson pode registrar triagem expressa/idempotente. Pedidos e aprovações por e-mail real exigem corroboração e ação humana no painel. O fluxo natural por menus é exercitado no simulador. From, DKIM ou código isolado nunca concedem autorização.

Envio exige `SIMULATION_MODE=false` e `EMAIL_SEND_ENABLED=true`. Mensagens novas para destinatários reais entram em PENDENTE; endereços `.test`/`.invalid` continuam SIMULADO. O dispatcher reclama a mensagem antes da chamada; confirmação incerta não é reenviada automaticamente. Reconciliar `Message-ID` antes de retentar. Threading com `threadId`, `In-Reply-To`/`References` e autenticação institucional de decisões ainda precisam de integração/homologação; o sender atual cria mensagens independentes.

## Regras e rotina

Somente Emerson decide prazos, prioridade, transferência e encerramento. Declaração de conclusão abre validação. Transferência só muda dono/seção após aceite. Snapshots históricos permanecem na seção da época.

D-2 usa dias corridos com antecipação de fins de semana. A função aceita feriados; cadastro institucional do calendário ainda precisa de evolução. Timestamps UTC, negócio America/Sao_Paulo. SEI exige HTTPS e host exato em `SEI_ALLOWED_HOSTS`; número não gera URL e o aplicativo não altera o SEI.

Agendamentos publicados: a cada 15 minutos e diariamente às 12h UTC. Handlers têm idempotência e lote limitado de avisos elegíveis. UI atualiza resumo a cada 60 segundos quando visível; isso não significa Gmail em tempo real.

## Migrações e publicação

0001–0003 originais preservadas. 0004 adiciona agregados, trava de versão, comandos, revisão e segurança. As quatro foram aplicadas no SQLite de testes e no D1; `d1_migrations` registra os nomes.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm check
pnpm test
pnpm exec wrangler deploy --dry-run
pnpm exec wrangler d1 migrations apply siga --remote
pnpm deploy
```

Autenticar Wrangler na conta correta. O deploy inicial usou o conector Cloudflare sem criar token adicional. Antes de dados reais/mudanças, exportar snapshot privado com `wrangler d1 export siga --remote --output <arquivo-privado.sql>`, registrar versão do Worker e validar restauração em banco separado. Backup/restauração institucional não foi executado nesta entrega.

Antes do piloto: concluir OAuth/respostas/identidade Gmail, autenticação individual, escopo institucional do SDG, retenção/anexos, calendário e backup restaurado. Desativar consulta pública antes de inserir dados reais. Esta entrega não declara homologação institucional ou certificação WCAG.
