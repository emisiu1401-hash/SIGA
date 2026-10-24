# 12 — SIGA v2.2 | Painel Diretor-Geral orientado a decisões + lotação do servidor

**Prevalência:** complemento/retificação de `docs/06_DASHBOARD_E_METRICAS.md` e `docs/11_ADENDO_SDG_SEI_PRIORIDADES.md` onde a v2.2 especificar mais detalhes. Regra aprovada pelo responsável de produto: adicionar DEPARTAMENTO ao cadastro institucional e oferecer painel executivo profundo por seção/servidor. **Ainda não implementado, nem homologado**.

## 1. Vocabulário institucional

- `SLC`: **Seção de Licitações, Compras e Contratos**. Corrige repetição inadvertida de "Compras" no pedido, sujeita à ratificação da nomenclatura oficial.
- `SAP`: **Seção de Almoxarifado e Patrimônio**.
- `SME`: **Seção de Administração Predial e Manutenção** (sigla/código e denominação fornecidos pelo demandante; confirmar nomenclatura institucional antes de cadastro real).
- `AE`: **Assistência de Engenharia**.
- `NULL` no banco: "Não classificada / sem seção responsável" durante triagem; **não** converter em unidade artificial.
- Evitar confundir seção demandante/origem externa, seção responsável pela demanda e lotação atual do executor.

## 2. Regras obrigatórias RN-027 a RN-035

**RN-027 — Departamento no cadastro de e-mail autorizado/servidor.** Cada `users` ativo da DAO terá `department_id` escolhido dentre unidades ativas. Identificar remetente pela identidade autenticada, não somente sufixo. Usuário externo à DAO pode solicitar demanda provisória sem lotação. Tela permite filtrar/cadastrar departamentos, importar CSV com código da unidade, rejeitar código desconhecido e deduplicar e-mail case-insensitive. Administrador registra histórico de movimentação de lotação.

**RN-028 — Classificação automática da demanda ao atribuir.** Ao Emerson designar responsável, obter lotação ativa do cadastro do escolhido. Após aceite/efetivação da atribuição principal, gravar `assignments.department_snapshot_id`, `demands.current_department_id` e, se primeira atribuição, `demands.origin_department_id`. Mostrar seção em assunto? usar corpo do e-mail e Dashboard, sem obrigar nomenclatura longa no subject. Ausência ou ambiguidade de cadastro bloqueia atribuição efetiva e pede esclarecimento. Uma demanda filha segue o responsável identificado, não herda automaticamente seção/prioridade da demanda mãe.

**RN-029 — Transferência entre seções.** Ao aprovar transferência e o novo executor aceitar, gravar nova atribuição e o snapshot de sua seção. Preservar snapshot anterior e eventos de transferência; atualizar somente a seção corrente da demanda. Na pendência de aceite, preservar seção/servidor anterior. Gestor pode justificar alteração excepcional da **seção responsável pela demanda** sem trocar executor, com rastreabilidade e sem alterar a lotação pessoal. Se tarefas paralelas envolverem mais de uma seção, usar colaboração com responsável principal único e contribuição explícita; não contar demanda duas vezes no estoque.

**RN-030 — Visão SDG estritamente de leitura.** Perfis `SDG_LEITOR` podem ver setores/perfis permitidos, aplicar filtros, exportar se autorizado e abrir detalhe/SEI se link validado. Nunca mutar registro por API, export ou click. Exibir "Última sincronização Gmail" distinto de "Atualizado no banco em". Dados atuais refletem persistência, não e-mails ainda não sincronizados.

**RN-031 — Filtros da direção.** Combináveis: seção (SLC, SAP, SME, AE, todas e não classificada), servidor (lista dependente da seção, podendo manter seleção 'todas'), prioridade (Baixa, Média, Alta, indefinida), período e eixo temporal (entrada, vencimento, encerramento), status, vencidas, sem prazo, aguardando validação, pai/filha e com/sem link SEI. Selecionar seção/servidor atualiza cartões, gráficos e tabela em conjunto, sem duplas contagens. Filtro salvo por usuário é opcional; botão Limpar filtros obrigatório.

**RN-032 — Relógios de dias.** Fuso America/Sao_Paulo; `dias_em_aberto = data_local_consulta - data_local_abertura` para não encerradas; `dias_de_atraso = max(0, data_local_consulta - prazo_vigente)` apenas tarefa ativa, sem declaração de conclusão sob validação; `dias_para_vencer = prazo - data_local_consulta` (mostrar 'hoje', D-1, D-2); `dias_sem_movimentacao = data_local_consulta - data_local_ultimo_evento_relevante`; `dias_em_validacao = data_local_consulta - entrada_em_validacao`; `dias_em_espera = soma_dos_intervalos_explicitos_de_bloqueio`; `tempo_ciclo_encerradas = encerramento - abertura`. Regra inicial: DIAS CORRIDOS, mostrar unidade, permitir parametrizar dias úteis no futuro. Se dado ausente exibir "Sem informação", não 0. **Data do painel e corte de dias** devem aparecer na tela.

