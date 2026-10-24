// Test-only Worker. Synthetic credentials and provider; never deployed.
import {
  startGmailOAuth,
  finishGmailOAuth,
  gmailAccountStatus,
} from "../../src/gmailAccounts.ts";
import { Repository } from "../../src/repository.ts";
import { seedDirectory } from "../../src/seed.ts";

export default {
  async fetch(request: Request, bindings: { DB: D1Database }) {
    const db = bindings.DB,
      repo = new Repository(db);
    await seedDirectory(repo);
    const env = {
      DB: db,
      DEPLOYMENT_MODE: "private",
      GOOGLE_CLIENT_ID: "test-client",
      GOOGLE_CLIENT_SECRET: "test-secret",
      SECRET_ENCRYPTION_KEY: "test-independent-protection-key-1234567890",
      GOOGLE_OAUTH_REDIRECT_URI:
        "https://test.invalid/api/gmail/oauth/callback",
      OUTBOX_MAILBOX_ID: "mock-mailbox",
    };
    const mode = new URL(request.url).searchParams.get("mode");
    globalThis.fetch = async (url) => {
      if (mode === "network")
        throw new TypeError("private-provider-description");
      if (String(url).endsWith("/token"))
        return Response.json({
          access_token: "test-access",
          refresh_token: "test-refresh-only-fixture",
          scope: "https://www.googleapis.com/auth/gmail.readonly",
        });
      if (String(url).endsWith("/profile"))
        return mode === "disabled"
          ? Response.json(
              { error: { details: [{ reason: "SERVICE_DISABLED" }] } },
              { status: 403 },
            )
          : Response.json({
              emailAddress: "sender@example.test",
              historyId: "100",
            });
      throw new Error("Unexpected test endpoint");
    };
    try {
      const p = await startGmailOAuth(
        new Request("https://test.invalid/api/settings/gmail/connect"),
        env,
        repo,
        "u-admin",
        { email: "sender@example.test" },
      );
      const state = new URL(p.authorizationUrl).searchParams.get("state");
      await finishGmailOAuth(
        new Request(
          env.GOOGLE_OAUTH_REDIRECT_URI + "?state=" + state + "&code=fake-code",
          { headers: { Cookie: p.cookie.split(";")[0] } },
        ),
        env,
        repo,
        "u-admin",
      );
      return Response.json(await gmailAccountStatus(repo, env));
    } catch (e) {
      return Response.json(
        { code: e instanceof Error && "code" in e ? e.code : "TEST_FAILED" },
        { status: 503 },
      );
    }
  },
};
