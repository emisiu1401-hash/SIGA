import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  reporter: "list",
  use: {
    baseURL: process.env.SIGA_TEST_URL || "http://127.0.0.1:8788",
    headless: true,
    ...(process.platform === "win32" ? { channel: "chrome" } : {}),
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: process.env.SIGA_TEST_URL
    ? undefined
    : {
        command: "node scripts/dev.mjs",
        url: "http://127.0.0.1:8788/api/health",
        reuseExistingServer: false,
        env: {
          PORT: "8788",
          SIGA_DB_PATH: ".local/e2e-" + Date.now() + ".sqlite",
        },
        timeout: 60000,
      },
});