**RN-033 — Perguntas que o SDG deve responder sem montar relatório.** (i) Quais estão vencidas e há quantos dias? (ii) Quais vencem hoje, D-2, em 7 dias? (iii) Quanto tempo estão abertas? (iv) Quantas há por seção, prioridade e servidor? (v) Quem está acumulando tarefas ativas e com prorrogação? (vi) Quais pessoas/seções não atualizaram há X dias? (vii) O que está bloqueado, sem responsável, sem prazo ou aguardando o gestor? (viii) Quantas entraram x encerraram por semana/mês e qual o estoque? (ix) Qual % foi concluído no prazo ORIGINAL e no vigente? (x) Quais já foram prorrogadas, transferidas e geraram filhas? (xi) Quanto tempo está parado por espera/validação? (xii) Qual link do SEI abre o processo específico?

**RN-034 — Prioridade.** A prioridade da demanda é `BAIXA`, `MEDIA` ou `ALTA`, definida exclusivamente por Emerson na atribuição; em triagem pode ser `NULL`. Badge com rótulo legível e contraste (verde/neutro Baixa, âmbar Média, vermelho Alta). Prioridade não é fator multiplicativo arbitrário de produtividade. Filtros, ordenação e barras empilhadas devem refletir prioridade.

**RN-035 — Acompanhamento, observabilidade e consistência.** Exibir hora de sincronização; sinalizar ingestão defasada; linkar todo KPI/gráfico à tabela de detalhes filtrada; publicar definições dos numeradores/denominadores; evitar N+1 em D1; paginar listas; limites para intervalo histórico; índices; consultas apenas de leitura para SDG; cache curto invalidado após mutação; export com filtros e auditoria. Não computar tempo de trabalho pelo intervalo de e-mails; somente tempos efetivamente declarados.

## 3. Desenho mínimo da tela executiva (desktop)

**Cabeçalho:** "Painel Executivo — DAO" + última sincronização Gmail + corte data/hora + acesso perfil.

**Barra de filtros persistente:** período e eixo de data | SEÇÃO | SERVIDOR | PRIORIDADE | STATUS | atalhos Vencidas / Hoje / D-2 / Sem prazo / Aguardando gestor | Limpar.

**Primeira fileira de 8 KPIs contextualizados:** ativas, vencidas (+ idade máxima), vencem em 2 dias, prioridade alta ativas, sem prazo ou sem responsável, pendentes de validação, encerradas no período, % no prazo original (conclusões do período). Todos clicáveis para ver demandas associadas.

**Visão carteira:** barras EMPILHADAS por seção x prioridade; barras de vencidas e entregas nos próximos 7 dias por seção; séries temporais entradas x encerramentos/estoque; distribuição por faixas de idade (0–2, 3–7, 8–15, 16–30, 31+ dias). Gráficos com rótulos e total.

**Visão pessoal:** tabela e gráfico por servidor com seção, ativas, vencidas, altas, D-2, sem movimento >N, entregas período, prazo original, prazo vigente, mediana dias ciclo; ordenar, abrir detalhes. Não gerar nota ou ranking de produtividade individual sem rubrica validada.

**Visão alertas:** tabela de EXCEÇÕES por ordenação: vencidas (dias de atraso), altas perto do prazo, sem prazo/sem responsável, sem movimentação, aguardando validação, pedidos pendentes. Colunas mínimas: código, objeto resumido, seção, executor, prioridade, estado, prazo vigente, dias em aberto, dias de atraso, última movimentação, processo SEI, ações de leitura.

**Cartão executivo por seção:** SLC/SAP/SME/AE com totais, altas, vencidas, em validação, idade média das ativas, recebidas/encerradas período; acessar recorte correspondente.

**Visão detalhe:** dados históricos, responsável/lotação na época de cada atribuição, andamento, prazos original/vigente e revisões, dias contados, evento de última alteração, relação pai/filha, link direto SEI validado e histórico de aprovações.

**Mobile:** filtros recolhíveis, KPIs em 2 colunas, gráficos de barras empilháveis verticalmente e tabela rolável. Acessibilidade teclado, contraste, legenda textual para prioridade, datas dd/mm/yyyy e aria nas barras.

## 4. Regras de contagem/segmentação

