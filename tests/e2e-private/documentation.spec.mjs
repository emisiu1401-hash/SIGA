import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

test("documentação: entrada pelo menu, busca, solução por erro e diagnóstico sem ações externas", async ({
  page,
}) => {
  const errors = [],
    requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) =>
    requests.push({ url: request.url(), method: request.method() }),
  );
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__copied = text;
        },
      },
    }),
  );
  await page.setViewportSize({ width: 1366, height: 1000 });
  await page.goto("/#settings");
  await page.getByRole("link", { name: "Documentação", exact: true }).click();
  await expect(page).toHaveURL(/\/documentacao\.html$/);
  await expect(page).toHaveTitle("Documentação e solução de problemas · SIGA");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Documentação do SIGA",
  );
  await expect(page.locator("#diagnostic-summary")).toHaveText(
    "Configuração OAuth inicial pendente",
  );
  const search = page.getByLabel("Pesquisar mensagem, código ou assunto");
  await search.fill("GMAIL_API_DISABLED");
  await expect(page.locator("#help-articles > details:visible")).toHaveCount(1);
  await page.locator("#erro-api summary").click();
  await expect(page.locator("#erro-api")).toContainText("Google Cloud");
  await search.fill("nenhum-resultadopossivel-123");
  await expect(page.locator("#help-empty")).toBeVisible();
  await search.fill("");
  await expect(page.locator("#help-articles > details:visible")).toHaveCount(
    14,
  );
  await page.goto("/documentacao.html?erro=GMAIL_API_DISABLED#erros");
  await expect(page.locator("#erro-api")).toHaveAttribute("open", "");
  await expect(page.locator("#erro-api summary")).toBeInViewport();
  await page.goto("/documentacao.html#erro-retorno");
  await expect(page.locator("#erro-retorno")).toHaveAttribute("open", "");
  await page
    .getByRole("button", { name: "Copiar endereço de retorno" })
    .click();
  expect(await page.evaluate(() => window.__copied)).toBe(
    "https://siga-private.emisiu1401.workers.dev/api/gmail/oauth/callback",
  );
  await page.goto("/documentacao.html");
  await page.locator("#diagnostic-copy").click();
  const report = await page.evaluate(() => window.__copied);
  expect(JSON.parse(report).connected).toBe(false);
  expect(report).not.toMatch(/owner@example|token|password|secret|csrf|email/i);
  for (const width of [360, 390, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => scrollTo(0, 0));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    const a11y = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      a11y.violations.map((item) => ({
        id: item.id,
        targets: item.nodes.map((node) => node.target),
      })),
    ).toEqual([]);
    if (process.env.SIGA_EVIDENCE_DIR && [360, 1366].includes(width)) {
      mkdirSync(process.env.SIGA_EVIDENCE_DIR, { recursive: true });
      await page.screenshot({
        path: join(process.env.SIGA_EVIDENCE_DIR, `documentacao-${width}.png`),
        fullPage: false,
      });
    }
  }
  const origin = new URL(page.url()).origin;
  expect(requests.filter((request) => !request.url.startsWith(origin))).toEqual(
    [],
  );
  expect(requests.filter((request) => request.method !== "GET")).toEqual([]);
  expect(errors).toEqual([]);
});

test("diagnóstico: pausa/simulação, relatório restrito, sessão vencida e perfis de consulta", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let limited = false,
    expired = false,
    settingReads = 0;
  await page.route("**/api/session", async (route) => {
    if (expired)
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: "{}",
      });
    const response = await route.fetch(),
      session = await response.json();
    if (limited) session.actor.roles = ["EXECUTOR"];
    await route.fulfill({ response, json: session });
  });
  await page.route("**/api/settings", async (route) => {
    settingReads++;
    const response = await route.fetch(),
      settings = await response.json();
    settings.gmail = {
      ...settings.gmail,
      connected: true,
      paused: true,
      oauthReady: true,
      email: "sender@example.test",
      refresh_token: "fixture-do-not-copy",
      sendAuthorized: true,
    };
    settings.aiConfigured = true;
    settings.extraSecret = "fixture-do-not-copy";
    await route.fulfill({ response, json: settings });
  });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw Error("clipboard unavailable");
        },
      },
    }),
  );
  await page.goto("/documentacao.html");
  await expect(page.locator("#diagnostic-summary")).toHaveText(
    "Conexão Google concluída",
  );
  await expect(page.locator("#diagnostic-values")).toContainText(
    "Conectada · pausada",
  );
  await expect(page.locator("#diagnostic-next")).toContainText("em simulação");
  await expect(page.locator("#diagnostic-values")).toContainText(
    "sender@example.test",
  );
  await page.locator("#diagnostic-copy").click();
  await expect(page.locator("#copy-fallback")).toBeVisible();
  const report = await page.locator("#diagnostic-report").inputValue();
  expect(JSON.parse(report)).toMatchObject({
    connected: true,
    paused: true,
    simulation: true,
    sendEnabled: false,
  });
  expect(report).not.toMatch(
    /sender@example|owner@example|fixture-do-not-copy|token|secret|password|csrf|email/i,
  );
  expect(await page.locator("body").innerText()).not.toContain(
    "fixture-do-not-copy",
  );
  limited = true;
  const previous = settingReads;
  await page.reload();
  await expect(page.locator("#diagnostic-summary")).toContainText(
    "restrito à gestão",
  );
  expect(settingReads).toBe(previous);
  await expect(page.locator("#diagnostic-copy")).toBeDisabled();
  expired = true;
  await page.reload();
  await expect(page.locator("#diagnostic-summary")).toContainText(
    "Não foi possível",
  );
  await expect(
    page.getByRole("heading", { name: "Documentação do SIGA", exact: true }),
  ).toBeVisible();
  expect(settingReads).toBe(previous);
  expect(errors).toEqual([]);
});
