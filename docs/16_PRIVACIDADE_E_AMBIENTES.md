# Privacidade e ambientes — 24/10/2026

## Endereços e isolamento

| Ambiente | Endereço | Banco | Acesso |
|---|---|---|---|
| Demonstração | https://siga.emisiu1401.workers.dev | `siga` | Público, dados fictícios, somente leitura |
| Privado | https://siga-private.emisiu1401.workers.dev | `siga-private` | Cloudflare Access + MFA + cadastro ativo + papéis do SIGA |

O código continua público em https://github.com/emisiu1401-hash/SIGA. E-mails autorizados, tokens, banco privado, backups e configurações locais não são publicados no repositório. Os identificadores de banco e a audiência Access no código são identificadores públicos, não credenciais.

A demonstração rejeita todos os métodos de gravação, inclusive login, inicialização, cadastro e token. Cookies antigos não concedem permissões. As senhas e a chave de sessão antigas foram removidas do Worker público. Não há agendamentos ou integrações reais nele. Configuração acidental de IA/Gmail real torna a demonstração indisponível em vez de executar a integração.

Cada banco tem um marcador `app_settings.deployment_identity`. O Worker verifica esse marcador antes de servir dados: trocar a configuração do Worker público para o banco privado resulta em bloqueio. Um ambiente sem modo explícito também é bloqueado. O modo de desenvolvimento só atende URLs de loopback.

## Primeiro acesso privado

1. Abra o endereço privado. A Cloudflare solicitará o e-mail autorizado e um código de autenticação.
2. Cadastre seu segundo fator pessoal (autenticador TOTP, chave de segurança ou biometria) quando solicitado. O segundo fator é obrigatório na política; o Codex não cadastrou um fator em seu nome.
3. A identidade aprovada é vinculada ao cadastro ativo do titular, com GESTOR, EXECUTOR e ADMIN. O cadastro inicial do gestor mantém o identificador `u-gestor`, preservando a regra de encerramento exclusivo por Emerson. Sua lotação não foi presumida.
4. O banco privado começa sem demandas e sem pessoas de demonstração. Cadastre a equipe pelo painel antes de atribuir atividades.

O e-mail autorizado e as instruções pessoais estão no guia **local e ignorado pelo Git** `.local/ACESSO_SIGA_PRIVADO.md`. A autorização inicial usa o e-mail da conta Cloudflare conectada; ela não concede acesso ao Gmail do usuário.

O Access protege o Worker inteiro, inclusive eventuais outros hostnames. As URLs de preview estão desativadas. O servidor também verifica assinatura RS256, emissor, audiência e expiração do JWT Access e confere a lista privada `ACCESS_ALLOWED_EMAILS`. Um cabeçalho de e-mail forjado ou uma senha de demonstração não autentica o usuário.

Papéis e situação ativa são consultados em cada requisição. Access não transforma leitores em administradores. Mutações continuam sujeitas a Origin, CSRF e políticas determinísticas do domínio. O simulador de identidades e a inicialização fictícia são bloqueados no privado. Sair encaminha para o logout do Access.

## Token de IA e Gmail

Preferência para token permanente: no Worker **siga-private**, cadastrar `AI_API_KEY` em Cloudflare Secrets. Nunca colocar valores reais em `wrangler*.jsonc`, `.env*.example`, JavaScript público, README, issues ou commits.

Alternativa pelo painel privado: Configurações → Token da API → Salvar. O servidor armazena apenas ciphertext AES-GCM com IV aleatório e `keyVersion=2`. A chave `SECRET_ENCRYPTION_KEY` fica em Cloudflare Secrets, separada de `SESSION_SECRET`. GETs não devolvem o token; o campo é limpo após salvar. `AI_API_KEY` no cofre tem precedência sobre o token do painel.

IA e Gmail permanecem desativados: `SIMULATION_MODE=true`, `AI_PROVIDER=mock`, `EMAIL_SEND_ENABLED=false`; nenhum agendamento no privado. Cadastrar um token não ativa consumo de IA nem envio. Para uso real, concluir e aprovar a integração conforme `14_OPERACAO_DA_APLICACAO.md`. Não confundir o modo das integrações com a classificação dos dados: o banco privado pode conter dados pessoais mesmo com integrações desativadas.

