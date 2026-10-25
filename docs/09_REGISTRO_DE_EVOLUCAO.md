# Atualização de implementação — 24/10/2026

## Correção de denominação institucional — 24/10/2026

- Pedido expresso do titular: substituir o cabeçalho comum das telas por `DIRETORIA DE ADMINISTRAÇÃO, ORÇAMENTO E FINANÇAS`.
- Alteração restrita ao texto em `public/index.html`, compartilhado pelos módulos do sistema. Sem mudança de dados ou regras.
- Validação: build, formato do HTML e seis testes existentes de navegação/responsividade (360/390/768/1024/1366/1920 px). Publicação preserva configurações e Secrets remotos.

## Cadastro e estatísticas da DAO — 24/10/2026

- Autorização: titular solicitou atualizar sua lotação de Não classificada para DAO e incluir as estatísticas dessa área, pois também pode executar demandas.
- Migration aditiva `0009_dao_department.sql` cadastra DAO como unidade executora própria. O consolidado de todas as áreas continua separado desse recorte; cada demanda conta uma vez.
- Atualização administrativa do titular no ambiente privado: lotação DAO, revisão incrementada, ativo e papéis ADMIN/EXECUTOR/GESTOR preservados. Histórico de lotação e `PERSON_UPDATED` registram autor, UTC, antes/depois e motivo. Nenhuma alteração de senha, e-mail, atribuição ou encerramento.
- DAO incluída na validação de cadastro, filtro, gráficos, cartão da área, exportações e instruções/lista do template Excel. Estatísticas seguem as mesmas definições das outras unidades. Propostas entram na unidade responsável após aceite; alteração cadastral não reescreve snapshots ou demandas antigas.
- Arquivos: `src/repository.ts`, `src/spreadsheets.ts`, `public/app.js`, `public/index.html`, template Excel, migration, testes de domínio/privacidade e fixture privada.
- Validação local: build, TypeScript, 84 testes Node/SQLite, 11 e2e gerais, 9 e2e privados, formato, verificações de segredos e três validadores Python passaram. Caso DAO cobre cadastro, autoatribuição com justificativa/prazo, aceite, recorte DAO+titular, contagem sem duplicação e preservação histórica. Navegador: 360/390/768/1024/1366/1920 px, sem erros de página ou overflow geral; Browser plugin ausente, usado Playwright/Chrome.
- Template Excel editado com artifact-tool; comparação preserva dados e colunas das três abas, acrescentando DAO às instruções e validação de seção. Evidências locais de tela e planilha em pasta de visualizações da conversa, subpasta `dao`.
- Publicação autorizada pelo pedido de atualização do sistema. Preservar as variáveis, Secrets e agendamentos remotos atuais, inclusive alterações de Gmail feitas pelo titular. Este incremento não lê nem envia e-mails, não ativa IA e não declara homologação institucional.


O estado abaixo substitui o registro inicial de 23/10, preservado como histórico mais adiante.

- Autorização: pedido direto do responsável para ler a pasta, criar o projeto completo, publicar repositório público SIGA e usar GitHub/Gmail/Cloudflare; não houve pedidos de aceite por incremento.
- INC-00 a INC-09: implementados os fluxos de domínio, simulador, persistência e painel descritos no README; aceites institucionais permanecem pendentes.
- INC-10: adaptador Gmail e fila de revisão preparados; perfil do conector identificado; OAuth do Worker ausente. Nenhuma leitura/envio real de mensagem. Respostas de aprovação reais dependem de corroboração humana e threading adicional.
- INC-11: autenticação/RBAC/CSRF, auditoria, controle de versão/idempotência e revisão de segurança executados. Piloto institucional, SSO, retenção e restauração de backup não homologados.
- Código: src/, public/, scripts/, migration aditiva 0004; migrations recebidas preservadas; testes de produto em tests/app e tests/e2e.
- Execução: build, TypeScript, 30 testes Node/SQLite, 9 e2e locais e 8 e2e de consulta no deploy; 3 validadores recebidos e teste de protótipo em 6 larguras. Detalhes em docs/15_VALIDACAO_E_LIMITES.md.
- Segurança: candidato de bloqueio Gmail por mensagem grande corrigido; parser limitado antes da limpeza; snapshots de auditoria imutáveis; restrição de atribuição efetiva; zero advisories após correção transitiva de undici.
- Infraestrutura: Worker siga e D1 siga em Cloudflare; quatro migrations aplicadas e agendamentos registrados. Demo em https://siga.emisiu1401.workers.dev.
- GitHub público: https://github.com/emisiu1401-hash/SIGA. Senhas e tokens fora do Git.
- IA: token pode ser configurado no painel ADMIN com criptografia, ou como Cloudflare Secret. Sem consumo pago em simulação.
- Evidências: .local/evidence e .local/prototype-evidence; relatório de segurança do Codex em armazenamento próprio da ferramenta.
- Aceite expresso de produto/homologação institucional: NÃO declarado.

