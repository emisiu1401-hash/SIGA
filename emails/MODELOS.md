# Templates de e-mail SIGA — Versionamento 1.0

Todos os modelos devem ser parametrizáveis, manter `[SIGA-AAAA-NNNN]` no assunto e oferecer **opções numeradas quando houver necessidade de resposta**. Usar `{{variavel}}`, sempre preenchida a partir de dados validados. Nunca inserir e-mail não cadastrado. Não incluir HTML executável. A seleção isolada de `1` é interpretada apenas com o menu de mensagem/solicitação ativo.

## EMAIL-01 — Triagem de nova demanda (`NEW_TRIAGE`)
**Para:** `{{gestor_email}}`  
**Assunto:** `[{{codigo}}] Nova demanda para triagem`

Prezado Emerson,

Foi identificada nova mensagem institucional sem vínculo de demanda.

**Solicitante:** {{solicitante}}  
**Assunto original:** {{assunto}}  
**Resumo:** {{resumo}}  
**Data de recebimento:** {{recebida_em}}
**Prioridade:** {{prioridade_ou_nao_definida}}
{{bloco_link_sei_opcional}}

**Como deseja proceder?**

1 — Atribuir a servidor: informe nome/e-mail e a prioridade (Baixa, Média ou Alta).  
2 — Assumir pessoalmente: informe data de entrega e justificativa.  
3 — Solicitar esclarecimentos.  
4 — Arquivar como informativa/duplicada, indicando motivo.  
5 — Outra providência.

Pode responder normalmente, sem números.

## EMAIL-02 — Solicitação de previsão (`INITIAL_DUE_REQUEST`)
**Para:** `{{responsavel_email}}`  
**Assunto:** `[{{codigo}}] Nova atribuição — previsão de entrega`

Prezado(a) {{responsavel_nome}},

**Atividade:** {{titulo}}  
**Escopo:** {{descricao}}  
**Gestor:** {{gestor_nome}}  
**Documentação requerida:** {{produtos_esperados}}  
**Prioridade:** {{prioridade_rotulo}}  
**Referência de processo:** {{processo_referencia_com_estado_verificacao}}
{{bloco_link_sei_opcional}}

**Como deseja responder?**

1 — Aceito e informo a data prevista de conclusão (DD/MM/AAAA).  
2 — Preciso de orientação/esclarecimento.  
3 — Não posso assumir; apresento motivo.  
4 — Sugiro outro responsável; informo nome/e-mail e motivo.  
5 — Outra informação.

Também pode responder apenas com a data quando esta mensagem pergunta a previsão, ou com texto livre.

## EMAIL-03 — Confirmação de prazo e D-2 consolidado (`DUE_ACK`)
**Para:** `{{responsavel_email}}`  
**Assunto:** `[{{codigo}}] Prazo registrado — {{data_prazo}}`

Registrei sua previsão de entrega para **{{data_prazo}}**. {{texto_de_aviso_antecipado_se_aplicavel}}

1 — Confirmar que manterá a data.  
2 — Pedir mais prazo (nova data e justificativa).  
3 — Informar que concluiu (resultado e documentação).  
4 — Propor outro responsável (nome/e-mail e justificativa).  
5 — Relatar impedimento ou fazer pergunta.

Não é necessário responder se esta mensagem for apenas confirmação, salvo atualização relevante.

## EMAIL-04 — Lembrete de dois dias (`REMINDER_V1`)
**Para:** `{{responsavel_email}}`  
**Assunto:** `[{{codigo}}] Acompanhamento preventivo — entrega em dois dias`

A demanda **{{titulo}}** tem prazo autorizado para **{{prazo}}**.  
**Prioridade:** {{prioridade_rotulo}}  
{{bloco_link_sei_opcional}}
Qual a situação?

1 — Confirmo a entrega no prazo.  
2 — Preciso de mais prazo; informarei data e justificativa.  
3 — Já concluí; informarei resultado e documentação.  
4 — Outro servidor continuará; informarei quem e por quê.  
5 — Tenho impedimento ou preciso de orientação.

Pode combinar opções (ex.: `2 e 4`) ou escrever em linguagem livre.

## EMAIL-05 — Pedir justificativa de prorrogação (`ASK_EXTENSION_REASON`)
**Para:** `{{responsavel_email}}`  
**Assunto:** `Re: [{{codigo}}] Complementação de prorrogação`

Recebi o pedido de alterar o prazo de **{{prazo_vigente}}** para **{{prazo_pretendido}}**, ainda sem alteração efetiva.

1 — Justificar: informe motivo e eventual dependência.  
2 — Corrigir nova data e justificar.  
3 — Desistir do pedido e manter prazo vigente.  
4 — Solicitar orientação.  
5 — Outra providência.