- Contagem de **demandas ativas por seção** usa `demands.current_department_id` **apenas** para demandas não encerradas. Uma demanda = uma seção principal no momento, sem duplicidade.
- **Entregas executadas por servidor/seção ao longo do tempo** usam `assignments.department_snapshot_id` e eventos/etapas validadas, nunca apenas a lotação atual ou seção atual da demanda.
- **Demandas encerradas no período** podem ser atribuídas à última seção responsável no encerramento, que deve ser preservada em snapshot de evento de encerramento; não reclassificar o histórico após transferências posteriores.
- D-2 e atrasadas são calculadas **por atribuições principais ativas**, com agrupar por demanda para evitar duplicidade em tarefas com apoio.
- Quando filtro de servidor está ativo, KPIs de estoque representam demandas cuja atribuição principal vigente está com o servidor. Métrica de entregas históricas por servidor usa a pessoa que efetivamente executou a etapa; apresentar legenda da métrica.
- Transferência PENDENTE não muda o departamento/servidor principal atual. `AGUARDANDO_VALIDACAO` não recebe etiqueta de atraso de execução; recebe idade de validação.
- Demandas SEM RESPONSÁVEL e SEM DEPARTAMENTO precisam ser visíveis em fila própria da triagem do gestor, nunca sumir dos totais gerais.
- Prazo original e vigente sempre preservados; não reescrever indicador de entrega no prazo original após prorrogação.

## 5. Critérios de aceite objetivos (CA-40...CA-54)

CA-40: Adicionar quatro seções canônicas (SLC, SAP, SME, AE) por migration; usuários com `department_id` optativo para remetente institucional externo e obrigatório ao habilitar executor DAO.
CA-41: Importação de usuário com unidade válida; e-mail duplicado e código inválido são rejeitados com relatório; consulta nome ambíguo não inventa e-mail.
CA-42: Atribuição a servidor cadastrado SLC persiste seção SLC na atribuição + demanda; e-mail de atribuição identifica seção automaticamente.
CA-43: Transferência SLC->AE cria novo snapshot AE, preserva SLC e só atualiza seção atual após aceite válido; nenhuma contagem duplicada.
CA-44: Mudança da lotação do servidor SAP->SME não reescreve histórico de atribuições anteriores; relatórios históricos ainda mostram SAP.
CA-45: Filtro SDG por SLC mostra somente demandas SLC na carteira atual; filtro por servidor dentro SLC mostra seus registros e recalcula TODOS os KPIs e gráficos.
CA-46: Filtros seção + prioridade Alta + vencida retornam conjunto e totais coerentes, com drill-down aos códigos correspondentes.
CA-47: Dado dia local fixo 2026-10-23, aberto em 2026-10-13 tem 10 dias; vencido em 2026-10-20 tem 3 dias de atraso; vencendo 2026-10-25 mostra D-2; sem vencimento mostra 'Sem prazo'.
CA-48: Demanda com conclusão declarada sob validação é contada como pendência de validação, não como atraso de execução; medir separadamente dias nessa fila.
CA-49: Contagem de estoque por seção soma exatamente a quantidade de demandas da carteira, separando Não classificada; sem duplos totais por colaboradores.
CA-50: Gráfico de prioridade traz rótulos BAIXA/MÉDIA/ALTA e não apenas cores; opção Não definida só em triagem.
CA-51: Gráficos Entradas x Encerramentos seguem período e tipo de recorte; export e detalhe refletem seleção; nunca misturar stock e flow sem legenda.
CA-52: Tabela de exceções contém código, responsável, seção, prioridade, dias em aberto/atraso, último evento, prazo, link SEI validado; ordenação e paginação estáveis.
CA-53: Perfil `SDG_LEITOR` recebe HTTP 403 para mutações mesmo chamando endpoints diretamente; acesso ao processo SEI não concede privilégio no SEI.
CA-54: Última sincronização Gmail aparece e apresenta alerta se tempo >limite configurado; dashboard reflete somente o que já foi persistido, sem fingir leitura imediata.

## 6. Incrementação técnica ordenada

1. Migration 0003 + modelos departamentos (sem alterar dados não confirmados) + cadastro dos usuários e filtros de lotação.
2. Serviços de atribuição/transferência com snapshot histórico; atualizar templates de e-mail com seção e processo SEI condicional.
3. Agregações e contratos JSON do dashboard, testes de denominadores e de dias com relógio congelado.
4. UI executiva completa (cards, gráficos, seções, servidor e exceções) com fixtures; autenticação SDG somente leitura.
5. Performance/consultas D1, paginação, atualização/sincronização, export e homologação.

## 7. Questões para ratificar antes da implantação institucional

- Confirmar denominação oficial da SME e se há mais seções, além de SLC/SAP/SME/AE, que precisem participar do piloto.
- Definir calendário: dias corridos inicialmente; feriados/dias úteis em etapa posterior.
- Definir escopo de consulta do SDG (toda DAO, ou agregados com detalhes restritos).
- Critérios institucionais para análise individual: nunca inferir eficiência apenas pela contagem de tarefas.
