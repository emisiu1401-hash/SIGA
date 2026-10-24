# SIGA — Pacote de especificação executável para Codex (v2.3)

**Data-base:** 23/10/2026. **Status:** proposta para desenvolvimento em ambiente fictício. **Não é aplicação pronta, nem autoriza conexão com Gmail ou deploy.**

## Objetivo

Construir o **SIGA — Sistema Inteligente de Gestão de Atividades**, com **e-mail como interface principal** e **dashboard gerencial** complementar. Toda mensagem recebida na **caixa Gmail autorizada** passa por identificação, correlação, interpretação assistida por IA, **validação determinística das regras** e registro auditável. Somente o gestor Emerson pode encerrar definitivamente demandas, inclusive as que executar pessoalmente.

## Por onde começar

Se você já iniciou o trabalho a partir da versão 2.2, leia `INSTRUCOES_ATUALIZACAO_V23.md` para fazer merge das diferenças sem perder código existente.

1. Crie um repositório **privado** no GitHub, extraia **todo** este pacote na raiz e abra-o no Codex.
2. Leia `AGENTS.md` (instruções permanentes do Codex) e `docs/01_VISAO_E_REGRAS.md` (fonte negocial de verdade).
3. Envie ao Codex o conteúdo de `PROMPT_PARA_CODEX.md`. **Comece pelo incremento 0 e pare após seus testes.**
4. Verifique a integridade inicial com `python tests/validate_spec.py` (isso **não** testa o aplicativo, que ainda será criado).
5. Cada incremento deve implementar um fluxo vertical funcional com **adaptadores fictícios**, testes repetíveis e relatório de execução. Liberar incremento seguinte somente com aceite explícito.
6. Integrações reais, credenciais e deploy institucional são bloqueados até autorização própria.

## Mapa de arquivos

| Arquivo | Por que existe |
|---|---|
| `AGENTS.md` | Restrições e método de trabalho do Codex |
| `PROMPT_PARA_CODEX.md` | Primeira instrução executável para o Codex |
| `docs/01_VISAO_E_REGRAS.md` | Regras negociais vinculantes, termos e permissões |
| `docs/02_FLUXOS_E_ESTADOS.md` | Diagramas, estados, transições e casos limite |
| `docs/03_ARQUITETURA_INTEGRACOES.md` | Interfaces, Gmail, IA, Cloudflare, segurança e migração |
| `docs/04_ROTEIRO_INCREMENTAL.md` | Backlog fatiado, dependências, critérios de aceite |
| `docs/05_CENARIOS_DE_ACEITE.md` | Cenários testáveis, inclusive toda a simulação realizada |
| `docs/06_DASHBOARD_E_METRICAS.md` | Interface, filtros, métricas e definição operacional |
| `docs/07_RISCOS_E_DECISOES.md` | Questões abertas e padrões provisórios de desenvolvimento |
| `docs/08_OPERACAO_E_CHECKLIST.md` | Implantação, segregação, observabilidade e recuperação |
| `docs/09_REGISTRO_DE_EVOLUCAO.md` | Progresso que o Codex deve atualizar a cada incremento |
| `db/migrations/0001_initial.sql` | Esquema SQL de referência compatível com D1/SQLite |
| `contracts/interpretacao.schema.json` | Formato esperado para extração estruturada da IA |
| `contracts/menus.json` | Significado versionado das opções 1–5 e A/B por contexto |
| `contracts/fixtures_simulacao.json` | Casos estruturados da simulação fictícia |
| `emails/MODELOS.md` | Templates com opções numeradas e campos parametrizados |
| `tests/TEST_PLAN.md` | Matriz de testes e execução off-line |
| `tests/validate_spec.py` | Verifica pacote, datas simuladas e SQL sem acessar rede |
| `docs/10_REFERENCIAS.md` | Documentações oficiais para verificação na implantação |

## Ordem de precedência diante de conflito

