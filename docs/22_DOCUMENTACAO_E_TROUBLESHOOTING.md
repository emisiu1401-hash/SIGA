# Documentação operacional e troubleshooting do SIGA

A pedido do titular, criado um guia navegável baseado nos problemas reais de configuração e conexão encontrados na implantação de 24/10/2026. A conta Google foi conectada pelo titular e o banco confirmou uma conexão pausada; isso não representa ativação de leitura/envio. Não foram lidos conteúdos Gmail nem usados tokens pelo Codex para validar a caixa.

## Onde abrir

- Menu lateral **Documentação**, disponível nos perfis do SIGA.
- **Configurações → Conta Google das comunicações → Documentação: trocar conta e resolver problemas**.
- Orientação de retorno OAuth → **Ver orientação na Documentação**, com o erro correspondente aberto e focado. Sucesso aponta para a explicação da pausa.
- Tela de senha → **Documentação e ajuda para entrar**.
- Endereço privado: `https://siga-private.emisiu1401.workers.dev/documentacao.html`.

O texto também pode ser consultado na demonstração pública, sem dados pessoais/credenciais e sem consulta cruzada ao privado. O mesmo caminho privado permanece coberto pelo Access. O guia não altera políticas para contornar autenticação.

## Conteúdo e manutenção

Fonte única da orientação ao usuário: `public/documentacao.html`. Estilos em `documentacao.css`; busca, seleção por erro e diagnóstico em `documentacao.js`. Atualizar a data de revisão ao alterar os procedimentos. Preservar o arquivo Google de propriedade e os endereços OAuth ao publicar.

O guia cobre troca da conta pessoal para a institucional; diferença entre caixa de comunicações, acesso SIGA e projeto Google; ponto de corte/cursor, mensagens retidas e reconexão; sucesso pausado e ativação; teste/produção e testadores; Secrets em Produção versus Prévias; cliente e callback; Gmail API; Google 500 e referências de auditoria; permissões; proteção/persistência; marca/Search Console; MFA/cookies; usuários, senhas e revisão de novas demandas.

A navegação e a busca são locais, sem Analytics, armazenamento persistente, dependências remotas ou envio de termos pesquisados. O link de erro inclui somente um código conhecido, sem referência do pedido ou parâmetros OAuth.

## Diagnóstico e privacidade

Somente GET `/api/session` e, para Gestor/ADMIN autenticado fora da demo, GET `/api/settings`. Usa as permissões existentes, não cria endpoint nem autoriza ações. Não conecta, retoma, sincroniza, envia, altera configurações ou consome IA. Consultas seguem a auditoria normal do servidor.

Estado exibido é lido da sessão atual, com horário em São Paulo; não declara verificar remotamente a marca, os testadores ou as políticas Workspace. A conta de comunicações pode aparecer na página para o gestor autenticado. O relatório copiável usa allowlist fixa de estados técnicos, sem e-mail, identidade, tokens, Secrets, cookies ou URL/query. Quando o clipboard falha, um campo somente leitura permite a cópia manual do mesmo relatório. Nada é enviado automaticamente.

Sucesso de OAuth não aciona o botão de retomada nem modifica flags da implantação. Validação Google da marca foi informada pelo titular; aprovação de escopos e permissão institucional continuam verificações distintas. Os caminhos dos fornecedores são apoiados em referências oficiais e podem mudar.

## Validação

Browser plugin especializado não disponível; usado Playwright/Chrome com ambiente privado fictício e fixtures de Access. Cenário principal: Configurações → menu Documentação → buscar código → abrir correção → copiar callback e diagnóstico. Validados estado conectado/pausado/em simulação, fallback de clipboard, sessão vencida, perfil limitado, erro OAuth contextual, demonstração sem consulta de configurações privadas, ausência de ações POST/rede externa, seis larguras e axe. Capturas ficam fora do repositório. Resultados finais registrados no documento 09.
