# Segurança de e-mail e interpretação por IA

Implementado em 24/10/2026. Um e-mail pode conter instruções destinadas a enganar a IA, código, HTML ativo ou pedidos de acesso indevido. Isso é entrada não confiável, mesmo quando o remetente pertence ao domínio institucional. A existência desse risco não significa que ocorreu um ataque no SIGA.

## Limite de autoridade

O interpretador recebe somente o texto novo limitado, o contrato de extração, o menu e a data. A requisição ao provedor não oferece ferramentas, funções, SQL, shell, credenciais administrativas, histórico de outras demandas ou acesso à caixa. O endpoint do provedor é fixo. A chave de API é usada na autenticação da conexão, sem entrar no prompt.

Toda saída do provedor real recebe `requires_human_review=true` por imposição do servidor. Intenções são declarações; fatos recebem `NAO_VERIFICADO`, inclusive se o modelo afirmar que já verificou ou aprovou. Saída estruturalmente inválida, excessiva, truncada, com ferramentas, contexto divergente, data inválida ou evidência textual inexistente é rejeitada. A proposta é armazenada separadamente do motivo da revisão e aparece como **sem efeito de decisão**.

O coletor real escreve somente na fila de revisão, auditoria e controle de sincronização. Não executa `commandForMessage` nem altera demandas, usuários, papéis, senhas, configurações ou caixa de saída a partir da interpretação. Decisões humanas continuam sujeitas à autenticação, perfil, CSRF, regras de domínio, versão e transação. O encerramento definitivo continua exclusivo do titular. Removido também o fallback do simulador que podia completar uma prorrogação quando a interpretação exigia revisão.

## Inspeção e quarentena

- Inspeção antes da limpeza do texto, abrangendo as alternativas inline de MIME, assunto, Unicode normalizado, controles invisíveis, tentativa de assumir papéis, instruções ao sistema, pedidos de segredos, SQL destrutivo, comandos e HTML ativo. Esses sinais são indicadores conservadores, não prova de intenção maliciosa.
- Entradas suspeitas ficam em `QUARANTINED`, não são enviadas ao modelo e não têm botão de triagem direta. O original permanece no Gmail; o SIGA guarda uma cópia textual limitada, sinais, versão da política e hash dessa cópia. O hash não representa todos os bytes do original MIME.
- Todos os anexos são ignorados pela interpretação, inclusive arquivos de texto e e-mails encaminhados como anexo. Não há download adicional de anexos nem navegação por links ou carregamento de imagens remotas. Extensões executáveis, macros, arquivos compactados e MIME excessivo provocam quarentena.
- Limites: resposta Gmail de até 500 KB, até 100 partes MIME, profundidade 12, até 24 mil caracteres coletados e 12 mil de texto novo. Mensagens inválidas ou excessivas são isoladas e o lote continua. Até cinco mensagens novas e duas tentativas de extração por sincronização; o cursor anterior é preservado quando há mais mensagens, e a deduplicação permite continuar na próxima sincronização. Os limites anteriores de páginas de histórico/recuperação permanecem.
- HTML é limpo e apresentado como texto escapado. Propostas também são escapadas, sem links executáveis. A CSP continua restringindo scripts e conexões à própria aplicação.

Registros anteriores à migration 0008 começam como `UNASSESSED`; a consulta e a triagem reavaliam o texto disponível no servidor. Um registro já isolado conserva a quarentena mesmo após a limpeza remover a marcação HTML.

## Como aproveitar um pedido legítimo isolado

Em **Correspondência → Mensagens para revisão**, o gestor abre a entrada e escolhe **Reescrever pedido para triagem**. O formulário começa vazio. É necessário escrever assunto e pedido administrativo sem as instruções indevidas, justificar o aproveitamento e confirmar a revisão. O servidor reavalia a reescrita e rejeita conteúdo ainda suspeito, inclusive em uma chamada direta à API.

A confirmação cria somente uma demanda provisória, sem prioridade ou atribuição automática. Não libera o original para a IA nem aprova alterações de demanda existente. A decisão fica vinculada ao gestor e à mensagem de origem no histórico transacional; a repetição não cria duplicata. O registro original conserva seu estado de quarentena, embora deixe a lista de pendências após a triagem.

Ingestão e quarentena geram auditoria com UTC, ator técnico, correlação, recurso, sinais e hash; sem copiar corpo de e-mail ou credenciais para o log. Atos humanos são registrados com a identidade autenticada.

## Verificação e limites

80 testes Node/SQLite passaram, incluindo ataques diretos, Unicode, HTML, SQL, shell, saída de modelo comprometida, contratos inválidos, isolamento de anexos, limites, lotes, preservação de tabelas e tentativa de contornar a quarentena pela API. Nove cenários gerais e cinco fluxos privados de navegador passaram, incluindo reescrita, recusa de conteúdo ainda suspeito, seis larguras e acessibilidade automatizada. TypeScript, formato, guarda de segredos, validadores Python e dry-run Wrangler passaram; `pnpm audit --prod` sem vulnerabilidades conhecidas.

Os testes usam provedores fictícios e não leem/enviam e-mail real nem consomem API paga. Não foi produzido novo scan Codex Security selado nem homologação institucional. Filtros não reconhecem toda possível injeção de prompt; a proteção principal é a ausência de autoridade operacional da IA e a validação humana/determinística. Revisão humana também deve conferir identidade e conteúdo, sem tratar a proposta como prova.

Gmail e IA reais continuam desativados nas publicações. A configuração de OAuth e a ativação posterior devem preservar estas barreiras; anexos ou automação de decisões exigem projeto e validação próprios antes de serem habilitados.

Referência: [OWASP — prevenção de prompt injection](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).
