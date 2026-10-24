import { assert, transition } from "./domain.ts";
import { auditStatement, recordAudit, sanitizeAuditDetails } from "./audit.ts";
import type { Repository } from "./repository.ts";
import type { Aggregate, Person, RuntimeEnv, Priority } from "./types.ts";
import { readWorkbook, writeWorkbook, XLSX_MIME } from "./xlsx.ts";

export const DEMAND_HEADERS = [
  "id",
  "codigo",
  "versao",
  "titulo",
  "descricao",
  "prioridade",
  "referencia_processo",
  "url_sei",
  "situacao",
  "responsavel_id",
  "secao",
  "prazo_atual",
];
export const PEOPLE_HEADERS = [
  "id",
  "versao",
  "nome",
  "email",
  "secao",
  "papeis",
  "ativo",
];
export type SheetKind = "demands" | "people";
type RecordRow = Record<string, string>;
type DemandOp = {
  id: string;
  version: number;
  values: RecordRow;
  row: number;
  fields: string[];
};
type PersonOp = {
  before?: Person;
  id: string;
  version: number;
  person: Person;
  row: number;
  fields: string[];
  historyId: string;
};
type ImportState = { demands: DemandOp[]; people: PersonOp[] };
const str = (v: unknown) => (v == null ? "" : String(v));
const jsonBytes = (v: unknown) =>
  new TextEncoder().encode(JSON.stringify(v)).length;
const sheetName = (kind: SheetKind) =>
  kind === "demands" ? "Demandas" : "Pessoas";
