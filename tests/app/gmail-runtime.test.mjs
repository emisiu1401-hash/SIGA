import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { mockInterpret } from "../../dist/testing.js";

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
  let mode = "first";
  const requested = [];
  const outboundService = async (request) => {
    const url = request.url;
    requested.push(url);
    if (url === "https://oauth2.googleapis.com/token") {
      const form = new URLSearchParams(await request.text());
      assert(
        ["authorization_code", "refresh_token"].includes(
          form.get("grant_type"),
        ),
      );
      if (mode === "refresh-redirect")
        return new Response(null, {
          status: 307,
          headers: { Location: "https://untrusted.example.test/capture" },
        });
      if (mode === "unavailable")
        return Response.json({ error: "server_error" }, { status: 503 });
      if (mode === "token-redirect")
        return new Response(null, {
          status: 307,
          headers: { Location: "https://untrusted.example.test/capture" },
        });
      return Response.json({
        access_token: "test-access",
        refresh_token: "test-refresh-only-fixture",
        scope:
          "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
      });
    }
    if (url === "https://gmail.googleapis.com/gmail/v1/users/me/profile") {
      if (mode === "profile-redirect")
        return new Response(null, {
          status: 302,
          headers: { Location: "https://untrusted.example.test/capture" },
        });
      return mode === "disabled"
        ? Response.json(
            { error: { details: [{ reason: "SERVICE_DISABLED" }] } },
            { status: 403 },
          )
        : Response.json({
            emailAddress: "sender@example.test",
            historyId: "100",
          });
    }
    if (
      url.startsWith("https://gmail.googleapis.com/gmail/v1/users/me/history?")
    )
      return Response.json({ history: [] });
    if (url === "https://gmail.googleapis.com/gmail/v1/users/me/messages/send")
      return mode === "send-redirect"
        ? new Response(null, {
            status: 307,
            headers: { Location: "https://untrusted.example.test/capture" },
          })
        : Response.json({ id: "fixture-message-id" });
    if (url === "https://api.openai.com/v1/chat/completions")
      return mode === "ai-redirect"
        ? new Response(null, {
            status: 307,
            headers: { Location: "https://untrusted.example.test/capture" },
          })
        : Response.json({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content: JSON.stringify(
                    mockInterpret("Solicito vistoria.", null, "2026-10-24"),
                  ),
                },
              },
            ],
          });
    throw new Error("Unexpected test endpoint");
  };
  const options = {
    workers: [
      {
        name: "gmail-test",
        modules: true,
        scriptPath,
        compatibilityDate: "2026-10-24",
        compatibilityFlags: ["nodejs_compat"],
        d1Databases: ["DB"],
        outboundService,
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
      mode = attempt;
      const response = await mf.dispatchFetch(
        "https://test.invalid/?mode=" + attempt,
      );
      assert.equal(response.status, 200);
      const status = await response.json();
      assert.equal(status.connected, true);
      assert.equal(status.paused, true);
    }
    for (const [attempt, code] of [
      ["disabled", "GMAIL_API_DISABLED"],
      ["unavailable", "GMAIL_PROVIDER_UNAVAILABLE"],
      ["token-redirect", "GMAIL_OAUTH_EXCHANGE"],
      ["profile-redirect", "GMAIL_PROFILE"],
    ]) {
      mode = attempt;
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
      4,
    );
    const logs = await db
      .prepare(
        "SELECT details_json FROM audit_log WHERE action='GMAIL_OAUTH_FAILED'",
      )
      .all();
    assert.equal(logs.results.length, 4);
    assert(!JSON.stringify(logs).includes("private-provider-description"));
    mode = "pipeline";
    const pipeline = await mf.dispatchFetch(
      "https://test.invalid/?mode=pipeline",
    );
    assert.equal(pipeline.status, 200);
    assert.deepEqual(await pipeline.json(), {
      imported: 0,
      sent: 1,
      review: true,
    });
    for (const [attempt, code] of [
      ["refresh-redirect", "GMAIL_AUTH"],
      ["send-redirect", "GMAIL_SEND"],
      ["ai-redirect", "AI_UNAVAILABLE"],
    ]) {
      mode = attempt;
      const rejected = await mf.dispatchFetch(
        "https://test.invalid/?mode=" + attempt,
      );
      assert.equal(rejected.status, 503);
      assert.equal((await rejected.json()).code, code);
    }
    assert(requested.length > 0);
    assert(
      requested.every(
        (url) =>
          url === "https://oauth2.googleapis.com/token" ||
          url === "https://gmail.googleapis.com/gmail/v1/users/me/profile" ||
          url.startsWith(
            "https://gmail.googleapis.com/gmail/v1/users/me/history?",
          ) ||
          url ===
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send" ||
          url === "https://api.openai.com/v1/chat/completions",
      ),
    );
  } finally {
    await mf.dispose();
  }
});
