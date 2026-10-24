# SIGA v2.3 — Responsividade, acessibilidade e paridade funcional multidispositivo

**Data:** 23/10/2026. **Tipo:** adendo vinculante ao pacote v2.2. **Escopo:** todos os perfis (SDG_LEITOR, gestor, executor e administrador), com demonstração concreta no Dashboard SDG. **Status:** protótipo HTML local alterado e testado; aplicação SIGA definitiva ainda não implementada.

## 1. Meta de negócio

O Secretário Diretor-Geral deve acessar o mesmo recorte de dados e tomar as mesmas decisões informacionais em PC, tablet e smartphone, sem perda de indicadores, filtros ou acesso ao processo SEI autorizado. Não basta reduzir elementos graficamente: a disposição deve adaptar-se à interação por toque e à largura disponível. Este adendo NÃO altera as regras de aprovação, a competência de encerramento de Emerson, as unidades SLC/SAP/SME/AE, prioridades, o domínio de datas nem a origem Gmail da plataforma.

## 2. Regras vinculantes

**RN-036 — Mobile-first e paridade funcional.** Desenvolver layout responsivo, com os mesmos campos, filtros, indicadores, gráficos, dados e navegação em todas as larguras. As tabelas amplas podem mudar de apresentação; os dados não podem ser omitidos. Desktop permanece visão ampla com tabela; celular terá cards por demanda.

**RN-037 — Pontos de verificação.** Validar ao menos 360, 390, 768, 1024, 1366 e 1920 pixels; incluir rotação vertical/horizontal para tablet/celular. Pontos de quebra são decisões de projeto, não contratos imutáveis. Não pode ocorrer rolagem horizontal DA PÁGINA, textos cortados, sobreposição de controles ou elementos inacessíveis. Rolagem horizontal de gráfico isolado só se for explicitamente necessária, rotulada e preservando alternativa textual.

**RN-038 — Navegação e filtros móveis.** Navegação lateral em drawer com acionamento e fechamento por botão, fora, Escape e mudança de seção; estado acessível em `aria-expanded`. Filtros com botão recolhível, campos acessíveis por toque, estado selecionado perceptível e contagem de filtros aplicados. Combinações departamento + servidor + prioridade + situação e atalhos de vencidas/D-2/sem atualização devem funcionar também no mobile, sem resultados diferentes dos de desktop.

**RN-039 — Cards móveis de demanda.** Quando a tabela se torna inadequada, mostrar cartão com código clicável, objeto, seção, responsável, status, prioridade textual, prazo vigente, dias em aberto, dias de atraso em execução, dias sem atualização e acesso ao SEI quando houver URL validada. Não atribuir atraso de execução às demandas em validação. Ausência de prazo ou URL deve aparecer explicitamente; não inventar links.

**RN-040 — Cálculos idênticos entre apresentações.** Reutilizar serviço de agregação e lista filtrada; trocar só a apresentação. Filtro de pessoa limita aos atuais responsáveis no estoque. Métricas históricas preservam snapshots. Data de corte e última sincronização devem estar visíveis em todas as telas; não rotular dados de Gmail como 'tempo real' sem latência transparente.

**RN-041 — Toque e teclado.** Áreas interativas com pelo menos 44x44 px (alvo recomendado), foco visível, labels, alternativa textual a cores, uso por teclado e Escape. Menus e detalhes devem restaurar o foco ao botão que os abriu. A aplicação final precisa prender o foco dentro de diálogos modais enquanto abertos. Desativar transições não essenciais com `prefers-reduced-motion`; observar WCAG 2.2 AA como objetivo de acessibilidade e registrar eventuais exceções.

**RN-042 — Segurança e permissões invariáveis.** SDG_LEITOR permanece somente leitura também na API, qualquer que seja o tamanho da tela. Links para SEI devem usar URL HTTPS validada em allowlist configurável; não inferir endereço por número, não permitir javascript:/data:/open redirect, não elevar permissões do SEI. Nenhum endpoint administrativo deve ser disponibilizado apenas porque um botão está oculto no mobile.

**RN-043 — Custo e desempenho.** Não exigir serviços pagos exclusivos só para apresentar mobile. Reutilizar consultas e cache de leitura apropriado, paginação/virtualização nas listas extensas e carregamento progressivo de gráficos. O protótipo local pode incluir apenas fixture pequena, mas a implementação deve funcionar com milhares de demandas sem montar toda a lista de uma vez.

**RN-044 — Integração com processo e interação.** Botão/link 'Abrir processo SEI' visível e acessível em detalhes, tabela e card, somente quando `process_url` estiver validada. Clique abre o endereço fornecido e está sujeito a login/permissão do SEI. A ausência de URL não bloqueia a atribuição ou o envio de e-mail.

## 3. Layout esperado por faixa

