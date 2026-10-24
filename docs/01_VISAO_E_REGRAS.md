# 01 — Visão do negócio e regras negociais

## 1. Finalidade, âmbito e não objetivos

SIGA é uma plataforma para controlar demandas administrativas da DAO, com gestor responsável e visibilidade ao SDG. A comunicação ordinária se realiza por **e-mail em linguagem natural**, com menus numerados opcionais. Painel serve para triagem, complementação, validação e visão gerencial. A IA interpreta e extrai; **políticas verificáveis aplicam as ações**.

Não substitui SEI, não abre chamados técnicos em sistemas terceiros sem integração autorizada, não comprova fatos somente por relato e não mede horas sem apontamento informado. O primeiro estágio usa caixa Gmail **designada e autorizada**, sem vigiar todas as caixas de servidores do domínio.

## 2. Glossário

- **Demanda:** unidade gerencial com código público próprio e gestor. Só se encerra com autorização **expressa** de Emerson.
- **Etapa:** parte delimitada do objeto, com resultados esperados.
- **Atribuição:** responsabilidade de um executor numa etapa, com prazo e histórico próprios; sucessivas transferências preservam atribuições anteriores.
- **Demanda filha:** necessidade **nova** derivada de uma anterior (por exemplo, reparo decorrente de vistoria), com código, estado, responsável e prazo independentes; a origem é rastreável.
- **Solicitação:** pedido de alteração que exige decisão humana (prorrogação, transferência, encerramento, nova demanda filha, exceções).
- **Decisão:** manifestação autenticada e correlacionada do gestor sobre solicitação específica (sem ressalvas, com ressalvas, indeferida, esclarecimentos, outra determinação).
- **Conclusão declarada:** executor informa que fez a atividade; não é validação técnica independente.
- **Encerramento definitivo:** ação explícita de Emerson no papel de gestor que altera `demanda.status` para `ENCERRADA`.
- **Conversa:** sequência de e-mails vinculada a uma solicitação, etapa ou demanda; mensagens de um mesmo `threadId` não têm automaticamente o mesmo assunto negocial.

## 3. Atores e perfis

| Perfil | Pode fazer | Não pode fazer |
|---|---|---|
| Remetente institucional autenticado | Originar demanda na caixa monitorada; enviar complementos conforme direitos | Escolher unilateralmente gestor/encerramento |
| Executor atribuído | Informar prazo inicial, relatar andamento, declarar conclusão, solicitar alterações, pedir apoio | Autorizar própria prorrogação/transferência, encerrar demanda |
| Emerson — gestor | Triar, atribuir, aprovar mudanças, assumir execução com prazo e justificativa, validar conclusão, encerrar | Bypassar auditoria ou alterar estado sem evento explícito |
| Emerson — executor | Executar e apontar suas tarefas, receber lembrete D-2 | Encerrar automaticamente apenas por declarar ter concluído; exige ato adicional explícito no papel gestor |
| SDG — leitor gerencial | Consultar painel, filtros e indicadores permitidos | Autorizar encerramentos nesta versão; acesso mutável depende de decisão futura |
| Sistema / IA | Interpretar, sugerir, notificar, agendar, registrar eventos permitidos | Ser gestor ou conceder autorizações de competência humana |

Perfis configurados por cadastro e autenticação. O sistema **não assume** que todo remetente do domínio seja executor autorizado em qualquer demanda.

## 4. Regras funcionais versionadas

**RN-001 — Entrada:** ao receber mensagem nova **na caixa monitorada** de remetente institucional válido `@tjmsp.jus.br`, procurar código de demanda no texto novo do corpo e assunto; tentar correlacionar por thread/identificador previamente conhecido quando a resposta não replica o código. Ausentes código válido e correlação inequívoca, criar **demanda provisória para triagem de Emerson**. Remetente fora do domínio: ignorar/quarentenar ou processar apenas quando regra excepcional aprovada — nunca autoabrir por padrão. Mensagem suspeita: revisão, sem atualização mutável.

**RN-002 — Código:** formato público configurável `[SIGA-AAAA-NNNN]`, por exemplo `[SIGA-2026-0001]`; sequência única com alocação transacional. Suportar leitura `SIGA-2026-0001` sem colchetes, preservando forma canônica na saída. Não identificar códigos apenas em rodapés, respostas citadas ou assinatura como sendo manifestação atual. Múltiplos códigos novos: não assumir destinatário, pedir esclarecimento/triagem. Código bem formado mas inexistente no banco: sinalizar referência desconhecida e enviar à triagem; não criar uma demanda substituta silenciosamente.

**RN-003 — Triagem:** Emerson recebe resumo e opções numeradas para indicar servidor autorizado, assumir com prazo+justificativa, pedir esclarecimentos, arquivar como informativa/duplicada ou outra providência. Triagem pode completar assunto, prioridade e objeto por e-mail ou painel. Classificar como `NOVA_TRIAGEM` até encaminhamento.

