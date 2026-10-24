# Validação executada — 24/10/2026

## Versão com senhas individuais

73 testes Node/SQLite passaram, incluindo hash/sal, limitação atômica de tentativas, vínculo Access/e-mail, cookies, bloqueio antes da troca temporária, revogação, recuperação Gmail controlada, token expirado/forjado/reutilizado/concorrente, SDG sem escrita e novo Gestor sem encerramento. A suíte geral de nove testes de navegador passou. Os quatro fluxos privados incluem login, troca, SDG, administração de acessos, recuperação via Gmail fictício e logout; seis larguras e axe na tela de senha. Uso do token em fragmento também foi exercitado quando a tela de login já estava aberta.

Scrypt (`N=16384,r=8,p=5`) validado no runtime workerd local e em Worker efêmero remoto sem banco ou segredos: HTTP 200, senha correta aceita, incorreta rejeitada; Worker removido após o teste. Backup privado pré-migração 0007 criptografado com DPAPI, restaurado em SQLite em memória e validado (integridade/FK ok, zero demandas). Detalhes em [19_SENHAS_E_USUARIOS.md](19_SENHAS_E_USUARIOS.md).

Gmail real ainda não foi configurado nem usado. Login com MFA pessoal e recebimento efetivo dos links não foram homologados; a API informa a pendência de configuração quando aplicável. Os testes exercitam controles específicos; não foi produzido um novo scan Codex Security selado desta versão.

## Complemento mais recente: conta Gmail, planilhas e log

62 testes Node/SQLite e 12 cenários de navegador locais passaram (9 gerais + 3 privados). Incluem troca entre contas Google fictícias, verificação de perfil/escopos/state/PKCE, cursores e filas separados, 100 cadastros por transação, conflitos/rollback/idempotência, template artifact-tool comprimido lido pelo parser de produção, arquivos hostis e log imutável/redigido com arquivo JSONL/hash conferido. Fluxo de arquivo no navegador valida o download escrito, a prévia sem mudança, a confirmação, a persistência no diretório e a auditoria com ator e correlação. Telas Planilhas/Auditoria foram verificadas nas seis larguras obrigatórias e com axe. Build/TypeScript/Prettier, três validadores Python, auditoria de dependências e dry-run Wrangler passaram.

Backup privado anterior a 0005/0006 restaurado em SQLite isolado: integrity_check ok, zero violações FK, zero demandas; DPAPI com roundtrip. As migrations foram aplicadas aos dois bancos e conferidas. Detalhes operacionais em [17_TROCA_DE_CONTA_GMAIL.md](17_TROCA_DE_CONTA_GMAIL.md) e [18_PLANILHAS_E_LOG.md](18_PLANILHAS_E_LOG.md).

O template comprimido também foi aberto no runtime `workerd` local via Wrangler, retornando as sete colunas de Pessoas com HTTP 200. Na publicação, o template baixado foi comparado byte a byte com o arquivo entregue; a demonstração rejeitou gravação e leitura de log administrativo (403), enquanto HTML/API privados redirecionaram para Cloudflare Access (302). Testes autenticados de mutação permanecem locais, sem inserir dados de ensaio no banco privado publicado.

Esta etapa usa testes de segurança direcionados e revisão de código; não foi aberto novo scan Codex Security selado. O relatório antigo abaixo mantém seu escopo e snapshot. Integração Google real ainda exige cliente OAuth e consentimento pessoal; envio/leitura reais e IA paga não foram executados. Testes automatizados de usabilidade não certificam WCAG nem equivalem a homologação institucional.

| Verificação | Evidência e alcance |
|---|---|
| Build e TypeScript estrito | Passaram; Worker com assets locais embutidos e dry-run Wrangler |
| Produto Node/SQLite | 30 testes: políticas, migrations, integração, API, hardening e volume |
| SIM-01–12 | Estados, outbox e eventos persistidos; original encerrada por gestor e filha sem executor presumido |
| Prazo/prorrogação | Pedido incompleto preserva vigente; aprovação mantém original; ressalvas exigem ato posterior |
| Transferência/seção | Dono/seção preservados até aceite; snapshots não reescritos por mudança de lotação |
| Permissões | Executor/ADMIN não encerram; SDG recebe 403; gestor-executor precisa de ato separado |
| HTTP e dados | Sessão, origem/CSRF, limite de login, HTML escapado, CSP, SEI HTTPS/allowlist |
| Consistência | Transações, versão concorrente rejeitada, idempotência e snapshots profundos imutáveis |
| IA | JSON Schema real, saída inválida rejeitada, token AES-GCM carregado apenas no servidor |
| Gmail controlado | Sem rede em simulação; mensagem >500KB isolada; seguinte importada com avanço do cursor |
| Volume | 2.500 demandas sintéticas, métricas coerentes e 12 linhas por página; execução local, não ensaio de carga D1 |
| Dependências | `pnpm audit --json`: zero advisories após atualização transitiva de undici |
| Codex Security | Revisão estática independente; bloqueio de coleta por mensagem grande corrigido e retestado |

## Usabilidade

9 cenários Playwright locais passaram: 360/390/768/1024/1366/1920px, orientação horizontal 844×390, reduced motion, acessibilidade automatizada e gestor atribuindo/executor aceitando e pedindo prorrogação. Verificados oito KPIs, identidade/conteúdo da página, console sem erro, filtros/paridade, vazio, drawer, foco preso/restaurado e ausência de rolagem horizontal geral.