Gmail exige OAuth próprio da aplicação, caixa expressamente autorizada e escopos mínimos. Guardar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` e `MAILBOX_ID` como Secrets no Worker privado. O conector desta conversa não transfere suas credenciais ao Worker.

Quando ativada, a IA recebe o texto selecionado para análise. O provedor contratado passa a ser um destinatário desse conteúdo; limitar a informação enviada e avaliar a política institucional antes de ativar.

## Administração e rotação

- Adicionar pessoa: cadastro ativo no SIGA, permissão explícita na política Access e inclusão no Secret `ACCESS_ALLOWED_EMAILS`. As três condições são necessárias. Nunca liberar todo um domínio por conveniência.
- Remover pessoa: desativar cadastro, remover autorização/lista e revogar suas sessões no Access. Uma requisição nova já consulta o cadastro atual.
- Rotacionar `AI_API_KEY`: substituir no cofre; revogar o anterior no provedor. Para token do painel, salvar o novo token e revogar o antigo.
- `SECRET_ENCRYPTION_KEY`: manter backup protegido. Para trocar a chave, ter o token disponível para recadastramento ou utilizar `AI_API_KEY`. Trocar somente a chave torna ciphertext antigo ilegível. Rotação de `SESSION_SECRET` é independente dos novos tokens criptografados.
- A autenticação privada é do Access. Trocar `SESSION_SECRET` não revoga sessões Access; usar a revogação no Access.

Somente administradores autorizados da Cloudflare devem gerenciar Secrets/D1/Access. Quem administra a infraestrutura ou compromete essas contas pode acessar dados; repositório público e criptografia de token não eliminam esse limite de confiança.

## Logs, backups e prevenção de publicação

Persistência de logs de execução desativada no Worker privado; auditoria negocial permanece no D1 privado. Não registrar corpos, tokens ou respostas integrais dos provedores. Backups/exportações contêm dados pessoais: guardar somente em armazenamento privado e criptografado, com retenção definida pelo responsável. Arquivos locais ignorados pelo Git não são automaticamente criptografados.

O snapshot inicial de 24/10/2026 foi exportado e restaurado em SQLite isolado: integridade e chaves estrangeiras válidas, dois registros técnicos/de usuário, três papéis e zero demandas. O snapshot e a cópia das chaves foram então criptografados com Windows DPAPI e a decifragem foi conferida byte a byte. Arquivos: `.local/private-backup-2026-10-24.sql.dpapi` e `.local/private-secrets.json.dpapi`. Cópias intermediárias em texto puro foram removidas. A recuperação DPAPI depende da mesma conta Windows e deste computador; isso não substitui um backup institucional independente. Não foi criada rotina automática de backup nem definida retenção institucional.

A caixa de saída privada usa o registro técnico desativado `private-mailbox`, separado da caixa fictícia do demo; `OUTBOX_MAILBOX_ID` liga a fila ao registro correto. Seu endereço de configuração pendente termina em `.invalid` e não corresponde a uma caixa real. A conexão de envio continua desativada e exige a configuração/homologação do Gmail.

GitHub Secret Scanning e Push Protection foram habilitados. A CI executa `pnpm security:secrets`; a guarda local `.githooks/pre-commit` verifica conteúdo versionado e o index, sem imprimir valores. A guarda foi ativada neste checkout com `git config core.hooksPath .githooks`. Em outros clones, repetir esse comando. Padrões automáticos não detectam todo segredo possível; revisar o diff antes de publicar.

Os modelos `.env.example` e `.env.private.example` contêm apenas nomes/campos vazios. `.dev.vars`, `.local`, `.wrangler` e arquivos `.env` reais são ignorados. Não usar `git add -f` para esses arquivos.

Um endereço institucional constava no pacote original e em commits anteriores. Ele foi substituído por exemplo fictício na versão atual. Isso não apaga o histórico ou cópias já feitas. Não houve reescrita de histórico. Se um token for publicado, revogá-lo imediatamente; apagar o arquivo não é revogação.

## Publicar e validar

```sh
pnpm build
pnpm check
pnpm test
pnpm test:e2e
pnpm test:e2e:private
pnpm security:secrets
pnpm exec wrangler deploy --dry-run --config wrangler.private.jsonc
pnpm deploy:private
```

Autenticar Wrangler na conta correta antes de publicar pela CLI. A implantação desta entrega usou o conector Cloudflare, sem criar token adicional. `wrangler.jsonc` publica a demonstração; `wrangler.private.jsonc` publica o privado. Não trocar bancos entre eles. Preservar Secrets no deploy.

`test:e2e:private` usa uma borda Access fictícia, assinada com chave efêmera, servidor somente em loopback e banco em memória. Essa fixture não integra o bundle de produção. Não injeta identidade fictícia no Worker publicado. A autenticação com o e-mail e o fator pessoal do titular depende de seu primeiro acesso; os testes automatizados não declaram esse acesso concluído.

## Referências oficiais

- [Cloudflare Access para Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
- [Segredos de Workers](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Revogação de credenciais publicadas](https://docs.github.com/en/code-security/tutorials/remediate-leaked-secrets/remediating-a-leaked-secret)
