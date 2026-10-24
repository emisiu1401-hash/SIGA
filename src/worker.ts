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
import type { Command, Person, RuntimeEnv } from "./types.ts";
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
export async function fetchHandler(request: Request, env: RuntimeEnv) {
  const repo = new Repository(
    env.DB,
    env.SIMULATION_MODE === "true",
    env.OUTBOX_MAILBOX_ID,
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
      const asset = __ASSETS__[path === "/" ? "/index.html" : path];
      return secured(
        asset
          ? new Response(asset.body, {
              headers: { "Content-Type": asset.type },
            })
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
    if (request.method !== "GET" && request.method !== "HEAD") {
      assert(
        current.authenticated && !actor.roles.includes("SDG_LEITOR"),
        "FORBIDDEN",
        "O perfil SDG é somente leitura. Entre com um perfil autorizado.",
        403,
      );
      csrfCheck(request, current.csrf);
    }
    if (path === "/api/session" && request.method === "GET")
      return secured(
        json({
          ...current,
          actor: { id: actor.id, name: actor.name, roles: actor.roles },
          simulation: env.SIMULATION_MODE === "true",
          deployment: env.DEPLOYMENT_MODE || "development",
          accessProtected: !!access,
        }),
      );
    if (path === "/api/logout" && request.method === "POST") {
      const r = json({ ok: true });
      r.headers.set(
        "Set-Cookie",
        "siga_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
      );
      return secured(r);
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
                "SELECT * FROM ingestion_reviews r WHERE NOT EXISTS(SELECT 1 FROM siga_commands c WHERE c.id='review:'||r.id) ORDER BY created_at DESC LIMIT 50",
              )
              .all()
          ).results,
        }),
      );
    }
    const triage = path.match(/^\/api\/reviews\/([a-zA-Z0-9-]+)\/triage$/);
    if (triage && request.method === "POST") {
      assert(
        actor.id === "u-gestor" && actor.roles.includes("GESTOR"),
        "FORBIDDEN",
        "A triagem de mensagens exige decisão de Emerson.",
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
        }>();
      assert(review, "NOT_FOUND", "Mensagem não encontrada.", 404);
      const people = await repo.people();
      const s = createAggregate(
        crypto.randomUUID(),
        await repo.nextCode(now),
        review.subject || "Mensagem para triagem",
        review.fresh_text,
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
            "Triagem expressa pelo gestor. Mensagem de origem: " +
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
      return secured(
        json({
          simulation: env.SIMULATION_MODE === "true",
          aiProvider: env.AI_PROVIDER,
          aiModel: env.AI_MODEL,
          aiConfigured: !!env.AI_API_KEY || !!saved,
          gmailConfigured: !!(
            env.GOOGLE_CLIENT_ID &&
            env.GOOGLE_CLIENT_SECRET &&
            env.GOOGLE_REFRESH_TOKEN &&
            env.MAILBOX_ID
          ),
          sendEnabled: env.EMAIL_SEND_ENABLED === "true",
          seiHosts: env.SEI_ALLOWED_HOSTS.split(","),
          cloudflare: true,
          privateEnvironment: env.DEPLOYMENT_MODE === "private",
          tokenStorage: env.AI_API_KEY
            ? "cloudflare-secret"
            : "encrypted-database",
        }),
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
      await repo.db
        .prepare(
          "INSERT INTO app_settings(key,value_json,updated_at) VALUES('ai_api_key',?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at",
        )
        .bind(JSON.stringify({ encrypted, keyVersion: 2 }), now)
        .run();
      await repo.audit(
        actor.id,
        "AI_SECRET_UPDATED",
        "Token de IA atualizado com criptografia AES-GCM.",
      );
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
      return secured(json(await synchronizeGmail(repo, env)));
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
      const effective = await configuredAi(env, repo);
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
        actor.id === "u-gestor" && actor.roles.includes("GESTOR"),
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
        actor.id,
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
      const text = freshText(String(input.text || "")),
        subject = freshText(String(input.subject || ""));
      assert(
        text.length >= 2,
        "TEXT",
        "Informe o texto novo do e-mail fictício.",
      );
      const people = await repo.people();
      const sender = people.find((p) => p.id === input.senderId && p.active);
      assert(sender, "SENDER", "Selecione um remetente fictício cadastrado.");
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
    if (status === 403 && env.DEPLOYMENT_MODE !== "demo")
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
  if (env.SIMULATION_MODE !== "true" && env.GOOGLE_REFRESH_TOKEN) {
    await synchronizeGmail(repo, env);
    await dispatchMail(repo, env);
  }
}
export default {
  fetch: fetchHandler,
  scheduled: scheduledHandler,
} satisfies ExportedHandler<RuntimeEnv>;
