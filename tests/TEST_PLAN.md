# Plano de execução dos testes (tarefas obrigatórias para o Codex)

## Tipos

1. **Unidade:** parsing de código e texto novo, ancoragem de datas, menus/contexto, políticas, papéis, transições, D-2 e anticiclo.
2. **Integração local:** migrations SQL reais no SQLite, repositórios, efeitos de domínio e outbox transacional.
3. **Contrato de IA:** todos os mocks/saídas são validados por `contracts/interpretacao.schema.json`; conferir saída inválida, múltiplas intenções, fatos declarados e fallback humano.
4. **Fluxo ponta a ponta mock:** reproduzir `contracts/fixtures_simulacao.json` na ordem. Persistir eventos reais em banco local, comparar `expected` com estados e outbox da execução.
5. **Negativos e recuperação:** `historyId` inválido, mensagens repetidas, e-mail externo, conta não autorizada, aprovação obsoleta, codificação HTML, duas decisões conflitantes, nome de destinatário ambíguo, prompt injection e transferência não aceita.

## Critérios mínimos técnicos

- O interpretador fake não deve simular a mutação; apenas retornar **intenções**. O motor de regras e o handler transacional devem gerar mudanças reais no banco de teste.
- Proibir rede no ambiente de teste. Fake de saída guarda e-mails produzidos para conferência de destinatários e menus numéricos.
- Relógio fixável: 2026-10-23 para `26/10` e cron em 2026-10-28 para `30/10`.
- Validar que **nenhum** teste de conclusão por executor consegue colocar `demands.status='ENCERRADA'` sem um ato gerencial separado.
- Validar que não surgem dois filhos `SIGA-2026-0002` em reprocessamentos; se outro código for sequenciado, preservar unicidade.
- Verificar SQL via ferramenta SQLite e chaves estrangeiras; não usar migrations inventadas sem executá-las.
- Cobertura dos casos CA-01 a CA-28 conforme incrementos implantados; evidências no registro de evolução.

## Sequência de verificação integradora ao atingir INC-08

```
SIM-01 nova demanda provisória
SIM-02 instrução de Emerson com Gabriela/Viva/Well/fotos/processo
SIM-03 desconsiderar contatos extras; cadastros; processo opcional
SIM-04 prazo inicial 26/10; D-2 consolidado 23/10
SIM-05 mudança para 30/10 incompleta
SIM-06 justificativa; aguardar gestor, manter 26/10
SIM-07 autoriza => prazo 30/10; agenda 28/10
SIM-08 "2 e 4. Indico Manuel" => duas intenções, nada efetivado
SIM-09 "finalizei minha parte" => conclusão declarada + proposta de filha
SIM-10 "1 e 4" => documentos declarados; chamado não aberto
SIM-11 "A1 e B1" => encerrar 0001, criar filha 0002 sem responsável
SIM-12 gestor não informa e-mail Manuel => pedir identificação, não enviar
```

**Não basta imprimir expectativas como se fossem resultados.** Cada cenário exige asserts sobre banco, outbox, eventos, timestamps, status, destinatários e número de efeitos efetivamente gerados.

## Roteiro adicional de testes v2.1

- Rodar `python tests/validate_addendum.py` para validar migração SQLite e contratos textuais; executar depois testes de aplicação.
- Testar CA-29 a CA-39, incluindo caso de prioridade ausente, alteração apenas pelo gestor, não manipulação pelo SDG, link HTTPS permitido/bloqueado, e-mails com URL, mudança refletida no gráfico e sincronização Gmail pendente.
- Testar que demandas sem URL e referência de processo sem máscara validada não impedem criação ou atribuição.
- Testar que o clique "Abrir no SEI" é oferecido apenas para URL permitida e não executa juntada, abertura de processo nem outras ações no SEI.

## v2.3 — testes obrigatórios de responsividade (CA-55..CA-69)

- `python tests/test_responsive_browser.py` testa o protótipo offline em larguras de 360, 390, 768, 1024, 1366 e 1920 px. Exige Playwright e Chromium; se indisponíveis, reportar teste NÃO EXECUTADO, jamais APROVADO.
- Validar ausência de rolagem horizontal global, coerência do conjunto filtrado entre cartões móveis e tabela desktop, abertura/fechamento dos controles e detalhe. Capturar evidência visual para 390, 768 e 1366 px.
- Quando desenvolver o app real: adicionar testes de API (papel SDG somente leitura, SEI com URL validada, paginação), e2e de mobile, teste de foco modal com teclado, checagem de contraste e reduced motion; não confundir teste de protótipo com validação do produto.
