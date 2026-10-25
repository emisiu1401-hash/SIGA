import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

test("DAO: cartão, filtro e lotação do titular em seis larguras", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page
      .locator('#department option[value="DAO"], #department option')
      .filter({ hasText: /^DAO$/ }),
  ).toHaveCount(1);
  for (const width of [360, 390, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const card = page.locator('#department-cards [data-department="DAO"]');
    await expect(card).toBeVisible();
    await card.click();
    await expect(page.locator("#department")).toHaveValue("DAO");
    const data = await (
      await page.request.get("/api/dashboard?department=DAO")
    ).json();
    expect(data.sections.some((s) => s.name === "DAO")).toBe(true);
    expect(data.rows.every((r) => r.department === "DAO")).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    if (process.env.SIGA_EVIDENCE_DIR && [390, 1366].includes(width)) {
      mkdirSync(process.env.SIGA_EVIDENCE_DIR, { recursive: true });
      await page.screenshot({
        path: join(process.env.SIGA_EVIDENCE_DIR, `dao-${width}.png`),
        fullPage: true,
      });
    }
  }
  await page.goto("/#team");
  const owner = page.locator("tr").filter({ hasText: "Titular de teste" });
  await expect(owner).toContainText("DAO");
  await expect(owner).toContainText("ADMIN");
  await expect(owner).toContainText("EXECUTOR");
  await expect(owner).toContainText("GESTOR");
  await expect(owner).toContainText("Ativo");
  expect(errors).toEqual([]);
});

test("identidade privada abre base vazia; cadastro persiste e token não retorna ao navegador", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/");
  await expect(page.locator("#kpis .kpi")).toHaveCount(8);
  await expect(page.locator(".demo-label")).toHaveText("ACESSO PRIVADO");
  await expect(page.locator("#account-name")).toContainText("Titular de teste");
  await expect(page.locator('[data-view="simulator"]')).toBeHidden();
  await expect(page.locator("#result-count")).toContainText("0 demandas");
  await page.locator("#new-demand").click();
  await page
    .locator('#create-form [name="title"]')
    .fill("Demanda privada de teste");
  await page
    .locator('#create-form [name="description"]')
    .fill("Fixture fictícia da suíte de privacidade.");
  await page.locator('#create-form button[type="submit"]').click();
  await expect(page.locator("#dialog")).toContainText(
    "Demanda privada de teste",
  );
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator("#result-count")).toContainText("1 demanda");
  await page.locator('[data-view="settings"]').click();
  await expect(page.locator("#ai-form")).toBeVisible();
  const dummy = "dummy-private-browser-token-1234567890";
  await page.locator('#ai-form [name="token"]').fill(dummy);
  await page.locator('#ai-form button[type="submit"]').click();
  await expect(page.locator("#ai-result")).toContainText(
    "criptografado e salvo",
  );
  await expect(page.locator('#ai-form [name="token"]')).toHaveValue("");
  const settings = await page.request.get("/api/settings");
  expect(settings.ok()).toBeTruthy();
  expect(await settings.text()).not.toContain(dummy);
  expect(
    (await page.request.post("/api/initialize", { data: {} })).status(),
  ).toBe(403);
  await page.locator('[data-view="dashboard"]').click();
  await expect(page.locator("#result-count")).toContainText("1 demanda");
  for (const width of [1366, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator("#kpis")).toHaveCSS("opacity", "1");
    await expect(page.locator(".chart-grid")).toHaveCSS("opacity", "1");
    await expect(page.locator("#demand-list")).toHaveCSS("opacity", "1");
    if (width <= 900)
      await expect(page.locator(".demand-cards")).toHaveCSS("opacity", "1");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      accessibility.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    if (process.env.SIGA_EVIDENCE_DIR) {
      mkdirSync(process.env.SIGA_EVIDENCE_DIR, { recursive: true });
      await page.screenshot({
        path: join(process.env.SIGA_EVIDENCE_DIR, `private-local-${width}.png`),
      });
    }
  }
  expect(errors).toEqual([]);
  await page.locator("#login-button").click();
  await expect(page).toHaveURL(/\/cdn-cgi\/access\/logout$/);
});