---

## Registro original de preparação (23/10/2026)

# 09 — Progresso e decisões do Codex (atualização obrigatória)

**Atualizado em:** 23/10/2026  
**Status:** especificação e contratos escritos; nenhuma funcionalidade implementada  
**Ambiente de operação real:** não autorizado / não configurado  
**Próximo trabalho:** Incremento 0 (somente mock)

| Incremento | Estado | Evidência de execução | Aceite do responsável |
|---|---|---|---|
| INC-00 Fundação e simulador | NÃO INICIADO | — | PENDENTE |
| INC-01 Triagem | NÃO INICIADO | — | PENDENTE |
| INC-02 Responsáveis e prazo | NÃO INICIADO | — | PENDENTE |
| INC-03 Menus e e-mails simulados | NÃO INICIADO | — | PENDENTE |
| INC-04 IA estruturada | NÃO INICIADO | — | PENDENTE |
| INC-05 Prorrogações e aprovações | NÃO INICIADO | — | PENDENTE |
| INC-06 Agendamento | NÃO INICIADO | — | PENDENTE |
| INC-07 Transferências e conclusão parcial | NÃO INICIADO | — | PENDENTE |
| INC-08 Validação e filha | NÃO INICIADO | — | PENDENTE |
| INC-09 Dashboard | NÃO INICIADO | — | PENDENTE |
| INC-10 Gmail real autorizado | BLOQUEADO POR AUTORIZAÇÃO | — | PENDENTE |
| INC-11 Piloto institucional | BLOQUEADO POR AUTORIZAÇÃO | — | PENDENTE |

## Registro de execução por incremento

### Documentação personalizada e diagnóstico operacional — 24/10/2026

- Pedido: guia no sistema para repetir a configuração/troca da conta Google, com troubleshooting baseado na implantação. Titular informou conexão concluída; leitura de metadados do D1 confirmou uma conexão pausada, sem ler a caixa.
- Entrega: `documentacao.html/css/js`, menu lateral, atalho em Configurações e tela de entrada; retornos OAuth abrem a orientação correspondente. Guia cobre troca, pausa/ativação, histórico/fila, Gmail API, testadores, callback, Secrets Produção/Prévias, MFA, cookies, marca, usuários e revisão humana de novas demandas.
- Diagnóstico: consulta as APIs existentes com papel da sessão, sem ações de integração; relatório copiável por allowlist exclui dados pessoais/credenciais. Demonstração não consulta o privado; sessão inválida/perfil sem autorização continuam com texto do guia e sem configurações.
- Validação: build, TypeScript, formato e 83 testes de aplicação passaram; oito fluxos privados passaram. Os nove cenários gerais existentes passaram; páginas públicas e novo cenário da documentação passaram em execução direcionada após adequar a fixture ao modo demo (servidor geral local usa desenvolvimento). Busca, atalhos, cópia/fallback, estados, perfis, ausência de ações/rede externa, seis larguras e axe cobertos. Browser plugin especializado ausente; usado Playwright/Chrome com fixtures locais. Nenhuma alteração de schema, conta, senha, envio ou modo das integrações.
- Publicação: dois Workers com etag `879f7c3ed96a4a9ad327e3c837953011a52abb218bb4ffb5e4a0f2cc5862658e`. HTML/CSS/JS publicados conferidos com os arquivos locais; guia privado continua protegido por Access. Guia público exercitado em Chrome com solução por código aberta/focada, sem overflow, erro JS ou consulta de configurações privadas. Cinco Secrets privados, zero públicos, simulação/IA mock/envio desativado e arquivo Search Console preservados. Capturas locais e publicadas em `documentacao` no diretório externo de evidências.

