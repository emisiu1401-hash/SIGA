import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, mkdirSync } from "node:fs";
import {
  readWorkbook,
  writeWorkbook,
  PEOPLE_HEADERS,
} from "../../dist/testing.js";
test("Excel: template e exportação reais, prévia, confirmação, auditoria e seis larguras", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#sheets");
  await expect(page.locator("#sheet-form")).toBeVisible();
  const download = async (id) => {
    const pending = page.waitForEvent("download");
    await page.locator(id).click();
    const file = await pending;
    return new Uint8Array(readFileSync(await file.path()));
  };
  const template = await download("#sheet-template");
  expect((await readWorkbook(template, "Pessoas"))[0].values).toEqual(
    PEOPLE_HEADERS,
  );
  await page.locator('#sheet-form [name="kind"]').selectOption("people");
  const exported = await download("#sheet-export");
  expect((await readWorkbook(exported, "Pessoas"))[0].values).toEqual(
    PEOPLE_HEADERS,
  );
  const bytes = writeWorkbook([
    {
      name: "Pessoas",
      rows: [
        PEOPLE_HEADERS,
        [
          "",
          "",
          "Pessoa Excel de teste",
          "excel-browser@example.test",
          "AE",
          "EXECUTOR",
          "SIM",
        ],
      ],
    },
  ]);
  await page.locator('#sheet-form [name="file"]').setInputFiles({
    name: "atualizacao.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(bytes),
  });
  await page.locator('#sheet-form [type="submit"]').click();
  await expect(page.locator("#sheet-confirm")).toBeVisible();
  expect(
    (await (await page.request.get("/api/directory")).json()).people.some(
      (p) => p.email === "excel-browser@example.test",
    ),
  ).toBe(false);
  await page.locator("#sheet-confirm").click();
  await expect
    .poll(async () =>
      (await (await page.request.get("/api/directory")).json()).people.some(
        (p) => p.email === "excel-browser@example.test",
      ),
    )
    .toBe(true);
  await page.goto("/#audit");
  await expect(page.locator("#audit-entries")).toContainText(
    "SPREADSHEET_APPLIED",
  );
  const log = await download("#audit-download"),
    lines = new TextDecoder().decode(log).trim().split("\n").map(JSON.parse);
  expect(lines[0].type).toBe("SIGA_AUDIT_EXPORT");
  const event = lines.find((r) => r.action === "SPREADSHEET_APPLIED");
  expect(event.actor_id).toBe("u-gestor");
  expect(event.request_id).toBeTruthy();
  expect(event.occurred_at).toMatch(/Z$/);
  const dir =
    process.env.SIGA_ARTIFACT_DIR ||
    "C:/Users/profe/.codex/visualizations/2026/10/24/01a16e34-10bd-79b0-aec6-7c2003269c90";
  mkdirSync(dir, { recursive: true });
  for (const width of [360, 390, 768, 1024, 1366, 1920])
    for (const view of ["sheets", "audit"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/#" + view);
      await page.reload();
      await expect(
        page.locator(view === "sheets" ? "#sheet-form" : "#audit-entries"),
      ).toBeVisible();
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      if (width <= 900) {
        await expect
          .poll(() =>
            page
              .locator("#sidebar")
              .evaluate((el) => el.getBoundingClientRect().right),
          )
          .toBeLessThanOrEqual(1);
        await expect
          .poll(() =>
            page
              .locator(".mobile-header")
              .evaluate((el) => el.getBoundingClientRect().top),
          )
          .toBe(0);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      if ([360, 1366].includes(width))
        await page.screenshot({
          path: `${dir}/${view}-${width}.png`,
          fullPage: true,
        });
      const a = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(a.violations).toEqual([]);
    }
  expect(errors).toEqual([]);
});
