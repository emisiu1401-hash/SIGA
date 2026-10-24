# 06 — Dashboard e métricas

## 1. Perfis e navegação

- **Emerson / Gestor:** fila de novas demandas; solicitações de decisão; demandas aguardando validação; responsáveis sem aceite; prazos vencidos; demandas pai/filha; minhas tarefas; histórico de mudanças; caixa de mensagens e falhas; ajuste de cadastro.
- **SDG / Leitura:** carteira por status/unidade/responsável; vencidas; próximas do prazo; conclusão no prazo original e vigente; tempo de ciclo; pendências de decisão; gargalos; última sincronização. Sem poder de encerramento na regra v2.
- **Executor (opcional):** acesso restrito a suas tarefas, informações associadas e lançamentos; porém rotina diária preferencial é **por e-mail**.

## 2. Filtros obrigatórios

Período (abertura, prazo, conclusão), servidor responsável, unidade/setor, situação, prioridade, tipo/etapa, demandas filhas, pendências de autorização, origem (e-mail/painel), prazo original vs vigente, vencidas e em validação. Combinações de filtros preservam contagem correta. Exportação posterior exige política de acesso.

## 3. Definições matemáticas iniciais

- **Demandas abertas:** `status NOT IN ('ENCERRADA','ARQUIVADA_SEM_DEMANDA','CANCELADA')`.
- **Vencidas:** prazo vigente da atribuição ativa < data local de hoje, sem conclusão declarada em validação; separar `em execução` de `aguardando validação`.
- **No prazo original:** conclusão declarada e validada até prazo original; mostrar prorrogações no detalhe.
- **No prazo vigente:** conclusão validada até o prazo mais recente autorizado; comparação não apaga original.
- **Tempo de ciclo:** diferença entre instantes de abertura e encerramento, não horas de trabalho.
- **Tempo de espera:** intervalos com evento explícito de impedimento, terceira parte, validação ou aceite. Não presumir razão do atraso.
- **Tempo declarado de execução:** soma de apontamentos confirmados, por etapa e servidor; se ausentes, mostrar `não informado` (não zero).
- **Carga:** contagem de atribuições ativas por servidor; acrescentar complexidade definida institucionalmente no futuro, não pontuar pessoas automaticamente.
- **Produtividade:** conjunto de indicadores contextualizados por complexidade, dependências e natureza da tarefa. Não gerar ranking individual simplista.
- **Latência de e-mail:** hora última sincronização; destacar quando desatualizada em vez de rotular como 'em tempo real'.

## 4. Componentes mínimos do MVP

Tabela de demandas; detalhe com timeline eventos; atribuições por etapa; pedidos de aprovação com A/B quando necessário; calendário D-2; painel de configurações; log de e-mails simulados (entrada e saída); erros; indicadores com filtros. Possibilidade de cadastrar e editar informações pelo dashboard **sem burlar** regras de autorização ou histórico.

## Requisitos adicionais obrigatórios — SIGA v2.1

Consultar `docs/11_ADENDO_SDG_SEI_PRIORIDADES.md`, RN-024 a RN-026 e CA-29 a CA-39. Exigir entregas verificáveis: cards KPI, barras por servidor, empilhamento por unidade/prioridade, séries de entradas x encerramentos, distribuição por estado, tabela de exceções com drill-down, filtros combináveis, prioridade textual+cor acessível, ação "Abrir no SEI" quando URL validada e métricas de sincronização. O papel SDG_LEITOR nunca pode efetuar mutações, inclusive via API. "Tempo real" significa refletir o banco já atualizado, nunca presumir que e-mails não sincronizados foram processados.

## Retificação prioritária v2.2 (substitui o protótipo executivo superficial)

A tela executiva deve obedecer INTEGRALMENTE `docs/12_PAINEL_EXECUTIVO_E_DEPARTAMENTOS_V22.md`: cadastros SLC/SAP/SME/AE, lotação atual + snapshot histórico, seleção de servidor que recalcula todo o painel, tempo em dias (aberto, atraso, sem movimento, em validação), cartões quantitativos e alertas, gráficos por seção/prioridade, evolução entradas/encerramentos e faixas de idade. Não homologar o painel com somente quatro KPIs ou gráfico único.
