# 11 — Adendo negocial obrigatório (v2.1): painel SDG, link SEI e prioridade

**Origem:** decisão do responsável pelo produto em 23/10/2026. **Status:** requisito aprovado para a especificação; funcionalidades ainda não implementadas nem homologadas.

## RN-023 — Cadastro e identidades
O perfil `SDG_LEITOR` já existe. O gestor é também executor de suas próprias atividades. Respeitar cadastro de usuários habilitados, e-mails autorizados e unidades da DAO. A atualização v2.1 não modifica a política: somente o gestor encerra definitivamente demandas; o SDG consulta, não altera.

## RN-024 — URL direta do processo SEI
1. Campo opcional independente `demands.process_url` (URL HTTPS completa) e estado de validação técnica `process_url_status`.
2. Campo `process_reference` existente permanece distinto: número do processo, quando fornecido, NÃO gera automaticamente uma URL. A URL não é fabricada a partir de números nem inferida de formato textual.
3. O gestor pode inserir/alterar a URL na triagem, atribuição e tela de detalhes; o executor pode sugerir uma URL por e-mail, sujeita a permissões/validação definidas. Alterações ficam no `demand_events` com autor, instante, valor anterior/novo e origem.
4. Antes de exibir hyperlink, verificar esquema HTTPS, hostname em allowlist institucional configurável, tamanho, ausência de credenciais embutidas e proibir esquemas javascript/data/file; não fazer fetch arbitrário do link recebido (prevenir SSRF). URL com formato/domínio aceito NÃO significa confirmação do processo, de sua existência ou de permissão de acesso.
5. Em toda comunicação relativa à demanda, incluir, quando válida e autorizada, bloco como `Processo SEI: <URL>` ou hyperlink HTML com rótulo "Abrir processo no SEI" e URL correspondente, além da referência numérica se houver. Não incluir o bloco se ausente ou não aprovada; jamais inventar link.
6. No Dashboard, mostrar ação clicável "Abrir no SEI" no detalhe da demanda e na lista quando aplicável, incluindo aviso de ausência de link. Clique abre novo contexto seguro; eventual login ou autorização depende do próprio SEI. A aplicação não fará juntada ou alteração processual automaticamente.
7. Nas demandas filhas, oferecer associação a URL original ou URL própria somente com regra explícita; não copiar automaticamente links que possam não representar a providência.

## RN-025 — Prioridade gerencial obrigatória na atribuição
1. Valores CANÔNICOS: `BAIXA`, `MEDIA`, `ALTA`. Rótulos: **Baixa**, **Média**, **Alta**.
2. A demanda provisória em triagem pode não ter prioridade (`NULL`). Ao designar responsável, Emerson deve definir explicitamente uma das três prioridades; o SIGA deve solicitar se não tiver sido informada, preferindo seleção simples no Dashboard e opções enumeradas por e-mail.
3. Somente o gestor com permissão pode criar ou modificar a classificação vigente, inclusive em tarefas próprias. Servidor pode sugerir alteração, sem aplicação automática.
4. Prioridade é propriedade da **demanda** no MVP. Se posteriormente houver prioridades diferentes por etapa, evoluir a modelagem com histórico explícito; não antecipar essa alteração.
5. Interface exibirá nome textual e poderá combinar sinal visual: Baixa (neutro/verde suave), Média (âmbar), Alta (vermelho). As cores são configuráveis e NUNCA substituem o rótulo textual; contrastes acessíveis.
6. Prioridade não reescreve vencimento, não autoriza escalonamentos implícitos nem encerra automaticamente tarefas. Ordenação padrão: vencidos, maior prioridade, vencimento mais próximo; filtros sempre disponíveis.
7. Ao gerar demanda filha, pedir ao gestor sua prioridade; não herdar automaticamente a prioridade da demanda pai.
8. Migração converte registros históricos `NORMAL` para `NULL` (sem reclassificar por inferência). Fluxo de criação de nova demanda provisória deve inserir `priority=NULL` explicitamente enquanto a migration legada mantiver default `NORMAL`.

## RN-026 — Dashboard executivo do SDG
**Público:** SDG, perfil somente de leitura. **Propósito:** responder perguntas concretas de trabalho, não produzir ranking automático de pessoas.

### Perguntas que a tela deve responder
- Quantas demandas estão abertas, em validação, atrasadas, concluídas e sem responsável?
- Quais entregas vencem hoje, em 2 dias, nesta semana e neste mês?
- Quem responde por cada entrega e quantas atribuições simultâneas possui cada servidor?
- Qual a distribuição por unidade, responsável e prioridade?
- Quantas demandas foram recebidas e encerradas no período? Como evoluiu o estoque?
- Quais prazos foram prorrogados? Qual a diferença entre prazo original e atual?
- O que está impedido, aguardando terceiros, aceite ou aprovação do gestor? Há quanto tempo?
- Quais tarefas derivaram novas demandas e qual seu vínculo pai/filha?
- Qual o tempo de ciclo, o tempo de espera e o tempo de trabalho DECLARADO (se houver)?
- Quando foram atualizados os dados pela última vez e há mensagens pendentes de processamento?

