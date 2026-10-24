import type { Aggregate, Person, RuntimeEnv } from "./types.ts";
import {
  activeAssignment,
  assert,
  days,
  localDate,
  safeSei,
} from "./domain.ts";

export class Repository {
  constructor(
    public db: D1Database,
    public simulation = true,
  ) {}
  async people(): Promise<Person[]> {
    const { results } = await this.db
      .prepare(
        `SELECT u.*,group_concat(r.role) roles FROM users u LEFT JOIN user_roles r ON r.user_id=u.id GROUP BY u.id ORDER BY full_name`,
      )
      .all<{
        id: string;
        full_name: string;
        email: string;
        roles: string;
        department_id: string | null;
        active: number;
      }>();
    return results.map((p) => ({
      id: p.id,
      name: p.full_name,
      email: p.email,
      roles: (p.roles || "").split(",") as Person["roles"],
      department: p.department_id?.replace("dept-", "").toUpperCase() || null,
      active: !!p.active,
    }));
  }
  async personSave(p: Person, actorId: string, at: string) {
    assert(
      p.name.trim().length >= 2 &&
        p.name.length <= 120 &&
        /^[^\s@\r\n]+@[^\s@\r\n]+$/.test(p.email),
      "PERSON",
      "Nome e e-mail válidos são obrigatórios.",
    );
    assert(
      p.department && ["SLC", "SAP", "SME", "AE"].includes(p.department),
      "DEPARTMENT",
      "Selecione uma seção cadastrada.",
    );
    assert(
      p.roles.length &&
        p.roles.every((r) => ["EXECUTOR", "SDG_LEITOR", "ADMIN"].includes(r)),
      "ROLES",
      "Papéis inválidos. O gestor não pode ser criado por cadastro ordinário.",
    );
    assert(
      p.id !== "u-gestor" && p.id !== "system",
      "PERSON",
      "Cadastro protegido.",
    );
    const statements = [
      this.db
        .prepare(
          `INSERT INTO users(id,full_name,email,active,created_at,department_id) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET full_name=excluded.full_name,email=excluded.email,active=excluded.active,department_id=excluded.department_id`,
        )
        .bind(
          p.id,
          p.name,
          p.email.toLowerCase(),
          +p.active,
          at,
          "dept-" + p.department.toLowerCase(),
        ),
      this.db.prepare("DELETE FROM user_roles WHERE user_id=?").bind(p.id),
      ...p.roles.map((role) =>
        this.db
          .prepare("INSERT INTO user_roles(user_id,role) VALUES(?,?)")
          .bind(p.id, role),
      ),
      this.db
        .prepare(
          "UPDATE user_department_history SET valid_until=? WHERE user_id=? AND valid_until IS NULL",
        )
        .bind(at, p.id),
      this.db
        .prepare(
          "INSERT INTO user_department_history(id,user_id,department_id,valid_from,registered_by,created_at) VALUES(?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          p.id,
          "dept-" + p.department.toLowerCase(),
          at,
          actorId,
          at,
        ),
    ];
    await this.db.batch(statements);
  }
  async get(id: string): Promise<Aggregate | null> {
    const r = await this.db
      .prepare(
        "SELECT state_json FROM siga_aggregates WHERE id=? OR id=(SELECT id FROM demands WHERE code=?)",
      )
      .bind(id, id)
      .first<{ state_json: string }>();
    return r ? JSON.parse(r.state_json) : null;
  }
  async command(id: string) {
    const r = await this.db
      .prepare("SELECT result_json FROM siga_commands WHERE id=?")
      .bind(id)
      .first<{ result_json: string }>();
    return r ? JSON.parse(r.result_json) : null;
  }
  async nextCode(at: string) {
    const year = localDate(at).slice(0, 4);
    const row = await this.db
      .prepare(
        "SELECT MAX(CAST(substr(code,11) AS INTEGER)) n FROM demands WHERE code LIKE ?",
      )
      .bind(`SIGA-${year}-%`)
      .first<{ n: number | null }>();
    return `SIGA-${year}-${String((row?.n || 0) + 1).padStart(4, "0")}`;
  }
  statements(s: Aggregate, previous: Aggregate | null) {
    const de = (d: string | null) => (d ? "dept-" + d.toLowerCase() : null);
    const statements: D1PreparedStatement[] = [];
    if (!previous)
      statements.push(
        this.db
          .prepare(
            `INSERT INTO demands(id,code,title,description,origin,manager_id,status,priority,opened_at,parent_demand_id,version,process_reference,process_url,process_url_status,current_department_id,origin_department_id,closed_at,closed_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          )
          .bind(
            s.id,
            s.code,
            s.title,
            s.description,
            s.parentId
              ? "CHILD"
              : s.events[0]?.origin === "EMAIL"
                ? "EMAIL"
                : "DASHBOARD",
            s.managerId,
            s.status,
            s.priority,
            s.openedAt,
            s.parentId,
            s.version,
            s.processReference,
            s.processUrl,
            s.processUrl ? "VALIDADO_DOMINIO" : "NAO_INFORMADO",
            de(s.department),
            de(s.originDepartment),
            s.closedAt,
            s.closedBy,
          ),
      );
    // The trigger rejects any competing update before the rest of the D1 atomic batch.
    statements.push(
      previous
        ? this.db
            .prepare(
              "UPDATE siga_aggregates SET version=?,state_json=? WHERE id=?",
            )
            .bind(s.version, JSON.stringify(s), s.id)
        : this.db
            .prepare(
              "INSERT INTO siga_aggregates(id,version,state_json) VALUES(?,?,?)",
            )
            .bind(s.id, s.version, JSON.stringify(s)),
    );
    if (previous)
      statements.push(
        this.db
          .prepare(
            `UPDATE demands SET title=?,description=?,status=?,priority=?,version=?,process_reference=?,process_url=?,process_url_status=?,current_department_id=?,origin_department_id=?,closed_at=?,closed_by=? WHERE id=?`,
          )
          .bind(
            s.title,
            s.description,
            s.status,
            s.priority,
            s.version,
            s.processReference,
            s.processUrl,
            s.processUrl ? "VALIDADO_DOMINIO" : "NAO_INFORMADO",
            de(s.department),
            de(s.originDepartment),
            s.closedAt,
            s.closedBy,
            s.id,
          ),
      );
    statements.push(
      this.db
        .prepare(
          `INSERT INTO stages(id,demand_id,step_no,title,status,created_at) VALUES(?,?,1,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status`,
        )
        .bind(
          s.id + ":stage",
          s.id,
          s.title,
          s.status === "ENCERRADA"
            ? "VALIDADA"
            : s.status === "AGUARDANDO_VALIDACAO"
              ? "CONCLUSA_DECLARADA"
              : s.status === "EM_EXECUCAO"
                ? "EM_EXECUCAO"
                : "PENDENTE",
          s.openedAt,
        ),
    );
    for (const a of s.assignments)
      statements.push(
        this.db
          .prepare(
            `INSERT INTO assignments(id,stage_id,assignee_id,status,original_due_date,current_due_date,due_revision,accepted_at,declared_done_at,started_at,updated_at,department_snapshot_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,current_due_date=excluded.current_due_date,due_revision=excluded.due_revision,accepted_at=excluded.accepted_at,declared_done_at=excluded.declared_done_at,updated_at=excluded.updated_at`,
          )
          .bind(
            a.id,
            s.id + ":stage",
            a.personId,
            a.status,
            a.originalDue,
            a.due,
            a.dueRevision,
            a.acceptedAt,
            a.declaredAt,
            a.createdAt,
            s.updatedAt,
            de(a.department),
          ),
      );
    for (const r of s.requests)
      statements.push(
        this.db
          .prepare(
            `INSERT INTO change_requests(id,demand_id,request_type,status,proposed_json,justification,expected_demand_version,created_at,decided_by,decided_at,conditions_text) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,proposed_json=excluded.proposed_json,justification=excluded.justification,expected_demand_version=excluded.expected_demand_version,decided_by=excluded.decided_by,decided_at=excluded.decided_at,conditions_text=excluded.conditions_text`,
          )
          .bind(
            r.id,
            s.id,
            r.type,
            r.status,
            JSON.stringify(r),
            r.reason,
            r.expectedVersion,
            r.createdAt,
            r.decidedBy,
            r.decidedAt,
            r.conditions,
          ),
      );
    for (const e of s.events.slice(previous?.events.length || 0))
      statements.push(
        this.db
          .prepare(
            `INSERT INTO demand_events(id,demand_id,actor_id,type,before_json,after_json,declared_or_verified,occurred_at,event_key) VALUES(?,?,?,?,?,?,?,?,?)`,
          )
          .bind(
            e.id,
            s.id,
            e.actorId,
            e.type,
            JSON.stringify(e.before),
            JSON.stringify({
              ...(e.after as object),
              reason: e.reason,
              origin: e.origin,
            }),
            e.verification,
            e.at,
            e.id,
          ),
      );
    for (const o of s.outbox.slice(previous?.outbox.length || 0))
      statements.push(
        this.db
          .prepare(
            `INSERT INTO outbound_messages(id,mailbox_id,demand_id,recipient_email,subject,body_text,status,dedupe_key,created_at) VALUES(?,?,?,?,?,?,?,?,?)`,
          )
          .bind(
            o.id,
            "mock-mailbox",
            s.id,
            o.to,
            o.subject,
            o.body,
            o.status,
            o.id,
            o.at,
          ),
      );
    return statements;
  }
  async save(
    s: Aggregate,
    previous: Aggregate | null,
    commandId: string,
    children: Aggregate[] = [],
  ) {
    for (const aggregate of [s, ...children])
      for (const outbound of aggregate.outbox.slice(
        aggregate.id === s.id ? previous?.outbox.length || 0 : 0,
      ))
        outbound.status =
          this.simulation || /\.(test|invalid)$/i.test(outbound.to)
            ? "SIMULADO"
            : "PENDENTE";
    const result = {
      id: s.id,
      code: s.code,
      version: s.version,
      children: children.map((c) => ({ id: c.id, code: c.code })),
    };
    await this.db.batch([
      ...this.statements(s, previous),
      ...children.flatMap((c) => this.statements(c, null)),
      this.db
        .prepare(
          "INSERT INTO siga_commands(id,demand_id,result_json,created_at) VALUES(?,?,?,?)",
        )
        .bind(commandId, s.id, JSON.stringify(result), s.updatedAt),
    ]);
    return result;
  }
  async audit(actorId: string | null, type: string, details: string) {
    await this.db
      .prepare(
        "INSERT INTO security_events(id,actor_id,type,details,occurred_at) VALUES(?,?,?,?,?)",
      )
      .bind(
        crypto.randomUUID(),
        actorId,
        type,
        details.slice(0, 500),
        new Date().toISOString(),
      )
      .run();
  }
  async emails(limit = 50) {
    return (
      await this.db
        .prepare(
          "SELECT id,recipient_email,subject,body_text,status,created_at FROM outbound_messages ORDER BY created_at DESC,id LIMIT ?",
        )
        .bind(limit)
        .all()
    ).results;
  }
}

export type DemandRow = {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string | null;
  department: string | null;
  assigneeId: string | null;
  assignee: string | null;
  due: string | null;
  originalDue: string | null;
  openedAt: string;
  closedAt: string | null;
  updatedAt: string;
  validationAt: string | null;
  declaredAt: string | null;
  parentId: string | null;
  processUrl: string | null;
  workMinutes: number | null;
  waitDays: number;
  blockedAt: string | null;
  origin: string;
  revision: number;
  openDays: number;
  lateDays: number;
  idleDays: number;
  validationDays: number | null;
  dueDays: number | null;
};
const projection = `SELECT d.id,d.code,d.title,d.status,d.priority,upper(replace(d.current_department_id,'dept-','')) department,a.assignee_id assigneeId,u.full_name assignee,a.current_due_date due,a.original_due_date originalDue,d.opened_at openedAt,d.closed_at closedAt,d.parent_demand_id parentId,d.process_url processUrl,d.origin,coalesce(a.due_revision,0) revision,a.declared_done_at declaredAt,json_extract(g.state_json,'$.updatedAt') updatedAt,json_extract(g.state_json,'$.validationAt') validationAt,json_extract(g.state_json,'$.blockedAt') blockedAt,json_extract(g.state_json,'$.waitDays') waitDays,json_extract(g.state_json,'$.workMinutes') workMinutes FROM demands d JOIN siga_aggregates g ON g.id=d.id LEFT JOIN assignments a ON a.id=(SELECT ax.id FROM assignments ax WHERE ax.stage_id=d.id||':stage' AND ax.status IN ('ATIVA','CONCLUSA_DECLARADA','VALIDADA') ORDER BY ax.accepted_at DESC,ax.id DESC LIMIT 1) LEFT JOIN users u ON u.id=a.assignee_id`;
export async function dashboard(
  repo: Repository,
  params: URLSearchParams,
  actor: Person,
  now: string,
  env: RuntimeEnv,
) {
  const clauses: string[] = [];
  const args: (string | number)[] = [];
  const eq = (key: string, col: string) => {
    const v = params.get(key);
    if (v) {
      clauses.push(`${col}=?`);
      args.push(v === "NONE" ? "" : v);
    }
  };
  eq(
    "department",
    "coalesce(upper(replace(d.current_department_id,'dept-','')),'')",
  );
  eq("person", "a.assignee_id");
  eq("priority", "coalesce(d.priority,'')");
  eq("status", "d.status");
  eq("origin", "d.origin");
  if (
    actor.roles.includes("EXECUTOR") &&
    !actor.roles.includes("GESTOR") &&
    !actor.roles.includes("ADMIN")
  ) {
    clauses.push(
      "(a.assignee_id=? OR EXISTS(SELECT 1 FROM assignments pending WHERE pending.stage_id=d.id||':stage' AND pending.assignee_id=? AND pending.status='AGUARDANDO_ACEITE'))",
    );
    args.push(actor.id, actor.id);
  }
  if (params.get("q")) {
    clauses.push("(d.title LIKE ? ESCAPE '!' OR d.code LIKE ? ESCAPE '!')");
    const q =
      "%" + params.get("q")!.slice(0, 100).replace(/[!%_]/g, "!$&") + "%";
    args.push(q, q);
  }
  const axis =
    params.get("axis") === "due"
      ? params.get("deadline") === "original"
        ? "a.original_due_date"
        : "a.current_due_date"
      : params.get("axis") === "closed"
        ? "d.closed_at"
        : "d.opened_at";
  for (const [key, op] of [
    ["from", ">="],
    ["to", "<="],
  ] as const) {
    const v = params.get(key);
    if (v) {
      assert(/^\d{4}-\d{2}-\d{2}$/.test(v), "DATE", "Filtro de data inválido.");
      clauses.push(`substr(${axis},1,10)${op}?`);
      args.push(v);
    }
  }
  if (params.get("relation") === "child")
    clauses.push("d.parent_demand_id IS NOT NULL");
  if (params.get("relation") === "parent")
    clauses.push(
      "EXISTS(SELECT 1 FROM demands child WHERE child.parent_demand_id=d.id)",
    );
  if (params.get("sei") === "yes")
    clauses.push("d.process_url_status='VALIDADO_DOMINIO'");
  if (params.get("sei") === "no") clauses.push("d.process_url IS NULL");
  const date = localDate(now);
  let rows = (
    await repo.db
      .prepare(
        projection + (clauses.length ? " WHERE " + clauses.join(" AND ") : ""),
      )
      .bind(...args)
      .all<DemandRow>()
  ).results.map((r) => ({
    ...r,
    processUrl: safeSei(r.processUrl, env.SEI_ALLOWED_HOSTS.split(",")),
    openDays: Math.max(
      0,
      days(localDate(r.openedAt), r.closedAt ? localDate(r.closedAt) : date),
    ),
    lateDays:
      r.status === "EM_EXECUCAO" && r.due ? Math.max(0, days(r.due, date)) : 0,
    idleDays: Math.max(0, days(localDate(r.updatedAt), date)),
    validationDays: r.validationAt
      ? Math.max(
          0,
          days(
            localDate(r.validationAt),
            r.closedAt ? localDate(r.closedAt) : date,
          ),
        )
      : null,
    dueDays: r.due ? days(date, r.due) : null,
  }));
  const open = (r: DemandRow) =>
    !["ENCERRADA", "ARQUIVADA_SEM_DEMANDA", "CANCELADA"].includes(r.status);
  const shortcut = params.get("shortcut");
  if (shortcut)
    rows = rows.filter((r) =>
      shortcut === "late"
        ? r.lateDays > 0
        : shortcut === "today"
          ? open(r) && r.dueDays === 0
          : shortcut === "d2"
            ? open(r) &&
              r.status !== "AGUARDANDO_VALIDACAO" &&
              r.dueDays !== null &&
              r.dueDays >= 0 &&
              r.dueDays <= 2
            : shortcut === "week"
              ? open(r) &&
                r.dueDays !== null &&
                r.dueDays >= 0 &&
                r.dueDays <= 7
              : shortcut === "idle"
                ? open(r) && r.idleDays >= 7
                : shortcut === "missing"
                  ? open(r) && (!r.due || !r.assigneeId)
                  : shortcut === "validation"
                    ? r.status === "AGUARDANDO_VALIDACAO"
                    : shortcut === "high"
                      ? open(r) && r.priority === "ALTA"
                      : shortcut === "closed"
                        ? r.status === "ENCERRADA"
                        : shortcut === "active"
                          ? open(r)
                          : shortcut === "blocked"
                            ? !!r.blockedAt
                            : shortcut === "extended"
                              ? r.revision > 1
                              : true,
    );
  if (params.get("age"))
    rows = rows.filter((r) => {
      const [min, max] = params.get("age")!.split("-").map(Number);
      return open(r) && r.openDays >= min && r.openDays <= max;
    });
  const active = rows.filter(open),
    closed = rows.filter((r) => r.status === "ENCERRADA"),
    validClosed = closed.filter((r) => r.originalDue && r.declaredAt),
    inOriginal = validClosed.filter(
      (r) => localDate(r.declaredAt!) <= r.originalDue!,
    ).length;
  const originalRate = validClosed.length
    ? Math.round((100 * inOriginal) / validClosed.length)
    : null;
  const currentEligible = closed.filter((r) => r.due && r.declaredAt);
  const currentRate = currentEligible.length
    ? Math.round(
        (100 *
          currentEligible.filter((r) => localDate(r.declaredAt!) <= r.due!)
            .length) /
          currentEligible.length,
      )
    : null;
  const kpis = {
    active: active.length,
    late: rows.filter((r) => r.lateDays > 0).length,
    d2: active.filter(
      (r) =>
        r.status !== "AGUARDANDO_VALIDACAO" &&
        r.dueDays !== null &&
        r.dueDays >= 0 &&
        r.dueDays <= 2,
    ).length,
    high: active.filter((r) => r.priority === "ALTA").length,
    missing: active.filter((r) => !r.due || !r.assigneeId).length,
    validation: rows.filter((r) => r.status === "AGUARDANDO_VALIDACAO").length,
    closed: closed.length,
    originalRate,
    currentRate,
    originalDenominator: validClosed.length,
    maxLate: Math.max(0, ...rows.map((r) => r.lateDays)),
  };
  const sections = ["SLC", "SAP", "SME", "AE", "Não classificada"].map(
    (name) => {
      const rs = rows.filter(
          (r) => (r.department || "Não classificada") === name,
        ),
        a = rs.filter(open);
      return {
        name,
        total: a.length,
        high: a.filter((r) => r.priority === "ALTA").length,
        medium: a.filter((r) => r.priority === "MEDIA").length,
        low: a.filter((r) => r.priority === "BAIXA").length,
        undefined: a.filter((r) => !r.priority).length,
        late: a.filter((r) => r.lateDays > 0).length,
        validation: a.filter((r) => r.status === "AGUARDANDO_VALIDACAO").length,
        averageAge: a.length
          ? Math.round(a.reduce((n, r) => n + r.openDays, 0) / a.length)
          : 0,
        received: rs.length,
        closed: rs.filter((r) => r.status === "ENCERRADA").length,
      };
    },
  );
  const people = [
    ...new Set(rows.map((r) => r.assigneeId).filter(Boolean)),
  ].map((id) => {
    const rs = rows.filter((r) => r.assigneeId === id),
      a = rs.filter(open),
      c = rs.filter((r) => r.status === "ENCERRADA"),
      cycles = c.map((r) => r.openDays).sort((a, b) => a - b);
    return {
      id,
      name: rs[0].assignee,
      department: rs[0].department,
      active: a.length,
      late: a.filter((r) => r.lateDays > 0).length,
      high: a.filter((r) => r.priority === "ALTA").length,
      d2: a.filter(
        (r) => r.dueDays !== null && r.dueDays >= 0 && r.dueDays <= 2,
      ).length,
      idle: a.filter((r) => r.idleDays >= 7).length,
      closed: c.length,
      extended: a.filter((r) => r.revision > 1).length,
      medianCycle: cycles.length ? cycles[Math.floor(cycles.length / 2)] : null,
    };
  });
  const age = [
    { name: "0–2 dias", min: 0, max: 2 },
    { name: "3–7 dias", min: 3, max: 7 },
    { name: "8–15 dias", min: 8, max: 15 },
    { name: "16–30 dias", min: 16, max: 30 },
    { name: "31+ dias", min: 31, max: 99999 },
  ].map((b) => ({
    ...b,
    count: active.filter((r) => r.openDays >= b.min && r.openDays <= b.max)
      .length,
  }));
  const statuses = [...new Set(rows.map((r) => r.status))].map((status) => ({
    status,
    count: rows.filter((r) => r.status === status).length,
  }));
  const flow: Record<
    string,
    { month: string; received: number; closed: number; stock: number }
  > = {};
  for (const r of rows) {
    const start = localDate(r.openedAt).slice(0, 7);
    flow[start] ||= { month: start, received: 0, closed: 0, stock: 0 };
    flow[start].received++;
    if (r.closedAt) {
      const end = localDate(r.closedAt).slice(0, 7);
      flow[end] ||= { month: end, received: 0, closed: 0, stock: 0 };
      flow[end].closed++;
    }
  }
  let stock = 0;
  const series = Object.values(flow)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((f) => ({ ...f, stock: (stock += f.received - f.closed) }));
  const order = params.get("sort");
  rows.sort((a, b) =>
    order === "code"
      ? a.code.localeCompare(b.code)
      : order === "age"
        ? b.openDays - a.openDays || a.code.localeCompare(b.code)
        : order === "due"
          ? (a.due || "9999").localeCompare(b.due || "9999") ||
            a.code.localeCompare(b.code)
          : b.lateDays - a.lateDays ||
            ({ ALTA: 0, MEDIA: 1, BAIXA: 2 }[a.priority as "ALTA"] ?? 3) -
              ({ ALTA: 0, MEDIA: 1, BAIXA: 2 }[b.priority as "ALTA"] ?? 3) ||
            (a.due || "9999").localeCompare(b.due || "9999") ||
            a.code.localeCompare(b.code),
  );
  const size = Math.min(50, Math.max(1, Number(params.get("size")) || 12)),
    page = Math.max(1, Number(params.get("page")) || 1);
  const sync = await repo.db
    .prepare(
      "SELECT last_sync_at,last_error FROM gmail_sync_state WHERE id='primary'",
    )
    .first<{ last_sync_at: string | null; last_error: string | null }>();
  return {
    kpis,
    sections,
    people,
    age,
    statuses,
    series,
    rows: rows.slice((page - 1) * size, page * size),
    total: rows.length,
    page,
    size,
    cutoff: date,
    updatedAt: now,
    syncAt: sync?.last_sync_at || null,
    syncError: sync?.last_error || null,
    simulation: env.SIMULATION_MODE === "true",
    definitions: {
      days: "Dias corridos; corte America/Sao_Paulo.",
      late: "Apenas execução ativa: prazo vigente anterior à data de corte. Validação é medida separadamente.",
      rates:
        "Conclusões declaradas e validadas até o prazo, sobre encerradas com data e prazo informados, no recorte selecionado.",
      flow: "Entradas e encerramentos da coorte selecionada; estoque acumulado desta coorte, não saldo global retroativo.",
      hours:
        "Tempo de trabalho somente quando declarado; não informado permanece nulo.",
    },
  };
}
