# Instruções de atualização do SIGA para v2.3

**Este pacote é completo (v2.0 + v2.1 + v2.2 + adendo v2.3).** Preserva histórico, regras negociais, banco e integração simulada. É uma especificação e protótipo, não a aplicação de produção.

## Quando o Codex ainda não começou

1. Criar repositório privado e extrair todos os arquivos na raiz.
2. Ler README, AGENTS e docs/13_RESPONSIVIDADE_E_TESTES_V23.md.
3. Usar PROMPT_PARA_CODEX.md e autorizar **somente o Incremento 0**.
4. Não habilitar Gmail, Cloudflare real, chaves, deploy ou IA paga sem autorização.

## Quando o Codex já está trabalhando na v2.2

1. Não sobrescrever código, migrations aplicadas ou alterações próprias do repositório. Criar commit/branch de segurança.
2. Incorporar `docs/13_RESPONSIVIDADE_E_TESTES_V23.md` e os apêndices v2.3 de `AGENTS.md`, `README.md`, `PROMPT_PARA_CODEX.md`, `docs/04_ROTEIRO_INCREMENTAL.md`, `docs/05_CENARIOS_DE_ACEITE.md` e `tests/TEST_PLAN.md` por merge/revisão, respeitando alterações existentes.
3. Usar `prototype/dashboard_sdg_demo.html` v2.3 como referência funcional para drawer, filtros móveis e cards. **Não** usar o dataset fictício como dado de produção.
4. Adicionar seus próprios testes de UI/API para CA-55 a CA-69 no incremento correspondente; preservar testes anteriores.
5. Não reexecutar a mesma migration em produção. A v2.3 não exige migration adicional: é a apresentação dos mesmos campos do banco v2.2.
6. Registrar diferenças, testes, riscos e evidências em `docs/09_REGISTRO_DE_EVOLUCAO.md` e pedir aceite do próximo incremento.

## Critérios de homologação específicos

- A página inteira não pode exigir rolagem horizontal em 360 e 390 px.
- Filtros seção + servidor + prioridade + status devem recalcular cartões, gráficos e KPIs.
- A visualização móvel deve apresentar a mesma informação da tabela desktop, inclusive idade, atraso e última atualização.
- Menu móvel precisa abrir/fechar; filtros devem ser recolhíveis; botões utilizáveis por toque.
- Abrir o detalhe da demanda no celular deve preservar dados, autorizações e link SEI validado (se existente).
- Perfil SDG permanece consulta em quaisquer dispositivos; permissões são aplicadas na API.
- Registros fictícios são sinalizados como tais; nenhum e-mail real é enviado nos testes.

## Verificação rápida

```bash
python tests/validate_spec.py
python tests/validate_addendum.py
python tests/validate_departamentos_v22.py
python tests/test_responsive_browser.py
```

O último script requer Playwright e Chromium instalados. Testes de aplicação real e acessibilidade aprofundada são **posteriores** e não podem ser declarados homologados por essa execução.
