import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";

test("OAuth roda no workerd/D1: sucesso, troca e falhas Google sem acesso a contas reais", async () => {
  const require = createRequire(import.meta.url),
    wr = createRequire(require.resolve("wrangler/package.json"));
  const runtime = await import(pathToFileURL(wr.resolve("miniflare")).href);
  mkdirSync(".local", { recursive: true });
  const scriptPath = ".local/gmail-runtime-test.js";
  await build({
    entryPoints: ["tests/fixtures/gmail-runtime.ts"],
    outfile: scriptPath,
    bundle: true,
    format: "esm",
    platform: "browser",
    external: ["node:crypto", "node:buffer"],
  });
  const options = {
    workers: [
      {
        name: "gmail-test",
        modules: true,
        scriptPath,
        compatibilityDate: "2026-10-24",
        compatibilityFlags: ["nodejs_compat"],
        d1Databases: ["DB"],
      },
    ],
  };
  const mf = new runtime.Miniflare(
    runtime.convertV4MiniflareOptions
      ? runtime.convertV4MiniflareOptions(options)
      : options,
  );
  try {
    const db = await mf.getD1Database("DB");
    for (const name of readdirSync("db/migrations").sort()) {
      const sql = readFileSync("db/migrations/" + name, "utf8")
        .replace(/^--.*$/gm, "")
        .replace(/\s+/g, " ");
      await db.exec(sql);
    }
    for (const attempt of ["first", "reconnect"]) {
      const response = await mf.dispatchFetch(
        "https://test.invalid/?mode=" + attempt,
      );
      assert.equal(response.status, 200);
      const status = await response.json();
      assert.equal(status.connected, true);
      assert.equal(status.paused, true);
    }
    for (const [mode, code] of [
      ["disabled", "GMAIL_API_DISABLED"],
      ["network", "GMAIL_OAUTH_NETWORK"],
    ]) {
      const response = await mf.dispatchFetch(
        "https://test.invalid/?mode=" + mode,
      );
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, code);
    }
    assert.equal(
      (await db.prepare("SELECT count(*) n FROM gmail_connections").first()).n,
      1,
    );
    assert.equal(
      (
        await db
          .prepare(
            "SELECT count(*) n FROM gmail_oauth_requests WHERE status='FAILED' AND verifier_cipher=''",
          )
          .first()
      ).n,
      2,
    );
    const logs = await db
      .prepare(
        "SELECT details_json FROM audit_log WHERE action='GMAIL_OAUTH_FAILED'",
      )
      .all();
    assert.equal(logs.results.length, 2);
    assert(!JSON.stringify(logs).includes("private-provider-description"));
  } finally {
    await mf.dispose();
  }
});
