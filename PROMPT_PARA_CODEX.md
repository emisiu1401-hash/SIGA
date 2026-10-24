# Prompt inicial — copie e cole no Codex

Você está recebendo o repositório SIGA e sua especificação negocial de 23/10/2026.

Leia, nesta ordem, `README.md`, `AGENTS.md`, `docs/01_VISAO_E_REGRAS.md`, `docs/02_FLUXOS_E_ESTADOS.md`, `docs/04_ROTEIRO_INCREMENTAL.md`, `docs/05_CENARIOS_DE_ACEITE.md`, `docs/07_RISCOS_E_DECISOES.md`, `db/migrations/0001_initial.sql`, `contracts/interpretacao.schema.json` e `docs/09_REGISTRO_DE_EVOLUCAO.md`.

**Execute somente o Incremento 0** (fundação e simulador mínimo, conforme roteiro), com dados 100% fictícios, sem conectar APIs, sem criar recursos externos e sem deploy. Faça perguntas apenas se houver bloqueio realmente incontornável; caso contrário, use uma hipótese reversível, documentando-a como tal. Não trate hipóteses como decisão do usuário.

Sua prioridade não é produzir quantidade de código ou telas; é construir um **núcleo testável de regras determinísticas e rastreáveis**, capaz de reproduzir a interpretação e a sequência dos casos da simulação. A IA deve ser uma porta de extração substituível (primeiro fake/mock determinístico), nunca a autoridade das transições. Gmail deve ser uma interface desacoplada (mock inicialmente); futuro fluxo real será Gmail API, não Outlook.

Entregue:

1. Análise objetiva das regras negociais e das lacunas restantes.
2. Estrutura mínima do repositório, incluindo scripts de testes, banco com migrations e um simulador local para mensagens.
3. Primeiros testes passando para registro de nova demanda, identidade, código da demanda, duplicidade, prazo inicial e autorização de prorrogação — todos sem rede.
4. Pequena visualização ou CLI que permita inserir um e-mail fictício e visualizar estado, eventos e respostas geradas; escolher a opção mais simples e demonstrável.
5. Evidência das execuções de testes, instruções para rodar e relatório em `docs/09_REGISTRO_DE_EVOLUCAO.md`.
6. Proposta concisa do próximo incremento, **sem implementá-lo**.

Nunca marcar algo como aprovado/homologado sem meu aceite expresso. Mantenha código e funções de negócio independentes de Cloudflare, embora GitHub + Cloudflare seja a arquitetura de referência. Para testes, substitua relógio, IA, Gmail e envio de e-mail por implementações controláveis e previsíveis.

## Complemento do prompt inicial (v2.2)

Esta versão tem um requisito prioritário adicional: `docs/12_PAINEL_EXECUTIVO_E_DEPARTAMENTOS_V22.md`. Inclua a migration `0003_departamentos_painel_executivo.sql`, os novos requisitos RN-027..RN-035 e critérios CA-40..CA-54 no plano de implementação. Não pule o Incremento 0. Quando chegar à construção do painel, use o protótipo `prototype/dashboard_sdg_demo.html` apenas como referência visual e de interação, não como fonte de dados reais. Não reduza o dashboard a quatro cartões e um gráfico. Obrigatórios: filtro combinado departamento+servidor+prioridade, métricas de dias e prazos, quatro unidades SLC/SAP/SME/AE, gráficos e tabela de exceções com drilldown.

## Complemento do prompt inicial (v2.3)

Foi adicionada a exigência transversal `docs/13_RESPONSIVIDADE_E_TESTES_V23.md` com RN-036..RN-044 e CA-55..CA-69. **Leia agora, planeje e preserve o Incremento 0 como primeira entrega.** Quando chegar à interface, faça layout mobile-first e paridade de filtros/indicadores entre computador, tablet e celular; cartões no celular, filtros recolhíveis e menu móvel funcional. Avalie o protótipo em `prototype/dashboard_sdg_demo.html`, mas use backend real e testes próprios somente quando o incremento correspondente for autorizado. Os screenshots são fictícios. Não conectar APIs reais, não publicar nem consumir recursos pagos sem autorização expressa.
