# 07 — Registro de decisões, suposições e riscos

## Complemento autorizado: senhas e gestores adicionais — 24/10/2026

O pedido atual autoriza cadastrar gestores adicionais. O papel permite gestão compartilhada, mas a competência de encerramento definitivo continua exclusiva de Emerson. Essa autorização substitui a restrição anterior de cadastro ordinário do papel GESTOR; não altera os demais requisitos de aceite, prazos, validação humana ou atuação da IA.

Senhas individuais são uma camada adicional ao Cloudflare Access/MFA. E-mail da identidade verificada precisa corresponder ao cadastro. Cadastro/credencial no SIGA não modifica automaticamente a allowlist da Cloudflare. A administração deve manter cadastro ativo, conta habilitada e e-mail autorizado em ambas as listas. Reemissão pelo ADMIN é poder sensível e auditado; a credencial do titular só pode ser reemitida pelo titular. Recuperação Gmail só funciona após configuração própria, permissão de envio e ativação da integração.

**Data:** 23/10/2026. Este documento recebe novas ADRs a cada incremento. Não assumir que algo foi homologado pelo simples fato de constar como sugestão.

## Decisões negociais confirmadas pela simulação

- DEC-N01: Canal de entrada principal: **Gmail monitorado** com filtro de mensagens originadas de `@tjmsp.jus.br`.
- DEC-N02: Sem código e sem correlação inequívoca → demanda provisória encaminhada a Emerson para triagem.
- DEC-N03: Gestor define responsável; executor informa sua estimativa de entrega; D-2 para lembrete.
- DEC-N04: Mudanças de prazo, responsabilidade e encerramento necessitam aprovação do gestor; prazo anterior preservado.
- DEC-N05: Todos os e-mails que solicitem resposta devem oferecer **números** e permitir linguagem livre; gestor tem `1` sem ressalvas, `2` com ressalvas, `3` indeferir, `4` esclarecer, `5` outra providência.
- DEC-N06: Emerson é gestor de todas as demandas e pode também executar tarefas, com prazo e justificativa; encerramento próprio exige decisão explícita separada.
- DEC-N07: Declaração de conclusão pelo executor volta para Emerson; somente ele encerra a demanda definitivamente.
- DEC-N08: Conclusão parcial pode originar nova demanda **filha**, não transferência automática; decisão dupla A/B independente.
- DEC-N09: Banco guarda distinção entre declarado e verificado; documento/processo opcional não validado não barra fluxo.
- DEC-N10: Testes desenvolvidos em ambiente fictício; plataforma prevista em Cloudflare + GitHub com arquitetura desacoplada.

## Políticas propostas (configuráveis) — não homologadas

| ID | Questão | Default para o simulador | Decisão real pendente |
|---|---|---|---|
| P-01 | Coleta do Gmail | a cada 15 minutos | frequência e caixa institucional permitidas |
| P-02 | Prazo D-2 em dia não útil | último dia útil anterior | feriados/expediente da organização |
| P-03 | Tipo de dias no D-2 | dias corridos, antecipação em não útil | dias úteis vs corridos |
| P-04 | Falta de resposta à atribuição | gerar alerta ao gestor após prazo configurável | SLA e escalonamento |
| P-05 | Falta de resposta à conclusão | pendência ao gestor, sem encerrar | tempo de cobrança da validação |
| P-06 | Horário de cron | configurável, fuso local convertido UTC | horários e feriados |
| P-07 | Limite de perguntas | 2 rodadas, depois escalar | limite homologado |
| P-08 | Política de retenção | dados simulados apenas | prazo e base normativa |
| P-09 | Autenticidade de mensagens | teste simula identidade confiável | implantação real com segurança Gmail/Workspace |
| P-10 | Transferência até aceite | manter vínculo com responsável anterior / gestor | momento exato de substituição |
| P-11 | Encerramento com ressalvas | pedir condições e se encerramento é imediato | política formal de ressalvas |
| P-12 | Destinatários e permissões SDG | leitura gerencial | governança detalhada e segregação |

## Bloqueios antes de dados reais

- TI aprovar conta Gmail específica, escopos OAuth, origem do domínio e política de envio de e-mail.
- Administração competente aprovar armazenamento/processamento institucional na Cloudflare ou outro host e escolha de IA (inclusive residência e compartilhamento de dados).
- Definir autenticação de gestor sobre mensagens de aprovação, prevenção de spoofing e resposta fraudulenta, classificação das informações.
- Definir retenção, logs, acesso, auditoria, backups e eventual integração SEI sem presumir que exista API autorizada.
- Confirmar custos reais e limites dos serviços na modalidade escolhida; não conectar provedores pagos nos testes sem autorização.

## Registro de novas decisões (Codex deve acrescentar)

| Data | ID | Problema | Opções consideradas | Escolha | Autor da decisão | Impacto e testes |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — |


## Decisões de implementação — 24/10/2026

- DEC-I01: instrução direta mais recente autoriza implementar todo o projeto e criar SIGA público no GitHub. Prevalece sobre a orientação antiga de privado e gates de incrementos; não implica homologação institucional.
- DEC-I02: Worker TypeScript com assets locais embutidos; D1 em Cloudflare e SQLite real no ambiente Node local. Mesmo domínio/API nos dois runtimes.
- DEC-I03: demonstração pública estritamente fictícia; contas mutáveis com senhas aleatórias privadas e sessão segura. Dados institucionais exigem desativar PUBLIC_DEMO e configurar identidade/SSO apropriada.
- DEC-I04: Gmail do conector verificado por perfil; o app requer OAuth próprio, não transfere credenciais do conector. Entradas reais retidas para corroboração humana; sem autorizações automáticas via From/DKIM/código.
- DEC-I05: token de IA salvo por ADMIN com AES-GCM, decriptado apenas no servidor; Secret AI_API_KEY tem precedência. Provedor inicial OpenAI, endpoint fixo. Simulação continua mock, sem custo de inferência.
- DEC-I06: condições de aprovação são registradas e exigem confirmação posterior antes de efetivação; comportamento conservador e reversível, sem presumir satisfação das ressalvas.
- DEC-I07: testes integrados complementam expressamente a prioridade omitida no fixture antigo; nenhuma prioridade inferida. Feriados, autenticação individual, anexos/retenção, threading Gmail e restauração institucional estão documentados como pendentes.
# Decisões complementares — Gmail, Excel e auditoria (24/10/2026)

- Conta Gmail de comunicação é independente da identidade de acesso. Troca exige consentimento Google pelo administrador, valida e-mail real e retém saída antiga; nenhuma fila é redirecionada automaticamente.
- Atualização Excel é limitada a metadados e cadastro. Aceite, prazo, transferência e encerramento continuam no domínio; importação exige prévia e confirmação atômica com versões.
- Log persiste em D1 com bloqueio de edição/exclusão pelo aplicativo. Administradores da infraestrutura ainda podem alterar schema; o hash do download não representa cadeia de custódia imutável externa. Política de retenção e arquivamento institucional permanece por definir.
- O cliente OAuth do aplicativo é uma configuração inicial própria; o conector Gmail da conversa não transfere tokens ao Worker. Nenhuma credencial real foi inventada ou publicada.