### Correção da chamada HTTP OAuth no Cloudflare — 24/10/2026

- Evidência: referência fornecida pelo titular localizada na auditoria com etapa `exchange`, classe `TypeError`, antes do limite de 15 segundos. O código usava `redirect: "error"`, rejeitado pelo workerd na construção da chamada. Incompatibilidade reproduzida localmente usando HTTP nativo do runtime, antes da resposta do provedor fictício.
- Correção: nove chamadas em `gmailAccounts.ts`, `gmail.ts` e `interpreter.ts` usam `redirect: "manual"`; validações existentes rejeitam respostas não-2xx. Portanto, redirecionamentos continuam bloqueados, sem encaminhar credenciais para o destino recebido em Location. Inclui autorização, renovação, perfil, sincronização, envio, recuperação de senha e IA.
- Lacuna de teste corrigida: removido o mock de `globalThis.fetch` do Worker de teste. As respostas são interceptadas pelo serviço de saída do Miniflare depois da validação HTTP nativa, sem rede externa. O teste falhou com a versão anterior (503 em vez de 200) e passou após a mudança.
- Cobertura: primeira conexão, reconexão, Gmail API desativada, indisponibilidade, renovação, sincronização, envio/recuperação e IA fictícios; 3xx em token, perfil, renovação, envio e IA são rejeitados sem visitar o destino arbitrário. Mantidos PKCE/state/sessão/criptografia/RBAC e políticas de revisão humana.
- Verificação: build, TypeScript, formato, 83 testes de aplicação e seis fluxos privados de navegador passaram. Nenhuma alteração de schema, credenciais, dados institucionais ou ativação das integrações; nenhum e-mail real ou IA paga usados.
- Publicação: dois Workers atualizados com etag `173c5992d555b3c88746a3e1f01a5d61096f41b0a52b7706721b7ef1c2076bf7`. Configuração remota preservada; cinco Secrets privados e zero públicos, Access/senha, simulação, envio desativado e IA mock conferidos. Arquivo Search Console continua idêntico/HTTP 200; página/API/callback privados redirecionam ao Access sem identidade. Conclusão OAuth pessoal permanece necessária para confirmar a caixa real.

### Arquivo de propriedade Google Search Console — 24/10/2026

- Pedido: publicar o HTML fornecido pelo titular na raiz do site público. Nome original do download com sufixo local `(1)`; publicado como `google7a0e37e960389c87.html`, conforme o identificador dentro do arquivo.
- Arquivo copiado sem alteração de bytes para `public/`; exceção explícita em `.prettierignore` preserva o conteúdo recebido. Marcador público de verificação de site, sem credenciais OAuth.
- Publicação somente no Worker de demonstração, preservando configurações remotas. HTTP 200 sem redirecionamento/autenticação; 53 bytes idênticos ao original (SHA-256 `46f87d8cdae86c705846e6f089d2c9d8eafd3a1c2d3b8dd66ecbc72887710d69`). Build e formato passaram. Sem alteração de autenticação, banco ou integrações; nenhuma suíte nova para este arquivo estático.
- Próximo passo humano: clicar em Verificar no Search Console; após confirmação, aguardar as 24 horas pedidas pelo Google antes de reenviar a marca. Publicar o arquivo não equivale a aprovação da marca ou dos escopos OAuth.

### Diagnóstico seguro do retorno OAuth Gmail — 24/10/2026