export function spreadsheetRole(actor: Person, kind: SheetKind, write = false) {
  assert(
    kind === "demands" || kind === "people",
    "SHEET_KIND",
    "Escolha Demandas ou Pessoas.",
  );
  assert(
    actor.roles.includes("ADMIN") || actor.roles.includes("GESTOR"),
    "FORBIDDEN",
    "Planilhas restritas à administração e gestão.",
    403,
  );
  if (write)
    assert(
      kind === "people"
        ? actor.roles.includes("ADMIN")
        : actor.id === "u-gestor" && actor.roles.includes("GESTOR"),
      "FORBIDDEN",
      kind === "people"
        ? "Atualização de pessoas exige ADMIN."
        : "Atualização de demandas exige Emerson/GESTOR.",
      403,
    );
}
export async function demandSheetRows(repo: Repository, ids?: string[]) {
  const where = ids ? " WHERE g.id IN (SELECT value FROM json_each(?))" : "";
  const base = `SELECT g.id,d.code codigo,g.version versao,json_extract(g.state_json,'$.title') titulo,json_extract(g.state_json,'$.description') descricao,json_extract(g.state_json,'$.priority') prioridade,json_extract(g.state_json,'$.processReference') referencia_processo,json_extract(g.state_json,'$.processUrl') url_sei,d.status situacao,json_extract(g.state_json,'$.department') secao,
    (SELECT json_extract(a.value,'$.personId') FROM json_each(g.state_json,'$.assignments') a WHERE json_extract(a.value,'$.status') IN ('ATIVA','CONCLUSA_DECLARADA','AGUARDANDO_ACEITE') ORDER BY json_extract(a.value,'$.createdAt') DESC LIMIT 1) responsavel_id,
    (SELECT json_extract(a.value,'$.due') FROM json_each(g.state_json,'$.assignments') a WHERE json_extract(a.value,'$.status') IN ('ATIVA','CONCLUSA_DECLARADA','AGUARDANDO_ACEITE') ORDER BY json_extract(a.value,'$.createdAt') DESC LIMIT 1) prazo_atual FROM siga_aggregates g JOIN demands d ON d.id=g.id`;
  const statement = repo.db.prepare(
    base + where + " ORDER BY d.code LIMIT 5001",
  );
  const { results } = await (
    ids ? statement.bind(JSON.stringify(ids)) : statement
  ).all();
  assert(
    results.length <= 5000,
    "SHEET_EXPORT",
    "Máximo de 5.000 demandas por exportação.",
    413,
  );
  return results.map((r) =>
    Object.fromEntries(DEMAND_HEADERS.map((h) => [h, str(r[h])])),
  );
}
function personRow(p: Person): RecordRow {
  return {
    id: p.id,
    versao: str(p.revision || 1),
    nome: p.name,
    email: p.email,
    secao: p.department || "",
    papeis: [...p.roles].sort().join(";"),
    ativo: p.active ? "SIM" : "NÃO",
  };
}
export async function exportSpreadsheet(
  repo: Repository,
  actor: Person,
  kind: SheetKind,
) {
  spreadsheetRole(actor, kind);
  const headers = kind === "demands" ? DEMAND_HEADERS : PEOPLE_HEADERS;
  const rows =
    kind === "demands"
      ? await demandSheetRows(repo)
      : (await repo.people()).filter((p) => p.id !== "system").map(personRow);
  const notes = [
    ["Como atualizar"],
    [
      "Mantenha os nomes das colunas. Edite somente os campos permitidos e envie a aba selecionada no SIGA.",
    ],
    [
      kind === "demands"
        ? "Editáveis: titulo, descricao, prioridade, referencia_processo e url_sei. id, codigo e versao identificam o registro."
        : "Editáveis: nome, email, secao, papeis e ativo. Para cadastrar pessoa nova, deixe id e versao vazios.",
    ],
    [
      "Prazo, responsável, situação e encerramento seguem os fluxos próprios do painel. Não são alterados por esta planilha.",
    ],
    [
      "Máximo: 1.000 linhas, 100 alterações por lote e 5 MB. Sem macros, fórmulas ou objetos incorporados.",
    ],
    [
      "A prévia não altera dados. Revise as diferenças e confirme. Arquivos desatualizados precisam ser exportados novamente.",
    ],
    [
      "Prioridades: BAIXA; MEDIA; ALTA. Seções: SLC; SAP; SME; AE. Papéis ordinários: EXECUTOR; SDG_LEITOR; ADMIN.",
    ],
    [
      "A versão e os identificadores não devem ser editados. Cadastro do gestor e do sistema são protegidos.",
    ],
  ];
  const bytes = writeWorkbook([
    {
      name: sheetName(kind),
      rows: [
        headers,
        ...rows.map((r) =>
          headers.map((h) => (h === "versao" ? Number(r[h]) : r[h])),
        ),
      ],
    },
    { name: "Instruções", rows: notes },
  ]);
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="siga-${kind}-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
async function loadStates(repo: Repository, ids: string[]) {
  if (!ids.length) return new Map<string, Aggregate>();
  const size = await repo.db
    .prepare(
      "SELECT sum(length(state_json)) n FROM siga_aggregates WHERE id IN (SELECT value FROM json_each(?))",
    )
    .bind(JSON.stringify(ids))
    .first<{ n: number }>();
  assert(
    (size?.n || 0) < 4_000_000,
    "IMPORT_SIZE",
    "O histórico deste lote é muito grande. Atualize menos demandas por vez.",
    413,
  );
  const { results } = await repo.db
    .prepare(
      "SELECT id,state_json FROM siga_aggregates WHERE id IN (SELECT value FROM json_each(?))",
    )
    .bind(JSON.stringify(ids))
    .all<{ id: string; state_json: string }>();
  return new Map(
    results.map((x) => [x.id, JSON.parse(x.state_json) as Aggregate]),
  );
}
const command = (op: DemandOp, at: string) => ({
  id: crypto.randomUUID(),
  type: "UPDATE_METADATA",
  expectedVersion: op.version,
  origin: "SPREADSHEET",
  reason: "Atualização por planilha confirmada pelo gestor em " + at,
  title: op.values.titulo,
  description: op.values.descricao,
  priority: (op.values.prioridade || null) as Priority,
  processReference: op.values.referencia_processo,
  processUrl: op.values.url_sei,
});
export async function previewSpreadsheet(
  repo: Repository,
  env: RuntimeEnv,
  actor: Person,
  kind: SheetKind,
  bytes: Uint8Array,
) {
  spreadsheetRole(actor, kind, true);
  const headers = kind === "demands" ? DEMAND_HEADERS : PEOPLE_HEADERS,
    parsed = await readWorkbook(bytes, sheetName(kind));
  assert(
    parsed[0]?.row === 1 &&
      headers.every((h, i) => parsed[0].values[i] === h) &&
      parsed[0].values.filter(Boolean).length === headers.length,
    "SHEET_HEADERS",
    "As colunas não correspondem ao template. Baixe o modelo ou uma exportação atualizada.",
  );
  assert(
    parsed.every((r) => r.values.slice(headers.length).every((v) => !v)),
    "SHEET_HEADERS",
    "Há conteúdo fora das colunas do template.",
  );
  const data = parsed.slice(1).map((x) => ({
    row: x.row,
    values: Object.fromEntries(headers.map((h, i) => [h, x.values[i] ?? ""])),
  }));
  assert(
    data.length > 0,
    "SHEET_EMPTY",
    "A aba selecionada não contém registros preenchidos.",
  );
  const errors: { row: number; message: string }[] = [],
    state: ImportState = { demands: [], people: [] },
    preview: { row: number; id: string; fields: string[]; changes: unknown }[] =
      [];
  const people = await repo.people(),
    peopleMap = new Map(people.map((p) => [p.id, p])),
    ids = new Set<string>(),
    emails = new Set<string>();
  const currentDemands =
    kind === "demands"
      ? new Map(
          (
            await demandSheetRows(
              repo,
              data.map((r) => r.values.id),
            )
          ).map((r) => [r.id, r]),
        )
      : new Map<string, RecordRow>();
  let unchanged = 0;
  for (const item of data)
    try {
      const r = item.values;
      assert(
        !r.id || !ids.has(r.id),
        "DUPLICATE_ID",
        "Identificador repetido no arquivo.",
      );
      if (r.id) ids.add(r.id);
      if (kind === "demands") {
        const current = currentDemands.get(r.id);
        assert(
          current,
          "IMPORT_ID",
          "Demanda inexistente. Exporte a carteira para obter os identificadores corretos.",
        );
        for (const field of [
          "codigo",
          "situacao",
          "responsavel_id",
          "secao",
          "prazo_atual",
        ])
          assert(
            !r[field] || r[field] === current[field],
            "READ_ONLY",
            `A coluna ${field} é de consulta e não pode alterar o fluxo da demanda.`,
          );
        const fields = [
          "titulo",
          "descricao",
          "prioridade",
          "referencia_processo",
          "url_sei",
        ].filter((h) => r[h] !== current[h]);
        if (!fields.length) {
          unchanged++;
          continue;
        }
        assert(
          Number(r.versao) === Number(current.versao),
          "IMPORT_STALE",
          "A versão mudou. Exporte uma planilha atualizada.",
          409,
        );
        state.demands.push({
          id: r.id,
          version: Number(r.versao),
          values: r,
          row: item.row,
          fields,
        });
        preview.push({
          row: item.row,
          id: r.codigo || r.id,
          fields,
          changes: fields.map((field) => ({
            field,
            before: current[field].slice(0, 300),
            after: r[field].slice(0, 300),
          })),
        });
      } else {
        const current = r.id ? peopleMap.get(r.id) : null;
        assert(
          !r.id || current,
          "IMPORT_ID",
          "Pessoa inexistente. Deixe id vazio apenas para cadastrar uma pessoa nova.",
        );
        assert(
          !emails.has(r.email.toLowerCase()),
          "DUPLICATE_EMAIL",
          "E-mail repetido no arquivo.",
        );
        emails.add(r.email.toLowerCase());
        const p: Person = {
          id: r.id || crypto.randomUUID(),
          name: r.nome.trim(),
          email: r.email.trim().toLowerCase(),
          department: r.secao.trim().toUpperCase() || null,
          roles: r.papeis
            .split(/[;,]/)
            .map((x) => x.trim().toUpperCase())
            .filter(Boolean) as Person["roles"],
          active: ["SIM", "TRUE", "1"].includes(r.ativo.trim().toUpperCase()),
        };
        assert(
          ["SIM", "NÃO", "NAO", "TRUE", "FALSE", "1", "0"].includes(
            r.ativo.trim().toUpperCase(),
          ),
          "PERSON",
          "Ativo deve ser SIM ou NÃO.",
        );
        assert(
          new Set(p.roles).size === p.roles.length,
          "PERSON",
          "Papéis repetidos.",
        );
        const row = personRow(p),
          before = current ? personRow(current) : {};
        const fields = ["nome", "email", "secao", "papeis", "ativo"].filter(
          (h) => row[h] !== before[h],
        );
        if (!fields.length) {
          unchanged++;
          continue;
        }
        assert(
          current ? Number(r.versao) === current.revision : !r.versao,
          "IMPORT_STALE",
          "Versão da pessoa inválida ou desatualizada.",
          409,
        );
        assert(
          !people.some(
            (other) =>
              other.id !== p.id && other.email.toLowerCase() === p.email,
          ),
          "PERSON_EMAIL",
          "O e-mail já pertence a outra pessoa.",
        );
        repo.personStatements(p, actor.id, new Date().toISOString());
        state.people.push({
          before: current || undefined,
          id: p.id,
          version: current?.revision || 0,
          person: p,
          row: item.row,
          fields,
          historyId: crypto.randomUUID(),
        });
        preview.push({
          row: item.row,
          id: current?.name || p.name,
          fields,
          changes: fields.map((field) => ({
            field,
            before: before[field] || "",
            after: row[field],
          })),
        });
      }
    } catch (error) {
      errors.push({
        row: item.row,
        message: error instanceof Error ? error.message : "Linha inválida.",
      });
    }
  assert(
    state.demands.length + state.people.length <= 100,
    "IMPORT_BATCH",
    "Máximo de 100 alterações por confirmação. Divida as alterações em lotes menores.",
    413,
  );
  if (kind === "demands" && !errors.length) {
    const states = await loadStates(
      repo,
      state.demands.map((x) => x.id),
    );
    for (const op of state.demands)
      try {
        transition(
          states.get(op.id)!,
          command(op, new Date().toISOString()),
          actor,
          people,
          new Date().toISOString(),
          env.SEI_ALLOWED_HOSTS.split(","),
        );
      } catch (e) {
        errors.push({
          row: op.row,
          message: e instanceof Error ? e.message : "Mudança inválida.",
        });
      }
  }
  const fileHash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", bytes as BufferSource),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
  const changes = state.demands.length + state.people.length;
  let id: string | null = null;
  if (!errors.length && changes) {
    await repo.db
      .prepare(
        "DELETE FROM spreadsheet_imports WHERE expires_at<? AND status!='APPLYING'",
      )
      .bind(Date.now())
      .run();
    assert(
      jsonBytes(state) < 500000,
      "IMPORT_SIZE",
      "Lote muito grande. Reduza o conteúdo ou as alterações.",
      413,
    );
    id = crypto.randomUUID();
    await repo.db
      .prepare(
        "INSERT INTO spreadsheet_imports(id,actor_id,kind,status,state_json,file_hash,created_at,expires_at) VALUES(?,?,?,'PREVIEW',?,?,?,?)",
      )
      .bind(
        id,
        actor.id,
        kind,
        JSON.stringify(state),
        fileHash,
        new Date().toISOString(),
        Date.now() + 900000,
      )
      .run();
  }
  await recordAudit(repo.db, {
    actor,
    requestId: repo.requestId,
    action: "SPREADSHEET_PREVIEW",
    resource: kind,
    source: "SPREADSHEET",
    outcome: errors.length ? "NEGADO" : "SUCESSO",
    details: { rows: data.length, changes, errors: errors.length, fileHash },
  });
  return {
    previewId: id,
    kind,
    rows: data.length,
    changes,
    unchanged,
    errors: errors.slice(0, 50),
    errorCount: errors.length,
    preview,
    expiresInMinutes: 15,
  };
}
export async function applySpreadsheet(
  repo: Repository,
  env: RuntimeEnv,
  actor: Person,
  id: string,
) {
  const saved = await repo.db
    .prepare("SELECT * FROM spreadsheet_imports WHERE id=? AND actor_id=?")
    .bind(id, actor.id)
    .first<{
      kind: SheetKind;
      status: string;
      state_json: string;
      file_hash: string;
      expires_at: number;
      result_json: string;
    }>();
  assert(
    saved,
    "IMPORT_PREVIEW",
    "Prévia não encontrada para este usuário.",
    404,
  );
  spreadsheetRole(actor, saved.kind, true);
  if (saved.status === "APPLIED")
    return { ...JSON.parse(saved.result_json), alreadyApplied: true };
  assert(
    saved.status === "PREVIEW" && saved.expires_at > Date.now(),
    "IMPORT_EXPIRED",
    "Prévia expirada ou já processada. Valide o arquivo novamente.",
    409,
  );
  const claimed = await repo.db
    .prepare(
      "UPDATE spreadsheet_imports SET status='APPLYING' WHERE id=? AND actor_id=? AND status='PREVIEW' AND expires_at>? RETURNING id",
    )
    .bind(id, actor.id, Date.now())
    .first();
  assert(
    claimed,
    "IMPORT_BUSY",
    "Esta importação já está sendo processada.",
    409,
  );
  try {
    const state = JSON.parse(saved.state_json) as ImportState,
      at = new Date().toISOString(),
      people = await repo.people();
    const result = {
      applied: true,
      kind: saved.kind,
      count: state.demands.length + state.people.length,
      importId: id,
    };
    const statements: D1PreparedStatement[] = [
      auditStatement(
        repo.db,
        {
          actor,
          requestId: repo.requestId || id,
          action: "SPREADSHEET_APPLIED",
          resource: id,
          source: "SPREADSHEET",
          at,
          details: {
            kind: saved.kind,
            count: result.count,
            fileHash: saved.file_hash,
          },
        },
        {
          sql: "EXISTS(SELECT 1 FROM spreadsheet_imports WHERE id=? AND actor_id=? AND status='APPLYING' AND expires_at>?)",
          params: [id, actor.id, Date.now()],
        },
      ),
    ];
    if (saved.kind === "demands") {
      const current = await loadStates(
        repo,
        state.demands.map((x) => x.id),
      );
      const payload = state.demands.map((op) => {
        const before = current.get(op.id);
        assert(
          before && before.version === op.version,
          "IMPORT_STALE",
          "Uma demanda mudou após a prévia. Nada foi aplicado.",
          409,
        );
        const cmd = command(op, at),
          next = transition(
            before,
            cmd,
            actor,
            people,
            at,
            env.SEI_ALLOWED_HOSTS.split(","),
          ).state;
        const event = next.events.at(-1)!;
        return {
          id: op.id,
          state: next,
          event,
          commandId: cmd.id,
          summary: { id: op.id, code: next.code, version: next.version },
          fields: op.fields,
        };
      });
      assert(
        jsonBytes(payload) < 900000,
        "IMPORT_SIZE",
        "O lote ficou grande devido ao histórico. Reduza o número de alterações.",
        413,
      );
      const value = JSON.stringify(payload);
      statements.push(
        repo.db
          .prepare(
            "UPDATE siga_aggregates SET version=json_extract(p.value,'$.state.version'),state_json=json_extract(p.value,'$.state') FROM json_each(?) p WHERE siga_aggregates.id=json_extract(p.value,'$.id')",
          )
          .bind(value),
        repo.db
          .prepare(
            "UPDATE demands SET title=json_extract(p.value,'$.state.title'),description=json_extract(p.value,'$.state.description'),priority=json_extract(p.value,'$.state.priority'),process_reference=json_extract(p.value,'$.state.processReference'),process_url=json_extract(p.value,'$.state.processUrl'),process_url_status=CASE WHEN json_extract(p.value,'$.state.processUrl') IS NULL THEN 'NAO_INFORMADO' ELSE 'VALIDADO_DOMINIO' END,version=json_extract(p.value,'$.state.version') FROM json_each(?) p WHERE demands.id=json_extract(p.value,'$.id')",
          )
          .bind(value),
        repo.db
          .prepare(
            "INSERT INTO demand_events(id,demand_id,actor_id,type,before_json,after_json,declared_or_verified,occurred_at,event_key) SELECT json_extract(value,'$.event.id'),json_extract(value,'$.id'),?,json_extract(value,'$.event.type'),json_extract(value,'$.event.before'),json_set(json_extract(value,'$.event.after'),'$.origin','SPREADSHEET'),json_extract(value,'$.event.verification'),?,json_extract(value,'$.event.id') FROM json_each(?)",
          )
          .bind(actor.id, at, value),
        repo.db
          .prepare(
            "INSERT INTO siga_commands(id,demand_id,result_json,created_at) SELECT json_extract(value,'$.commandId'),json_extract(value,'$.id'),json_extract(value,'$.summary'),? FROM json_each(?)",
          )
          .bind(at, value),
      );
    } else {
      for (const op of state.people) {
        const old = people.find((p) => p.id === op.id);
        assert(
          op.version ? old?.revision === op.version : !old,
          "IMPORT_STALE",
          "Um cadastro mudou após a prévia. Nada foi aplicado.",
          409,
        );
        repo.personStatements(op.person, actor.id, at);
      }
      const payload = state.people.map((op) => ({
          ...op,
          person: {
            ...op.person,
            departmentId: "dept-" + op.person.department!.toLowerCase(),
          },
        })),
        value = JSON.stringify(payload);
      statements.unshift(
        auditStatement(
          repo.db,
          {
            actor,
            requestId: repo.requestId || id,
            action: "SPREADSHEET_PEOPLE_GUARD",
            resource: id,
            source: "SPREADSHEET",
            at,
          },
          {
            sql: "NOT EXISTS(SELECT 1 FROM json_each(?) p LEFT JOIN users u ON u.id=json_extract(p.value,'$.id') WHERE (json_extract(p.value,'$.version')=0 AND u.id IS NOT NULL) OR (json_extract(p.value,'$.version')>0 AND (u.id IS NULL OR u.revision!=json_extract(p.value,'$.version'))))",
            params: [value],
          },
        ),
      );
      statements.push(
        repo.db
          .prepare(
            "INSERT INTO users(id,full_name,email,active,created_at,department_id) SELECT json_extract(value,'$.id'),json_extract(value,'$.person.name'),json_extract(value,'$.person.email'),json_extract(value,'$.person.active'),?,json_extract(value,'$.person.departmentId') FROM json_each(?) WHERE 1 ON CONFLICT(id) DO UPDATE SET full_name=excluded.full_name,email=excluded.email,active=excluded.active,department_id=excluded.department_id,revision=users.revision+1",
          )
          .bind(at, value),
        repo.db
          .prepare(
            "DELETE FROM password_sessions WHERE user_id IN (SELECT json_extract(value,'$.id') FROM json_each(?))",
          )
          .bind(value),
        repo.db
          .prepare(
            "DELETE FROM password_links WHERE user_id IN (SELECT json_extract(value,'$.id') FROM json_each(?))",
          )
          .bind(value),
        repo.db
          .prepare(
            "UPDATE login_accounts SET version=version+1 WHERE user_id IN (SELECT json_extract(value,'$.id') FROM json_each(?))",
          )
          .bind(value),
        repo.db
          .prepare(
            "DELETE FROM user_roles WHERE user_id IN (SELECT json_extract(value,'$.id') FROM json_each(?))",
          )
          .bind(value),
        repo.db
          .prepare(
            "INSERT INTO user_roles(user_id,role) SELECT json_extract(p.value,'$.id'),r.value FROM json_each(?) p,json_each(p.value,'$.person.roles') r",
          )
          .bind(value),
        repo.db
          .prepare(
            "UPDATE user_department_history SET valid_until=? WHERE valid_until IS NULL AND user_id IN (SELECT json_extract(value,'$.id') FROM json_each(?))",
          )
          .bind(at, value),
        repo.db
          .prepare(
            "INSERT INTO user_department_history(id,user_id,department_id,valid_from,registered_by,created_at) SELECT json_extract(value,'$.historyId'),json_extract(value,'$.id'),json_extract(value,'$.person.departmentId'),?,?,? FROM json_each(?)",
          )
          .bind(at, actor.id, at, value),
      );
    }
    const auditRows = [...state.demands, ...state.people].map((op) => ({
      id: crypto.randomUUID(),
      resource: op.id,
      action:
        saved.kind === "demands"
          ? "DEMAND_UPDATE_METADATA"
          : op.version
            ? "PERSON_UPDATED"
            : "PERSON_CREATED",
      details: sanitizeAuditDetails({
        importId: id,
        row: op.row,
        fields: op.fields,
        beforeVersion: op.version,
        afterVersion: op.version + 1,
        ...("person" in op
          ? { before: op.before || null, after: op.person }
          : {}),
      }),
    }));
    statements.push(
      repo.db
        .prepare(
          "INSERT INTO audit_log(id,request_id,occurred_at,actor_id,actor_name,roles_json,action,resource,source,outcome,details_json) SELECT json_extract(value,'$.id'),?,?,?,?,?,json_extract(value,'$.action'),json_extract(value,'$.resource'),'SPREADSHEET','SUCESSO',json_extract(value,'$.details') FROM json_each(?)",
        )
        .bind(
          repo.requestId || id,
          at,
          actor.id,
          actor.name,
          JSON.stringify(actor.roles),
          JSON.stringify(auditRows),
        ),
    );
    // A bulk audit insert keeps up to 100 changes atomic within the D1 query budget.
    assert(
      statements.length <= 45,
      "IMPORT_BATCH",
      "Reduza o lote para no máximo 30 alterações por confirmação.",
      413,
    );
    statements.push(
      repo.db
        .prepare(
          "UPDATE spreadsheet_imports SET status='APPLIED',applied_at=?,state_json='{}',result_json=? WHERE id=?",
        )
        .bind(at, JSON.stringify(result), id),
    );
    await repo.db.batch(statements);
    return result;
  } catch (error) {
    await repo.db
      .prepare(
        "UPDATE spreadsheet_imports SET status='FAILED',state_json='{}',result_json=? WHERE id=? AND status='APPLYING'",
      )
      .bind(JSON.stringify({ error: "IMPORT_FAILED" }), id)
      .run();
    throw error;
  }
}