**RN-004 — Atribuição inicial:** após autorização de Emerson e verificação de identificação única no cadastro, registrar atribuição **aguardando aceite/previsão**; enviar e-mail ao indicado pedindo data. O responsável pode aceitar e informar prazo, recusar com justificativa ou pedir esclarecimento. Não criar prazo artificial. Se o gestor atribuir pelo nome e houver homônimos, perguntar. Em simulação, nunca fabricar cadastro.

**RN-005 — Prazo inicial:** resposta `26/10` a pergunta específica de previsão (contexto 23/10/2026) = `2026-10-26`; registrar sem exigir aprovação de Emerson, pois é compromisso inicial. Se data ambígua (passada, expressão relativa sem referencial, sem ano próximo de virada, fuso) esclarecer. Usar `America/Sao_Paulo` nas datas de negócio.

**RN-006 — Lembrete D-2:** para atribuição ativa com prazo, enviar um e-mail a **dois dias corridos** do vencimento; se cair em dia não útil, antecipar ao último dia útil configurado. Se o lembrete for devido no mesmo dia de atribuição/confirmacão de prazo, **consolidar** no e-mail de confirmação e marcar como atendido. Não disparar lembretes repetidos para a mesma atribuição, versão de prazo e tipo; reagendar quando prazo muda. Se o prazo já está muito próximo/vencido e o horário da rotina passou, aplicar aviso imediato controlado pela política, sem envios em massa.

**RN-007 — Opções do responsável no lembrete:** 1 confirma prazo; 2 solicita mais prazo com data e justificativa; 3 informa conclusão com escopo/produtos; 4 indica outra pessoa para continuar, com identificação/motivo; 5 informa impedimento ou pede orientação. Combinações `2 e 4` são admitidas. Não presumir que combinação significa mudança já aprovada.

**RN-008 — Prorrogação:** se falta nova data ou justificativa, perguntar apenas o faltante. Justificativa detalhada não equivale a aprovação. Pedido completo gera aprovação ao Emerson; somente após autorização expressa efetuar mudança; manter prazo anterior e motivo no histórico. `Autorizo`, quando associado a uma **única** aprovação pendente inequívoca, equivale a `1`, sem ressalvas. Se várias solicitações pendentes e resposta isolada `Autorizo`, pedir a qual se refere.

**RN-009 — Decisões do gestor:** `1` autoriza sem ressalvas; `2` autoriza com ressalvas **descritas** (sem descrição = perguntar antes de aplicar); `3` indefere; `4` pede esclarecimentos; `5` determina outra providência. Números valem **somente no contexto do menu enviado**. Texto prevalece sobre número em caso de ressalva textual (`1, desde que ...` => com ressalvas, nunca aprovação simples). Duas decisões podem vir combinadas: `A1 e B1`.

**RN-010 — Transferência:** sugerir não é transferir. Verificar justificativa, identidade por cadastro e autorização do gestor. Solicitar aceite e previsão ao novo indicado. Até aceite/ativação, não deixar a demanda sem responsável: preservar atribuição anterior ou estado de transição com dono gerencial definido. Se destinatário recusou/não respondeu, alertar Emerson. Preservar registro do antigo executor, suas horas, seu prazo e resultado parcial. Novo executor gera novo ciclo D-2.

**RN-011 — Apoio versus transferência:** 'Gabriela ajudaria' não pode ser interpretado automaticamente como mudança de titularidade. Se ambíguo, perguntar se `apoio` ou `transferência`. Apoio pode ser cadastrado como participação sem mudar o responsável principal conforme autorização.

**RN-012 — Declaração de conclusão:** executor pode declarar entrega total ou parcial; registrar `CONCLUSA_DECLARADA` ou conclusão da etapa. Não encerrar a demanda; suspender cobranças ordinárias durante a validação, preservando o prazo vigente. Solicitar ao gestor uma decisão explícita, inclusive se ele próprio foi o executor.

**RN-013 — Conclusão parcial e demanda filha:** se Gabriela afirma que concluiu vistoria e Manuel deve abrir um **novo chamado** de reparo, não transferir vistoria automaticamente. Confirmar produtos documentais se houver incerteza e propor duas decisões independentes: `A` validar/encerrar vistoria, `B` autorizar demanda filha para chamado. `A1 e B1` encerra demanda original e cria outra, **sem** inventar identidade de Manuel nem considerar chamado aberto. A filha aguarda triagem/atribuição e previsão próprias.

**RN-014 — Autorização de encerramento:** exclusivo do gestor autorizado e ato explícito dirigido à **demanda correta**. Concluir uma etapa ou aprovar um prazo não encerra. Pai e filha independentes: encerrar um não encerra o outro.

**RN-015 — Minimizador de perguntas:** obter dados de cadastro antes de perguntar, tratar histórico e contexto; não repetir perguntas respondidas. Se falta e-mail da pessoa, perguntar apenas após falha inequívoca de resolução. Dados complementares não essenciais (por exemplo, processo opcional 12345) não devem bloquear o andamento.