- Relato: uma tentativa completou o consentimento e falhou dentro do SIGA; outra exibiu erro 500 do próprio Google. Auditoria confirmou callbacks com `GMAIL_OAUTH_FAILED`, antes sem etapa ou classe. Sem logs históricos adicionais, a causa original permanece indeterminada; não atribuída por presunção a indisponibilidade Google.
- Mudança: respostas Google limitadas e validadas; classificação de cliente recusado, código expirado, API desativada, indisponibilidade, rede, resposta, criptografia e persistência. Falhas ganham evento de auditoria com etapa/categoria fixa, sem mensagens/stack/payloads/credenciais. Página mantém orientação e referência do pedido em Configurações; parâmetros transitórios removidos da URL.
- Preservação: PKCE, state/cookie/sessão, uso único, escopos, verificação da conta, criptografia e transação mantidos. Falhas apagam o verificador temporário, liberam a trava e preservam a conta anterior. Nenhuma migração ou ativação das integrações reais.
- Testes: 83 testes Node/SQLite passaram, incluindo novo teste no workerd/D1 (primeira conexão, reconexão, API desativada e rede). Casos de erro cobrem também HTML, JSON inválido/nulo, credenciais, consentimento, criptografia e persistência, sem mensagens reais. TypeScript, formato e guarda de segredos passaram. Seis fluxos privados e dez gerais passaram em navegador; erro de API com orientação persistente, referência, conta preservada, seis larguras e axe. Capturas em `oauth-diagnostic` no diretório de evidências externo ao Git.
- Publicação autorizada: Workers público/privado atualizados com etag `39af9a6c44a81524d3e91b3e67553114ed34a1ce8244ca6c9d0f7f223a389732`. Assets públicos conferidos com o arquivo local; página/API/callback privados redirecionam ao Access sem identidade. Cinco Secrets privados preservados, nenhum público; simulação, IA mock e envio desativado conferidos após a atualização. Sem alteração de banco ou senha.
- Browser plugin especializado ausente; Playwright/Chrome com Google fictício. Nenhum consentimento pessoal, leitura de caixa real, envio ou IA paga executados pelo Codex. Próxima verificação depende de nova autorização pessoal do titular; diagnóstico anterior não pode ser reconstruído retroativamente.

### Páginas públicas de apresentação, privacidade e termos — 24/10/2026

- Solicitação: titular pediu os três endereços de Branding para passar OAuth de teste a produção; confirmou que ainda não possui domínio próprio.
- Entrega: `sobre.html`, `privacidade.html`, `termos.html` e `info.css`, com informações da implementação atual e links nos rodapés do painel/login. Publicação no Worker público de demonstração; aplicação e banco privados continuam protegidos.
- Conteúdo: finalidades, dados, permissões Gmail, limites de IA, destinatários de dados, credenciais, auditoria, revogação, retenção/exclusão e contato via administrador/suporte do consentimento. Não inventados prazos, aprovação Google/institucional ou canal público com e-mail pessoal.
- Limite de produção: domínio verificável, revisão dos documentos e procedimentos do operador, e verificação/avaliação Google conforme escopos e exceções continuam pendentes. Publicar URLs não é homologação nem substitui cadastrar usuários de teste. Guia 21 detalha os limites.
- Validação: novo fluxo Playwright cobre HTTP, CSP, links, conteúdo, ausência de rede externa, seis larguras e axe; executadas também as suítes geral e privada, build, TypeScript, formato e guarda de segredos. Capturas fora do repositório. Browser plugin especializado ausente; usados Playwright/Chrome e fixtures locais, sem login Google pessoal nem caixa real.
- Resultado local: seis fluxos privados e nove regressões gerais passaram; o novo cenário das páginas passou em execução isolada. A primeira execução paralela das duas suítes conflitou no diretório de traces; o cenário foi repetido com diretório de artefatos separado. Não houve falha funcional no conteúdo.
- Sem alteração de banco, credenciais, permissões de usuários ou modo das integrações. Deploy deve preservar a configuração remota atual, inclusive Secrets configurados pelo titular.

### Configuração Gmail compreensível — 24/10/2026