8 cenários de consulta/acessibilidade também passaram no Cloudflare publicado: seis larguras, orientação e axe. Não houve mutação remota de demandas ou envio de mensagens nesse teste. O Browser plugin especializado não está listado; foi usado Playwright regular com Chrome/Chromium. Capturas ficam em `.local/evidence`.

axe passou com regras selecionadas WCAG 2/2.1/2.2 AA no painel e diálogo, após correção de contraste. Isso não certifica WCAG. Não houve auditoria com leitor de tela humano, Safari/iOS ou Firefox.

Os scripts recebidos `validate_spec.py`, `validate_addendum.py`, `validate_departamentos_v22.py` e `test_responsive_browser.py` passaram. O protótipo foi testado nas seis larguras, com novas capturas em `.local/prototype-evidence`, preservando o material recebido. Os validadores de especificação são distintos dos testes da aplicação.

O fixture antigo omite prioridade na atribuição. O teste integrado registra **complemento explícito do gestor escolhendo Alta** antes de atribuir; a resposta original sem prioridade não é aplicada por inferência.

## Limites materiais

- Conector Gmail identificado; nenhuma mensagem da caixa foi lida. OAuth próprio do Worker permanece por configurar.
- Entradas reais passam por revisão. Respostas automáticas de aprovação, corroboração institucional e threading completo não foram homologados.
- Token de IA pode ser salvo; nenhuma API paga foi chamada. Outros fornecedores precisam de adaptador.
- Dados e contas publicados são fictícios. SSO/escopo institucional, calendário/feriados, anexos/retenção, exportação autorizada e backup restaurado dependem do piloto.
- Fluxo mensal representa a coorte selecionada; não se declara reconstrução retroativa de estoque global.
- Testes técnicos não constituem aceite do produto nem autorização institucional para dados reais.


## Registro da auditoria Codex Security

Scan `0e0c19af-acf3-4368-99b0-70d32ddca89f`, concluído e selado em 24/10/2026. Não restaram achados reportáveis após as correções e a releitura independente dos controles alterados. A ferramenta registrou o aviso: "Directory contents changed while the scan was running; results were saved for the original snapshot." Portanto, o relatório selado mantém a identidade do snapshot inicial; os regressivos e a revisão de controles documentam as correções posteriores. Não se apresenta esse snapshot como uma certificação imutável da versão final publicada.

A medição retornada pela ferramenta foi 13.728.494 tokens totais, dos quais 13.265.664 de entrada em cache, 13.670.003 de entrada total e 58.491 de saída, considerando 4 chats. É contabilidade de contexto da ferramenta, não estimativa de preço ou de cobrança. O relatório canônico permanece no armazenamento privado do Codex Security, vinculado à conversa.
# Complemento de privacidade — 24/10/2026

Esta seção registra a evolução posterior à primeira demonstração descrita neste documento.

- **39 testes Node/SQLite passaram**, incluindo tokens Access falsos/expirados, audiência/emissor incorretos, e-mail não autorizado, usuário desativado, RBAC, CSRF/Origin, isolamento dos bancos, demonstração sem gravações, criptografia independente e detecção de segredo no index Git.
- **9 testes gerais de navegador locais passaram**, com seis larguras 360/390/768/1024/1366/1920, orientação e acessibilidade automatizada.
- **1 fluxo privado em navegador passou**, em banco fictício em memória: base vazia → identidade individual → cadastro → persistência após recarga → gravação e limpeza do campo de token → GET sem token → logout Access. Desktop 1366 e celular 360 sem overflow e sem violações axe nas verificações executadas. A mensagem de gráfico vazio recebeu correção de contraste.
- **8 testes de consulta na demonstração publicada passaram**. A gravação foi explicitamente excluída dessa suíte remota porque a demonstração agora é somente leitura; o mesmo fluxo de gravação passou localmente.
- TypeScript, Prettier, três validações Python da especificação e dry-run Wrangler privado passaram. `pnpm audit --prod`: nenhuma vulnerabilidade conhecida reportada.
- Cloudflare Access configurado com allowlist de um e-mail e MFA. Requisições anônimas ao HTML e à API privados redirecionaram para o login. O Worker também rejeita JWT inválido se a proteção da borda for removida por engano.
- Snapshot D1 privado restaurado em SQLite isolado, integridade/chaves estrangeiras válidas. Backup e Secrets locais iniciais protegidos com Windows DPAPI, com decifragem comparada byte a byte; intermediários em texto puro removidos.

**Limites:** o login real do titular com seu segundo fator depende de sua ação pessoal e não foi simulado no ambiente publicado. O fluxo autenticado foi validado com Access assinado fictício somente no servidor local de teste. Não houve leitura/envio Gmail, chamada paga de IA, backup recorrente, restauração no D1 ativo, auditoria exaustiva ou certificação WCAG. DPAPI depende da conta Windows/computador que criou os arquivos. Um e-mail do pacote original permanece no histórico anterior do Git.

Operação atual: [16_PRIVACIDADE_E_AMBIENTES.md](16_PRIVACIDADE_E_AMBIENTES.md).