### Visão inicial do painel
- Cartões KPI: abertas, em andamento, vencidas, vencem em D-2, aguardando validação, concluídas no período, sem responsável, com prioridade Alta.
- Gráfico de barras horizontais: atribuições ativas por servidor (com recorte de unidade/prioridade).
- Barras empilhadas: atividades por unidade x estado ou prioridade.
- Linha temporal: entradas e encerramentos por semana/mês (séries separadas; escopo do período explícito).
- Gráfico de distribuição: estados atuais por quantidade (pizza/rosca apenas se legível).
- Tabela de atenção: vencidas, bloqueadas, sem previsão, validação pendente, com link para detalhe e processo SEI.
- Exibir períodos, denominadores, métodos de contagem e último horário de sincronização. Cada gráfico admite detalhamento das demandas que o compõem (*drill-down*).

### Filtros combináveis obrigatórios
Período e tipo da data (abertura/prevista/encerramento), servidor, unidade, situação, prioridade (Baixa/Média/Alta/Não definida), prazo original vs vigente, apenas vencidas, apenas em validação, pai/filha, origem e demandas com/sem link SEI.

### Regras de cálculo e atualização
- Métricas em tempo **operacional**: alterações feitas no Dashboard aparecem após persistência; dados de mensagens são atualizados somente após ingestão real pelo Gmail. Exibir "Última sincronização Gmail" e "Última atualização do painel". NUNCA prometer atualização instantânea de mensagens sob polling periódico.
- Implementação inicial: recarga leve do resumo por polling durante uso do painel, com intervalo configurável (p.ex. 30–60 segundos), sem exigir WebSocket. Em cargas maiores, estudar SSE. Evitar sobrecarga dos limites gratuitos da Cloudflare.
- Diferenciar **tarefas/atribuições** de **demandas**. "Concluída" por executor não é "encerrada" pelo gestor. Demanda filha tem existência própria.
- Prazo original e prazo prorrogado são indicadores separados. Alteração de responsável não apaga histórico.
- Sem apontamento de horas, exibir **não informado**, nunca zero presumido. Não inferir tempo ativo de intervalos entre e-mails.
- Indicadores individuais devem mostrar contexto de complexidade e espera; não produzir nota de desempenho ou ranking simplista automaticamente.
- `SDG_LEITOR`: visualização autorizada, filtros, detalhamento e exportação apenas quando autorizada. Não pode mudar responsável, prazo, prioridade, evidência ou encerramento.

## Critérios de aceite v2.1
**CA-29:** demanda sem código cria triagem com prioridade não definida e sem URL; designação exige prioridade informada por Emerson.
**CA-30:** prioridade `BAIXA`, `MEDIA`, `ALTA` aceita; `URGENTE` rejeitada com sugestão das três opções; executor não altera prioridade sem autorização.
**CA-31:** alterar prioridade de Média para Alta preserva anterior, motivo e ator em eventos, muda visualizações e ordenações.
**CA-32:** URL HTTPS aprovada, armazenada em campo próprio, é exibida como link no dashboard e em e-mails relevantes; texto da referência fica separado.
**CA-33:** URL ausente, domínio não permitido, javascript: ou link sem validação não gera hyperlink clicável; atribuição pode prosseguir sem URL.
**CA-34:** o número SEI isolado ou a referência textual 12345 não cria URL automaticamente.
**CA-35:** cartões e gráficos agregam apenas registros que passam nos filtros; clique no gráfico permite abrir a lista detalhada.
**CA-36:** operador com papel `SDG_LEITOR` não pode editar nem via API, mesmo que manipule a interface; Emerson pode gerir prioridades de suas próprias tarefas.
**CA-37:** após chegada de e-mail ainda não sincronizado, painel não afirma atualização em tempo real e exibe último sync; mudança feita pelo painel é refletida após persistência.
**CA-38:** nenhuma hora de trabalho não informada é representada como 0; conclusão declarada por executor não é somada como encerramento definitivo.
**CA-39:** ao criar demanda filha, SIGA não presume mesma prioridade ou mesmo link SEI da demanda original.

## Consequências para implementação incremental
- **INC-01/02:** cadastro do gestor/usuários e atribuição com prioridade obrigatória, link SEI opcional, menus e DTOs atualizados; SQL `0002_dashboard_sei_priority.sql`.
- **INC-03:** menus numerados para prioridade e atualização de link via ação autorizada, mantendo linguagem natural.
- **INC-09:** Dashboard executivo com gráficos, indicadores, filtros persistentes durante a sessão, drill-down, leitura estrita do SDG e relógios de sincronização.
- **INC-10:** e-mails reais usam a URL aprovada. Templates têm bloco SEI opcional; NÃO fazer links para URLs não verificadas.
- **Todas as etapas:** manter fixtures, testes e documentação atualizados; não conectar serviços reais sem aprovação.
