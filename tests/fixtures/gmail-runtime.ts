// Test-only Worker. Synthetic credentials and provider; never deployed.
import {
  startGmailOAuth,
  finishGmailOAuth,
  gmailAccountStatus,
  activateGmailAccount,
  configuredGmail,
} from "../../src/gmailAccounts.ts";
import {
  dispatchMail,
  synchronizeGmail,
  sendSecurityMail,
} from "../../src/gmail.ts";
import { interpret } from "../../src/interpreter.ts";
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
    // Keep native fetch intact. Miniflare intercepts outbound HTTP after workerd
    // has validated RequestInit, so unsupported options cannot be hidden by a mock.
    try {
      if (
        [
          "pipeline",
          "refresh-redirect",
          "send-redirect",
          "ai-redirect",
        ].includes(mode || "")
      ) {
        const status = await gmailAccountStatus(repo, env);
        await activateGmailAccount(
          repo,
          { ...env, SIMULATION_MODE: "false" },
          "u-admin",
          { connectionId: status.connectionId, version: status.version },
        );
        const effective = await configuredGmail(repo, {
          ...env,
          SIMULATION_MODE: "false",
          EMAIL_SEND_ENABLED: "true",
        });
        const sync = await synchronizeGmail(repo, effective);
        const id = crypto.randomUUID();
        await db
          .prepare(
            "INSERT INTO outbound_messages(id,mailbox_id,recipient_email,subject,body_text,status,dedupe_key,created_at) VALUES(?,?,'recipient@example.com','Synthetic test','Synthetic body','PENDENTE',?,?)",
          )
          .bind(id, effective.OUTBOX_MAILBOX_ID, id, new Date().toISOString())
          .run();
        const dispatch = await dispatchMail(repo, effective);
        await sendSecurityMail(
          effective,
          "recipient@example.com",
          "Synthetic recovery",
          "Synthetic body",
          AbortSignal.timeout(15000),
        );
        const proposal = await interpret(
          "Solicito vistoria.",
          null,
          "2026-10-24",
          {
            AI_PROVIDER: "openai",
            AI_API_KEY: "fixture-api-key",
            AI_MODEL: "fixture-model",
            SIMULATION_MODE: "false",
          },
        );
        return Response.json({
          imported: sync.imported,
          sent: dispatch.sent,
          review: proposal.requires_human_review,
        });
      }
      const p = await startGmailOAuth(
        new Request("https://test.invalid/api/settings/gmail/connect"),
        env,
        repo,
        "u-admin",
        { email: "sender@example.test", allowSend: true },
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
