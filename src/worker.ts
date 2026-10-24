import {
  DomainError,
  assert,
  createAggregate,
  transition,
  codes,
  freshText,
  localDate,
  activeAssignment,
} from "./domain.ts";
import { Repository, dashboard } from "./repository.ts";
import {
  passwordMode,
  passwordLogin,
  changePassword,
  requestPasswordReset,
  resetPassword,
  provisionPassword,
  accessAccounts,
  disablePassword,
  passwordLogout,
  clearPasswordCookie,
} from "./passwords.ts";
import {
  login,
  session,
  csrfCheck,
  constantEqual,
  encryptSecret,
} from "./auth.ts";
import { seedDemo } from "./seed.ts";
import {
  interpret,
  commandForMessage,
  boundedJson,
  configuredAi,
} from "./interpreter.ts";
import { synchronizeGmail, dispatchMail } from "./gmail.ts";
import { assessEmail } from "./emailSecurity.ts";
import {
  curatedEmail,
  reviewAssessment,
  storeEmailReview,
} from "./emailReview.ts";
import {
  gmailAccountStatus,
  gmailOutboxId,
  configuredGmail,
  startGmailOAuth,
  finishGmailOAuth,
  activateGmailAccount,
} from "./gmailAccounts.ts";
import type { Command, Person, RuntimeEnv } from "./types.ts";
import {
  auditStatement,
  recordAudit,
  auditEntries,
  exportAudit,
  type RequestAudit,
} from "./audit.ts";
import {
  exportSpreadsheet,
  previewSpreadsheet,
  applySpreadsheet,
  type SheetKind,
} from "./spreadsheets.ts";
import {
  deploymentGuard,
  deploymentDatabaseGuard,
  privateAccess,
} from "./privacy.ts";

