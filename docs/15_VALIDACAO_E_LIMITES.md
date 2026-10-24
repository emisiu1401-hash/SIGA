# Validação executada — 24/10/2026

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
