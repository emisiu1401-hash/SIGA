# Senhas individuais e perfis de acesso

O ambiente privado usa duas camadas: **Cloudflare Access** verifica o e-mail autorizado e o fator adicional; depois, **SIGA** solicita usuário/e-mail e senha individual. A identidade Cloudflare deve corresponder ao e-mail do cadastro. A demonstração pública permanece somente consulta e oferece um botão para abrir o ambiente privado.

Abra `https://siga-private.emisiu1401.workers.dev/login`. Complete a verificação Cloudflare com seu próprio e-mail. Informe a credencial recebida. Senhas temporárias devem ser trocadas no primeiro acesso; até lá, o backend bloqueia os dados e as operações do painel. As credenciais iniciais reais são entregues somente na conversa/arquivo local privado, nunca neste repositório.

## Primeiro acesso: cadastrar MFA no Cloudflare

Se aparecer **Nenhum método de autenticação configurado**, ainda falta cadastrar um dispositivo pessoal no Cloudflare Access. Abra [Cadastrar MFA](https://siga-emisiu1401.cloudflareaccess.com/AddMfaDevice), entre com o mesmo e-mail autorizado e adicione um aplicativo autenticador (Google/Microsoft Authenticator) ou um método compatível, como Windows Hello. No aplicativo autenticador, escaneie o QR code e confirme com o código de seis dígitos. Não envie o QR code, chave de configuração ou códigos para terceiros ou para esta conversa. Depois, retorne ao SIGA privado e complete a senha individual.

O portal **App Launcher** precisa estar habilitado e permitir o mesmo e-mail. Em 24/10/2026, o diagnóstico reproduziu `/NoAuth` com a mensagem de portal não ativado; a aplicação `app_launcher` foi criada com política limitada aos mesmos usuários autorizados. Os métodos de MFA da organização e a exigência de MFA do SIGA privado foram preservados. O portal de cadastro é a etapa anterior ao MFA, conforme o fluxo oficial da Cloudflare; isso não libera acesso ao SIGA sem o segundo fator.

Se o navegador continuar na página antiga, reabra o link de cadastro em uma aba nova ou janela privativa. A inscrição e a verificação do dispositivo pessoal precisam ser concluídas pelo próprio usuário. [Procedimento oficial](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/independent-mfa/#enroll-authenticators).

## Erro de redirecionamentos após o MFA

O cookie da aplicação Cloudflare Access deve usar `SameSite=Lax`, mantendo `HttpOnly=true`. A Cloudflare alerta que `SameSite=Strict` pode provocar `ERR_TOO_MANY_REDIRECTS` no retorno da autenticação entre domínios. O SIGA mantém verificação de origem/CSRF nas operações, validação do JWT Access e senha individual; MFA e allowlist continuam obrigatórios. [Referência oficial](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/#samesite-attribute).

Em 24/10/2026, após relato de loop ao abrir SIGA pelo portal, o diagnóstico encontrou logins autorizados repetidos em segundos e a aplicação configurada com cookie Strict. Foi alterado somente o atributo para Lax, preservando audiência, destino Worker, política de usuários e exigência de MFA. A inscrição de autenticador não foi apagada. Para testar sem cookies anteriores, abra o [SIGA privado diretamente](https://siga-private.emisiu1401.workers.dev/login) em janela anônima/privativa, confirme e-mail e MFA quando solicitado e informe a senha individual. Não é necessário recadastrar o Google Authenticator.

A leitura de configuração confirma a alteração; a prova final do fluxo com o dispositivo pessoal depende do usuário. Não confundir essa conferência com login pessoal concluído pelo agente.

## Trocar e recuperar senha

- **Alterar minha senha**, junto aos controles de sessão: informe a atual e a nova senha, confirmando-a. A aplicação encerra todas as sessões dessa conta; entre novamente.
- **Esqueci minha senha**, na tela de entrada: informe o usuário ou e-mail cadastrado. Quando o Gmail estiver configurado e ativado, o aplicativo enviará um link de uso único com validade de 15 minutos para o endereço cadastrado. A senha anterior continua válida até a efetivação da redefinição. A conta e os papéis não são alterados.
- O link não contém senha. O token fica no fragmento da URL, é retirado da barra de endereços pela tela e nunca integra a fila comum de correspondência nem o log. O banco armazena somente o hash do token. Uso, expiração, troca de e-mail, nova credencial ou redefinição concluída invalidam o link. A identidade Access também precisa corresponder à conta.
- Se o Gmail estiver pendente, o formulário informa essa condição e não finge um envio. Configure OAuth e a conta de comunicações pelo [guia 17](17_TROCA_DE_CONTA_GMAIL.md). A recuperação exige conexão com permissão de envio, sem pausa, `SIMULATION_MODE=false` e `EMAIL_SEND_ENABLED=true`. A conta remetente é independente da conta do usuário.

Senhas pessoais aceitam 15 a 128 caracteres, incluindo frases longas. Não há troca periódica arbitrária; troque após suspeita de exposição. Nunca compartilhe a senha do titular para dar acesso a outra pessoa.

## Habilitar outros usuários

Em **Usuários e acessos**, o administrador:

1. Cadastra a pessoa com seu e-mail real, seção e perfil, ou edita o cadastro em Equipe.
2. Seleciona a pessoa e um identificador de acesso. O botão **Habilitar acesso / emitir senha temporária** gera uma credencial aleatória exibida uma única vez. Guarde e entregue por canal restrito. Reemissão invalida senha, sessões e links anteriores.
3. Autoriza explicitamente o mesmo e-mail nas políticas da aplicação **SIGA privado** e do **App Launcher** (para cadastro de MFA), e no Secret `ACCESS_ALLOWED_EMAILS` do Worker privado. Essas listas não são abertas automaticamente pelo cadastro. A tela indica essa pendência. Não libere todo o domínio nem desative MFA para simplificar o cadastro.

Na Cloudflare, edite as políticas Allow dos aplicativos **SIGA privado** e **App Launcher**, preservando os e-mails já autorizados e acrescentando o endereço exato. Atualize o Secret do Worker **siga-private** com a lista de e-mails separados por vírgula. Nunca edite a demonstração nem copie senhas para variáveis públicas.

| Perfil | Permissões |
|---|---|
| SDG_LEITOR | Painel, filtros, indicadores e consulta. Pode trocar/redefinir a própria senha e sair; continua sem escrita administrativa. |
| EXECUTOR | Atua nas demandas em que está atribuído: aceite, prazo proposto, pedidos, declarações e apontamentos. Não aprova mudanças gerenciais nem encerra demandas. |
| GESTOR | Cria e administra demandas, atribuições, prioridades e decisões de gestão. **O encerramento definitivo continua exclusivo de Emerson (`u-gestor`)**; Gestor adicional não herda essa competência. |
| ADMIN | Gerencia cadastro, acessos e configurações. O papel sozinho não concede encerramento. Somente o titular pode reemitir a credencial do próprio titular. |

A solicitação atual autorizou habilitar gestores adicionais, ampliando a regra anterior que reservava o papel ao titular. A exceção de encerramento não foi ampliada. As novas demandas permanecem vinculadas ao titular para notificações; os eventos preservam o gestor que praticou cada ato. A importação Excel de metadados de demandas continua restrita ao titular, conforme o fluxo já implementado.

**Desabilitar acesso** encerra sessões e invalida links. Desativar/alterar cadastro também revoga as sessões existentes. A API consulta papéis e situação atuais a cada requisição. Para retirada completa, remova também as autorizações/listas e sessões Cloudflare. O titular e a conta técnica do sistema têm proteção contra edição/desabilitação indevida.

## Controles implementados e limites

Senhas usam scrypt com sal aleatório por credencial (`N=16384`, `r=8`, `p=5`, chave de 32 bytes), uma das configurações mínimas alternativas publicadas pela [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Não há senha reversível armazenada no banco. Sessões opacas aleatórias são armazenadas por hash, expiram em oito horas e são revogáveis; cookie HttpOnly/Secure em HTTPS, SameSite Lax para retorno OAuth, verificação de origem e CSRF nas operações. Tokens de recuperação são aleatórios, armazenados por hash e protegidos por uso único/versão/expiração, seguindo os princípios de [recuperação OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

Há limites atômicos por conta e IP, inclusive na recuperação, troca e aplicação do link. O aplicativo não devolve hash de senha ou tokens de sessão nas consultas; logs não registram senhas ou links. A emissão de senha temporária retorna o segredo somente ao administrador autenticado que solicitou, em resposta sem cache. Administrador de infraestrutura ainda controla banco, código e cofres; este controle não elimina esse limite de confiança.

Testes usam usuários/e-mails fictícios, Access assinado localmente e Gmail simulado. A função scrypt também foi exercitada em um Worker temporário remoto sem banco/segredos e removido em seguida. O primeiro login pessoal, inscrição de MFA e entrega efetiva de e-mail Gmail não são declarados homologados pelos testes.