- Relato: administrador salvou token de IA, encontrou "Aguardando OAuth" e não identificou como habilitar o e-mail.
- Diagnóstico atual confirmado na Cloudflare: GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET ausentes; retorno OAuth configurado; plataforma em simulação, IA mock e envio desativado. Nenhuma caixa real conectada pelo aplicativo.
- UI: estado explícito de configuração inicial pendente, botão Configurar Gmail (passo a passo), instruções Google/Cloudflare, retorno exato com cópia, ação de reconsulta e formulário de autorização disponível apenas após os pré-requisitos. Sincronização desabilitada com explicação quando não pode operar. Token salvo também informa se o motor continua em simulação.
- Verificação: novo teste de navegador exercita guia/cópia/foco/restauração, seis larguras e axe sem chamadas externas nem alterações de conexão; captura fora do repositório. Os seis fluxos privados passaram, incluindo conexão/troca Google fictícia, senhas, quarentena e novo guia. TypeScript, formato e guarda de segredos passaram. Browser plugin especializado não disponível; usado Playwright regular com fixtures locais e Access assinado.
- Sem alteração de banco, senha, escopo OAuth ou ativação real. O titular ainda precisa criar/configurar o cliente Google e dar consentimento na conta. Credenciais não foram solicitadas na conversa; são armazenadas como Secrets na Cloudflare.

### Cookie Access e loop após MFA — 24/10/2026

- Relato: usuário concluiu inscrição no Google Authenticator e recebeu ERR_TOO_MANY_REDIRECTS ao abrir SIGA.
- Evidência: logs Access mostram logins autorizados repetidos em segundos para o aplicativo privado; configuração usava SameSite Strict. Documentação Cloudflare associa esse modo a ciclos de redirecionamento.
- Correção autorizada de infraestrutura: SameSite alterado para Lax. Resposta da API confirmou HttpOnly, audiência, destino Worker, política e MFA obrigatório preservados. Sem alteração de senha, autenticadores, código do Worker, banco ou integrações.
- Guia 19 atualizado com configuração e teste direto em sessão nova. Validação pessoal com e-mail/MFA não executada pelo agente; usuário precisa repetir entrada para confirmação ponta a ponta.

### Desbloqueio do cadastro de MFA — 24/10/2026

- Problema relatado: primeiro login parado na tela Cloudflare Access sem método MFA cadastrado.
- Diagnóstico: organização/aplicação já permitem TOTP, chave de segurança e biometria; porém não havia aplicação App Launcher. O acesso a `/AddMfaDevice` reproduziu `/NoAuth` e pedido para o administrador ativar o portal.
- Correção de infraestrutura: criada aplicação `app_launcher` com OTP e política contendo somente os mesmos e-mails exatos já autorizados no privado. Exigência de MFA e senha individual do SIGA preservadas; não houve ampliação por domínio ou bypass.
- Guia 19 atualizado com inscrição pessoal de autenticador, link direto e necessidade de manter a política do portal ao habilitar novas pessoas. Não houve coleta de código, QR ou inscrição de dispositivo pelo agente.
- Verificação: portal antes retornava `/NoAuth`; após ativação, navegador abriu login do App Launcher com campo de e-mail e envio de código. API confirmou política limitada e MFA obrigatório da aplicação preservado. Não foi solicitado código por e-mail nem concluída inscrição pelo agente.
- Não se declara concluída a autenticação pessoal: cadastro e prova do fator dependem do usuário. Sem alteração de código do Worker, banco, senhas ou integrações Gmail/IA.

### Proteção de e-mail e IA — 24/10/2026