O prazo atual permanece até aprovação do gestor.

## EMAIL-06 — Decisão simples do gestor (`MANAGER_APPROVAL_V1`)
**Para:** `{{gestor_email}}`  
**Assunto:** `[{{codigo}}] Aprovação solicitada — {{tipo}}`

**Responsável:** {{nome_responsavel}}  
**Situação vigente:** {{situacao_atual}}  
**Mudança solicitada:** {{proposta}}  
**Justificativa:** {{justificativa}}  
**Registro de evidência:** {{origem_do_relato}}  
**Prioridade:** {{prioridade_rotulo}}
{{bloco_link_sei_opcional}}

1 — Autorizar **sem ressalvas**.  
2 — Autorizar **com ressalvas** (descrever quais).  
3 — Indeferir (informar justificativa quando aplicável).  
4 — Solicitar esclarecimentos.  
5 — Determinar outra providência.

Responda `1`, `2 ...`, etc. ou em linguagem natural. Sem decisão, nada é modificado.

## EMAIL-07 — Duas decisões independentes (`MANAGER_DOUBLE_DECISION_V1`)
**Para:** `{{gestor_email}}`  
**Assunto:** `[{{codigo}}] Validação da vistoria e nova providência`

Gabriela **declarou** conclusão em **{{data_conclusao_declarada}}**, incluindo relatório, fotos e juntada. A efetiva documentação não foi verificada pelo sistema. Relatou necessidade de **novo chamado** para reparo de telhas a ser encaminhado a Manuel (cadastro a verificar).

**A — Demanda original {{codigo}}:**  
A1 — Autorizar **sem ressalvas** o encerramento definitivo.  
A2 — Autorizar **com ressalvas** (descrever condições e se encerramento é imediato).  
A3 — Indeferir conclusão.  
A4 — Pedir esclarecimentos.  
A5 — Outra providência.

**B — Nova demanda vinculada:**  
B1 — Autorizar **sem ressalvas** a criação da demanda para abertura de chamado corretivo.  
B2 — Autorizar **com ressalvas** (descrever condições).  
B3 — Indeferir criação.  
B4 — Pedir esclarecimentos.  
B5 — Outra providência.

Responda separadamente para A e B, por exemplo `A1 e B1`. As decisões são independentes.

## EMAIL-08 — Esclarecer transferência versus apoio (`ASK_TRANSFER_SCOPE`)
**Para:** `{{responsavel_email}}`  
**Assunto:** `[{{codigo}}] Esclarecimento sobre continuidade`

Compreendi que há pedido de prorrogação e indicação de **{{nome_indicado}}**. Para evitar interpretação errada:

1 — Transferência integral para a pessoa indicada, que informará novo prazo.  
2 — Pessoa indicada prestará apoio; continuo responsável e informarei nova data.  
3 — Apenas transferência, sem prorrogação.  
4 — Apenas prorrogação, permanecendo responsável.  
5 — Outra orientação.

Informe também o motivo. O responsável e prazo atuais permanecem até as decisões cabíveis.

## EMAIL-09 — Esclarecer conclusão/documentação (`DOCUMENTATION_V1`)
**Para:** `{{responsavel_email}}`  
**Assunto:** `[{{codigo}}] Confirmação da vistoria e reparo`

Você declarou que concluiu sua parte e que {{nome_indicado}} precisa abrir novo chamado para telhas. Informe:

**Sobre a vistoria:**  
1 — Concluí vistoria, relatório, fotos e juntada.  
2 — Concluí vistoria, mas há pendência documental (especificar).

**Sobre o reparo:**  
3 — Chamado já aberto (informar número).  
4 — Chamado ainda precisa ser aberto por {{nome_indicado}}.  
5 — Outra informação.

Pode combinar opções, como `1 e 4`; o SIGA registrará as informações como **declaradas**.

## EMAIL-10 — Identificação do novo responsável (`ASK_MANUEL_IDENTITY`)
**Para:** `{{gestor_email}}`  
**Assunto:** `[{{codigo_filho}}] Responsável da demanda vinculada`

A demanda original **{{codigo_pai}}** foi encerrada por sua decisão. A nova demanda **{{codigo_filho}}** foi criada para providenciar abertura de chamado de reparo das telhas. {{nome_sugerido}} foi indicado, mas não localizado de modo inequívoco no cadastro autorizado.

1 — Manter {{nome_sugerido}}; informar identificação/e-mail institucional.  
2 — Indicar outra pessoa e e-mail.  
3 — Assumir pessoalmente; informar data e justificativa.  
4 — Manter temporariamente sem responsável, com orientação.  
5 — Outra providência.

Não será enviado e-mail a pessoa não identificada.

