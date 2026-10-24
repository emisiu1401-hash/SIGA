// Test-only edge emulator. Never imported by the deploy bundle; loopback only.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { LocalD1 } from "../scripts/sqlite.mjs";
import { fetchHandler } from "../dist/testing.js";
const oauthBrowserTest = process.env.SIGA_OAUTH_BROWSER_TEST === "true";
const port = oauthBrowserTest ? 8790 : 8789;
const db = new LocalD1();
db.migrate();
const at = new Date().toISOString();
await db
  .prepare(
    "INSERT INTO mailbox_accounts(id,account_ref,provider,enabled,created_at) VALUES('private-mailbox','pending-configuration@exemplo.invalid','gmail',0,?)",
  )
  .bind(at)
  .run();
await db
  .prepare(
    "INSERT INTO users(id,full_name,email,active,created_at,department_id) VALUES('u-gestor','Titular de teste','owner@example.test',1,?,'dept-ae')",
  )
  .bind(at)
  .run();
for (const role of ["ADMIN", "GESTOR", "EXECUTOR"])
  await db
    .prepare("INSERT INTO user_roles VALUES('u-gestor',?)")
    .bind(role)
    .run();
await db
  .prepare(
    "INSERT INTO app_settings VALUES('deployment_identity','{\"mode\":\"private\"}',?)",
  )
  .bind(at)
  .run();
const { privateKey, publicKey } = await generateKeyPair("RS256");
const jwk = {
  ...(await exportJWK(publicKey)),
  kid: "private-browser-test",
  alg: "RS256",
};
const issuer = "https://siga-browser-tests.cloudflareaccess.com";
const jwt = await new SignJWT({ email: "owner@example.test" })
  .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
  .setSubject("browser-test")
  .setIssuer(issuer)
  .setAudience("private-browser-test")
  .setIssuedAt()
  .setExpirationTime("1h")
  .sign(privateKey);
globalThis.fetch = async (url, options = {}) => {
  if (
    oauthBrowserTest &&
    String(url) === "https://oauth2.googleapis.com/token"
  ) {
    const form = new URLSearchParams(options.body);
    const payload = JSON.parse(form.get("code"));
    return Response.json({
      access_token: Buffer.from(JSON.stringify(payload)).toString("base64url"),
      refresh_token: "dummy-browser-refresh-token-123456789",
      scope: payload.scope,
    });
  }
  if (
    oauthBrowserTest &&
    String(url) === "https://gmail.googleapis.com/gmail/v1/users/me/profile"
  ) {
    const auth = new Headers(options.headers).get("Authorization").slice(7);
    const payload = JSON.parse(Buffer.from(auth, "base64url").toString());
    return Response.json({ emailAddress: payload.email, historyId: "100" });
  }
  if (String(url) !== issuer + "/cdn-cgi/access/certs")
    throw Error("External network prohibited in private UI tests");
  return Response.json({ keys: [jwk] });
};
const env = {
  OUTBOX_MAILBOX_ID: "private-mailbox",
  DB: db,
  DEPLOYMENT_MODE: oauthBrowserTest ? "development" : "private",
  PUBLIC_DEMO: "false",
  ACCESS_REQUIRED: "true",
  ACCESS_TEAM_DOMAIN: issuer,
  ACCESS_AUD: "private-browser-test",
  ACCESS_ALLOWED_EMAILS: "owner@example.test",
  SECRET_ENCRYPTION_KEY: randomBytes(48).toString("base64url"),
  SIMULATION_MODE: "true",
  AI_PROVIDER: "mock",
  AI_MODEL: "test-model",
  EMAIL_SEND_ENABLED: "false",
  SEI_ALLOWED_HOSTS: "sei.tjmsp.jus.br",
  ...(oauthBrowserTest
    ? {
        GOOGLE_CLIENT_ID: "dummy-browser-client.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET: "dummy-browser-client-secret",
        GOOGLE_OAUTH_REDIRECT_URI: `http://127.0.0.1:${port}/api/gmail/oauth/callback`,
      }
    : {}),
};
createServer(async (req, res) => {
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (
        size >
        (req.url?.startsWith("/api/spreadsheets/preview") ? 5000000 : 24000)
      ) {
        res.writeHead(413);
        res.end();
        return;
      }
      chunks.push(chunk);
    }
    const method = req.method || "GET";
    const request = new Request(`http://127.0.0.1:${port}${req.url}`, {
      method,
      headers: { ...req.headers, "Cf-Access-Jwt-Assertion": jwt },
      ...(["GET", "HEAD"].includes(method)
        ? {}
        : { body: Buffer.concat(chunks) }),
    });
    const response = await fetchHandler(request, env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500);
    res.end("Test server failure");
  }
}).listen(port, "127.0.0.1", () =>
  console.log("Private UI test server: http://127.0.0.1:8789"),
);
