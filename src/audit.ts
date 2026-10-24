import { assert } from "./domain.ts";
import type { Person } from "./types.ts";

export type AuditEvent = {
  actor?: Pick<Person, "id" | "name" | "roles"> | null;
  action: string;
  resource?: string;
  source?: string;
  outcome?: string;
  requestId?: string;
  at?: string;
  status?: number;
  duration?: number;
  details?: unknown;
};
export type RequestAudit = {
  databaseReady?: boolean;
  requestId: string;
  actor?: Person;
  started?: boolean;
  errorCode?: string;
};
export function sanitizeAuditDetails(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[LIMITADO]";
  if (typeof value === "string")
    return value
      .slice(0, 1000)
      .replace(
        /\bBearer\s+[^\s]+|\bsk-[A-Za-z0-9_-]{15,}|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
        "[REDACTED]",
      );
  if (Array.isArray(value))
    return value.slice(0, 30).map((v) => sanitizeAuditDetails(v, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 40)
        .map(([k, v]) => [
          k,
          /(password|secret|token|authorization|cookie|verifier|authorizationCode)/i.test(
            k,
          )
            ? "[REDACTED]"
            : sanitizeAuditDetails(v, depth + 1),
        ]),
    );
  return value ?? null;
}
export function auditStatement(
  db: D1Database,
  event: AuditEvent,
  guard?: { sql: string; params: unknown[] },
) {
  const details = JSON.stringify(sanitizeAuditDetails(event.details || {}));
  const params = [
    crypto.randomUUID(),
    event.requestId || crypto.randomUUID(),
    event.at || new Date().toISOString(),
    event.actor?.id || null,
    event.actor?.name || "Não autenticado",
    JSON.stringify(event.actor?.roles || []),
  ];
  return db
    .prepare(
      `INSERT INTO audit_log(id,request_id,occurred_at,actor_id,actor_name,roles_json,action,resource,source,outcome,http_status,duration_ms,details_json) VALUES(?,?,?,?,?,?,${guard ? `CASE WHEN (${guard.sql}) THEN ? ELSE NULL END` : "?"},?,?,?,?,?,?)`,
    )
    .bind(
      ...params,
      ...(guard?.params || []),
      event.action.slice(0, 100),
      (event.resource || "")
        .split("?")[0]
        .replace(/[\r\n\u0000]/g, "")
        .slice(0, 300),
      event.source || "SYSTEM",
      event.outcome || "SUCESSO",
      event.status ?? null,
      event.duration == null ? null : Math.round(event.duration),
      details.length <= 8000
        ? details
        : JSON.stringify({ summary: "Detalhes limitados por tamanho." }),
    );
}
export async function recordAudit(db: D1Database, event: AuditEvent) {
  await auditStatement(db, event).run();
}
export function auditFilters(params: URLSearchParams) {
  const clauses: string[] = [],
    args: unknown[] = [];
  for (const [key, column] of [
    ["actor", "actor_id"],
    ["action", "action"],
    ["outcome", "outcome"],
    ["source", "source"],
  ]) {
    const value = params.get(key);
    if (value) {
      assert(value.length <= 100, "AUDIT_FILTER", "Filtro de log inválido.");
      clauses.push(column + "=?");
      args.push(value);
    }
  }
  for (const [key, op] of [
    ["from", ">="],
    ["to", "<="],
  ]) {
    const value = params.get(key);
    if (value) {
      const at = new Date(value);
      assert(
        Number.isFinite(at.getTime()),
        "AUDIT_FILTER",
        "Data de log inválida.",
      );
      clauses.push("occurred_at" + op + "?");
      args.push(at.toISOString());
    }
  }
  return {
    where: clauses.length ? " WHERE " + clauses.join(" AND ") : "",
    args,
  };
}
export async function auditEntries(
  db: D1Database,
  params: URLSearchParams,
  forExport = false,
) {
  const { where, args } = auditFilters(params),
    size = forExport
      ? 5000
      : Math.min(100, Math.max(1, Number(params.get("size")) || 30)),
    page = forExport ? 1 : Math.max(1, Number(params.get("page")) || 1);
  assert(
    Number.isInteger(page) && Number.isInteger(size),
    "AUDIT_FILTER",
    "Paginação inválida.",
  );
  const total = await db
    .prepare("SELECT count(*) n FROM audit_log" + where)
    .bind(...args)
    .first<{ n: number }>();
  const { results } = await db
    .prepare(
      "SELECT * FROM audit_log" +
        where +
        " ORDER BY occurred_at DESC,id LIMIT ? OFFSET ?",
    )
    .bind(...args, size, (page - 1) * size)
    .all();
  return {
    entries: results.map((r) => ({
      ...r,
      roles: JSON.parse(String(r.roles_json)),
      details: JSON.parse(String(r.details_json)),
      roles_json: undefined,
      details_json: undefined,
    })),
    total: total?.n || 0,
    page,
    size,
    truncated: forExport && (total?.n || 0) > size,
  };
}
export async function exportAudit(db: D1Database, params: URLSearchParams) {
  const result = await auditEntries(db, params, true);
  const text =
    JSON.stringify({
      type: "SIGA_AUDIT_EXPORT",
      generatedAt: new Date().toISOString(),
      timestamps: "UTC ISO 8601",
      displayTimezone: "America/Sao_Paulo",
      count: result.entries.length,
      total: result.total,
      truncated: result.truncated,
    }) +
    "\n" +
    result.entries.map((x) => JSON.stringify(x)).join("\n") +
    "\n";
  assert(
    new TextEncoder().encode(text).length <= 12_000_000,
    "AUDIT_EXPORT",
    "Recorte muito grande. Reduza o período do log.",
    413,
  );
  const digest = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
  return new Response(text, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Content-Disposition": `attachment; filename="siga-log-${new Date().toISOString().slice(0, 10)}.jsonl"`,
      "X-Content-SHA256": digest,
      "X-SIGA-Truncated": String(result.truncated),
    },
  });
}
