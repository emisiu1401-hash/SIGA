import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
const initial = "Fixture-initial-owner-password-2026!",
  personal = "Minha-frase-de-teste-2026!";
async function login(page, account, password) {
  await page.goto("/login");
  await page.locator('[name="account"]').fill(account);
  await page.locator('[name="password"]').fill(password);
  await page.locator("#auth-submit").click();
}
test("senha individual: primeiro acesso, troca, perfil, habilitação, Gmail simulado e revogação", async ({
  page,
  browser,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#auth-form")).toBeVisible();
  expect((await page.request.get("/api/dashboard")).status()).toBe(401);
  const dir =
    process.env.SIGA_ARTIFACT_DIR ||
    "C:/Users/profe/.codex/visualizations/2026/10/24/01a16e34-10bd-79b0-aec6-7c2003269c90";
  mkdirSync(dir, { recursive: true });
  for (const width of [360, 390, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator("#auth-form")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
        .violations,
    ).toEqual([]);
    if ([360, 1366].includes(width))
      await page.screenshot({
        path: `${dir}/password-login-${width}.png`,
        fullPage: true,
      });
  }
  await login(page, "emerson", initial);
  await expect(page).toHaveURL(/change=1/);
  expect((await page.request.get("/api/dashboard")).status()).toBe(403);
  await page.locator('[name="password"]').fill(initial);
  await page.locator('[name="newPassword"]').fill(personal);
  await page.locator('[name="confirm"]').fill(personal);
  await page.locator("#auth-submit").click();
  await expect(page.locator("#auth-message")).toContainText("Senha atualizada");
  await login(page, "emerson", personal);
  await expect(page.locator("#kpis .kpi")).toHaveCount(8);
  await page.goto("/#access");
  await expect(page.locator("#access-form")).toBeVisible();
  await page.locator("#access-add-person").click();
  await page
    .locator('#person-form [name="name"]')
    .fill("Gestor adicional de teste");
  await page
    .locator('#person-form [name="email"]')
    .fill("gestor-extra@example.test");
  await page.locator('#person-form [name="role"]').selectOption("GESTOR");
  await page.locator('#person-form button[type="submit"]').click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  const directory = await (await page.request.get("/api/directory")).json(),
    user = directory.people.find(
      (p) => p.email === "gestor-extra@example.test",
    );
  expect(user.roles).toEqual(["GESTOR"]);
  await page.locator('#access-form [name="userId"]').selectOption(user.id);
  await page.locator('#access-form [name="username"]').fill("gestor.extra");
  await page.locator('#access-form button[type="submit"]').click();
  await expect(page.locator("#access-result")).toContainText(
    "Senha temporária:",
  );
  const accounts = await (await page.request.get("/api/auth/accounts")).json();
  expect(JSON.stringify(accounts)).not.toContain("scrypt");
  expect(JSON.stringify(accounts)).not.toContain("temporaryPassword");
  const sdgContext = await browser.newContext({
    baseURL: "http://127.0.0.1:8792",
  });
  await sdgContext.addCookies([
    { name: "test_identity", value: "sdg", url: "http://127.0.0.1:8792" },
  ]);
  const sdg = await sdgContext.newPage();
  await login(sdg, "sdg", "Fixture-initial-sdg-password-2026!");
  await expect(sdg).toHaveURL(/change=1/);
  await sdg
    .locator('[name="password"]')
    .fill("Fixture-initial-sdg-password-2026!");
  await sdg.locator('[name="newPassword"]').fill(personal);
  await sdg.locator('[name="confirm"]').fill(personal);
  await sdg.locator("#auth-submit").click();
  await expect(sdg.locator("#auth-message")).toContainText("Senha atualizada");
  await login(sdg, "sdg", personal);
  await expect(sdg.locator("#account-name")).toContainText("SDG de teste");
  expect((await sdg.request.get("/api/auth/accounts")).status()).toBe(403);
  await sdgContext.close();
  await page.goto("/login");
  await page.locator("#auth-forgot").click();
  await page.locator('[name="account"]').fill("emerson");
  await page.locator("#auth-submit").click();
  await expect(page.locator("#auth-message")).toContainText(
    "receberá as instruções",
  );
  const messages = await (await page.request.get("/__test__/mail")).json();
  expect(messages).toHaveLength(1);
  const link = messages[0].match(
    /http:\/\/127\.0\.0\.1:8792\/login#reset=[\w-]+/,
  )[0];
  await page.goto(link);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("#auth-title")).toHaveText("Defina uma nova senha");
  await page
    .locator('[name="newPassword"]')
    .fill("Senha-redefinida-de-teste-2026!");
  await page
    .locator('[name="confirm"]')
    .fill("Senha-redefinida-de-teste-2026!");
  await page.locator("#auth-submit").click();
  await expect(page.locator("#auth-message")).toContainText("Senha redefinida");
  expect((await page.request.get("/api/dashboard")).status()).toBe(401);
  await login(page, "emerson", "Senha-redefinida-de-teste-2026!");
  await expect(page.locator("#kpis .kpi")).toHaveCount(8);
  await page.locator("#login-button").click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/dashboard")).status()).toBe(401);
  expect(errors).toEqual([]);
});
