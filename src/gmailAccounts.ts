import { auditStatement } from "./audit.ts";
import { encryptSecret, decryptSecret, constantEqual } from "./auth.ts";
import { assert } from "./domain.ts";
import { boundedJson } from "./interpreter.ts";
import type { Repository } from "./repository.ts";
import type { RuntimeEnv } from "./types.ts";

const READ = "https://www.googleapis.com/auth/gmail.readonly";
const SEND = "https://www.googleapis.com/auth/gmail.send";
type Control = {
  active_connection_id: string | null;
  version: number;
  paused: number;
  busy_until: number;
};
type Connection = {
  id: string;
  mailbox_id: string;
  account_ref: string;
  refresh_token_cipher: string;
  scopes: string;
  connected_at: string;
};
const hash = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
const random = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
const challenge = async (s: string) =>
  btoa(
    String.fromCharCode(
      ...new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
      ),
    ),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
async function control(repo: Repository) {
  const row = await repo.db
    .prepare("SELECT * FROM gmail_control WHERE id=1")
    .first<Control>();
  assert(
    row,
    "GMAIL_MIGRATION",
    "Atualização da configuração Gmail pendente.",
    503,
  );
  return row;
}
async function connection(repo: Repository, id: string) {
  const row = await repo.db
    .prepare(
      "SELECT c.*,m.account_ref FROM gmail_connections c JOIN mailbox_accounts m ON m.id=c.mailbox_id WHERE c.id=?",
    )
    .bind(id)
    .first<Connection>();
  assert(
    row,
    "GMAIL_CONNECTION",
    "Conexão Gmail indisponível. Reconecte a conta.",
    503,
  );
  return row;
}
function redirectUri(request: Request, env: RuntimeEnv) {
  const configured = env.GOOGLE_OAUTH_REDIRECT_URI || "";
  const url = new URL(request.url);
  assert(
    configured === url.origin + "/api/gmail/oauth/callback" &&
      (url.protocol === "https:" ||
        (env.DEPLOYMENT_MODE === "development" &&
          ["127.0.0.1", "localhost"].includes(url.hostname))),
    "GMAIL_REDIRECT",
    "Configure o endereço de retorno OAuth deste ambiente.",
    503,
  );
  return configured;
}
function oauthConfig(env: RuntimeEnv) {
  assert(
    env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      env.SECRET_ENCRYPTION_KEY &&
      env.SECRET_ENCRYPTION_KEY.length >= 32,
    "GMAIL_OAUTH_SETUP",
    "A conexão Google precisa da configuração inicial do cliente OAuth na Cloudflare. Consulte o guia de operação.",
    503,
  );
}
export async function gmailAccountStatus(repo: Repository, env: RuntimeEnv) {
  const c = await control(repo);
  const active = c.active_connection_id
    ? await connection(repo, c.active_connection_id)
    : null;
  const scopes = active?.scopes.split(" ") || [];
  const held = await repo.db
    .prepare(
      "SELECT count(*) n FROM outbound_messages WHERE failure_reason LIKE 'CONTA_ALTERADA:%'",
    )
    .first<{ n: number }>();
  return {
    oauthReady: !!(
      env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      env.GOOGLE_OAUTH_REDIRECT_URI &&
      env.SECRET_ENCRYPTION_KEY
    ),
    email: active?.account_ref || env.MAILBOX_ID || null,
    connected: !!active || !!(env.GOOGLE_REFRESH_TOKEN && env.MAILBOX_ID),
    connectionId: active?.id || null,
    version: c.version,
    paused: active ? !!c.paused : false,
    sendAuthorized: active ? scopes.includes(SEND) : false,
    integrationsEnabled: env.SIMULATION_MODE !== "true",
    heldMessages: held?.n || 0,
    busy: c.busy_until > Date.now(),
  };
}
export async function gmailOutboxId(repo: Repository, env: RuntimeEnv) {
  const c = await control(repo);
  return c.active_connection_id
    ? (await connection(repo, c.active_connection_id)).mailbox_id
    : env.OUTBOX_MAILBOX_ID;
}
export async function configuredGmail(
  repo: Repository,
  env: RuntimeEnv,
): Promise<RuntimeEnv> {
  const c = await control(repo);
  if (!c.active_connection_id)
    return { ...env, GMAIL_CONTROL_VERSION: c.version };
  const active = await connection(repo, c.active_connection_id);
  assert(
    env.SECRET_ENCRYPTION_KEY,
    "GMAIL_SECRET",
    "Chave de proteção Gmail indisponível.",
    503,
  );
  return {
    ...env,
    GOOGLE_REFRESH_TOKEN: await decryptSecret(
      active.refresh_token_cipher,
      env.SECRET_ENCRYPTION_KEY,
    ),
    MAILBOX_ID: active.account_ref,
    OUTBOX_MAILBOX_ID: active.mailbox_id,
    GMAIL_CONNECTION_ID: active.id,
    GMAIL_CONTROL_VERSION: c.version,
    SIMULATION_MODE: c.paused ? "true" : env.SIMULATION_MODE,
    EMAIL_SEND_ENABLED:
      c.paused || !active.scopes.split(" ").includes(SEND)
        ? "false"
        : env.EMAIL_SEND_ENABLED,
  };
}
// Serializes account changes, sync and sending. The processing deadline is shorter
// than the lease, including each bounded 15-second provider request.
export async function gmailOperation(repo: Repository, env: RuntimeEnv) {
  const owner = crypto.randomUUID(),
    now = Date.now(),
    deadline = now + 180000;
  const claim = await repo.db
    .prepare(
      "UPDATE gmail_control SET lease_owner=?,busy_until=? WHERE id=1 AND active_connection_id IS ? AND version=? AND busy_until<? RETURNING id",
    )
    .bind(
      owner,
      now + 240000,
      env.GMAIL_CONNECTION_ID || null,
      env.GMAIL_CONTROL_VERSION || 0,
      now,
    )
    .first();
  assert(
    claim,
    "GMAIL_BUSY",
    "Comunicações em andamento ou conta alterada. Atualize e tente novamente.",
    409,
  );
  return {
    check: () =>
      assert(
        Date.now() < deadline,
        "GMAIL_DEADLINE",
        "Lote interrompido no limite seguro; o histórico foi preservado.",
        503,
      ),
    signal: () =>
      AbortSignal.timeout(Math.max(1, Math.min(15000, deadline - Date.now()))),
    release: () =>
      repo.db
        .prepare(
          "UPDATE gmail_control SET lease_owner=NULL,busy_until=0 WHERE id=1 AND lease_owner=?",
        )
        .bind(owner)
        .run(),
  };
}
export async function startGmailOAuth(
  request: Request,
  env: RuntimeEnv,
  repo: Repository,
  actorId: string,
  input: Record<string, unknown>,
) {
  oauthConfig(env);
  const uri = redirectUri(request, env);
  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  assert(
    email.length <= 254 &&
      /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(email),
    "EMAIL",
    "Informe o e-mail Google que deseja conectar.",
  );
  const c = await control(repo);
  assert(
    c.busy_until < Date.now(),
    "GMAIL_BUSY",
    "Aguarde o processamento em andamento antes de trocar a conta.",
    409,
  );
  await repo.db
    .prepare("DELETE FROM gmail_oauth_requests WHERE expires_at<?")
    .bind(Date.now())
    .run();
  const pending = await repo.db
    .prepare(
      "SELECT count(*) n FROM gmail_oauth_requests WHERE actor_id=? AND status IN ('PENDING','PROCESSING')",
    )
    .bind(actorId)
    .first<{ n: number }>();
  assert(
    (pending?.n || 0) < 5,
    "GMAIL_OAUTH_RATE",
    "Muitas conexões abertas. Aguarde dez minutos.",
    429,
  );
  const state = random(),
    verifier = random();
  await repo.db
    .prepare("INSERT INTO gmail_oauth_requests VALUES(?,?,?,?,?,?,?,'PENDING')")
    .bind(
      await hash(state),
      actorId,
      email,
      await encryptSecret(verifier, env.SECRET_ENCRYPTION_KEY!),
      c.version,
      input.allowSend === true ? 1 : 0,
      Date.now() + 600000,
    )
    .run();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: uri,
    response_type: "code",
    scope: input.allowSend === true ? READ + " " + SEND : READ,
    access_type: "offline",
    prompt: "consent select_account",
    state,
    login_hint: email,
    code_challenge: await challenge(verifier),
    code_challenge_method: "S256",
  }).toString();
  return {
    authorizationUrl: url.toString(),
    cookie: `siga_google_state=${state}; HttpOnly; SameSite=Lax; Path=/api/gmail/oauth/callback; Max-Age=600${uri.startsWith("https:") ? "; Secure" : ""}`,
  };
}
export async function finishGmailOAuth(
  request: Request,
  env: RuntimeEnv,
  repo: Repository,
  actorId: string,
) {
  oauthConfig(env);
  const uri = redirectUri(request, env),
    url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  const cookie =
    request.headers
      .get("Cookie")
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("siga_google_state="))
      ?.slice(18) || "";
  assert(
    /^[a-f0-9]{64}$/.test(state) && (await constantEqual(state, cookie)),
    "GMAIL_OAUTH_STATE",
    "Autorização expirada ou origem inválida. Inicie a conexão novamente.",
    403,
  );
  const stateHash = await hash(state);
  const pending = await repo.db
    .prepare(
      "UPDATE gmail_oauth_requests SET status='PROCESSING' WHERE state_hash=? AND actor_id=? AND status='PENDING' AND expires_at>? RETURNING *",
    )
    .bind(stateHash, actorId, Date.now())
    .first<{
      expected_email: string;
      verifier_cipher: string;
      control_version: number;
      request_send: number;
    }>();
  assert(
    pending,
    "GMAIL_OAUTH_STATE",
    "Esta autorização já foi usada ou expirou.",
    403,
  );
  const leaseOwner = crypto.randomUUID();
  try {
    assert(
      !url.searchParams.has("error"),
      "GMAIL_OAUTH_CANCELLED",
      "A autorização foi cancelada. A conta anterior foi mantida.",
    );
    const code = url.searchParams.get("code") || "";
    assert(
      code && code.length <= 4096,
      "GMAIL_OAUTH_CODE",
      "Código de autorização inválido.",
    );
    const exchange = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: uri,
        code_verifier: await decryptSecret(
          pending.verifier_cipher,
          env.SECRET_ENCRYPTION_KEY!,
        ),
      }),
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    assert(
      exchange.ok,
      "GMAIL_OAUTH_EXCHANGE",
      "O Google não concluiu a autorização. Tente conectar novamente.",
      503,
    );
    const tokens = (await boundedJson(exchange, 24000)) as {
      access_token?: string;
      refresh_token?: string;
      scope?: string;
    };
    assert(
      typeof tokens.access_token === "string" &&
        tokens.access_token.length <= 4096 &&
        !/[\r\n]/.test(tokens.access_token),
      "GMAIL_OAUTH_EXCHANGE",
      "Resposta OAuth inválida.",
      503,
    );
    assert(
      typeof tokens.refresh_token === "string" &&
        tokens.refresh_token.length >= 10 &&
        tokens.refresh_token.length <= 4096 &&
        !/[\r\n]/.test(tokens.refresh_token),
      "GMAIL_OAUTH_REFRESH",
      "O Google não forneceu acesso contínuo. Reconecte com consentimento offline.",
      503,
    );
    const scopes = (tokens.scope || "").split(" ");
    assert(
      scopes.includes(READ) && (!pending.request_send || scopes.includes(SEND)),
      "GMAIL_OAUTH_SCOPES",
      "Permissões Google insuficientes. A conta anterior foi mantida.",
      403,
    );
    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      {
        headers: { Authorization: "Bearer " + tokens.access_token },
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
    assert(
      response.ok,
      "GMAIL_PROFILE",
      "Não foi possível verificar a caixa Google.",
      503,
    );
    const profile = (await boundedJson(response, 24000)) as {
      emailAddress?: string;
      historyId?: string;
    };
    assert(
      profile.emailAddress?.toLowerCase() === pending.expected_email,
      "MAILBOX_MISMATCH",
      "A conta autorizada não corresponde ao e-mail informado. A conta anterior foi mantida.",
      403,
    );
    assert(
      typeof profile.historyId === "string" &&
        /^\d{1,32}$/.test(profile.historyId),
      "GMAIL_PROFILE",
      "Marco de sincronização inválido.",
      503,
    );
    const previous = await control(repo);
    const previousMailbox = previous.active_connection_id
      ? (await connection(repo, previous.active_connection_id)).mailbox_id
      : env.OUTBOX_MAILBOX_ID || repo.outboxMailboxId;
    const existing = await repo.db
      .prepare(
        "SELECT id FROM mailbox_accounts WHERE account_ref=? COLLATE NOCASE",
      )
      .bind(pending.expected_email)
      .first<{ id: string }>();
    const mailboxId = existing?.id || crypto.randomUUID(),
      connectionId = crypto.randomUUID(),
      now = Date.now(),
      at = new Date().toISOString();
    const cipher = await encryptSecret(
      tokens.refresh_token,
      env.SECRET_ENCRYPTION_KEY!,
    );
    const claimed = await repo.db
      .prepare(
        "UPDATE gmail_control SET lease_owner=?,busy_until=? WHERE id=1 AND version=? AND busy_until<? AND NOT EXISTS(SELECT 1 FROM gmail_sync_state WHERE lease_until>?) RETURNING id",
      )
      .bind(leaseOwner, now + 120000, pending.control_version, now, now)
      .first();
    assert(
      claimed,
      "GMAIL_BUSY",
      "A conta mudou ou há comunicações em andamento. A conexão anterior foi mantida; tente novamente.",
      409,
    );
    const auditActor = (await repo.people()).find((p) => p.id === actorId);
    await repo.db.batch([
      auditStatement(repo.db, {
        actor: auditActor,
        requestId: repo.requestId,
        action: "GMAIL_ACCOUNT_CHANGED",
        resource: mailboxId,
        source: "GMAIL",
        at,
        details: { before: previousMailbox, after: mailboxId, paused: true },
      }),
      // NOT NULL enforces the lease/version inside the same atomic transaction.
      repo.db
        .prepare(
          "INSERT INTO security_events(id,actor_id,type,details,occurred_at) SELECT ?,?,CASE WHEN lease_owner=? AND version=? AND busy_until>? THEN 'GMAIL_ACCOUNT_CHANGED' ELSE NULL END,?,? FROM gmail_control WHERE id=1",
        )
        .bind(
          crypto.randomUUID(),
          actorId,
          leaseOwner,
          pending.control_version,
          Date.now(),
          JSON.stringify({
            before: previousMailbox,
            after: mailboxId,
            email: pending.expected_email,
            paused: true,
          }),
          at,
        ),
      repo.db
        .prepare(
          "INSERT OR IGNORE INTO mailbox_accounts(id,account_ref,provider,enabled,created_at) VALUES(?,?,'gmail',0,?)",
        )
        .bind(mailboxId, pending.expected_email, at),
      repo.db
        .prepare("INSERT INTO gmail_connections VALUES(?,?,?,?,?,?)")
        .bind(
          connectionId,
          mailboxId,
          cipher,
          scopes
            .filter(
              (x) => x === READ || (pending.request_send === 1 && x === SEND),
            )
            .join(" "),
          actorId,
          at,
        ),
      repo.db
        .prepare(
          "INSERT OR IGNORE INTO gmail_sync_state(id,history_id,last_sync_at,lease_until) VALUES(?,?,?,0)",
        )
        .bind(mailboxId, profile.historyId, at),
      repo.db
        .prepare(
          "UPDATE outbound_messages SET status='ERRO',failure_reason='CONTA_ALTERADA: mensagem retida para revisão; não reenviar pela nova conta' WHERE status='PENDENTE' AND mailbox_id IN (?,?)",
        )
        .bind(previousMailbox, mailboxId),
      repo.db
        .prepare(
          "UPDATE gmail_control SET active_connection_id=?,version=version+1,paused=1,lease_owner=NULL,busy_until=0 WHERE id=1",
        )
        .bind(connectionId),
      repo.db
        .prepare("DELETE FROM gmail_connections WHERE id!=?")
        .bind(connectionId),
      repo.db.prepare("UPDATE mailbox_accounts SET enabled=0"),
      repo.db
        .prepare(
          "UPDATE gmail_oauth_requests SET status='COMPLETE',verifier_cipher='' WHERE state_hash=?",
        )
        .bind(stateHash),
    ]);
    return { email: pending.expected_email };
  } catch (e) {
    await repo.db
      .prepare(
        "UPDATE gmail_oauth_requests SET status='FAILED',verifier_cipher='' WHERE state_hash=?",
      )
      .bind(stateHash)
      .run();
    throw e;
  } finally {
    await repo.db
      .prepare(
        "UPDATE gmail_control SET lease_owner=NULL,busy_until=0 WHERE id=1 AND lease_owner=?",
      )
      .bind(leaseOwner)
      .run();
  }
}
export async function activateGmailAccount(
  repo: Repository,
  env: RuntimeEnv,
  actorId: string,
  input: Record<string, unknown>,
) {
  const current = await control(repo);
  assert(
    env.SIMULATION_MODE !== "true",
    "GMAIL_SIMULATION",
    "A plataforma permanece em simulação. Configure a ativação das integrações antes de retomar comunicações.",
    409,
  );
  assert(
    current.active_connection_id &&
      input.connectionId === current.active_connection_id &&
      input.version === current.version,
    "GMAIL_STALE",
    "A conta mudou. Atualize a página antes de retomar.",
    409,
  );
  const auditActor = (await repo.people()).find((p) => p.id === actorId);
  await repo.db.batch([
    auditStatement(repo.db, {
      actor: auditActor,
      requestId: repo.requestId,
      action: "GMAIL_ACCOUNT_ACTIVATED",
      resource: current.active_connection_id,
      source: "GMAIL",
      details: { before: "PAUSADA", after: "ATIVA" },
    }),
    repo.db
      .prepare(
        "INSERT INTO security_events(id,actor_id,type,details,occurred_at) SELECT ?,?,CASE WHEN active_connection_id=? AND version=? AND busy_until<? THEN 'GMAIL_ACCOUNT_ACTIVATED' ELSE NULL END,?,? FROM gmail_control WHERE id=1",
      )
      .bind(
        crypto.randomUUID(),
        actorId,
        current.active_connection_id,
        current.version,
        Date.now(),
        JSON.stringify({
          before: "PAUSADA",
          after: "ATIVA",
          connectionId: current.active_connection_id,
        }),
        new Date().toISOString(),
      ),
    repo.db.prepare("UPDATE gmail_control SET paused=0 WHERE id=1"),
    repo.db
      .prepare(
        "UPDATE mailbox_accounts SET enabled=1 WHERE id=(SELECT mailbox_id FROM gmail_connections WHERE id=?)",
      )
      .bind(current.active_connection_id),
  ]);
  return { activated: true };
}
