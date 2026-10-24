import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";
import { assert } from "./domain.ts";
import type { RuntimeEnv } from "./types.ts";
import type { Repository } from "./repository.ts";

// Only public signing keys are cached; identities and tokens remain request-local.
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export type AccessIdentity = { email: string; csrf: string };

export function deploymentGuard(env: RuntimeEnv) {
  assert(
    !env.AUTH_MODE || env.AUTH_MODE === "access_password",
    "AUTH_CONFIG",
    "Modo de autenticação inválido.",
    503,
  );
  assert(
    ["demo", "private", "development"].includes(env.DEPLOYMENT_MODE || ""),
    "DEPLOYMENT_CONFIG",
    "Ambiente não configurado. Acesso bloqueado.",
    503,
  );
  if (env.DEPLOYMENT_MODE === "demo") {
    assert(
      env.PUBLIC_DEMO === "true" &&
        env.SIMULATION_MODE === "true" &&
        env.AI_PROVIDER === "mock" &&
        env.EMAIL_SEND_ENABLED !== "true" &&
        !env.AI_API_KEY &&
        !env.GOOGLE_REFRESH_TOKEN &&
        !env.GOOGLE_CLIENT_SECRET &&
        !env.MAILBOX_ID,
      "DEMO_CONFIG",
      "Demonstração indisponível: configuração insegura.",
      503,
    );
  }
  if (env.DEPLOYMENT_MODE === "private") {
    assert(
      env.PUBLIC_DEMO === "false" &&
        env.ACCESS_REQUIRED === "true" &&
        env.ACCESS_AUD &&
        env.ACCESS_ALLOWED_EMAILS &&
        env.ACCESS_TEAM_DOMAIN,
      "PRIVATE_CONFIG",
      "Acesso privado ainda não configurado.",
      503,
    );
  }
}

export async function deploymentDatabaseGuard(
  repo: Repository,
  env: RuntimeEnv,
) {
  if (!["demo", "private"].includes(env.DEPLOYMENT_MODE || "")) return;
  const marker = await repo.db
    .prepare(
      "SELECT value_json FROM app_settings WHERE key='deployment_identity'",
    )
    .first<{ value_json: string }>();
  assert(
    marker && JSON.parse(marker.value_json).mode === env.DEPLOYMENT_MODE,
    "DATABASE_ISOLATION",
    "Banco incompatível com este ambiente. Acesso bloqueado.",
    503,
  );
}

export async function privateAccess(
  request: Request,
  env: RuntimeEnv,
): Promise<AccessIdentity | undefined> {
  if (env.DEPLOYMENT_MODE !== "private" && env.ACCESS_REQUIRED !== "true")
    return;
  const issuer = env.ACCESS_TEAM_DOMAIN || "";
  assert(
    /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer) &&
      env.ACCESS_AUD &&
      env.ACCESS_ALLOWED_EMAILS,
    "PRIVATE_CONFIG",
    "Acesso privado ainda não configurado.",
    503,
  );
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  assert(
    token && token.length <= 16384,
    "ACCESS",
    "Autentique-se pelo acesso privado do SIGA.",
    403,
  );
  let keys = keySets.get(issuer);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(issuer + "/cdn-cgi/access/certs"), {
      [customFetch]: (url, options) => fetch(url, options),
      timeoutDuration: 5000,
    });
    if (keySets.size >= 4) keySets.clear();
    keySets.set(issuer, keys);
  }
  let email: string;
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer,
      audience: env.ACCESS_AUD,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "sub", "email"],
    });
    assert(
      typeof payload.email === "string",
      "ACCESS",
      "Identidade inválida.",
      403,
    );
    email = payload.email.toLowerCase();
  } catch {
    assert(false, "ACCESS", "Acesso privado inválido ou expirado.", 403);
  }
  const allowed = env
    .ACCESS_ALLOWED_EMAILS!.split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  assert(
    allowed.includes(email!),
    "ACCESS",
    "Esta conta não tem acesso ao SIGA.",
    403,
  );
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("siga-csrf:" + token),
  );
  return {
    email: email!,
    csrf: Array.from(new Uint8Array(hash), (x) =>
      x.toString(16).padStart(2, "0"),
    ).join(""),
  };
}
