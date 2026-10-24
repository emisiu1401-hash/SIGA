# SIGA — Sistema Inteligente de Gestão de Atividades

[Abrir aplicação](https://siga.emisiu1401.workers.dev) · [Operação](docs/14_OPERACAO_DA_APLICACAO.md) · [Testes e limites](docs/15_VALIDACAO_E_LIMITES.md)

**[SIGA privado](https://siga-private.emisiu1401.workers.dev)**: banco separado, identidade Cloudflare Access e MFA obrigatório. A demonstração pública agora é somente consulta. Credenciais devem ser inseridas exclusivamente no ambiente privado ou nos Secrets do Worker `siga-private`. Veja [privacidade e ambientes](docs/16_PRIVACIDADE_E_AMBIENTES.md).

Aplicação baseada na especificação v2.3: núcleo de regras determinísticas, persistência D1/SQLite, painel executivo responsivo, perfis de acesso, correspondência simulada, fila Gmail e interpretador de IA substituível.

**Publicado como demonstração com dados inteiramente fictícios.** Sem envio real de e-mail, chamada paga de IA ou homologação institucional. A especificação recebida permanece em `docs`, `contracts`, `emails`, `db` e `prototype`; o README original está em `docs/00_PACOTE_ORIGINAL.md`.

## Funcionalidades

- Triagem, atribuição com prioridade explícita, aceite, prazo inicial, D-2 e prorrogações aprovadas pelo gestor.
- Transferência com responsabilidade preservada até aceite, apoio separado e snapshots históricos de seção.
- Declaração de conclusão distinta de encerramento; somente Emerson/GESTOR encerra. Decisões A/B e filha independente.
- Auditoria imutável de antes/depois, transações, controle de versão e idempotência.
- Oito KPIs, gráficos, filtros na URL, seções/servidores, dias, detalhes, paginação e cartões no celular.
- Cadastro/importação CSV, histórico de lotação, correspondência, configurações e simulador de e-mail.
- Token OpenAI configurável no painel ADMIN privado, criptografado no servidor com chave independente; Cloudflare Secret `AI_API_KEY` tem precedência. A demonstração rejeita tokens e gravações.
- Adaptador Gmail OAuth, cursor, recuperação, deduplicação e limites MIME. **Entradas reais vão à revisão humana; respostas reais não aprovam mudanças automaticamente nesta versão.**
- Troca de conta Google em Configurações, com conferência da identidade, pausa e retenção da fila anterior. [Configuração inicial e uso](docs/17_TROCA_DE_CONTA_GMAIL.md).
- [Documentação dentro do SIGA](https://siga-private.emisiu1401.workers.dev/documentacao.html): roteiro de troca Google, diagnóstico de leitura, busca por erros e soluções da implantação. [Manutenção e validação do guia](docs/22_DOCUMENTACAO_E_TROUBLESHOOTING.md).
- Importação/exportação Excel com template, validação, prévia, confirmação e versões; log persistente com filtros e download JSONL. [Como usar](docs/18_PLANILHAS_E_LOG.md).
- Senha individual após Cloudflare Access, troca inicial obrigatória, recuperação via Gmail e administração de acessos por perfil. [Senhas e usuários](docs/19_SENHAS_E_USUARIOS.md).

- Quarentena de e-mails suspeitos, anexos fora da interpretação, propostas da IA sem autoridade e reescrita segura pelo gestor. [Proteções e limites](docs/20_SEGURANCA_DE_EMAIL_E_IA.md).

- Páginas públicas de [apresentação](https://siga.emisiu1401.workers.dev/sobre.html), [privacidade](https://siga.emisiu1401.workers.dev/privacidade.html) e [termos](https://siga.emisiu1401.workers.dev/termos.html). [Preparação OAuth para produção e limites](docs/21_PAGINAS_PUBLICAS_E_OAUTH_PRODUCAO.md).

## Executar

Requisitos: Node.js 24 e pnpm 11.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Abra `http://127.0.0.1:8787`. O primeiro início cria SQLite em `.local/siga.sqlite`, aplica migrations e gera senhas aleatórias em `.dev.vars`. Ambos são privados e ignorados pelo Git. O guia de credenciais entregue neste computador está em `.local/ACESSO_SIGA.md`.

## Verificar

```sh
pnpm build
pnpm check
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:e2e:private
pnpm security:secrets
python tests/validate_spec.py
python tests/validate_addendum.py
python tests/validate_departamentos_v22.py
```

O teste Python do protótipo foi preservado: `python tests/test_responsive_browser.py` (requer pacote Python `playwright`; `SIGA_CHROMIUM_PATH` permite navegador local). As capturas vão para `.local/prototype-evidence`, sem sobrescrever as imagens recebidas.

Os testes usam SQLite real e provedores controlados. O e2e cria base isolada em `127.0.0.1:8788`; `SIGA_TEST_URL` permite verificar um deploy. Não apontar a suíte de mutação para dados institucionais.

## Código

| Pasta/arquivo | Responsabilidade |
|---|---|
| `src/domain.ts` | Políticas, estados, datas, identidade e SEI |
| `src/repository.ts` | D1/SQLite, agregações, projeções e transações |
| `src/worker.ts` | API, autorização e agendamento |
| `src/auth.ts` | Sessões, CSRF, login e criptografia |
| `src/interpreter.ts` | Mock/OpenAI com JSON Schema |
| `src/gmail.ts` | OAuth, coleta/revisão e envio condicionado |
| `public` | Interface embutida no Worker, sem assets remotos |
| `scripts` | Build, servidor Node e provisionamento GitHub |
| `tests/app`, `tests/e2e` | Testes do produto e usabilidade |
| `db/migrations` | 0001–0003 preservadas e extensões 0004–0007 |

## Cloudflare e integrações

Workers e bancos independentes: `siga` (demonstração) e `siga-private` (privado). `wrangler.jsonc` publica a demonstração; `wrangler.private.jsonc` publica o privado. O deploy usou o conector Cloudflare. Pela CLI autenticada: `pnpm build`, `pnpm exec wrangler deploy --dry-run --config wrangler.private.jsonc` e `pnpm deploy:private`.

O pedido de 24/10/2026 autorizou a implementação e o repositório **público**, prevalecendo sobre a orientação antiga de privado/gates de incremento. Isso não é homologação institucional. OAuth, identidade institucional e ativação real estão descritos no guia de operação.