**RN-016 — Referências processuais:** processo `12345` pode ser associado como referência declarada opcional, **não verificada**. Configuração futura de máscara por órgão/tipo pode validá-lo, sem presumir que é SEI. Não afirmar juntada confirmada sem evidência externa; registrar “juntada declarada pela servidora”.

**RN-017 — Menu em todo e-mail que pede resposta:** incluir escolhas numeradas com instrução de que linguagem livre também é válida. E-mails meramente informativos podem não exigir resposta; se oferecerem ações, incluir menu contextual, não botões externos obrigatórios.

**RN-018 — Compatibilidade com e-mail natural:** aceitar erros de digitação, nomes parciais, datas, pares de opções e discurso livre. A IA devolve `intentions[]`, fatos alegados, campos e perguntas necessárias; máquina de estados verifica admissibilidade. Se o modelo for incapaz de extrair, submeter a triagem humana sem perda da mensagem.

**RN-019 — Auditoria e integridade:** identificar cada ação por mensagem, ator, versão, data, estado anterior e estado seguinte; todas as mudanças em transação, outbox para notificação; deduplicação na importação e nos avisos; proteção contra reexecução fora de ordem.

**RN-020 — Dashboard:** mostrar carteira de atividades por setor, executor, gestor, período, prazo, status, demandas pai/filha, notificações, solicitações e eventos. Toda edição no painel passa pelas mesmas regras e eventos do e-mail. Registrar último horário de sincronização para não insinuar tempo real em coleta periódica.

**RN-021 — Indicadores:** separar tempo de ciclo (datas), espera por terceiros, tempo declarado efetivo (apontamentos) e desempenho no prazo original versus revisado. Não atribuir horas pela duração entre mensagens.

**RN-022 — Segurança e conformidade:** integração Gmail depende de OAuth/autorização compatível, segredo protegido, permissões mínimas, política de retenção e aprovação institucional antes de dados reais. Não aceitar código de rastreio nem `From` textual como autenticação. Impedir loops por auto-respostas, mensagens automáticas, reencaminhamentos e instruções hostis no corpo.

## 5. Roteiro factual de simulação que deve ser preservado

1. Sem código e remetente institucional: demanda provisória de vistoria das calhas, encaminhada a Emerson.
2. Emerson orienta: "À Gabriela para vistoria acompanhada da Viva e informando Well do resultado. Fazer registro fotográfico e encartar no processo 12345". Identificar Gabriela, Viva, Well, fotos, referência opcional.
3. Gestor esclarece: Gabriela foi inserida em cadastro, desconsiderar Viva/Well como destinatários, Gabriela cuidará do necessário, processo pode ser presumido apenas **se** obedecer máscara; sem máscara configurada, 12345 fica **não verificado**.
4. Gabriela responde à pergunta de prazo: `26/10`. Prazo 26/10/2026; D-2 cai sábado 24/10; consolidar lembrete na confirmação de sexta 23/10.
5. Gabriela: `Mude para 30/10`. Falta justificativa; não modificar prazo.
6. Gabriela justifica indisponibilidade da Viva por atendimento no Arquivo Geral e diz não vislumbrar prejuízo. Encaminhar a Emerson, preservando distinção entre relato e verificação.
7. Emerson: `Autorizo` -> prorrogação **sem ressalvas** para 30/10/2026; D-2 em 28/10/2026.
8. Gabriela: `2 e 4. Indico Manuel` -> pedido composto; não mudar prazo ou responsável, pedir finalidade (transferência integral, apoio, só uma das opções) e motivo.
9. Gabriela esclarece: `Eu finalizei minha parte em 28/10, mas o Manuel precisa abrir um novo chamado para conserto de parte das telhas` -> conclusão parcial e proposta de demanda filha, não simples transferência.
10. Gabriela: `1 e 4` no menu de conclusão -> relatório, fotografias e juntada **declarados**; chamado de reparo ainda não aberto. Submeter `A` e `B` a Emerson.
11. Emerson: `A1 e B1` -> demanda `SIGA-2026-0001` encerrada definitivamente por autorização expressa; demanda filha `SIGA-2026-0002` criada com gestor Emerson e **responsável não confirmado**; não enviar a Manuel sem identificação.
12. SIGA solicita a Emerson identificação inequívoca de Manuel ou novo encaminhamento. A filha aguarda sem prazo até aceite/previsão. A cadeia acima não envia mensagens reais.

## Adendo v2.1 — Alterações negociais posteriores

**Obrigatório:** `docs/11_ADENDO_SDG_SEI_PRIORIDADES.md` prevalece quanto à especialização do dashboard executivo, campo de URL direta do SEI e prioridade gerencial. Introduz RN-023 a RN-026 e CA-29 a CA-39. O campo antigo `priority=\"NORMAL\"` está obsoleto e deve ser substituído por triagem sem prioridade e atribuição com `BAIXA`/`MEDIA`/`ALTA`. A referência de processo permanece opcional e separada de `process_url`. Nenhuma delas autoriza atos no SEI ou encerra demanda.
