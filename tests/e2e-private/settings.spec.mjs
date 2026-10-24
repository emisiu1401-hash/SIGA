import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

test("Gmail sem OAuth mostra configuração inicial e guia utilizável nas seis larguras", async ({
  page,
  context,
}) => {
  const errors = [],
    external = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:8789"))
      external.push(request.url());
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/#settings");
  await expect(page).toHaveTitle("Configurações · SIGA");
  await expect(page.locator("#gmail-account-panel")).toContainText(
    "Etapa 1 de 3",
  );
  await expect(page.locator("#operation-content")).not.toContainText(
    "Aguardando OAuth",
  );
  await expect(page.locator("#gmail-account-form")).toHaveCount(0);
  await expect(page.locator("#sync-gmail")).toBeDisabled();
  const original = await (await page.request.get("/api/settings")).json();
  expect(original.gmail.oauthReady).toBe(false);
  await page.locator("#gmail-recheck").click();
  await expect(
    page.locator("#gmail-account-panel [data-gmail-setup]"),
  ).toBeVisible();
  for (const width of [360, 390, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator("[data-gmail-setup]").click();
    await expect(page.locator("#gmail-setup-guide")).toBeVisible();
    await expect(page.locator("#gmail-callback")).toHaveValue(
      "http://127.0.0.1:8789/api/gmail/oauth/callback",
    );
    await expect(page.locator("#gmail-setup-guide")).toContainText(
      "GOOGLE_CLIENT_SECRET",
    );
    await expect(page.locator("#gmail-setup-guide")).toContainText(
      "usuários de teste",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      axe.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    if (process.env.SIGA_EVIDENCE_DIR && [390, 1366].includes(width)) {
      mkdirSync(process.env.SIGA_EVIDENCE_DIR, { recursive: true });
      await page.screenshot({
        path: join(process.env.SIGA_EVIDENCE_DIR, `gmail-setup-${width}.png`),
      });
    }
    await page.locator("#copy-gmail-callback").click();
    await expect(page.locator("#gmail-setup-result")).toContainText("copiado");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "http://127.0.0.1:8789/api/gmail/oauth/callback",
    );
    await page.keyboard.press("Escape");
    await expect(page.locator("#dialog")).not.toBeVisible();
    await expect(page.locator("[data-gmail-setup]")).toBeFocused();
  }
  const after = await (await page.request.get("/api/settings")).json();
  expect(after.gmail).toEqual(original.gmail);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