- Autorização: responsável identificou risco de instruções/códigos em e-mails e solicitou providências contra sabotagem.
- Resultado: quarentena antes da IA; inspeção de assunto/corpo/MIME e Unicode; anexos excluídos; interpretação real sempre humana/não verificada; contrato limitado e sem ferramentas. Removido fallback de execução com revisão pendente.
- Interface/API: Correspondência sinaliza quarentena; triagem direta rejeitada; gestor reescreve pedido em formulário vazio, justifica e confirma criação apenas provisória. Reavaliação no servidor, histórico e idempotência preservados.
- Coleta: até cinco mensagens novas e duas tentativas de extração por lote; cursor preservado enquanto restar fila; mensagens inválidas isoladas sem bloquear as seguintes. Auditoria atômica inclui UTC, origem, correlação, sinais e hash da cópia limitada, sem corpo ou segredos.
- Arquivos: migration 0008, `emailSecurity.ts`, `emailReview.ts`, interpretador, Gmail, Worker, contrato JSON, UI e testes. Guia 20 e documentos atualizados.
- Validação: 80 testes Node/SQLite, 9 cenários gerais e 5 privados de navegador; ataques, saída comprometida, limites, preservação de tabelas, quarentena/reescrita, seis larguras e axe. TypeScript/formato/guarda de segredos/validadores Python/audit de produção/dry-run passaram. Backup pré-0008 criptografado e restauração em memória com integridade/FK conferidos.
- Limites: filtros não cobrem toda injeção; a barreira central é a falta de autoridade da IA e a decisão humana/determinística. Sem novo scan Codex Security selado ou homologação institucional. Nenhuma leitura/envio real ou API paga nos testes. Primeiro login pessoal com MFA continua sendo ato do usuário.
- Publicação autorizada nos ambientes existentes, mantendo demo somente consulta e privado com Access/senha. Integrações reais permanecem desativadas.

### Senhas individuais e habilitação de usuários — 24/10/2026

- Pedido: tela de senha, senhas iniciais do titular/SDG, troca, recuperação Gmail e habilitação de Executor/Gestor. E-mail do SDG fornecido diretamente na conversa e usado somente na base/configuração privadas; nenhuma identidade real nova no repositório.
- Implementação: migration 0007 com credenciais scrypt/sal individual, sessões opacas por hash, links de recuperação por hash/versão/expiração. Modo `AUTH_MODE=access_password` acrescenta senha ao Access e MFA existentes, sem aceitar senha de outro e-mail. Troca temporária obrigatória antes dos dados; troca/reset/reemissão/desativação revogam sessões e links.
- UI: tela `/login`, Esqueci minha senha, Alterar minha senha, acesso privado a partir da demonstração e painel ADMIN de Usuários e acessos. Senhas temporárias exibidas uma vez; consultas não retornam hashes. Autorização de e-mails na Cloudflare permanece explícita, independente do cadastro de perfil.
- Domínio: habilitação de gestores adicionais autorizada pelo pedido atual; permite gestão compartilhada, sem delegação de encerramento. `u-gestor` continua o único autorizador do encerramento definitivo; testes cobrem a tentativa por novo Gestor.
- Recuperação: envio Gmail separado da outbox comum para não persistir links secretos. Verifica remetente ativo, escopos/configuração e identidade Access. Cliente OAuth Google continua pendente; o formulário informa isso sem prometer entrega. Nenhum e-mail real enviado.
- Testes: 73 casos Node/SQLite; nove cenários gerais de navegador; quatro fluxos privados, incluindo novo fluxo titular/SDG, troca inicial, cadastro/habilitação, recuperação com Gmail fictício, limpeza do fragmento e logout. Seis larguras e axe na tela de senha. Corrigidos `currentTarget` após await e rolagem interna do menu com mais opções. Scrypt validado no workerd local e em Worker temporário publicado sem dados/segredos, removido após HTTP 200 (correta aceita/incorreta rejeitada).
- Backup anterior: export privado restaurado em SQLite em memória, integridade ok/FK sem erro, zero demandas; cópia DPAPI com roundtrip em `.local/private-before-passwords.sql.dpapi`. Não houve restauração sobre o banco ativo.
- Limites: login pessoal e inscrição de segundo fator dependem dos usuários. Gmail real depende de OAuth próprio e ativação; não houve teste de entrega real. O relatório Codex Security anterior não cobre automaticamente esta versão; foram realizados testes direcionados de segurança. Não é certificação WCAG nem homologação institucional.

### Troca Gmail, Excel e log — 24/10/2026

