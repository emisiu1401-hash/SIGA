# Conta Google das comunicações

O administrador pode trocar a caixa em **Configurações → Conta Google das comunicações**. A conta usada para receber/enviar mensagens é independente da identidade de acesso ao SIGA. Trocar a caixa não troca o proprietário nem os papéis do sistema.

## O que fazer quando aparece configuração inicial pendente

No SIGA, abra **Configurações → Conta Google das comunicações → Configurar Gmail (passo a passo)**. O botão apresenta as etapas Google/Cloudflare e permite copiar o endereço de retorno correto. A mensagem antiga **Aguardando OAuth** foi substituída: ela escondia que ainda faltam as credenciais do aplicativo, não uma senha do usuário. Enquanto isso, conectar e sincronizar permanecem indisponíveis, com o motivo explicado.

Depois de cadastrar os dois Secrets na Cloudflare, volte ao SIGA e clique em **Já configurei · verificar novamente**. Quando o servidor detectar as credenciais, aparecerá o formulário **Conectar ou trocar conta Google**. A sequência é: (1) preparar o aplicativo Google, (2) autorizar a conta desejada e (3) habilitar a operação real/retomar a conta. Salvar um token de IA não executa essas etapas e não ativa automaticamente consumo pago de IA.

## Configuração inicial, uma vez

O Worker precisa de um cliente OAuth próprio. O conector Gmail desta conversa não entrega suas credenciais ao aplicativo. Crie um projeto no Google Cloud, habilite Gmail API e configure o consentimento OAuth conforme as políticas da organização. Para um aplicativo em teste, inclua as contas autorizadas como usuários de teste; contas institucionais podem depender de aprovação do administrador Google Workspace. Consulte a documentação oficial de [OAuth para aplicações web](https://developers.google.com/identity/protocols/oauth2/web-server).

Crie um cliente do tipo aplicativo web com este URI de redirecionamento exato:

```text
https://siga-private.emisiu1401.workers.dev/api/gmail/oauth/callback
```

Cadastre `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` como Secrets do Worker **siga-private**, pela Cloudflare. Nunca os coloque em Git, planilhas, logs ou variáveis do frontend. `SECRET_ENCRYPTION_KEY` já protege as credenciais armazenadas no servidor. A variável `GOOGLE_OAUTH_REDIRECT_URI` já contém o retorno correto. Não configure essas credenciais na demonstração pública.

O aplicativo pede `gmail.readonly`. A opção de envio adiciona `gmail.send`; a autorização retornada precisa cobrir as permissões solicitadas. O modo de teste do Google pode expirar autorizações e exigir reconexão. O uso institucional pode exigir verificação do aplicativo ou autorização interna do Workspace.

## Conectar e trocar

1. Entre no ambiente privado como administrador e abra Configurações.
2. Informe a conta que deseja usar e marque envio somente se necessário.
3. Clique em **Conectar ou trocar conta Google** e selecione essa mesma conta na página do Google.
4. Ao retornar, confira o endereço conectado. O servidor consulta o [perfil da caixa](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/getProfile), conferindo o e-mail real, além de validar state, PKCE, escopos e sessão do administrador.
5. A conexão fica pausada. Quando a implantação estiver autorizada para integração real, retome explicitamente as comunicações da conta exibida.

Repita o procedimento quando desejar mudar de conta, inclusive de uma conta pessoal de testes para a institucional. Cancelamento, conta diferente ou conflito com outra operação preservam a conexão anterior. Se houver operação em andamento, aguarde o término e tente novamente. O acesso de login e sua allowlist Cloudflare continuam sendo administrados separadamente.

## Histórico e mensagens pendentes

Demandas e eventos são preservados. Cursores e deduplicação são separados por caixa. A primeira conexão inicia no histórico atual do Google e não importa silenciosamente todos os e-mails antigos; veja o [guia de sincronização Gmail](https://developers.google.com/workspace/gmail/api/guides/sync). Mensagens antigas pendentes são retidas com motivo `CONTA_ALTERADA`, permanecem vinculadas à caixa anterior e não são reenviadas automaticamente pela nova conta. Confira Correspondência antes de preparar uma nova mensagem.

Os refresh tokens são cifrados com AES-GCM e nunca retornam em configurações, exportações ou logs. Após a troca, a credencial anterior é removida do armazenamento ativo do SIGA; isso não equivale a revogar a autorização na conta Google. Para revogação completa, remova o acesso nas configurações de segurança da conta anterior. Backups anteriores podem conter a cópia cifrada.

## Estado desta entrega

Recurso implementado e testado com provedores fictícios. O cliente OAuth Google ainda não foi fornecido/configurado; não há caixa real conectada. A implantação continua com `SIMULATION_MODE=true`, `EMAIL_SEND_ENABLED=false`, IA mock e sem cron. A ativação real exige revisão da configuração da plataforma: `SIMULATION_MODE=false` e, para envio, `EMAIL_SEND_ENABLED=true`, além das permissões Google e da retomada pelo administrador. Nenhuma caixa real foi lida e nenhum e-mail real foi enviado nos testes.
