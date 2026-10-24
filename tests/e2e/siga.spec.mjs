import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, mkdirSync } from "node:fs";
const credentials = () =>
  Object.fromEntries(
    readFileSync(".dev.vars", "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const n = l.indexOf("=");
        return [l.slice(0, n), l.slice(n + 1)];
      }),
  );
async function ready(page) {
  await page.goto("/");
  await expect(page.locator("#kpis .kpi")).toHaveCount(8);
  await expect(page.locator("#result-count")).toContainText("24 demandas");
  await expect(page.locator("#kpis")).toHaveCSS("opacity", "1");
  await expect(page.locator(".chart-grid")).toHaveCSS("opacity", "1");
}
const widths = [360, 390, 768, 1024, 1366, 1920];
for (const width of widths)
  test(`CA-55..66: navegação, filtros, paridade e teclado em ${width}px`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.setViewportSize({ width, height: 900 });
    await ready(page);
    await expect(page).toHaveTitle("Painel executivo · SIGA");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    if (width <= 900) {
      await expect(page.locator("#filters")).toBeHidden();
      await page.locator("#mobile-filters").click();
      await expect(page.locator("#filters")).toBeVisible();
      await page.locator("#menu-open").click();
      await expect(page.locator("#menu-open")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      await page.keyboard.press("Escape");
      await expect(page.locator("#menu-open")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await expect(page.locator("#menu-open")).toBeFocused();
    }
    await page.locator("#department").selectOption("SLC");
    await page.locator("#person").selectOption("u-ana");
    await expect(page.locator("#result-count")).toContainText("5 demandas");
    const response = await page.request.get(
      "/api/dashboard?department=SLC&person=u-ana",
    );
    const data = await response.json();
    expect(data.total).toBe(5);
    expect(data.sections.reduce((n, s) => n + s.total, 0)).toBe(
      data.kpis.active,
    );
    expect(
      data.rows.every(
        (r) => r.department === "SLC" && r.assigneeId === "u-ana",
      ),
    ).toBe(true);
    const visibleCodes = await page
      .locator(
        width <= 900
          ? "#demand-cards [data-detail]"
          : "#demand-rows [data-detail]",
      )
      .allTextContents();
    expect(visibleCodes.length).toBe(5);
    const link = page
      .locator(
        width <= 900
          ? "#demand-cards [data-detail]"
          : "#demand-rows [data-detail]",
      )
      .first();
    await link.click();
    await expect(page.locator("#dialog")).toBeVisible();
    await expect(page.locator("#dialog-content")).toContainText(
      "Histórico auditável",
    );
    await page.keyboard.press("Shift+Tab");
    expect(
      await page.evaluate(() =>
        document.querySelector("#dialog").contains(document.activeElement),
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator("#dialog")).toBeHidden();
    await expect(link).toBeFocused();
    await page.locator("#clear-filters").click();
    await expect(page.locator("#result-count")).toContainText("24 demandas");
    await page.locator("#more-filters").click();
    await page.locator("[name=q]").fill("nenhum-registro-xyz");
    await expect(page.locator("#empty-state")).toBeVisible();
    await expect(page.locator("#result-count")).toContainText("0 demandas");
    await page.locator("#empty-clear").click();
    await expect(page.locator("#result-count")).toContainText("24 demandas");
    await page.locator('[data-shortcut="d2"]').click();
    await expect(page.locator('[data-shortcut="d2"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const filtered = await page.request.get("/api/dashboard?shortcut=d2");
    const rows = (await filtered.json()).rows;
    expect(
      rows.every(
        (r) =>
          r.dueDays >= 0 &&
          r.dueDays <= 2 &&
          r.status !== "AGUARDANDO_VALIDACAO",
      ),
    ).toBe(true);
    await page.locator('[data-shortcut=""]').click();
    if ([390, 768, 1366].includes(width)) {
      mkdirSync(".local/evidence", { recursive: true });
      await page.screenshot({
        path: ".local/evidence/app-" + width + ".png",
        fullPage: true,
      });
    }
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  });
test("orientação horizontal 844px e redução de movimento", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(
    await page
      .locator("#kpis")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});
test("WCAG 2.2 AA: verificação automatizada do painel e diálogo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await ready(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.locator("#demand-rows [data-detail]").first().click();
  const modal = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    modal.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
});
test("gestor cria e atribui; executor aceita, pede prorrogação e não se autoaprova", async ({
  browser,
}) => {
  test.skip(
    !!process.env.SIGA_TEST_URL,
    "Publicação de demonstração é somente consulta; gravações são testadas na base local isolada.",
  );
  const secrets = credentials();
  const mc = await browser.newContext(),
    ec = await browser.newContext();
  const manager = await mc.newPage(),
    executor = await ec.newPage();
  await manager.goto("/");
  await manager.locator("#login-button").click();
  await manager.locator("#dialog [name=account]").selectOption("gestor");
  await manager
    .locator("#dialog [name=password]")
    .fill(secrets.MANAGER_PASSWORD);
  await manager.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(manager.locator("#new-demand")).toBeVisible();
  await manager.locator("#new-demand").click();
  await manager
    .locator("#dialog [name=title]")
    .fill("Teste automatizado: fluxo de atribuição");
  await manager
    .locator("textarea[name=description]")
    .fill("Dados fictícios de teste de usabilidade.");
  await manager
    .getByRole("button", { name: "Registrar demanda", exact: true })
    .click();
  await expect(manager.locator("#dialog-content")).toContainText(
    "Nova triagem",
  );
  const code = await manager.locator("#dialog-eyebrow").textContent();
  await manager.locator("#assign-action").click();
  await manager.locator("#dialog [name=personId]").selectOption("u-gabriela");
  await manager.locator("#dialog [name=priority]").selectOption("ALTA");
  await manager
    .locator("#dialog [name=reason]")
    .fill("Atribuição explícita para teste.");
  await manager.getByRole("button", { name: "Confirmar e registrar" }).click();
  await expect(manager.locator("#dialog-content")).toContainText(
    "AGUARDANDO ACEITE",
  );
  await executor.goto("/");
  await executor.locator("#login-button").click();
  await executor.locator("#dialog [name=account]").selectOption("executor");
  await executor
    .locator("#dialog [name=password]")
    .fill(secrets.EXECUTOR_PASSWORD);
  await executor.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(executor.locator("#new-demand")).toBeHidden();
  const demandCode = code.replace("SIGA / ", "");
  const session = await (await ec.request.get("/api/session")).json();
  const list = await (await ec.request.get("/api/dashboard")).json();
  const row = list.rows.find((r) => r.code === demandCode);
  expect(row).toBeTruthy();
  await executor.locator('#demand-rows [data-detail="' + row.id + '"]').click();
  await executor.locator("#accept-action").click();
  const due = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  await executor.locator("#dialog [name=date]").fill(due);
  await executor.getByRole("button", { name: "Confirmar e registrar" }).click();
  await expect(executor.locator("#dialog-content")).toContainText(
    "Em execução",
  );
  await executor.locator("#extension-action").click();
  await executor
    .locator("#dialog [name=date]")
    .fill(new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10));
  await executor
    .locator("#dialog [name=reason]")
    .fill("Aguardando terceiro — justificativa fictícia.");
  await executor.getByRole("button", { name: "Confirmar e registrar" }).click();
  await expect(executor.locator("#dialog-content")).toContainText(
    "AGUARDANDO GESTOR",
  );
  expect(await executor.locator("[data-decide]").count()).toBe(0);
  // API policy applies even if an executor fabricates a manager-only control.
  const detail = await (await ec.request.get("/api/demands/" + row.id)).json();
  const denied = await ec.request.post("/api/demands/" + row.id + "/actions", {
    headers: {
      Origin: new URL(executor.url()).origin,
      "X-CSRF-Token": session.csrf,
    },
    data: {
      type: "DECIDE",
      id: crypto.randomUUID(),
      expectedVersion: detail.demand.version,
      requestId: detail.demand.requests[0].id,
      decision: "APPROVE",
    },
  });
  expect(denied.status()).toBe(403);
  await mc.close();
  await ec.close();
});