## EMAIL-11 — Aceite de transferência/filha (`ASSIGNMENT_ACCEPTANCE_V1`)
**Para:** `{{novo_responsavel_email}}`  
**Assunto:** `[{{codigo}}] Nova atribuição — aceite e previsão`

O gestor aprovou o encaminhamento da etapa **{{titulo_etapa}}**. Sua atribuição está pendente de aceite.

1 — Aceito; informarei prazo de entrega.  
2 — Aceito com necessidade de esclarecimento.  
3 — Não posso assumir; informarei motivo.  
4 — Sugerir outra solução para o gestor.  
5 — Outra informação.

## EMAIL-12 — Encerramento informativo (`CLOSED_NOTICE`)
**Para:** `{{destinatario_validado}}`  
**Assunto:** `[{{codigo}}] Encerramento definitivo da demanda`

Informo que **{{gestor}}**, em **{{data}}**, autorizou expressamente o encerramento definitivo da demanda **{{codigo}} — {{titulo}}**. O histórico foi preservado. {{referencia_filha_se_houver}}

Mensagem informativa; não é necessário responder.

## EMAIL-13 — Impedimento ou pergunta (`ASK_BLOCKER_DETAILS`)
**Para:** `{{responsavel_email}}`  
**Assunto:** `[{{codigo}}] Esclarecimento de impedimento`

Recebi sua informação sobre **{{resumo_impedimento}}**.

1 — Informar o que impede a execução e desde quando.  
2 — Informar providência já tomada e de quem depende.  
3 — Solicitar apoio do gestor.  
4 — Informar que impedimento foi superado.  
5 — Outro esclarecimento.

Responda em linguagem livre, se preferir.

## Política de apresentação

- Uma mensagem pode conter **dois menus nomeados** A/B quando existem decisões distintas.
- Para destinatário sem demanda decidida, não enviar menu irrelevante: informar resultado e opções contextuais apenas quando há ação solicitada.
- Não oferecer `clicar no link` como meio obrigatório de responder; pode haver link opcional para painel.
- Proteger cabeçalhos contra injection de quebra de linha e limitar o tamanho de inserções. Corpo e anexos obedecem política de dados.

## EXTENSÃO v2.1 — Prioridade, link SEI e bloco obrigatório nos e-mails pertinentes

- O bloco `{{bloco_link_sei_opcional}}` é produzido por função de template central. Quando o URL validado estiver autorizado para aquele destinatário, conterá `**Processo SEI:** [Abrir processo no SEI]({{process_url_validada}})` no HTML e `Processo SEI: {{process_url_validada}}` no corpo texto. Não use endereço inventado ou não validado. Se não houver URL, bloco vazio.
- Aplicar bloco SEI a **todos os modelos relativos à demanda** (EMAIL-01 a EMAIL-13), preferencialmente no cabeçalho padronizado do renderizador para evitar esquecimento. Se o modelo não contém variáveis explícitas, o renderizador acrescenta o bloco ao resumo de demanda.
- Adicionar no contexto de e-mails a prioridade textual `Baixa`, `Média` ou `Alta`; em triagem, mostrar `Não definida`. Prioridade somente é efetivada por autorização de Emerson; designação exige escolha explícita.
- Exemplo de menu de seleção de prioridade para atribuição no e-mail ao gestor: `1 — Baixa`, `2 — Média`, `3 — Alta`, sempre em um **menu com identificador próprio**, distinto do menu de aprovação `1=autorizar sem ressalvas`. Não interpretar números sem identificador de menu.
- Ao incluir um URL de processo em e-mail enviado, escapar parâmetros e HTML; clientes podem exigir autenticação no SEI; o SIGA não afirma que o destinatário já está autenticado.

## Adendo v2.2 — bloco de seção nos e-mails

Todos os e-mails de atribuição, prazo, prorrogação, transferência e validação deverão contemplar no corpo, quando houver atribuição ativa:

- **Unidade responsável:** `{{departamento_codigo}} — {{departamento_nome}}`.
- **Responsável:** `{{responsavel_nome}}`.
- **Prioridade:** `{{prioridade_texto}}` (Baixa/Média/Alta).
- **Prazo vigente:** `{{prazo_vigente}}` e, quando houver, **Dias para vencer** ou **Dias em atraso**.
- **Processo SEI:** `{{numero_processo_opcional}}` e `{{bloco_link_sei_opcional}}` com endereço HTTPS validado pelo sistema; nunca criar URL por inferência.

A lotação exposta é a SEÇÃO ATUAL RESPONSÁVEL PELA DEMANDA, não confundir com origem do e-mail. Em transferência pendente, mencionar seção/responsável atuais + transferência proposta separadamente. Em registro histórico mencionar snapshot da seção correspondente à etapa.