- Resultado: conta de comunicação configurável em Configurações, independente do login; troca OAuth com PKCE/state, perfil validado, pausa, filas retidas e deduplicação por caixa. Sem cliente Google configurado, o formulário explica a pendência e não inicia autorização incompleta.
- Excel: template `.xlsx` com Demandas/Pessoas/Instruções; exportação atual; upload binário limitado; validação ZIP/XML, colunas, tipos, duplicatas, versões, RBAC e SEI; prévia sem mutação; confirmação atômica/idempotente, até 100 mudanças. Responsável, prazo e encerramento mantêm os fluxos específicos.
- Auditoria: migration 0006, log append-only D1 com UTC, ator/papéis, ação/recurso, origem/resultado, correlação, status/duração HTTP; eventos transacionais de domínio, cadastro, Gmail, token e planilha. Consulta paginada e arquivo JSONL com metadados/hash. Sem corpos de e-mail ou credenciais; históricos legados preservados.
- Arquivos: migrations 0005/0006, `src/gmailAccounts.ts`, `src/xlsx.ts`, `src/spreadsheets.ts`, `src/audit.ts`, domínio/repositório/Worker/Gmail, UI/build, template público vazio e guias 17/18. Template autorado com artifact-tool, três abas renderizadas e arquivo reaberto pelo parser de produção.
- Verificação: 62 testes Node/SQLite passaram; 9 cenários gerais de navegador e 3 fluxos privados (incluindo Gmail fictício, arquivo Excel/downloads/log real de teste) passaram; seis larguras, axe e erros de página; TypeScript, Prettier, validadores Python e dry-run Wrangler. Dependências de produção sem vulnerabilidades conhecidas no `pnpm audit --prod`.
- Segurança exercitada: OAuth cancelado/trocado/expirado/escopo incorreto, concorrência entre contas, leitura/envio somente da caixa ativa, AES-GCM, CSRF/RBAC, fórmulas/macros/XXE/ZIP corrompido/expansão excessiva, rollback integral e imutabilidade/redação do log. Isto não substitui pentest institucional nem novo relatório Codex Security selado.
- Backup antes da migração: export privado restaurado em SQLite em memória, integridade `ok`, zero erros FK e zero demandas; cópia local DPAPI e roundtrip verificados. Migrations 0005/0006 aplicadas aos dois D1, com seis versões registradas e marcadores de ambiente preservados.
- Implantação autorizada: os dois ambientes permanecem separados, demo somente leitura e privado com Access. Integrações reais seguem desligadas; sem leitura/envio de e-mail, IA paga ou dados institucionais. Cliente OAuth Google, primeiro login pessoal/MFA, retenção institucional e ativação real permanecem dependências humanas explícitas.

### Privacidade e separação de ambientes — 24/10/2026

