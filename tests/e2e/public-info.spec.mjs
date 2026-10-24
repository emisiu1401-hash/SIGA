import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

test("páginas públicas OAuth: links, conteúdo, CSP, seis larguras e acessibilidade", async ({
  page,
}) => {
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  const pages = [
    ["/sobre.html", "SIGA — Sistema Inteligente de Gestão de Atividades"],
    ["/privacidade.html", "Política de Privacidade — SIGA"],
    ["/termos.html", "Termos de Uso — SIGA"],
  ];
  for (const [path, title] of pages) {
    const response = await page.goto(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/html");
    expect(response.headers()["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
    await expect(page).toHaveTitle(title);
    await expect(page.locator("main h1")).toHaveCount(1);
    const internal = await page
      .locator("a[href^='/']")
      .evaluateAll((nodes) => [
        ...new Set(nodes.map((n) => n.getAttribute("href"))),
      ]);
    for (const link of internal)
      expect((await page.request.get(link)).status()).toBe(200);
    for (const width of [360, 390, 768, 1024, 1366, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        result.violations.map((v) => ({
          id: v.id,
          targets: v.nodes.map((n) => n.target),
        })),
      ).toEqual([]);
      if (process.env.SIGA_EVIDENCE_DIR && [390, 1366].includes(width)) {
        mkdirSync(process.env.SIGA_EVIDENCE_DIR, { recursive: true });
        await page.screenshot({
          path: join(
            process.env.SIGA_EVIDENCE_DIR,
            `${path.slice(1, -5)}-${width}.png`,
          ),
          fullPage: true,
        });
      }
    }
  }
  await page.goto("/sobre.html");
  await page.getByRole("link", { name: "Privacidade", exact: true }).click();
  await expect(page).toHaveURL(/\/privacidade\.html$/);
  await expect(page.locator("main")).toContainText("Uso Limitado");
  await expect(page.locator("main")).toContainText("OpenAI");
  await expect(page.locator("main")).toContainText(
    "não possui prazo global de expurgo",
  );
  const origin = new URL(page.url()).origin;
  expect(requests.filter((url) => !url.startsWith(origin))).toEqual([]);
  expect(errors).toEqual([]);
});
