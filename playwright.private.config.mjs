import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e-private",
  workers: 1,
  retries: 0,
  timeout: 45000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8789",
    headless: true,
    ...(process.platform === "win32" ? { channel: "chrome" } : {}),
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node tests/private-server.mjs",
    url: "http://127.0.0.1:8789/api/health",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