- Autorização: responsável solicitou "Implemente conforme sugerido", após proposta de manter código público e separar demonstração de uso privado.
- Resultado: demonstração somente leitura, sem Secrets e sem cron; novo Worker e D1 `siga-private`, sem demandas fictícias. Access do Worker inteiro, allowlist do titular e MFA obrigatório. Identidade verificada também no servidor; perfis continuam consultados no cadastro.
- Isolamento: marcador persistente por banco; configuração ausente/incompatível falha fechada; desenvolvimento somente em loopback; seed e simulador bloqueados no privado. Caixa de saída técnica independente e desativada.
- Credenciais: novos tokens do painel usam AES-GCM com `SECRET_ENCRYPTION_KEY` independente da sessão; Secret `AI_API_KEY` mantém precedência. Tokens não retornam em GET. Cópias locais iniciais de Secrets e backup criptografadas com Windows DPAPI, com roundtrip conferido; plaintext transitório removido.
- GitHub: Secret Scanning e Push Protection habilitados pela API. Guarda de segredos em CI e pre-commit verifica também index. Um e-mail institucional original foi substituído por exemplo na versão atual; histórico não reescrito.
- Arquivos principais: `src/privacy.ts`, `src/auth.ts`, `src/worker.ts`, `src/repository.ts`, `src/interpreter.ts`, `public/app.js`, `public/styles.css`, `wrangler.private.jsonc`, `scripts/check-secrets.mjs`, `.githooks`, testes novos de privacidade, configurações e guia 16.
- Testes: 39 testes Node/SQLite passaram; fluxo privado em navegador passou (base vazia, criação/persistência, token sem devolução, logout e acessibilidade desktop/mobile). Suíte geral local e demonstração publicada verificam seis larguras e orientação; resultados finais em `15_VALIDACAO_E_LIMITES.md`. TypeScript, formato, validações Python e dry-run passaram. Browser plugin não disponível; usados Playwright/Chrome e fixtures assinadas de Access no teste local.
- Backup: export do D1 privado restaurado em SQLite isolado; integrity_check e foreign_key_check passaram. Dois usuários técnicos/do titular, três papéis, zero demandas. Não houve restauração sobre o banco ativo.
- Limites: primeiro acesso com e-mail e fator pessoal do titular não executado por Codex; nenhuma mensagem Gmail lida/enviada e nenhuma chamada paga de IA. Sem rotina automática/retencão institucional de backup, homologação ou certificação de acessibilidade.
- Implantação externa: SIM, autorizada para os dois ambientes. Gmail/IA reais continuam desligados. Próximo passo humano: primeiro login, inscrição do segundo fator, cadastro da equipe e configuração de credenciais apenas no privado.

Copie esta seção e preencha, sem declarar sucesso por presunção:

```md
### INC-XX — AAAA-MM-DD
- Resultado negocial demonstrado:
- Código e arquivos alterados:
- Testes executados / comando / resultado:
- Cenários CA-XX cobertos:
- Evidências (logs, screenshots, saída CLI):
- Limitações ou falhas:
- Decisões tomadas e pendentes:
- Deploy externo ou envio real? (por padrão: NÃO)
- Aceite expresso do responsável? (não / data / evidência)
- Próxima menor fatia proposta:
```

## Registro inicial de documentação

- [2026-10-23] Pacote v2 derivado da simulação SIGA 01–10; foco Gmail, código de demanda, menus numéricos, decisões A/B, demanda filha e atribuição sem e-mail não presumido. **Sem código executável de produto e sem testes de execução da aplicação**. Migração SQL e esquemas são referências a serem validadas/testadas no início do desenvolvimento.

## Pacote de especificação v2.3 — 23/10/2026 (preparação, não incremento implementado)

- **Motivo:** tornar explícita a paridade desktop/tablet/celular; operacionalizar protótipo mobile, filtros recolhíveis, drawer e cartões.
- **Documentos adicionados:** `docs/13_RESPONSIVIDADE_E_TESTES_V23.md`, `INSTRUCOES_ATUALIZACAO_V23.md`.
- **Documentos atualizados:** `AGENTS.md`, `README.md`, `PROMPT_PARA_CODEX.md`, `docs/04_ROTEIRO_INCREMENTAL.md`, `docs/05_CENARIOS_DE_ACEITE.md`, `tests/TEST_PLAN.md`.
- **Protótipo atualizado:** `prototype/dashboard_sdg_demo.html`; screenshots móveis/tablet/desktop com dados fictícios.
- **Testes estruturais executados nesta preparação:** `validate_spec.py`, `validate_addendum.py`, `validate_departamentos_v22.py` passaram (SQL, contratos e documentos; não são testes de produto).
- **Teste de navegador executado nesta preparação:** `test_responsive_browser.py` passou nas larguras 360, 390, 768, 1024, 1366, 1920 px, validando KPIs, filtros, cards, menu, detalhe e ausência de rolagem horizontal geral no protótipo.
- **Limitação:** nenhuma implementação de backend, integração Gmail, IA real, deploy, teste de WCAG completo ou homologação institucional ocorreu. Os critérios de API, SEI real e paginação precisam de testes nos incrementos futuros.
- **Próximo passo:** Codex deve incorporar o adendo ao plano e continuar somente incremento autorizado, não antecipar UI nem integração real.
