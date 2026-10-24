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
  projects: [
    { name: "private", testMatch: /(?:privacy|sheets)\.spec\.mjs/ },
    {
      name: "gmail-oauth",
      testMatch: "gmail.spec.mjs",
      use: { baseURL: "http://127.0.0.1:8790" },
    },
    {
      name: "individual-passwords",
      testMatch: "passwords.spec.mjs",
      use: { baseURL: "http://127.0.0.1:8792" },
    },
  ],
  webServer: [
    {
      command: "node tests/private-server.mjs",
      url: "http://127.0.0.1:8792/api/health",
      reuseExistingServer: false,
      timeout: 30000,
      env: { SIGA_PASSWORD_BROWSER_TEST: "true" },
    },
    {
      command: "node tests/private-server.mjs",
      url: "http://127.0.0.1:8789/api/health",
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: "node tests/private-server.mjs",
      url: "http://127.0.0.1:8790/api/health",
      reuseExistingServer: false,
      timeout: 30000,
      env: { SIGA_OAUTH_BROWSER_TEST: "true" },
    },
  ],
});
