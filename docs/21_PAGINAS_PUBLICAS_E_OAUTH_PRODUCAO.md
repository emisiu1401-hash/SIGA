# Páginas públicas e preparação OAuth para produção

Criadas em 24/10/2026, a pedido do titular, para fornecer os endereços de Branding do Google Auth Platform.

| Campo Google | Endereço publicado |
|---|---|
| Página inicial do aplicativo | https://siga.emisiu1401.workers.dev/sobre.html |
| Política de Privacidade | https://siga.emisiu1401.workers.dev/privacidade.html |
| Termos de Serviço | https://siga.emisiu1401.workers.dev/termos.html |

As páginas são públicas no Worker de demonstração e não consultam a caixa nem expõem o banco privado. O rodapé do painel e a tela de senha apontam para os documentos públicos. O aplicativo privado permanece em `https://siga-private.emisiu1401.workers.dev`, protegido integralmente por Access; não abrir exceção para servir política pública no mesmo Worker privado.

## O que ainda falta para produção Google

O titular informou nesta etapa que não possui domínio próprio. Publicar estes endereços não comprova propriedade de domínio nem conclui a aprovação OAuth. A verificação do Google exige domínio verificável da aplicação e dos endereços associados, incluindo callback. Não declarar `workers.dev` um domínio pertencente ao titular nem prometer aprovação dos subdomínios compartilhados. Definir um endereço cujo controle possa ser comprovado, por domínio próprio ou autorizado da organização, e validar a estratégia na Search Console antes de submeter a marca.

O SIGA pede `gmail.readonly` e, opcionalmente, `gmail.send`. Permissões sensíveis/restritas podem exigir verificação e, conforme o uso e as exceções aplicáveis, avaliação de segurança. Mudar o status para produção não substitui essas etapas. O erro de acesso de usuário de teste é resolvido pela lista de testadores do mesmo projeto, sem precisar declarar o aplicativo pronto para produção.

A política publicada descreve fatos e limites da versão atual: persistência privada, credenciais cifradas, permissões, fila de revisão, IA externa opcional, revogação, retenção ainda sem expurgo global automático e procedimento administrativo de exclusão. Não foi inventado prazo de retenção, canal de privacidade, aprovação institucional, certificação ou aprovação Google. O contato usa o suporte indicado no consentimento e o administrador que concedeu o acesso. Antes do uso institucional, o responsável precisa definir contato, retenção, procedimentos e demais requisitos aplicáveis, e revisar estes documentos.

Ao migrar os endereços, atualizar páginas, links do produto, Secrets/variáveis, configuração local, URI autorizado no Google e guias. O consentimento Google e a verificação de domínio continuam sendo procedimentos externos da conta do titular. Nenhuma publicação das páginas ativa automaticamente Gmail, IA paga ou envio.

## Validação

Em 24/10/2026, o titular forneceu o arquivo de verificação Search Console para publicação em `https://siga.emisiu1401.workers.dev/google7a0e37e960389c87.html`. O sufixo `(1)` do download foi removido do nome, mantendo o conteúdo original. O arquivo deve permanecer publicado para futuras verificações. A confirmação da propriedade na conta Google e a análise de marca/domínios/escopos continuam externas; não declarar aprovação com base apenas no HTTP 200 do arquivo.

Navegação entre as páginas, HTTP 200/Content-Type/CSP, links internos, conteúdo declarado, ausência de requisições externas, seis larguras (360/390/768/1024/1366/1920) e axe exercitados em teste local de navegador. Suítes geral e privada verificam também regressões no painel, login e demais fluxos. Fontes normativas não equivalem a certificado de conformidade.

Referências: [OAuth 2.0 Policies](https://developers.google.com/identity/protocols/oauth2/policies), [verificação de escopos restritos](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification), [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy).
