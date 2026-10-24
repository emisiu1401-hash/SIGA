import { SignJWT, jwtVerify } from "jose";
import { assert } from "./domain.ts";
import { Repository } from "./repository.ts";
import type { Person, RuntimeEnv } from "./types.ts";
import type { AccessIdentity } from "./privacy.ts";
import { passwordMode, passwordSession } from "./passwords.ts";

const encoder = new TextEncoder();
export async function constantEqual(a: string, b: string) {
  const [x, y] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  let diff = 0;
  const aa = new Uint8Array(x),
    bb = new Uint8Array(y);
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}
export async function session(
  request: Request,
  env: RuntimeEnv,
  repo: Repository,
  access?: AccessIdentity,
): Promise<{
  actor: Person;
  csrf: string;
  authenticated: boolean;
  mustChangePassword?: boolean;
  username?: string;
}> {
  if (passwordMode(env)) return passwordSession(request, repo, access);
  if (env.DEPLOYMENT_MODE === "private" || env.ACCESS_REQUIRED === "true") {
    assert(access, "ACCESS", "Autenticação privada obrigatória.", 403);
    const actor = (await repo.people()).find(
      (p) => p.active && p.email.toLowerCase() === access.email,
    );
    assert(
      actor &&
        actor.roles.some((r) =>
          ["ADMIN", "GESTOR", "EXECUTOR", "SDG_LEITOR"].includes(r),
        ),
      "ACCESS_USER",
      "Conta sem cadastro ativo no SIGA.",
      403,
    );
    return { actor, csrf: access.csrf, authenticated: true };
  }
  const cookie = request.headers
    .get("Cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("siga_session="))
    ?.slice(13);
  if (env.DEPLOYMENT_MODE !== "demo" && cookie && env.SESSION_SECRET) {
    try {
      const { payload } = await jwtVerify(
        cookie,
        encoder.encode(env.SESSION_SECRET),
        { algorithms: ["HS256"], issuer: "siga", audience: "siga-web" },
      );
      const actor = (await repo.people()).find(
        (p) => p.id === payload.sub && p.active,
      );
      if (actor)
        return { actor, csrf: String(payload.csrf), authenticated: true };
    } catch {
      /* Invalid sessions fall back to minimum privileges. */
    }
  }
  assert(
    env.PUBLIC_DEMO === "true" && env.SIMULATION_MODE === "true",
    "AUTH",
    "Entre para acessar o SIGA.",
    401,
  );
  return {
    actor: {
      id: "u-sdg",
      name: "Visitante · demonstração",
      email: "sdg@exemplo.test",
      roles: ["SDG_LEITOR"],
      department: null,
      active: true,
    },
    csrf: "",
    authenticated: false,
  };
}
export async function login(
  request: Request,
  env: RuntimeEnv,
  repo: Repository,
  input: { account?: string; password?: string },
) {
  assert(
    env.SESSION_SECRET && env.SESSION_SECRET.length >= 32,
    "AUTH_CONFIG",
    "Autenticação ainda não configurada.",
    503,
  );
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const ipHash = await crypto.subtle.digest("SHA-256", encoder.encode(ip));
  const key = Array.from(new Uint8Array(ipHash))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  const now = Date.now();
  const attempts = await repo.db
    .prepare("SELECT attempts,expires_at FROM auth_attempts WHERE key=?")
    .bind(key)
    .first<{ attempts: number; expires_at: number }>();
  assert(
    !attempts || attempts.expires_at < now || attempts.attempts < 8,
    "RATE_LIMIT",
    "Muitas tentativas. Aguarde 15 minutos.",
    429,
  );
  await repo.db
    .prepare(
      "INSERT INTO auth_attempts(key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<? THEN 1 ELSE attempts+1 END, expires_at=CASE WHEN expires_at<? THEN ? ELSE expires_at END",
    )
    .bind(key, now + 900000, now, now, now + 900000)
    .run();
  const accounts: Record<string, { id: string; password: string | undefined }> =
    {
      gestor: { id: "u-gestor", password: env.MANAGER_PASSWORD },
      executor: { id: "u-gabriela", password: env.EXECUTOR_PASSWORD },
      admin: { id: "u-admin", password: env.ADMIN_PASSWORD },
    };
  const selected = accounts[input.account || ""];
  const valid = await constantEqual(
    input.password || "",
    selected?.password || crypto.randomUUID(),
  );
  if (!selected?.password || !valid) {
    await repo.audit(null, "LOGIN_DENIED", "Credenciais inválidas.");
    assert(false, "AUTH", "Conta ou senha inválida.", 401);
  }
  const csrf = crypto.randomUUID();
  const token = await new SignJWT({ csrf })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(selected.id)
    .setIssuer("siga")
    .setAudience("siga-web")
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(encoder.encode(env.SESSION_SECRET));
  await repo.db
    .prepare("DELETE FROM auth_attempts WHERE key=?")
    .bind(key)
    .run();
  await repo.audit(selected.id, "LOGIN", "Sessão iniciada.");
  return {
    cookie: `siga_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
    csrf,
  };
}
export function csrfCheck(request: Request, token: string) {
  assert(
    request.headers.get("Origin") === new URL(request.url).origin,
    "ORIGIN",
    "Origem da requisição não autorizada.",
    403,
  );
  assert(
    token && request.headers.get("X-CSRF-Token") === token,
    "CSRF",
    "Sessão expirada. Entre novamente.",
    403,
  );
}
export async function encryptSecret(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    await crypto.subtle.digest("SHA-256", encoder.encode(secret)),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(value),
  );
  return btoa(String.fromCharCode(...iv, ...new Uint8Array(data)));
}
export async function decryptSecret(value: string, secret: string) {
  const bytes = Uint8Array.from(atob(value), (x) => x.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "raw",
    await crypto.subtle.digest("SHA-256", encoder.encode(secret)),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.slice(0, 12) },
      key,
      bytes.slice(12),
    ),
  );
}
