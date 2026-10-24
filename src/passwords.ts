import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { assert } from "./domain.ts";
import { auditStatement, recordAudit } from "./audit.ts";
import { configuredGmail, gmailOperation } from "./gmailAccounts.ts";
import { sendSecurityMail } from "./gmail.ts";
import type { AccessIdentity } from "./privacy.ts";
import type { Repository } from "./repository.ts";
import type { Person, RuntimeEnv } from "./types.ts";

export const passwordMode = (env: RuntimeEnv) =>
  env.AUTH_MODE === "access_password";
type Account = {
  user_id: string;
  username: string;
  password_hash: string;
  version: number;
  enabled: number;
  must_change: number;
  email_snapshot: string;
};
const enc = new TextEncoder();
export const tokenHash = async (text: string) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text))),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
export function passwordPolicy(password: unknown): asserts password is string {
  assert(
    typeof password === "string" &&
      Array.from(password).length >= 15 &&
      password.length <= 128 &&
      !/[\u0000-\u001f]/.test(password),
    "PASSWORD_POLICY",
    "Use uma senha de 15 a 128 caracteres, sem quebras de linha.",
  );
  assert(
    ![
      "123456789012345",
      "passwordpassword",
      "senhasenhasenha",
      "abcdefghijklmnop",
    ].includes(password.toLowerCase()),
    "PASSWORD_POLICY",
    "Escolha uma senha menos previsível.",
  );
}
async function derive(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(
      password,
      salt,
      32,
      { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}
export async function hashPassword(password: string) {
  passwordPolicy(password);
  const salt = randomBytes(24).toString("base64url"),
    hash = await derive(password, salt);
  return `scrypt$16384$8$5$${salt}$${hash.toString("base64url")}`;
}
export async function verifyPassword(password: string, hash: string) {
  if (password.length > 128) return false;
  const parts = hash.split("$");
  assert(
    parts.length === 6 &&
      parts[0] === "scrypt" &&
      parts[1] === "16384" &&
      parts[2] === "8" &&
      parts[3] === "5",
    "PASSWORD_HASH",
    "Configuração da credencial inválida.",
    503,
  );
  const derived = await derive(password, parts[4]),
    expected = Buffer.from(parts[5], "base64url");
  return (
    derived.length === expected.length && timingSafeEqual(derived, expected)
  );
}
const cookie = (request: Request, value: string, maxAge = 28800) =>
  `siga_password=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
export const clearPasswordCookie = (request: Request) => cookie(request, "", 0);
function sessionToken(request: Request) {
  return (
    request.headers
      .get("Cookie")
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("siga_password="))
      ?.slice(14) || ""
  );
}
export async function passwordSession(
  request: Request,
  repo: Repository,
  access?: AccessIdentity,
) {
  const raw = sessionToken(request);
  assert(/^[\w-]{43}$/.test(raw), "AUTH", "Entre com sua conta e senha.", 401);
  const result = await repo.db
    .prepare(
      "SELECT s.*,a.username,a.must_change FROM password_sessions s JOIN login_accounts a ON a.user_id=s.user_id JOIN users u ON u.id=a.user_id WHERE s.token_hash=? AND s.expires_at>? AND a.enabled=1 AND u.active=1 AND a.version=s.credential_version AND lower(u.email)=s.email_snapshot AND a.email_snapshot=s.email_snapshot",
    )
    .bind(await tokenHash(raw), Date.now())
    .first<{
      user_id: string;
      email_snapshot: string;
      csrf: string;
      must_change: number;
      username: string;
    }>();
  assert(
    result && (!access || access.email === result.email_snapshot),
    "AUTH",
    "Sessão expirada. Entre novamente.",
    401,
  );
  const actor = (await repo.people()).find(
    (p) => p.id === result.user_id && p.active,
  );
  assert(actor && actor.id !== "system", "AUTH", "Conta indisponível.", 401);
  return {
    actor,
    csrf: result.csrf,
    authenticated: true,
    mustChangePassword: !!result.must_change,
    username: result.username,
  };
}
export async function authRate(
  repo: Repository,
  key: string,
  limit: number,
  window = 900000,
) {
  const hash = "password:" + (await tokenHash(key)),
    now = Date.now();
  const row = await repo.db
    .prepare(
      "INSERT INTO auth_attempts(key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<? THEN 1 ELSE attempts+1 END,expires_at=CASE WHEN expires_at<? THEN ? ELSE expires_at END RETURNING attempts",
    )
    .bind(hash, now + window, now, now, now + window)
    .first<{ attempts: number }>();
  assert(
    row && row.attempts <= limit,
    "RATE_LIMIT",
    "Muitas tentativas. Aguarde 15 minutos.",
    429,
  );
}
export async function passwordLogin(
  request: Request,
  repo: Repository,
  input: Record<string, unknown>,
  access?: AccessIdentity,
) {
  const account = String(input.account || "")
      .trim()
      .toLowerCase(),
    password = typeof input.password === "string" ? input.password : "";
  assert(
    account.length <= 254 && password.length <= 128,
    "AUTH",
    "Conta ou senha inválida.",
    401,
  );
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  await authRate(repo, "login-ip:" + ip, 30);
  await authRate(repo, "login-account:" + account, 8);
  const found = await repo.db
    .prepare(
      "SELECT a.* FROM login_accounts a JOIN users u ON u.id=a.user_id WHERE (a.username=? COLLATE NOCASE OR u.email=? COLLATE NOCASE) AND a.enabled=1 AND u.active=1 AND lower(u.email)=a.email_snapshot",
    )
    .bind(account, account)
    .first<Account>();
  // Identical work for unknown users; fixed non-secret dummy verifier, never a credential.
  const dummy =
    "scrypt$16384$8$5$ZHVtbXktc2FsdC1mb3ItdGltaW5nLW9ubHk$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const valid = await verifyPassword(password, found?.password_hash || dummy);
  if (!found || !valid || (access && access.email !== found.email_snapshot)) {
    await recordAudit(repo.db, {
      requestId: repo.requestId,
      action: "PASSWORD_LOGIN_DENIED",
      source: "SECURITY",
      outcome: "NEGADO",
    });
    assert(false, "AUTH", "Conta ou senha inválida.", 401);
  }
  const actor = (await repo.people()).find((p) => p.id === found.user_id)!;
  const raw = randomBytes(32).toString("base64url"),
    csrf = crypto.randomUUID(),
    at = new Date().toISOString();
  await repo.db.batch([
    repo.db
      .prepare("DELETE FROM password_sessions WHERE expires_at<?")
      .bind(Date.now()),
    repo.db
      .prepare("INSERT INTO password_sessions VALUES(?,?,?,?,?,?,?)")
      .bind(
        await tokenHash(raw),
        actor.id,
        found.version,
        found.email_snapshot,
        csrf,
        Date.now() + 28800000,
        at,
      ),
    auditStatement(repo.db, {
      actor,
      requestId: repo.requestId,
      action: "PASSWORD_LOGIN",
      source: "SECURITY",
      at,
    }),
  ]);
  return {
    cookie: cookie(request, raw),
    csrf,
    mustChangePassword: !!found.must_change,
  };
}
export async function passwordLogout(
  request: Request,
  repo: Repository,
  actor: Person,
) {
  await repo.db.batch([
    repo.db
      .prepare("DELETE FROM password_sessions WHERE token_hash=?")
      .bind(await tokenHash(sessionToken(request))),
    auditStatement(repo.db, {
      actor,
      requestId: repo.requestId,
      action: "PASSWORD_LOGOUT",
      source: "SECURITY",
    }),
  ]);
  return clearPasswordCookie(request);
}
export async function changePassword(
  repo: Repository,
  actor: Person,
  input: Record<string, unknown>,
) {
  passwordPolicy(input.newPassword);
  const current = await repo.db
    .prepare("SELECT * FROM login_accounts WHERE user_id=? AND enabled=1")
    .bind(actor.id)
    .first<Account>();
  await authRate(repo, "change:" + actor.id, 8);
  assert(
    current &&
      typeof input.currentPassword === "string" &&
      (await verifyPassword(input.currentPassword, current.password_hash)),
    "AUTH",
    "Senha atual inválida.",
    401,
  );
  assert(
    !(await verifyPassword(input.newPassword, current.password_hash)),
    "PASSWORD_SAME",
    "Escolha uma senha diferente da atual.",
  );
  const hash = await hashPassword(input.newPassword),
    at = new Date().toISOString();
  await repo.db.batch([
    auditStatement(
      repo.db,
      {
        actor,
        requestId: repo.requestId,
        action: "PASSWORD_CHANGED",
        source: "SECURITY",
        at,
      },
      {
        sql: "EXISTS(SELECT 1 FROM login_accounts WHERE user_id=? AND version=? AND enabled=1)",
        params: [actor.id, current.version],
      },
    ),
    repo.db
      .prepare(
        "UPDATE login_accounts SET password_hash=?,version=version+1,must_change=0,updated_at=? WHERE user_id=?",
      )
      .bind(hash, at, actor.id),
    repo.db
      .prepare("DELETE FROM password_sessions WHERE user_id=?")
      .bind(actor.id),
    repo.db
      .prepare("DELETE FROM password_links WHERE user_id=?")
      .bind(actor.id),
  ]);
  return {
    changed: true,
    message: "Senha atualizada. Entre novamente com a nova senha.",
  };
}
export async function provisionPassword(
  repo: Repository,
  actor: Person,
  userId: string,
  username: string,
  enabled = true,
) {
  assert(
    actor.roles.includes("ADMIN"),
    "FORBIDDEN",
    "Acesso restrito à administração.",
    403,
  );
  assert(
    userId !== "u-gestor" || actor.id === "u-gestor",
    "FORBIDDEN",
    "Somente o titular pode reemitir sua credencial.",
    403,
  );
  assert(
    /^[a-z0-9][a-z0-9._-]{2,59}$/.test(username),
    "USERNAME",
    "Use um identificador de 3 a 60 letras minúsculas, números, ponto, hífen ou sublinhado.",
  );
  const person = (await repo.people()).find((p) => p.id === userId);
  assert(
    person && person.id !== "system" && person.active,
    "AUTH_USER",
    "Cadastre e ative a pessoa primeiro.",
  );
  assert(
    !person.email.endsWith(".invalid"),
    "AUTH_EMAIL",
    "Informe o e-mail real autorizado da pessoa.",
  );
  const raw = "Siga-" + randomBytes(18).toString("base64url"),
    hash = await hashPassword(raw),
    at = new Date().toISOString();
  await repo.db.batch([
    repo.db
      .prepare(
        "INSERT INTO login_accounts(user_id,username,password_hash,enabled,must_change,email_snapshot,updated_at) VALUES(?,?,?,?,1,?,?) ON CONFLICT(user_id) DO UPDATE SET username=excluded.username,password_hash=excluded.password_hash,enabled=excluded.enabled,must_change=1,email_snapshot=excluded.email_snapshot,version=login_accounts.version+1,updated_at=excluded.updated_at",
      )
      .bind(userId, username, hash, +enabled, person.email.toLowerCase(), at),
    repo.db
      .prepare("DELETE FROM password_sessions WHERE user_id=?")
      .bind(userId),
    repo.db.prepare("DELETE FROM password_links WHERE user_id=?").bind(userId),
    auditStatement(repo.db, {
      actor,
      requestId: repo.requestId,
      action: "PASSWORD_ACCESS_PROVISIONED",
      resource: userId,
      source: "SECURITY",
      at,
      details: { username, enabled },
    }),
  ]);
  return {
    username,
    temporaryPassword: raw,
    mustChangePassword: true,
    email: person.email,
  };
}
export async function accessAccounts(repo: Repository) {
  return (
    await repo.db
      .prepare(
        "SELECT a.user_id,a.username,a.enabled,a.must_change,a.updated_at,u.full_name,u.email,u.active FROM login_accounts a JOIN users u ON u.id=a.user_id ORDER BY u.full_name",
      )
      .all()
  ).results;
}
export async function disablePassword(
  repo: Repository,
  actor: Person,
  userId: string,
) {
  assert(
    actor.roles.includes("ADMIN") &&
      userId !== "u-gestor" &&
      userId !== actor.id,
    "FORBIDDEN",
    "Não é permitido desabilitar o titular ou o próprio acesso.",
    403,
  );
  await repo.db.batch([
    repo.db
      .prepare(
        "UPDATE login_accounts SET enabled=0,version=version+1 WHERE user_id=?",
      )
      .bind(userId),
    repo.db
      .prepare("DELETE FROM password_sessions WHERE user_id=?")
      .bind(userId),
    repo.db.prepare("DELETE FROM password_links WHERE user_id=?").bind(userId),
    auditStatement(repo.db, {
      actor,
      requestId: repo.requestId,
      action: "PASSWORD_ACCESS_DISABLED",
      resource: userId,
      source: "SECURITY",
    }),
  ]);
  return { disabled: true };
}
export async function requestPasswordReset(
  request: Request,
  repo: Repository,
  env: RuntimeEnv,
  input: Record<string, unknown>,
  access?: AccessIdentity,
) {
  const account = String(input.account || "")
    .trim()
    .toLowerCase();
  assert(
    account.length > 0 && account.length <= 254,
    "ACCOUNT",
    "Informe o usuário ou e-mail cadastrado.",
  );
  await authRate(
    repo,
    "reset-ip:" + (request.headers.get("CF-Connecting-IP") || "local"),
    10,
  );
  await authRate(repo, "reset-account:" + account, 3);
  const effective = await configuredGmail(repo, env);
  assert(
    effective.SIMULATION_MODE !== "true" &&
      effective.EMAIL_SEND_ENABLED === "true" &&
      effective.GOOGLE_CLIENT_ID &&
      effective.GOOGLE_CLIENT_SECRET &&
      effective.GOOGLE_REFRESH_TOKEN &&
      effective.MAILBOX_ID,
    "PASSWORD_MAIL_SETUP",
    "A recuperação por e-mail aguarda a configuração e ativação do Gmail pelo administrador.",
    503,
  );
  const found = await repo.db
    .prepare(
      "SELECT a.* FROM login_accounts a JOIN users u ON u.id=a.user_id WHERE (a.username=? COLLATE NOCASE OR u.email=? COLLATE NOCASE) AND a.enabled=1 AND u.active=1 AND lower(u.email)=a.email_snapshot",
    )
    .bind(account, account)
    .first<Account>();
  const generic = {
    requested: true,
    message:
      "Se houver uma conta habilitada para este endereço, você receberá as instruções de redefinição.",
  };
  if (!found || (access && access.email !== found.email_snapshot)) {
    await recordAudit(repo.db, {
      requestId: repo.requestId,
      action: "PASSWORD_RESET_REQUESTED",
      source: "SECURITY",
    });
    return generic;
  }
  const raw = randomBytes(32).toString("base64url"),
    hash = await tokenHash(raw),
    at = new Date().toISOString();
  const base = env.APP_ORIGIN || new URL(request.url).origin;
  assert(
    base === new URL(request.url).origin,
    "AUTH_ORIGIN",
    "Endereço de aplicação inválido.",
    503,
  );
  const url = base + "/login#reset=" + raw;
  // Reset links live only in a hashed, expiring store, never the ordinary mail outbox/log.
  await repo.db.batch([
    repo.db
      .prepare("DELETE FROM password_links WHERE user_id=? OR expires_at<?")
      .bind(found.user_id, Date.now()),
    repo.db
      .prepare("INSERT INTO password_links VALUES(?,?,?,?,?,NULL,?)")
      .bind(
        hash,
        found.user_id,
        found.version,
        found.email_snapshot,
        Date.now() + 900000,
        at,
      ),
    auditStatement(repo.db, {
      requestId: repo.requestId,
      action: "PASSWORD_RESET_REQUESTED",
      resource: found.user_id,
      source: "SECURITY",
    }),
  ]);
  try {
    const operation = await gmailOperation(repo, effective);
    try {
      await sendSecurityMail(
        effective,
        found.email_snapshot,
        "SIGA — redefinição de senha",
        `Foi solicitada uma nova senha para seu acesso ao SIGA.\n\nAbra o link em até 15 minutos:\n${url}\n\nO link só pode ser usado uma vez. Se você não fez a solicitação, ignore esta mensagem.`,
        operation.signal(),
      );
    } finally {
      await operation.release();
    }
  } catch {
    await repo.db
      .prepare("DELETE FROM password_links WHERE token_hash=?")
      .bind(hash)
      .run();
    await recordAudit(repo.db, {
      requestId: repo.requestId,
      action: "PASSWORD_RESET_EMAIL_FAILED",
      resource: found.user_id,
      source: "SECURITY",
      outcome: "NEGADO",
    });
  }
  return generic;
}
export async function resetPassword(
  repo: Repository,
  input: Record<string, unknown>,
  access?: AccessIdentity,
) {
  assert(
    typeof input.token === "string" && /^[\w-]{43}$/.test(input.token),
    "PASSWORD_LINK",
    "Link inválido ou expirado.",
  );
  passwordPolicy(input.newPassword);
  await authRate(repo, "reset-apply:" + (access?.email || "local"), 8);
  const hash = await tokenHash(input.token),
    row = await repo.db
      .prepare(
        "SELECT l.*,a.version FROM password_links l JOIN login_accounts a ON a.user_id=l.user_id JOIN users u ON u.id=l.user_id WHERE l.token_hash=? AND l.used_at IS NULL AND l.expires_at>? AND a.version=l.credential_version AND a.enabled=1 AND u.active=1 AND lower(u.email)=l.email_snapshot AND a.email_snapshot=l.email_snapshot",
      )
      .bind(hash, Date.now())
      .first<{ user_id: string; version: number; email_snapshot: string }>();
  assert(
    row && (!access || access.email === row.email_snapshot),
    "PASSWORD_LINK",
    "Link inválido ou expirado.",
  );
  const passwordHash = await hashPassword(input.newPassword),
    at = new Date().toISOString(),
    actor = (await repo.people()).find((p) => p.id === row.user_id);
  await repo.db.batch([
    auditStatement(
      repo.db,
      {
        actor,
        requestId: repo.requestId,
        action: "PASSWORD_RESET_COMPLETED",
        source: "SECURITY",
        at,
      },
      {
        sql: "EXISTS(SELECT 1 FROM password_links l JOIN login_accounts a ON a.user_id=l.user_id JOIN users u ON u.id=a.user_id WHERE l.token_hash=? AND l.used_at IS NULL AND l.expires_at>? AND a.enabled=1 AND a.version=l.credential_version AND u.active=1 AND lower(u.email)=l.email_snapshot AND a.email_snapshot=l.email_snapshot)",
        params: [hash, Date.now()],
      },
    ),
    repo.db
      .prepare(
        "UPDATE login_accounts SET password_hash=?,version=version+1,must_change=0,updated_at=? WHERE user_id=?",
      )
      .bind(passwordHash, at, row.user_id),
    repo.db
      .prepare("DELETE FROM password_sessions WHERE user_id=?")
      .bind(row.user_id),
    repo.db
      .prepare("DELETE FROM password_links WHERE user_id=?")
      .bind(row.user_id),
  ]);
  return { reset: true, message: "Senha redefinida. Entre com a nova senha." };
}
