# 04 — Roadmap incremental orientado por valor negocial

**Regra:** apenas uma fatia por vez; critério de aceite automatizado + demo sintética + autorização explícita antes de prosseguir. Ordem pode ser revista mediante ADR; preservar código existente.

| ID | Fatia funcional | Valor observável | Critérios de aceite para liberar próximo |
|---|---|---|---|
| INC-00 | Fundação e simulador off-line | Inserir um e-mail fictício e visualizar interpretação, evento e resposta | Projeto roda localmente sem rede; migration válida; relógio/IA/Gmail mocks; pelo menos 5 cenários básicos executados |
| INC-01 | Demandas, usuários e triagem | Novo e-mail institucional sem código gera registro provisório e pedido a Emerson | Domínio validado, sem duplicata, identificação de Gestor, nomes ambíguos resolvidos sem invenção |
| INC-02 | Atribuições e prazo inicial | Gestor indica executor; executor informa data | Identidade verificada, prazo inicial `26/10` contextualizado, atribuição rastreável, painel básico |
| INC-03 | Menus e correspondência simulada | Conversas naturais com opções numeradas | `1`, `2 e 4`, `A1 e B1` significados corretamente por `menu_id`; gera emails sem enviar |
| INC-04 | IA interpretativa substituível | Texto livre vira propostas estruturadas, sem decisão automática | JSON schema validado; falhas e confusões em revisão; comportamento mock equivalente |
| INC-05 | Prorrogação e decisão humana | Pedido incompleto gera contrapergunta; completo vai para gestor | `Mude para 30/10` não muda prazo; justificativa + `Autorizo` mudam com auditoria; ressalvas sem texto exigem complemento |
| INC-06 | Monitoramento e agenda | Lembrete 2 dias antes; consolidação em dia não útil | 24/10 sábado => aviso 23/10 consolidado; 30/10 sexta => aviso 28/10; cron duplicado não duplica |
| INC-07 | Transferência, apoio e conclusão parcial | Interpreta combinações; preserva titularidade até aprovação/aceite | `2 e 4. Indico Manuel` não muda responsável; nova atribuição só após autorização, identidade, aceite |
| INC-08 | Validação do gestor e demandas filhas | Desvincula vistoria encerrada de reparo pendente | `1 e 4` no menu correto; `A1 e B1` encerra pai e cria filha; Manuel não recebe e-mail sem cadastro confirmado |
| INC-09 | Dashboard gerencial | Gestor/SDG veem estados e decisões, podendo editar com auditoria | Filtros, data de sincronização, pendências, dashboard não altera regras à revelia |
| INC-10 | Integração Gmail em ambiente autorizado | Coleta e resposta reais em caixa de teste expressamente autorizada | Escopos, credenciais secretas, cursor e 404, MIME/thread, deduplicação, falhas, aprovação expressa |
| INC-11 | Hardening e piloto institucional | Controle de acesso, operacionalização e homologação | Auditoria, retentativa, dados sensíveis, alertas, backup, acesso por papel, liberação formal da TI |

## Histórias de usuário prioritárias

- **HU-01** Como gestor, quero receber por e-mail solicitações novas da caixa institucional sem código, para atribuí-las rapidamente.
- **HU-02** Como executor, quero ser atribuído por e-mail, aceitar e informar minha previsão em linguagem natural.
- **HU-03** Como executor, quero ser lembrado em D-2 e responder com número ou texto livre.
- **HU-04** Como executor, quero pedir prorrogação com justificativa sem atualizar o prazo diretamente.
- **HU-05** Como gestor, quero aprovar sem ressalvas, com ressalvas, indeferir ou pedir esclarecimentos com opções numeradas.
- **HU-06** Como executor, quero propor apoio, transferência ou relatar que minha parte terminou, com histórico próprio.
- **HU-07** Como gestor, quero validar conclusão e encerrar apenas mediante ato expresso, inclusive quando sou o executor.
- **HU-08** Como gestor, quero criar demanda filha para uma nova providência decorrente da execução, sem confundir com transferência.
- **HU-09** Como SDG, quero painel filtrável de cargas, prazos, pendências e produtividade contextualizada.
- **HU-10** Como administrador, quero inspecionar o que a IA entendeu e reprocessar ambiguidades sem dados perdidos.

## Critérios de pronto por fatia

1. Entrega demonstrável no `SIMULATION_MODE`.
2. Migrações, testes automatizados e evidência de execução.
3. Contratos de integração com tipos e erros claros.
4. Mensagens geradas exibidas em caixa de saída simulada.
5. Arquivos `docs/07_RISCOS_E_DECISOES.md` e `docs/09_REGISTRO_DE_EVOLUCAO.md` atualizados.
6. Nenhuma alteração de permissão, regra de gestão, segredo ou envio real sem decisão do usuário.

## Cenário integrador obrigatório

Ao concluir INC-08, `tests/TEST_PLAN.md` deve rodar a **simulação 01 a 10**, com a sequência integral de `docs/01_VISAO_E_REGRAS.md` e `contracts/fixtures_simulacao.json`. A cada passo, inspecionar estado, eventos, pendências, destinatário simulado e mensagem gerada; não aceitar uma simulação de texto que não atualize estados coerentemente.

## Adendo de implementação v2.1

- **INC-01/02:** interpretar `docs/11_ADENDO_SDG_SEI_PRIORIDADES.md`; incluir URL direta opcional, prioridade obrigatória ao gestor na atribuição, e migration 0002. Corrigir legado NORMAL sem presumir Média.
- **INC-03/05/06:** atualizar menus de triagem/atribuição com prioridades 1/2/3, incluir bloco de URL SEI em comunicações pertinentes, sem gerar links por número do processo.
- **INC-09:** requisito obrigatório de dashboards, gráficos, perguntas gerenciais e verificação de `SDG_LEITOR` via UI/API, com testes CA-29 a CA-39.
- **INC-10:** bloco de link direto para SEI em Gmail enviado após validação técnica. Não automatizar atos no SEI.

Não iniciar incrementos não autorizados. Aplicar `0002` depois de `0001` em ambiente simulado com mecanismo de versionamento de migração.

## Adendo incremental obrigatório v2.2

Não suprimir incrementos anteriores. Acrescentar refinamento do **Incremento 1**: departamentos e lotação no cadastro, migração 0003, compatibilidade de e-mails autorizados. Refinar o **Incremento Dashboard/SDG**: contratos dos filtros por seção e servidor, 8 KPIs, contagem de dias, quatro painéis por seção, gráficos comparativos por prioridade, séries de fluxo (entrada/encerramento), tabela de exceções, drilldown e perfil SDG somente leitura. Ver `docs/12_PAINEL_EXECUTIVO_E_DEPARTAMENTOS_V22.md`. Desenvolvimento faseado, aceites CA-40..CA-54, rodar com dados sintéticos. Atualizar `docs/09_REGISTRO_DE_EVOLUCAO.md` antes de liberar próximo incremento.

## Gate transversal de UI v2.3

Qualquer incremento que produza UI terá testes básicos de 360/390/768/1024/1366/1920 px e teclado; o incremento de Dashboard terá a homologação específica CA-55..CA-69 do adendo `docs/13_RESPONSIVIDADE_E_TESTES_V23.md`. Desktop amplo, tablet adaptado, mobile-first com drawer, filtros recolhíveis e cartões de demanda. Nenhuma aprovação da funcionalidade será inferida de um protótipo com dados fictícios. Preservar progresso existente e executar apenas o incremento autorizado.