| Dispositivo | Navegação | Filtros | Indicadores | Demanda individual |
|---|---|---|---|---|
| Smartphone 360/390 | Cabeçalho fixo + menu gaveta | Recolhidos por padrão, expandíveis, rótulos e botões grandes | 2 colunas, gráficos empilhados verticalmente | **Cards** completos, com drill-down e link SEI condicional |
| Tablet 768/1024 | Menu lateral quando houver espaço; drawer se estreito | 2 colunas ou 1 conforme largura | 2 colunas e gráficos empilháveis | Tabela de consulta com detalhe, ou cartões conforme necessidade |
| Desktop 1366/1920 | Menu lateral permanente | Controles visíveis simultaneamente | 4+ KPIs por linha, gráficos e tabela | Tabela detalhada ordenável, com drill-down |

## 4. Contratos para implementação

- Camada de domínio/backend produz resultados com dados neutros em relação ao dispositivo. Um endpoint paginado oferece mesmos códigos, datas, responsáveis e prioridades em mobile e desktop.
- Cada filtro deve ser refletido na URL da aplicação ou estado persistente de navegação, permitindo retornar ao mesmo recorte após abrir detalhe. No protótipo de demonstração o estado é local, sem backend.
- Desktop e mobile recebem o **mesmo conjunto filtrado e ordenado**, ou páginas equivalentes do mesmo endpoint; não manter duas regras distintas de consulta.
- Manter `SDG_LEITOR` e papel de gestor com interfaces distintas; não introduzir botões de escrita no painel do SDG.
- Data de corte é expressa em America/Sao_Paulo, com datas originais disponíveis no detalhe. A atualização entre e-mails e banco depende da sincronização e deve mostrar sua última execução.

## 5. Critérios de aceite (CA-55 a CA-69)

| ID | Teste obrigatório | Aceite |
|---|---|---|
| CA-55 | 360px e 390px | Sem rolagem horizontal geral, conteúdo acessível, filtros acionáveis |
| CA-56 | 768px e 1024px | Layout tablet legível, gráficos e tabelas não cortados |
| CA-57 | 1366px e 1920px | Menu, filtros, KPIs, gráficos e tabela legíveis e funcionais |
| CA-58 | Filtros móveis departamento+servidor | Totais, gráficos, tabela/cards usam exatamente o mesmo recorte |
| CA-59 | Prioridade+situação+atalho D-2 | Combinações mantêm coerência dos indicadores e da lista |
| CA-60 | Cartões móveis | Código, seção, pessoa, prioridade, status, prazo, idade, atraso e última movimentação aparecem |
| CA-61 | Drill-down mobile/desktop | Mesmo código abre mesma demanda com dados equivalentes; não executa mutações |
| CA-62 | Ausência de dados | Lista sem resultados apresenta estado vazio claro sem erro de JavaScript |
| CA-63 | Drawer móvel | Abre/fecha por botão, clique fora e Escape; `aria-expanded` correto |
| CA-64 | Filtros recolhíveis | Estado acessível, opções selecionadas preservadas, limpar restaura o painel |
| CA-65 | Acessibilidade | Foco visível, botões >=44px na interface móvel, legibilidade sem cor isolada e redução de movimento |
| CA-66 | Modal | Fechar por tecla Escape e botão, restaurar foco; no app final aplicar focus trap |
| CA-67 | Link SEI | URL validada aparece e funciona em card e tabela/detalhe; URL não autorizada é omitida |
| CA-68 | Permissões | SDG não cria/edita/encerra demandas por APIs nem no desktop nem no celular |
| CA-69 | Dados e desempenho | Respostas paginadas, snapshots consistentes, métricas corretas com dataset maior e status de sincronização |

## 6. Evidências no pacote e comandos

- Protótipo local: `prototype/dashboard_sdg_demo.html` (HTML, CSS e JS com dados fictícios, sem chamadas de rede).
- Testes automatizados de navegador: `python tests/test_responsive_browser.py` (depende de Playwright e navegador Chromium; pode exigir ajuste de caminho do executável).
- Evidências opcionais de apresentação: `prototype/dashboard_mobile_v23_preview.png`, `prototype/dashboard_390px_v23.png`, `prototype/dashboard_768px_v23.png`, `prototype/dashboard_1366px_v23.png`.
- Testes estruturais regressivos: `python tests/validate_spec.py`, `python tests/validate_addendum.py`, `python tests/validate_departamentos_v22.py`.

**Atenção:** passar no teste HTML de protótipo **não equivale** a demonstrar a app definitiva nem a validar WCAG completa. Reexecutar casos CA-55...CA-69 depois da implementação integrada.

## 7. Sequência para Codex

1. **Incremento 0 não muda:** núcleo offline com políticas e fixtures. Não pular para telas.
2. Ao alcançar o incremento de Dashboard, entregar contrato de dados e API paginada, com autorização por papel.
3. Implementar interface **mobile-first**, orientada pelas regras acima. Utilizar HTML demonstrativo somente como referência visual e comportamental, não copiá-lo como produto final sem revisão.
4. Executar testes de navegador nas seis larguras e uma rodada manual de acessibilidade por teclado/leitor de tela.
5. Registrar links para evidências e teste executado em `docs/09_REGISTRO_DE_EVOLUCAO.md`. Parar para homologação do responsável pelo produto.

