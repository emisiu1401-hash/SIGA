import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

test("administrador conecta e troca caixas pelo Google sem mudar login nem exibir tokens", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let authorizedEmail = null;
  await page.route(
    "https://accounts.google.com/o/oauth2/v2/auth?**",
    async (route) => {
      const url = new URL(route.request().url());
      const code = JSON.stringify({
        email: authorizedEmail || url.searchParams.get("login_hint"),
        scope: url.searchParams.get("scope"),
      });
      const callback = new URL(url.searchParams.get("redirect_uri"));
      callback.searchParams.set("state", url.searchParams.get("state"));
      callback.searchParams.set("code", code);
      // Consent UI is a fixture; no Google page or mailbox is accessed by this test.
      await route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html lang="pt-BR"><title>Consentimento Google fictício</title><a id="authorize-test" href="${callback.toString().replaceAll("&", "&amp;")}">Autorizar conta de teste</a></html>`,
      });
    },
  );
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/#settings");
  await expect(page.locator("#gmail-account-form")).toBeVisible();
  await expect(page.locator("#account-name")).toContainText("Titular de teste");
  const connect = async (email, send = false) => {
    await page.locator('#gmail-account-form [name="email"]').fill(email);
    await page
      .locator('#gmail-account-form [name="allowSend"]')
      .setChecked(send);
    await page.locator('#gmail-account-form button[type="submit"]').click();
    await expect(page).toHaveURL(/^https:\/\/accounts\.google\.com\//);
    await page.locator("#authorize-test").click();
    await expect(page.locator("#gmail-account-panel")).toBeVisible();
  };
  await connect("personal-sender@example.test", true);
  await expect(page.locator("#gmail-account-panel .gmail-address")).toHaveText(
    "personal-sender@example.test",
  );
  await expect(page.locator("#gmail-account-panel")).toContainText(
    "Pausada após conexão",
  );
  await expect(page.locator("#gmail-account-activate")).toBeDisabled();
  await connect("institutional-sender@example.test");
  await expect(page.locator("#gmail-account-panel .gmail-address")).toHaveText(
    "institutional-sender@example.test",
  );
  await expect(page.locator("#account-name")).toContainText("Titular de teste");
  const settings = await (await page.request.get("/api/settings")).json();
  expect(settings.gmail.sendAuthorized).toBe(false);
  expect(JSON.stringify(settings)).not.toContain("dummy-browser-refresh");
  expect(JSON.stringify(settings)).not.toContain("dummy-browser-client-secret");
  authorizedEmail = "different-account@example.test";
  await connect("another-sender@example.test");
  await expect(page.locator("#toast")).toContainText("conta diferente");
  await expect(page.locator("#gmail-account-panel .gmail-address")).toHaveText(
    "institutional-sender@example.test",
  );
  for (const width of [360, 390, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    const a11y = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      a11y.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    if (process.env.SIGA_EVIDENCE_DIR && [360, 1366].includes(width)) {
      mkdirSync(process.env.SIGA_EVIDENCE_DIR, { recursive: true });
      await page.locator("#gmail-account-panel").screenshot({
        path: join(
          process.env.SIGA_EVIDENCE_DIR,
          `gmail-account-local-${width}.png`,
        ),
      });
    }
  }
  expect(errors).toEqual([]);
});