1. Correção explícita e mais recente do responsável pelo produto registrada em `docs/07_RISCOS_E_DECISOES.md`.
2. Regras negociais de `docs/01_VISAO_E_REGRAS.md` e `docs/02_FLUXOS_E_ESTADOS.md`.
3. Critérios de aceite de `docs/05_CENARIOS_DE_ACEITE.md`.
4. Esquemas, contratos e modelos.
5. Escolhas técnicas e documentação operacional.

**Nota de evolução:** substitui a hipótese antiga de entrada principal por **Microsoft Graph/Outlook**. A fonte de entrada exigida nesta versão é a **caixa Gmail autorizada**, embora o adaptador de mensagens possa ser trocado futuramente. Esta versão também acrescenta a regra de **duas aprovações independentes para conclusão da demanda original e criação de demanda filha**, e **opções numéricas em todos os e-mails que solicitam resposta**.

## Adendo v2.1 — SDG, link SEI e prioridade

**Ler também:** `docs/11_ADENDO_SDG_SEI_PRIORIDADES.md` (RN-023 a RN-026 e CA-29 a CA-39). Migração aditiva `db/migrations/0002_dashboard_sei_priority.sql` inclui link HTTPS de processo e reforça enum de prioridade. Valor `NORMAL` legado é mapeado para `NULL`, sem presumir classificação. Execute em dados fictícios: `python tests/validate_addendum.py`.

**Já previsto em v2.0:** dashboard SDG com filtros e indicadores e campo genérico de prioridade. **Novo em v2.1:** gráficos e perguntas gerenciais testáveis, URL direta opcional do SEI nos e-mails/painel, prioridades Baixa/Média/Alta selecionadas pelo gestor no momento de atribuição, representação acessível por cores. Sem implementação ou implantação real.

## Adendo v2.2 — Painel Executivo SDG e departamento

**Por que:** o primeiro desenho executivo foi considerado insuficiente pelo responsável do produto. A v2.2 amplia a visão gerencial sem alterar as regras de e-mail e aprovações da v2.1.

**Leia:** `docs/12_PAINEL_EXECUTIVO_E_DEPARTAMENTOS_V22.md`. **SQL:** `db/migrations/0003_departamentos_painel_executivo.sql`. **Protótipo clicável com dados fictícios:** `prototype/dashboard_sdg_demo.html`. **Validação estrutural:** `python tests/validate_departamentos_v22.py`.

As quatro unidades iniciais são SLC, SAP, SME e AE. `users.department_id` armazena a lotação atual do servidor; `assignments.department_snapshot_id` preserva a seção na atribuição; `demands.current_department_id` reflete a seção da demanda no momento. Filtro de servidor recalcula todo o painel. Os tempos de dias são calculados a partir das datas, não inferidos de e-mails. Prioridade e link SEI da v2.1 continuam obrigatórios.

**Nota:** o pacote é especificação, não software concluído. Novas tabelas e campos devem passar pelos testes de domínio e integração antes de produção.


## Adendo v2.3 — responsividade em computador, tablet e celular

**Leia:** `docs/13_RESPONSIVIDADE_E_TESTES_V23.md`, com RN-036 a RN-044 e CA-55 a CA-69. O protótipo `prototype/dashboard_sdg_demo.html` foi melhorado para incluir drawer móvel navegável, filtros recolhíveis, contagem de filtros ativos, cards móveis de demandas e mesmos resultados filtrados em toda tela. Contém somente dados fictícios.

**Teste executável:** `python tests/test_responsive_browser.py` (Playwright+Chromium). Este teste é de protótipo, não do SIGA definitivo; execução real do produto seguirá por incrementos.

**Compatibilidade:** mantém integralmente v2.0, v2.1 e v2.2 (Gmail, IA interpretativa, aprovação humana exclusiva, SEI, prioridades, SLC/SAP/SME/AE, Dashboard SDG). Nenhuma nova integração real, custo pago ou deploy é autorizado.
