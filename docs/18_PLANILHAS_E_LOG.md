# Excel e log detalhado

## Atualização por planilha

No ambiente privado, abra **Planilhas Excel**. Baixe o template vazio para conhecer a estrutura ou cadastrar pessoas; para atualizar registros existentes, prefira **Exportar dados atuais**, pois traz identificadores e versões corretos. Escolha Demandas ou Pessoas, selecione o `.xlsx` e clique em **Validar e mostrar prévia**. Confira os campos antes/depois e confirme. Sem confirmação, nenhum cadastro ou demanda é modificado. A prévia pertence ao usuário e vale 15 minutos. A exportação pode conter dados pessoais: armazene em local restrito.

| Aba | Colunas | Atualização permitida |
|---|---|---|
| Demandas | id, codigo, versao, titulo, descricao, prioridade, referencia_processo, url_sei, situacao, responsavel_id, secao, prazo_atual | titulo, descricao, prioridade, referencia_processo, url_sei |
| Pessoas | id, versao, nome, email, secao, papeis, ativo | nome, email, secao, papeis, ativo; id/versao vazios cadastram uma nova pessoa |

Prazos, responsabilidades, transferência, aceite, situação e encerramento seguem os fluxos próprios. Só Emerson/GESTOR atualiza demandas; ADMIN atualiza pessoas. Cadastros do gestor e sistema são protegidos. ADMIN/GESTOR podem exportar. SDG/EXECUTOR não recebem acesso a estes arquivos administrativos.

Use prioridades `BAIXA`, `MEDIA`, `ALTA`; seção `SLC`, `SAP`, `SME`, `AE`; ativo `SIM` ou `NÃO`. Papéis ordinários: `EXECUTOR`, `SDG_LEITOR`, `ADMIN`, separados por `;`. Somente URLs HTTPS nos domínios SEI autorizados. Não modifique nomes de colunas, IDs ou versões. No template, amarelo identifica entrada e cinza identifica contexto, sem substituir validação no servidor.

Limites: `.xlsx` até 5 MB, 1.000 linhas preenchidas, 100 mudanças por confirmação. Exportação até 5.000 demandas; se ultrapassar o limite de importação, divida o arquivo preservando cabeçalhos. Há limites adicionais de conteúdo/histórico por lote; reduza o lote quando solicitado. Os arquivos não aceitam fórmulas, macros, objetos incorporados ou pacotes com vínculos externos. ZIP possui limites de expansão, entradas, XML, células e CRC; XML com DTD/entidades externas é rejeitado. Números de versão, duplicatas e campos protegidos são conferidos antes da confirmação.

A aplicação revalida permissões e versões, executa o lote inteiro e seus eventos de auditoria em uma transação D1. Um conflito ou erro de banco desfaz o lote; reexporte os dados e valide novamente. Repetir confirmação concluída retorna o resultado anterior. Prévia interrompida durante aplicação não é reaplicada automaticamente; gere outra prévia. Conteúdo de prévias vencidas é removido na próxima validação bem-sucedida; backups têm ciclo de vida próprio.

## Log de auditoria

**Trilha de auditoria** permite consulta por usuário, ação, resultado e período. Cada registro inclui ID, usuário/nome/papéis, instante UTC ISO 8601, ação, recurso, origem, resultado e identificador de correlação. Eventos HTTP incluem status e duração; eventos de negócio registram versões e referências ao histórico antes/depois. O painel mostra data/hora com segundos em `America/Sao_Paulo` e o instante UTC nos detalhes. Mudanças de pessoas registram antes/depois; alterações de demandas mantêm os snapshots nos eventos da demanda.

O botão **Baixar arquivo de log (.jsonl)** gera uma linha JSON de metadados e uma linha por evento. Abre em editor de texto e ferramentas de análise. O cabeçalho HTTP `X-Content-SHA256` permite comparar o arquivo transferido. Exporte até 5.000 registros por recorte, máximo 12 MB; o metadado `truncated` e `total` informam corte por quantidade. Reduza o período para obter o restante. A paginação do painel não restringe o arquivo ao conteúdo da página atual.

O log persiste em D1, não no disco efêmero do Worker. Triggers rejeitam UPDATE/DELETE pelo aplicativo; não há endpoint de edição/exclusão. Tokens, senhas, cookies, códigos OAuth, corpos de e-mail e cabeçalhos de autorização não são registrados. Há redação adicional de campos sensíveis e limites de tamanho. ADMIN/GESTOR têm consulta/exportação; arquivos de log podem conter informações pessoais e devem ficar em local restrito.

Requisições autenticadas de mudança têm registro de início antes de executar. Mudanças de domínio, pessoas, conta Gmail, token IA e aplicação de planilhas incluem auditoria na transação. Encerramentos HTTP, negações após validação do ambiente e exportações administrativas têm correlação; falha posterior ao commit é sinalizada com `X-SIGA-Audit-Degraded` e diagnóstico sem segredo, preservando o resultado real da operação. Bloqueios na borda Cloudflare, indisponibilidade total do banco e requisições rejeitadas antes da validação do ambiente não geram linha D1; consulte os controles da plataforma.

Registros anteriores à migration 0006 continuam nos eventos legados e no histórico das demandas, sem fabricar retroativamente horários/usuários. O novo log começa nesta versão. Não se declara inviolabilidade perante administrador da infraestrutura: ele controla schema, backups e credenciais. Não há arquivamento automático em WORM nem política institucional de retenção já homologada. A aplicação não apaga registros de auditoria; defina prazo, acesso a backups, exportação protegida e retenção com o responsável antes de uso institucional prolongado.