const json = (data: unknown, status = 200) => Response.json(data, { status });
async function body(request: Request) {
  assert(
    request.headers.get("Content-Type")?.startsWith("application/json"),
    "CONTENT_TYPE",
    "Use application/json.",
    415,
  );
  return (await boundedJson(new Response(request.body), 24000)) as Record<
    string,
    unknown
  >;
}
function secured(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'",
  );
  headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, headers });
}
async function handleRequest(
  request: Request,
  env: RuntimeEnv,
  trace: RequestAudit,
) {
  const repo = new Repository(
    env.DB,
    env.SIMULATION_MODE === "true",
    env.OUTBOX_MAILBOX_ID,
    trace.requestId,
  );
  const url = new URL(request.url);
  const path = url.pathname;
  const now = new Date().toISOString();
  try {
    deploymentGuard(env);
    assert(
      env.DEPLOYMENT_MODE !== "development" ||
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
      "DEPLOYMENT_CONFIG",
      "Desenvolvimento disponível somente no computador local.",
      503,
    );
    const access = await privateAccess(request, env);
    await deploymentDatabaseGuard(repo, env);
    trace.databaseReady = true;
    if (
      env.DEPLOYMENT_MODE === "demo" &&
      !["GET", "HEAD"].includes(request.method)
    )
      assert(
        false,
        "DEMO_READ_ONLY",
        "A demonstração é somente consulta. Use o ambiente privado para cadastrar dados e credenciais.",
        403,
      );
    if (!path.startsWith("/api/")) {
      let assetPath = path === "/" ? "/index.html" : path;
      if (passwordMode(env)) {
        if (path === "/login") assetPath = "/login.html";
        if (path === "/" || path === "/index.html") {
          try {
            await session(request, env, repo, access);
          } catch {
            assetPath = "/login.html";
          }
        }
      }
      const asset = __ASSETS__[assetPath];
      return secured(
        asset
          ? new Response(
              asset.binary
                ? Uint8Array.from(atob(asset.body), (c) => c.charCodeAt(0))
                : asset.body,
              {
                headers: { "Content-Type": asset.type },
              },
            )
          : new Response("Página não encontrada", { status: 404 }),
      );
    }
    if (path === "/api/health")
      return secured(
        json({
          status: "ok",
          application: "SIGA",
          simulation: env.SIMULATION_MODE === "true",
        }),
      );
    if (
      passwordMode(env) &&
      path === "/api/auth/meta" &&
      request.method === "GET"
    )
      return secured(
        json({
          passwordLogin: true,
          email: access?.email || null,
          accessProtected: !!access,
        }),
      );
    if (
      passwordMode(env) &&
      ["/api/login", "/api/auth/forgot", "/api/auth/reset"].includes(path) &&
      request.method === "POST"
    ) {
      assert(
        request.headers.get("Origin") === url.origin,
        "ORIGIN",
        "Origem não autorizada.",
        403,
      );
      const input = await body(request);
      if (path === "/api/auth/forgot")
        return secured(
          json(await requestPasswordReset(request, repo, env, input, access)),
        );
      if (path === "/api/auth/reset") {
        const result = await resetPassword(repo, input, access);
        return secured(
          new Response(JSON.stringify(result), {
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie": clearPasswordCookie(request),
            },
          }),
        );
      }
      const result = await passwordLogin(request, repo, input, access);
      return secured(
        new Response(
          JSON.stringify({
            csrf: result.csrf,
            mustChangePassword: result.mustChangePassword,
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie": result.cookie,
            },
          },
        ),
      );
    }
    if (path === "/api/login" && request.method === "POST") {
      assert(
        !access,
        "ACCESS_LOGIN",
        "O acesso privado usa sua identidade Cloudflare Access.",
        403,
      );
      assert(
        request.headers.get("Origin") === url.origin,
        "ORIGIN",
        "Origem não autorizada.",
        403,
      );
      const input = await body(request);
      const result = await login(request, env, repo, input);
      const response = json({ csrf: result.csrf });
      response.headers.set("Set-Cookie", result.cookie);
      return secured(response);
    }
    if (path === "/api/initialize" && request.method === "POST") {
      assert(
        env.DEPLOYMENT_MODE !== "private" &&
          env.PUBLIC_DEMO === "true" &&
          env.SIMULATION_MODE === "true" &&
          env.ADMIN_PASSWORD &&
          (await constantEqual(
            request.headers.get("Authorization") || "",
            "Bearer " + env.ADMIN_PASSWORD,
          )),
        "FORBIDDEN",
        "Inicialização não autorizada.",
        403,
      );
      await seedDemo(repo);
      return secured(json({ initialized: true }));
    }
    const current = await session(request, env, repo, access);
    const actor = current.actor;
    if (current.mustChangePassword)
      assert(
        ["/api/session", "/api/auth/change", "/api/logout"].includes(path),
        "PASSWORD_CHANGE_REQUIRED",
        "Troque a senha temporária antes de acessar os dados.",
        403,
      );
    if (current.authenticated) trace.actor = actor;
    if (
      current.authenticated &&
      ((request.method !== "GET" && request.method !== "HEAD") ||
        path === "/api/gmail/oauth/callback")
    ) {
      await recordAudit(repo.db, {
        actor,
        requestId: trace.requestId,
        action: "REQUEST_STARTED",
        resource: path,
        source: "HTTP",
        details: { method: request.method },
      });
      trace.started = true;
    }
    if (env.DEPLOYMENT_MODE !== "demo") {
      repo.outboxMailboxId =
        (await gmailOutboxId(repo, env)) || repo.outboxMailboxId;
      env = { ...env, OUTBOX_MAILBOX_ID: repo.outboxMailboxId };
    }
    if (path === "/api/gmail/oauth/callback" && request.method === "GET") {
      assert(
        actor.roles.includes("ADMIN") && env.DEPLOYMENT_MODE !== "demo",
        "FORBIDDEN",
        "Conexão restrita ao administrador.",
        403,
      );
      let destination = "/?gmail=connected#settings";
      try {
        await finishGmailOAuth(request, env, repo, actor.id);
      } catch (error) {
        trace.errorCode =
          error instanceof DomainError ? error.code : "GMAIL_OAUTH_FAILED";
        const allowed = [
          "MAILBOX_MISMATCH",
          "GMAIL_OAUTH_SCOPES",
          "GMAIL_OAUTH_REFRESH",
          "GMAIL_OAUTH_STATE",
          "GMAIL_OAUTH_CANCELLED",
          "GMAIL_BUSY",
          "GMAIL_API_DISABLED",
          "GMAIL_PROVIDER_UNAVAILABLE",
          "GMAIL_OAUTH_CLIENT",
          "GMAIL_OAUTH_EXPIRED",
          "GMAIL_OAUTH_EXCHANGE",
          "GMAIL_OAUTH_NETWORK",
          "GMAIL_OAUTH_RESPONSE",
          "GMAIL_OAUTH_PROTECTION",
          "GMAIL_OAUTH_STORAGE",
          "GMAIL_PROFILE",
        ];
        const reason =
          error instanceof DomainError && allowed.includes(error.code)
            ? error.code
            : "GMAIL_OAUTH_FAILED";
        destination =
          "/?gmail=error&reason=" +
          reason +
          "&ref=" +
          trace.requestId +
          "#settings";
      }
      return secured(
        new Response(null, {
          status: 303,
          headers: {
            Location: url.origin + destination,
            "Set-Cookie": `siga_google_state=; HttpOnly; SameSite=Lax; Path=/api/gmail/oauth/callback; Max-Age=0${url.protocol === "https:" ? "; Secure" : ""}`,
          },
        }),
      );
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      assert(
        current.authenticated &&
          (!actor.roles.includes("SDG_LEITOR") ||
            ["/api/auth/change", "/api/logout"].includes(path)),
        "FORBIDDEN",
        "O perfil SDG é somente leitura. Entre com um perfil autorizado.",
        403,
      );
      csrfCheck(request, current.csrf);
    }
    if (current.mustChangePassword)
      assert(
        ["/api/session", "/api/auth/change", "/api/logout"].includes(path),
        "PASSWORD_CHANGE_REQUIRED",
        "Troque a senha temporária antes de acessar os dados.",
        403,
      );
    if (path === "/api/session" && request.method === "GET")
      return secured(
        json({
          ...current,
          actor: { id: actor.id, name: actor.name, roles: actor.roles },
          simulation: env.SIMULATION_MODE === "true",
          deployment: env.DEPLOYMENT_MODE || "development",
          accessProtected: !!access,
          passwordLogin: passwordMode(env),
        }),
      );
    if (path === "/api/logout" && request.method === "POST") {
      if (passwordMode(env))
        return secured(
          new Response(JSON.stringify({ ok: true }), {
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie": await passwordLogout(request, repo, actor),
            },
          }),
        );
      const r = json({ ok: true });
      r.headers.set(
        "Set-Cookie",
        "siga_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
      );
      return secured(r);
    }
    if (path === "/api/auth/change" && request.method === "POST")
      return secured(
        new Response(
          JSON.stringify(
            await changePassword(repo, actor, await body(request)),
          ),
          {
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie": clearPasswordCookie(request),
            },
          },
        ),
      );
    if (path === "/api/auth/accounts" && request.method === "GET") {
      assert(
        actor.roles.includes("ADMIN"),
        "FORBIDDEN",
        "Acesso restrito à administração.",
        403,
      );
      return secured(
        json({
          accounts: await accessAccounts(repo),
          accessEmails: (env.ACCESS_ALLOWED_EMAILS || "")
            .split(",")
            .map((x) => x.trim().toLowerCase()),
        }),
      );
    }
    if (path === "/api/auth/accounts" && request.method === "POST") {
      const input = await body(request);
      assert(
        typeof input.userId === "string" && typeof input.username === "string",
        "AUTH_USER",
        "Informe a pessoa e o identificador de acesso.",
      );
      return secured(
        json(
          await provisionPassword(repo, actor, input.userId, input.username),
        ),
      );
    }
    if (path === "/api/auth/accounts/disable" && request.method === "POST") {
      const input = await body(request);
      return secured(
        json(await disablePassword(repo, actor, String(input.userId || ""))),
      );
    }
    if (path === "/api/dashboard" && request.method === "GET")
      return secured(
        json(await dashboard(repo, url.searchParams, actor, now, env)),
      );
    if (path === "/api/directory" && request.method === "GET") {
      const people = await repo.people();
      return secured(
        json({
          people: people
            .filter((p) => p.id !== "system")
            .map((p) =>
              current.authenticated
                ? p
                : {
                    id: p.id,
                    name: p.name,
                    roles: p.roles,
                    department: p.department,
                    active: p.active,
                  },
            ),
          departments: (
            await repo.db
              .prepare(
                "SELECT code,name FROM departments WHERE active=1 ORDER BY code",
              )
              .all()
          ).results,
        }),
      );
    }
    if (path === "/api/directory" && request.method === "POST") {
      assert(
        actor.roles.includes("ADMIN"),
        "FORBIDDEN",
        "Cadastro restrito à administração.",
        403,
      );
      const input = await body(request);
      const people = (
        Array.isArray(input.people) ? input.people : [input]
      ) as Person[];
      assert(
        people.length <= 100,
        "BATCH",
        "Máximo de 100 cadastros por importação.",
      );
      const results = [];
      for (const p of people) {
        try {
          p.id ||= crypto.randomUUID();
          await repo.personSave(p, actor.id, now);
          results.push({ name: p.name, ok: true });
        } catch (e) {
          results.push({
            name: p.name,
            ok: false,
            error: e instanceof Error ? e.message : "Cadastro inválido",
          });
        }
      }
      return secured(json({ results }));
    }
    if (path === "/api/mail" && request.method === "GET") {
      assert(
        actor.roles.includes("GESTOR") || actor.roles.includes("ADMIN"),
        "FORBIDDEN",
        "Correspondência restrita à gestão.",
        403,
      );
      return secured(
        json({
          outbox: await repo.emails(),
          reviews: (
            await repo.db
              .prepare(
                "SELECT r.*,m.account_ref mailbox_email FROM ingestion_reviews r LEFT JOIN mailbox_accounts m ON m.id=r.mailbox_id WHERE NOT EXISTS(SELECT 1 FROM siga_commands c WHERE c.id='review:'||r.id) ORDER BY r.created_at DESC LIMIT 50",
              )
              .all()
          ).results.map((row) => {
            const assessment = reviewAssessment(
              row as {
                subject: string;
                fresh_text: string;
                security_status?: string;
                security_flags_json?: string;
              },
            );
            return {
              ...row,
              subject: assessment.subject,
              fresh_text: assessment.text,
              security_status: assessment.status,
              security_flags: assessment.flags,
            };
          }),
        }),
      );
    }
    const triage = path.match(/^\/api\/reviews\/([a-zA-Z0-9-]+)\/triage$/);
    if (triage && request.method === "POST") {
      assert(
        actor.roles.includes("GESTOR"),
        "FORBIDDEN",
        "A triagem de mensagens exige decisão de gestor autenticado.",
        403,
      );
      const key = "review:" + triage[1];
      const previous = await repo.command(key);
      if (previous) return secured(json(previous));
      const review = await repo.db
        .prepare("SELECT * FROM ingestion_reviews WHERE id=?")
        .bind(triage[1])
        .first<{
          subject: string;
          fresh_text: string;
          sender: string;
          provider_message_id: string;
          security_status: string;
          security_flags_json: string;
        }>();
      assert(review, "NOT_FOUND", "Mensagem não encontrada.", 404);
      const content = curatedEmail(review, await body(request));
      const people = await repo.people();
      const s = createAggregate(
        crypto.randomUUID(),
        await repo.nextCode(now),
        content.subject || "Mensagem para triagem",
        content.text,
        "u-gestor",
        now,
      );
      const next = transition(
        s,
        {
          id: key,
          type: "CREATE",
          origin: "EMAIL",
          reason:
            (content.curated
              ? "Texto reescrito pelo gestor após quarentena. Justificativa: " +
                content.reason +
                ". "
              : "Triagem expressa pelo gestor. ") +
            "Mensagem de origem: " +
            review.provider_message_id,
        },
        actor,
        people,
        now,
        env.SEI_ALLOWED_HOSTS.split(","),
      );
      return secured(json(await repo.save(next.state, null, key), 201));
    }
    if (path === "/api/audit" && request.method === "GET") {
      assert(
        actor.roles.includes("ADMIN") || actor.roles.includes("GESTOR"),
        "FORBIDDEN",
        "Auditoria restrita.",
        403,
      );
      return secured(
        json({
          security: (
            await repo.db
              .prepare(
                "SELECT * FROM security_events ORDER BY occurred_at DESC LIMIT 50",
              )
              .all()
          ).results,
          events: (
            await repo.db
              .prepare(
                "SELECT e.id,e.type,e.actor_id,e.occurred_at,e.declared_or_verified,d.code FROM demand_events e JOIN demands d ON d.id=e.demand_id ORDER BY e.occurred_at DESC LIMIT 100",
              )
              .all()
          ).results,
        }),
      );
    }
    if (
      ["/api/audit/log", "/api/audit/export"].includes(path) &&
      request.method === "GET"
    ) {
      assert(
        actor.roles.includes("ADMIN") || actor.roles.includes("GESTOR"),
        "FORBIDDEN",
        "Auditoria restrita.",
        403,
      );
      return secured(
        path.endsWith("export")
          ? await exportAudit(repo.db, url.searchParams)
          : json(await auditEntries(repo.db, url.searchParams)),
      );
    }
    if (path === "/api/spreadsheets/export" && request.method === "GET")
      return secured(
        await exportSpreadsheet(
          repo,
          actor,
          url.searchParams.get("kind") as SheetKind,
        ),
      );
    if (path === "/api/spreadsheets/preview" && request.method === "POST") {
      assert(
        request.headers.get("Content-Type")?.split(";")[0] ===
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "CONTENT_TYPE",
        "Envie um arquivo .xlsx.",
        415,
      );
      const reader = request.body?.getReader();
      assert(reader, "SHEET_EMPTY", "Arquivo vazio.");
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          assert(
            size <= 5_000_000,
            "SHEET_SIZE",
            "Arquivo maior que 5 MB.",
            413,
          );
          chunks.push(value);
        }
      } finally {
        await reader.cancel();
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const c of chunks) {
        bytes.set(c, offset);
        offset += c.length;
      }
      return secured(
        json(
          await previewSpreadsheet(
            repo,
            env,
            actor,
            url.searchParams.get("kind") as SheetKind,
            bytes,
          ),
        ),
      );
    }
    if (path === "/api/spreadsheets/apply" && request.method === "POST") {
      const input = await body(request);
      assert(
        typeof input.previewId === "string",
        "IMPORT_PREVIEW",
        "Valide a planilha primeiro.",
      );
      return secured(
        json(await applySpreadsheet(repo, env, actor, input.previewId)),
      );
    }
    if (path === "/api/settings" && request.method === "GET") {
      assert(
        actor.roles.includes("ADMIN") || actor.roles.includes("GESTOR"),
        "FORBIDDEN",
        "Configurações restritas.",
        403,
      );
      const saved = await repo.db
        .prepare("SELECT value_json FROM app_settings WHERE key='ai_api_key'")
        .first();
      const gmail = await gmailAccountStatus(repo, env);
      return secured(
        json({
          simulation: env.SIMULATION_MODE === "true",
          aiProvider: env.AI_PROVIDER,
          aiModel: env.AI_MODEL,
          aiConfigured: !!env.AI_API_KEY || !!saved,
          gmailConfigured: gmail.connected,
          gmail,
          sendEnabled:
            gmail.connected &&
            env.SIMULATION_MODE !== "true" &&
            env.EMAIL_SEND_ENABLED === "true" &&
            (!gmail.connectionId || (!gmail.paused && gmail.sendAuthorized)),
          seiHosts: env.SEI_ALLOWED_HOSTS.split(","),
          cloudflare: true,
          privateEnvironment: env.DEPLOYMENT_MODE === "private",
          tokenStorage: env.AI_API_KEY
            ? "cloudflare-secret"
            : "encrypted-database",
        }),
      );
    }
    if (path === "/api/settings/gmail/connect" && request.method === "POST") {
      assert(
        actor.roles.includes("ADMIN"),
        "FORBIDDEN",
        "Conexão restrita ao administrador.",
        403,
      );
      const result = await startGmailOAuth(
        request,
        env,
        repo,
        actor.id,
        await body(request),
      );
      return secured(
        new Response(
          JSON.stringify({ authorizationUrl: result.authorizationUrl }),
          {
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie": result.cookie,
            },
          },
        ),
      );
    }
    if (path === "/api/settings/gmail/activate" && request.method === "POST") {
      assert(
        actor.roles.includes("ADMIN"),
        "FORBIDDEN",
        "Ativação restrita ao administrador.",
        403,
      );
      return secured(
        json(
          await activateGmailAccount(repo, env, actor.id, await body(request)),
        ),
      );
    }
    if (path === "/api/settings/ai" && request.method === "POST") {
      assert(
        actor.roles.includes("ADMIN"),
        "FORBIDDEN",
        "Segredos restritos ao administrador.",
        403,
      );
      const input = await body(request);
      assert(
        env.SECRET_ENCRYPTION_KEY && env.SECRET_ENCRYPTION_KEY.length >= 32,
        "SECRET",
        "Chave de criptografia não configurada.",
        503,
      );
      assert(
        typeof input.token === "string" &&
          input.token.length >= 20 &&
          input.token.length <= 512 &&
          !/[\r\n]/.test(input.token),
        "TOKEN",
        "Informe um token válido.",
      );
      const encrypted = await encryptSecret(
        input.token,
        env.SECRET_ENCRYPTION_KEY,
      );
      const updateSecret = repo.db
        .prepare(
          "INSERT INTO app_settings(key,value_json,updated_at) VALUES('ai_api_key',?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at",
        )
        .bind(JSON.stringify({ encrypted, keyVersion: 2 }), now);
      await repo.db.batch([
        updateSecret,
        auditStatement(repo.db, {
          actor,
          requestId: repo.requestId,
          action: "AI_SECRET_UPDATED",
          source: "SECURITY",
          at: now,
          details: {
            message: "Credencial atualizada com AES-GCM; valor omitido.",
          },
        }),
      ]);
      return secured(
        json({
          saved: true,
          message:
            "Token criptografado e salvo. Em simulação, o interpretador continua local e sem consumo pago.",
        }),
      );
    }
    if (path === "/api/gmail/sync" && request.method === "POST") {
      assert(
        actor.roles.includes("ADMIN"),
        "FORBIDDEN",
        "Sincronização restrita ao administrador.",
        403,
      );
      return secured(
        json(await synchronizeGmail(repo, await configuredGmail(repo, env))),
      );
    }
    if (path === "/api/interpret" && request.method === "POST") {
      assert(
        actor.roles.includes("ADMIN") || actor.roles.includes("GESTOR"),
        "FORBIDDEN",
        "Interpretação restrita à gestão.",
        403,
      );
      const input = await body(request);
      assert(
        typeof input.text === "string" && input.text.length >= 2,
        "TEXT",
        "Informe texto para interpretação.",
      );
      const effective =
        assessEmail("", input.text).status === "QUARANTINED"
          ? env
          : await configuredAi(env, repo);
      return secured(
        json({
          interpretation: await interpret(
            input.text,
            null,
            localDate(now),
            effective,
          ),
          simulation: env.SIMULATION_MODE === "true",
        }),
      );
    }
    if (path === "/api/demands" && request.method === "POST") {
      assert(
        actor.roles.includes("GESTOR"),
        "FORBIDDEN",
        "Criação restrita ao gestor.",
        403,
      );
      const input = await body(request);
      const key = String(input.commandId || "");
      assert(
        key.length >= 16 && key.length <= 120,
        "IDEMPOTENCY",
        "Identificador idempotente necessário.",
      );
      const prior = await repo.command(key);
      if (prior) return secured(json(prior));
      const people = await repo.people();
      const s = createAggregate(
        crypto.randomUUID(),
        await repo.nextCode(now),
        String(input.title || ""),
        String(input.description || ""),
        "u-gestor",
        now,
      );
      const next = transition(
        s,
        { id: key, type: "CREATE" },
        actor,
        people,
        now,
        env.SEI_ALLOWED_HOSTS.split(","),
      );
      return secured(json(await repo.save(next.state, null, key), 201));
    }
    const detail = path.match(/^\/api\/demands\/([a-zA-Z0-9:-]+)$/);
    if (detail && request.method === "GET") {
      const s = await repo.get(detail[1]);
      assert(s, "NOT_FOUND", "Demanda não encontrada.", 404);
      if (
        actor.roles.includes("EXECUTOR") &&
        !actor.roles.includes("GESTOR") &&
        !actor.roles.includes("ADMIN")
      )
        assert(
          s.assignments.some((a) => a.personId === actor.id),
          "FORBIDDEN",
          "Demanda fora de seu escopo.",
          403,
        );
      const people = await repo.people();
      return secured(
        json({
          demand: {
            ...s,
            outbox:
              current.authenticated && !actor.roles.includes("SDG_LEITOR")
                ? s.outbox
                : [],
            activeMenus: current.authenticated ? s.activeMenus : {},
          },
          people: people.map((p) => ({
            id: p.id,
            name: p.name,
            department: p.department,
            roles: p.roles,
          })),
          children: (await Promise.all(s.childIds.map((id) => repo.get(id))))
            .filter(Boolean)
            .map((c) => ({
              id: c!.id,
              code: c!.code,
              title: c!.title,
              status: c!.status,
            })),
          parent: s.parentId
            ? await repo.db
                .prepare("SELECT id,code,title FROM demands WHERE id=?")
                .bind(s.parentId)
                .first()
            : null,
        }),
      );
    }
    const action = path.match(/^\/api\/demands\/([a-zA-Z0-9:-]+)\/actions$/);
    if (action && request.method === "POST") {
      const input = await body(request);
      const command = input as unknown as Command;
      assert(
        typeof command.id === "string" &&
          command.id.length >= 16 &&
          command.id.length <= 120,
        "IDEMPOTENCY",
        "Identificador idempotente necessário.",
      );
      assert(
        Number.isInteger(command.expectedVersion),
        "VERSION",
        "Versão da demanda obrigatória.",
      );
      const s = await repo.get(action[1]);
      assert(s, "NOT_FOUND", "Demanda não encontrada.", 404);
      const prior = await repo.command(command.id);
      if (prior) {
        assert(
          prior.id === s.id,
          "CONFLICT",
          "Identificador usado em outra demanda.",
          409,
        );
        return secured(json(prior));
      }
      command.origin = "DASHBOARD";
      const people = await repo.people();
      command.childCode = await repo.nextCode(now);
      command.childId = crypto.randomUUID();
      const next = transition(
        s,
        command,
        actor,
        people,
        now,
        env.SEI_ALLOWED_HOSTS.split(","),
      );
      return secured(
        json(await repo.save(next.state, s, command.id, next.children)),
      );
    }
    if (path === "/api/simulate" && request.method === "POST") {
      assert(
        env.DEPLOYMENT_MODE === "development" &&
          env.SIMULATION_MODE === "true" &&
          actor.roles.includes("GESTOR"),
        "FORBIDDEN",
        "Simulador reservado ao gestor no modo de demonstração.",
        403,
      );
      const input = await body(request);
      assert(
        typeof input.commandId === "string" && input.commandId.length >= 16,
        "IDEMPOTENCY",
        "Identificador obrigatório.",
      );
      const key = input.commandId;
      const duplicate = await repo.command(key);
      if (duplicate) return secured(json({ ...duplicate, duplicate: true }));
      const assessment = assessEmail(
        String(input.subject || ""),
        String(input.text || ""),
      );
      const text = assessment.text,
        subject = assessment.subject;
      assert(
        text.length >= 2,
        "TEXT",
        "Informe o texto novo do e-mail fictício.",
      );
      const people = await repo.people();
      const sender = people.find((p) => p.id === input.senderId && p.active);
      assert(sender, "SENDER", "Selecione um remetente fictício cadastrado.");
      if (assessment.status === "QUARANTINED") {
        await storeEmailReview(repo, {
          mailbox: repo.outboxMailboxId,
          providerId: key,
          sender: sender.email,
          assessment,
          reason:
            "Simulação isolada: conteúdo suspeito, sem execução de comandos.",
        });
        return secured(
          json({
            review: true,
            quarantined: true,
            security_flags: assessment.flags,
          }),
        );
      }
      let s = input.demandId ? await repo.get(String(input.demandId)) : null;
      const found = codes(subject + " " + text);
      assert(
        found.length <= 1,
        "CORRELATION",
        "Há mais de um código: mensagem exige revisão.",
      );
      if (found.length) {
        const byCode = await repo.get(found[0]);
        assert(
          byCode,
          "UNKNOWN_CODE",
          "Código inexistente: mensagem exige triagem.",
        );
        assert(
          !s || s.id === byCode.id,
          "CORRELATION",
          "Código e conversa apontam para demandas distintas.",
        );
        s = byCode;
      }
      if (!s) {
        const created = createAggregate(
          crypto.randomUUID(),
          await repo.nextCode(now),
          subject || "Nova mensagem para triagem",
          text,
          "u-gestor",
          now,
        );
        const next = transition(
          created,
          { id: key, type: "CREATE", origin: "EMAIL" },
          people.find((p) => p.id === "u-gestor")!,
          people,
          now,
        );
        return secured(
          json({ ...(await repo.save(next.state, null, key)), created: true }),
        );
      }
      const menu = s.activeMenus[sender.id] || null;
      const interpretation = await interpret(text, menu, localDate(now), env);
      const command = commandForMessage(
        s,
        text,
        sender,
        people,
        now,
        key,
        interpretation,
      );
      if (!command) {
        await repo.db.batch([
          repo.db
            .prepare(
              "INSERT INTO ingestion_reviews(id,provider_message_id,sender,subject,fresh_text,reason,created_at) VALUES(?,?,?,?,?,?,?)",
            )
            .bind(
              crypto.randomUUID(),
              key,
              sender.email,
              subject,
              text,
              "Interpretação não aplicável automaticamente: revisão humana necessária.",
              now,
            ),
          repo.db
            .prepare(
              "INSERT INTO siga_commands(id,demand_id,result_json,created_at) VALUES(?,?,?,?)",
            )
            .bind(key, s.id, JSON.stringify({ id: s.id, review: true }), now),
        ]);
        return secured(json({ review: true, interpretation, id: s.id }));
      }
      command.childId = crypto.randomUUID();
      command.childCode = await repo.nextCode(now);
      const next = transition(
        s,
        command,
        sender,
        people,
        now,
        env.SEI_ALLOWED_HOSTS.split(","),
      );
      await repo.audit(
        actor.id,
        "SIMULATED_SENDER",
        `Simulador usou identidade fictícia ${sender.id}.`,
      );
      return secured(
        json({
          ...(await repo.save(next.state, s, key, next.children)),
          interpretation,
        }),
      );
    }
    return secured(
      json({ error: "NOT_FOUND", message: "Rota não encontrada." }, 404),
    );
  } catch (error) {
    trace.errorCode =
      error instanceof DomainError ? error.code : "REQUEST_FAILED";
    const known = error instanceof DomainError;
    let status = known ? error.status : 500;
    let message = known
      ? error.message
      : "Não foi possível concluir. Recarregue e tente novamente.";
    const detail = String(error);
    if (/STALE_VERSION|UNIQUE constraint|SQLITE_CONSTRAINT/.test(detail)) {
      status = 409;
      message =
        "Conflito de versão ou registro duplicado. Recarregue os dados.";
    }
    if (status === 403 && trace.databaseReady && env.DEPLOYMENT_MODE !== "demo")
      try {
        await repo.audit(null, "ACCESS_DENIED", `${request.method} ${path}`);
      } catch {}
    // Never log bodies, credentials or provider payloads.
    if (status === 500)
      console.error(
        JSON.stringify({
          event: "request_failed",
          path,
          requestId: crypto.randomUUID(),
          kind: error instanceof Error ? error.name : "Unknown",
        }),
      );
    return secured(
      json({ error: known ? error.code : "REQUEST_FAILED", message }, status),
    );
  }
}
export async function fetchHandler(request: Request, env: RuntimeEnv) {
  const trace: RequestAudit = { requestId: crypto.randomUUID() },
    start = performance.now();
  const response = await handleRequest(request, env, trace),
    path = new URL(request.url).pathname;
  if (
    trace.databaseReady &&
    env.DEPLOYMENT_MODE !== "demo" &&
    path.startsWith("/api/") &&
    (trace.started ||
      response.status >= 400 ||
      /\/(export|settings|logout|login|sync)(\/|$)/.test(path))
  ) {
    try {
      await recordAudit(env.DB, {
        actor: trace.actor,
        requestId: trace.requestId,
        action: "HTTP_" + request.method,
        resource: path,
        source: "HTTP",
        outcome:
          trace.errorCode || response.status >= 400 ? "NEGADO" : "SUCESSO",
        status: response.status,
        duration: performance.now() - start,
        details: { errorCode: trace.errorCode || null },
      });
    } catch {
      console.error(
        JSON.stringify({
          event: "audit_write_failed",
          requestId: trace.requestId,
        }),
      );
      response.headers.set("X-SIGA-Audit-Degraded", "true");
    }
  }
  response.headers.set("X-Request-ID", trace.requestId);
  return response;
}
export async function scheduledHandler(
  _controller: ScheduledController,
  env: RuntimeEnv,
) {
  deploymentGuard(env);
  if (env.DEPLOYMENT_MODE === "demo") return;
  const repo = new Repository(
    env.DB,
    env.SIMULATION_MODE === "true",
    env.OUTBOX_MAILBOX_ID,
  );
  await deploymentDatabaseGuard(repo, env);
  repo.outboxMailboxId =
    (await gmailOutboxId(repo, env)) || repo.outboxMailboxId;
  const people = await repo.people();
  const system = people.find((p) => p.id === "system")!;
  const now = new Date().toISOString();
  const { results } = await repo.db
    .prepare(
      "SELECT g.state_json FROM siga_aggregates g JOIN demands d ON d.id=g.id JOIN assignments a ON a.stage_id=d.id||':stage' AND a.status='ATIVA' JOIN json_each(g.state_json,'$.assignments') j ON json_extract(j.value,'$.id')=a.id WHERE d.status='EM_EXECUCAO' AND json_extract(j.value,'$.reminderSent')=0 AND json_extract(j.value,'$.reminderDate')<=? ORDER BY a.current_due_date,a.id LIMIT 100",
    )
    .bind(localDate(now))
    .all<{ state_json: string }>();
  for (const row of results) {
    const state = JSON.parse(row.state_json);
    const a = activeAssignment(state);
    if (
      a?.reminderDate &&
      !a.reminderSent &&
      a.reminderDate <= localDate(now)
    ) {
      const key = `cron:${a.id}:${a.dueRevision}:d2`;
      if (await repo.command(key)) continue;
      try {
        const next = transition(
          state,
          {
            id: key,
            type: "REMIND",
            expectedVersion: state.version,
            origin: "CRON",
          },
          system,
          people,
          now,
        );
        await repo.save(next.state, state, key);
      } catch (e) {
        if (!(e instanceof DomainError) && !/STALE_VERSION/.test(String(e)))
          throw e;
      }
    }
  }
  if (env.SIMULATION_MODE !== "true") {
    const effective = await configuredGmail(repo, env);
    if (effective.GOOGLE_REFRESH_TOKEN) {
      await synchronizeGmail(repo, effective);
      await dispatchMail(repo, effective);
    }
  }
}
export default {
  fetch: fetchHandler,
  scheduled: scheduledHandler,
} satisfies ExportedHandler<RuntimeEnv>;
