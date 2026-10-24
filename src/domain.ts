import type {
  Aggregate,
  Assignment,
  Command,
  Person,
  Priority,
  Request,
} from "./types.ts";

export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function assert(
  condition: unknown,
  code: string,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new DomainError(code, message, status);
}
export const localDate = (instant: string | Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
export const days = (a: string, b: string) =>
  Math.round(
    (Date.parse(b.slice(0, 10) + "T12:00:00Z") -
      Date.parse(a.slice(0, 10) + "T12:00:00Z")) /
      86400000,
  );
export const addDays = (date: string, n: number) =>
  new Date(Date.parse(date + "T12:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !isNaN(Date.parse(value)) &&
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value
  );
}
export function parseDate(text: string, today: string): string | null {
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return validDate(iso[1]) && iso[1] >= today ? iso[1] : null;
  const m = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
  if (!m) return null;
  if (!m[3] && today.slice(5, 7) === "12" && m[2] === "1") return null;
  const d = `${m[3] || today.slice(0, 4)}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return validDate(d) && d >= today ? d : null;
}
export function reminderDate(due: string, holidays: string[] = []) {
  let d = addDays(due, -2);
  while (
    [0, 6].includes(new Date(d + "T12:00:00Z").getUTCDay()) ||
    holidays.includes(d)
  )
    d = addDays(d, -1);
  return d;
}
export function safeSei(
  value: string | null | undefined,
  hosts: string[],
): string | null {
  if (!value || value.length > 2048 || /[\r\n\\]/.test(value)) return null;
  try {
    const u = new URL(value);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.port ||
      !hosts.includes(u.hostname.toLowerCase()) ||
      /(?:redirect|return|next|url|target|dest|continue)/i.test(
        [...u.searchParams.keys()].join(" "),
      )
    )
      return null;
    return u.href;
  } catch {
    return null;
  }
}
export function freshText(text: string) {
  // Bound BEFORE parsing and stop at quoted/script content; malformed untrusted HTML
  // cannot trigger repeated unbounded regex scans across a complete MIME message.
  const bounded = text.slice(0, 24000);
  const quote = bounded.search(/<(?:blockquote|script)\b/i);
  const current = quote < 0 ? bounded : bounded.slice(0, quote);
  return current
    .replace(/<[^>\n]{0,1000}>/g, " ")
    .split(
      /\n(?:\s*>|On .{0,300}wrote:|Em .{0,300}escreveu:|De:|From:|_{5}|-{2,}\s*(?:Original|Mensagem))|\n--\s*\n/i,
    )[0]
    .trim()
    .slice(0, 12000);
}
export const codes = (text: string) => [
  ...new Set(text.match(/SIGA-\d{4}-\d{4,}/g) || []),
];
export function resolvePerson(reference: string, people: Person[]) {
  const r = reference.trim().toLocaleLowerCase("pt-BR");
  const matches = people.filter(
    (p) =>
      p.active &&
      (p.email.toLowerCase() === r ||
        p.id === reference ||
        p.name.toLocaleLowerCase("pt-BR") === r ||
        p.name.toLocaleLowerCase("pt-BR").startsWith(r + " ")),
  );
  return matches.length === 1
    ? { kind: "unique" as const, person: matches[0] }
    : { kind: matches.length ? ("ambiguous" as const) : ("none" as const) };
}
export const activeAssignment = (s: Aggregate) =>
  s.assignments.findLast((a) =>
    ["ATIVA", "CONCLUSA_DECLARADA", "VALIDADA"].includes(a.status),
  ) || null;
const editable = (s: Aggregate) =>
  assert(
    !["ENCERRADA", "ARQUIVADA_SEM_DEMANDA", "CANCELADA"].includes(s.status),
    "FINAL_STATE",
    "A demanda já está finalizada.",
    409,
  );
const manager = (s: Aggregate, p: Person) =>
  assert(
    p.active && p.id === s.managerId && p.roles.includes("GESTOR"),
    "FORBIDDEN",
    "Somente Emerson, no papel de gestor, pode autorizar esta ação.",
    403,
  );
const executor = (s: Aggregate, p: Person) =>
  assert(
    p.active &&
      s.assignments.some(
        (a) =>
          a.personId === p.id &&
          ["ATIVA", "AGUARDANDO_ACEITE", "CONCLUSA_DECLARADA"].includes(
            a.status,
          ),
      ),
    "FORBIDDEN",
    "Ação restrita ao responsável desta demanda.",
    403,
  );
export function createAggregate(
  id: string,
  code: string,
  title: string,
  description: string,
  managerId: string,
  at: string,
  parentId: string | null = null,
): Aggregate {
  assert(
    title.trim().length >= 3 && title.length <= 250,
    "TITLE",
    "Informe um título de 3 a 250 caracteres.",
  );
  return {
    id,
    code,
    title: title.trim(),
    description: description.slice(0, 12000),
    managerId,
    parentId,
    childIds: [],
    status: parentId ? "AGUARDANDO_ATRIBUICAO" : "NOVA_TRIAGEM",
    priority: null,
    processReference: null,
    processUrl: null,
    department: null,
    originDepartment: null,
    openedAt: at,
    updatedAt: at,
    closedAt: null,
    closedBy: null,
    version: 0,
    assignments: [],
    requests: [],
    events: [],
    outbox: [],
    activeMenus: {},
    validationAt: null,
    blockedAt: null,
    waitDays: 0,
    workMinutes: null,
    clarifications: 0,
  };
}
const menus: Record<string, string> = {
  NEW_TRIAGE_V1:
    "1 — Atribuir: nome/e-mail e prioridade Baixa, Média ou Alta.\n2 — Assumir: prazo e justificativa.\n3 — Pedir esclarecimentos.\n4 — Arquivar: justificativa.\n5 — Outra providência.",
  INITIAL_DUE_REQUEST_V1:
    "1 — Aceito; informo data de entrega DD/MM/AAAA.\n2 — Preciso de esclarecimento.\n3 — Recuso: motivo.\n4 — Sugiro outra pessoa: identificação e motivo.\n5 — Outra informação.",
  REMINDER_V1:
    "1 — Confirmo o prazo.\n2 — Solicito prorrogação: nova data e motivo.\n3 — Declaro conclusão: resultados e documentação.\n4 — Proponho transferência: pessoa e motivo.\n5 — Relato impedimento ou peço orientação.",
  MANAGER_APPROVAL_V1:
    "1 — Autorizar sem ressalvas.\n2 — Autorizar com ressalvas: descrever condições.\n3 — Indeferir.\n4 — Pedir esclarecimentos.\n5 — Outra providência.",
  ASK_EXTENSION_REASON_V1:
    "1 — Informar justificativa.\n2 — Corrigir data e justificar.\n3 — Desistir do pedido.\n4 — Pedir orientação.\n5 — Outra providência.",
  ASK_TRANSFER_SCOPE_V1:
    "1 — Transferência integral.\n2 — Apoio, mantendo responsável.\n3 — Apenas transferência.\n4 — Apenas prorrogação.\n5 — Outra orientação.\nInforme motivo e identificação da pessoa.",
  DOCUMENTATION_V1:
    "1 — Declaro vistoria, relatório, fotos e juntada concluídos.\n2 — Há pendência documental.\n3 — Chamado de reparo já aberto: informe referência.\n4 — Chamado ainda precisa ser aberto.\n5 — Outra informação.",
  MANAGER_DOUBLE_DECISION_V1:
    "A1 — Encerrar original sem ressalvas.\nA2 — Encerrar com ressalvas: explicitar condições e momento.\nA3 — Indeferir conclusão.\nA4 — Pedir esclarecimentos.\nA5 — Outra providência.\nB1 — Criar demanda filha sem ressalvas.\nB2 — Criar com ressalvas: explicitar condições.\nB3 — Indeferir criação.\nB4 — Pedir esclarecimentos.\nB5 — Outra providência.",
  ASK_MANUEL_IDENTITY_V1:
    "1 — Identificar pessoa sugerida por nome e e-mail cadastrado.\n2 — Indicar outra pessoa.\n3 — Assumir: data e justificativa.\n4 — Manter sem responsável temporariamente.\n5 — Outra providência.",
};
export function mail(
  s: Aggregate,
  to: Person,
  menu: string | null,
  message: string,
  at: string,
  key: string,
  hosts: string[],
) {
  assert(
    to.active && /^[^\s@\r\n]+@[^\s@\r\n]+$/.test(to.email),
    "RECIPIENT",
    "Destinatário não identificado.",
  );
  const a = activeAssignment(s);
  const link = safeSei(s.processUrl, hosts);
  s.outbox.push({
    id: key,
    to: to.email,
    subject: `[${s.code}] ${s.title.replace(/[\r\n]/g, " ")}`,
    body: `${s.code} — ${s.title}\nUnidade responsável: ${s.department || "Não classificada"}\nPrioridade: ${s.priority || "Não definida"}\nPrazo vigente: ${a?.due || "Sem prazo"}\nReferência: ${s.processReference || "Não informada"} (não verificada)\n${link ? "Processo SEI: " + link + "\n" : ""}\n${message}${menu ? "\n\n" + menus[menu] + "\n\nResponda com números ou em linguagem natural." : ""}`,
    menu,
    status: "SIMULADO",
    at,
  });
  if (menu) s.activeMenus[to.id] = menu;
}
export function transition(
  original: Aggregate,
  command: Command,
  actor: Person,
  people: Person[],
  at: string,
  hosts: string[] = ["sei.tjmsp.jus.br"],
): { state: Aggregate; children: Aggregate[] } {
  assert(
    actor.active && !actor.roles.includes("SDG_LEITOR"),
    "FORBIDDEN",
    "O perfil SDG é somente leitura.",
    403,
  );
  assert(
    command.expectedVersion === undefined ||
      command.expectedVersion === original.version,
    "STALE_VERSION",
    "A demanda foi atualizada. Recarregue antes de decidir.",
    409,
  );
  if (command.type === "DOUBLE") {
    manager(original, actor);
    assert(
      original.activeMenus[actor.id] === "MANAGER_DOUBLE_DECISION_V1",
      "MENU",
      "Decisão dupla fora do menu ativo.",
    );
    const pending = original.requests.filter(
      (r) =>
        r.status === "AGUARDANDO_GESTOR" &&
        ["CONCLUSAO", "DEMANDA_FILHA"].includes(r.type),
    );
    assert(
      pending.length === 2 &&
        pending.every((r) => r.expectedVersion === original.version),
      "STALE_APPROVAL",
      "Decisões pendentes inexistentes ou obsoletas.",
      409,
    );
    let state = structuredClone(original);
    const children: Aggregate[] = [];
    for (const r of pending) {
      const approve =
        r.type === "CONCLUSAO" ? command.close : command.createChild;
      if (approve === undefined) continue;
      const current = state.requests.find((x) => x.id === r.id)!;
      current.expectedVersion = state.version;
      const result = transition(
        state,
        {
          ...command,
          id: command.id + ":" + r.type,
          type: "DECIDE",
          requestId: r.id,
          expectedVersion: state.version,
          decision: approve ? "APPROVE" : "REJECT",
        },
        actor,
        people,
        at,
        hosts,
      );
      state = result.state;
      children.push(...result.children);
    }
    // One persisted version per external transaction, independent A/B audit events.
    state.version = original.version + 1;
    return { state, children };
  }
  const s = structuredClone(original);
  const before = structuredClone({
    status: s.status,
    priority: s.priority,
    department: s.department,
    assignment: activeAssignment(s),
    processUrl: s.processUrl,
    ...(command.type === "UPDATE_METADATA"
      ? {
          title: s.title,
          description: s.description,
          processReference: s.processReference,
        }
      : {}),
  });
  const children: Aggregate[] = [];
  const m = people.find((p) => p.id === s.managerId)!;
  assert(m, "MANAGER", "Gestor não cadastrado.");
  const out = (p: Person, menu: string | null, message: string) =>
    mail(
      s,
      p,
      menu,
      message,
      at,
      `${command.id}:mail:${s.outbox.length}`,
      hosts,
    );
  const reason = command.reason?.trim() || "";
  let verification: "DECLARADO" | "SISTEMA" = "SISTEMA";
  const request = (type: Request["type"], data: Partial<Request> = {}) => {
    const r: Request = {
      id: crypto.randomUUID(),
      type,
      status: "AGUARDANDO_GESTOR",
      date: null,
      personId: null,
      title: null,
      reason,
      conditions: null,
      expectedVersion: s.version + 1,
      createdAt: at,
      decidedBy: null,
      decidedAt: null,
      ...data,
    };
    s.requests.push(r);
    return r;
  };
  switch (command.type) {
    case "UPDATE_METADATA": {
      editable(s);
      manager(s, actor);
      assert(reason, "REASON", "Informe o motivo da atualização.");
      assert(
        typeof command.title === "string" &&
          command.title.trim().length >= 3 &&
          command.title.length <= 250,
        "TITLE",
        "Título deve ter entre 3 e 250 caracteres.",
      );
      assert(
        typeof command.description === "string" &&
          command.description.length <= 12000,
        "DESCRIPTION",
        "Descrição excede 12.000 caracteres.",
      );
      assert(
        command.priority === null ||
          ["BAIXA", "MEDIA", "ALTA"].includes(command.priority || ""),
        "PRIORITY",
        "Prioridade inválida.",
      );
      assert(
        command.priority !== null || !s.assignments.length,
        "PRIORITY",
        "Não remova a prioridade de demanda já atribuída.",
      );
      const link = command.processUrl
        ? safeSei(command.processUrl, hosts)
        : null;
      assert(
        !command.processUrl || link,
        "SEI_URL",
        "URL SEI fora dos critérios permitidos.",
      );
      assert(
        (command.processReference || "").length <= 120,
        "PROCESS_REFERENCE",
        "Referência de processo excede 120 caracteres.",
      );
      s.title = command.title.trim();
      s.description = command.description;
      s.priority = command.priority as Priority;
      s.processUrl = link;
      s.processReference = command.processReference || null;
      verification = "DECLARADO";
      break;
    }
    case "CREATE":
      manager(s, actor);
      out(m, "NEW_TRIAGE_V1", "Nova demanda provisória. Indique o tratamento.");
      break;
    case "ASSIGN": {
      editable(s);
      manager(s, actor);
      assert(
        ["BAIXA", "MEDIA", "ALTA"].includes(command.priority || ""),
        "PRIORITY",
        "Emerson deve escolher Baixa, Média ou Alta na atribuição.",
      );
      assert(
        !s.assignments.some((a) =>
          ["ATIVA", "CONCLUSA_DECLARADA", "AGUARDANDO_ACEITE"].includes(
            a.status,
          ),
        ),
        "USE_TRANSFER",
        "Para alterar o responsável, solicite transferência.",
        409,
      );
      const p = people.find(
        (p) =>
          p.id === command.personId && p.active && p.roles.includes("EXECUTOR"),
      );
      assert(
        p && p.department,
        "PERSON",
        "Selecione executor cadastrado e sua seção.",
      );
      if (p.id === s.managerId)
        assert(
          reason && command.date,
          "SELF_ASSIGN",
          "Para assumir, informe prazo e justificativa.",
        );
      s.priority = command.priority as Priority;
      s.status = "AGUARDANDO_ATRIBUICAO";
      s.assignments.push({
        id: crypto.randomUUID(),
        personId: p.id,
        department: p.department,
        status: "AGUARDANDO_ACEITE",
        originalDue: null,
        due: null,
        dueRevision: 0,
        acceptedAt: null,
        declaredAt: null,
        createdAt: at,
        reminderDate: null,
        reminderSent: false,
      });
      out(
        p,
        "INITIAL_DUE_REQUEST_V1",
        "Atribuição proposta. Sua seção será efetivada após aceite.",
      );
      break;
    }
    case "ACCEPT": {
      editable(s);
      executor(s, actor);
      const a = s.assignments.findLast(
        (a) => a.personId === actor.id && a.status === "AGUARDANDO_ACEITE",
      );
      assert(a, "STATE", "Não há atribuição aguardando seu aceite.", 409);
      assert(
        command.date &&
          validDate(command.date) &&
          command.date >= localDate(at),
        "DATE",
        "Informe data válida, sem ambiguidade e não anterior a hoje.",
      );
      s.assignments
        .filter((v) => v.status === "ATIVA")
        .forEach((v) => (v.status = "TRANSFERIDA"));
      a.status = "ATIVA";
      a.acceptedAt = at;
      a.originalDue = command.date;
      a.due = command.date;
      a.dueRevision = 1;
      a.reminderDate = reminderDate(command.date);
      a.reminderSent = a.reminderDate <= localDate(at);
      s.department = a.department;
      s.originDepartment ||= a.department;
      s.status = "EM_EXECUCAO";
      s.requests
        .filter(
          (r) =>
            r.type === "TRANSFERENCIA" &&
            r.personId === actor.id &&
            r.status === "AGUARDANDO_ACEITE",
        )
        .forEach((r) => (r.status = "APROVADA"));
      out(
        actor,
        "REMINDER_V1",
        `Prazo inicial registrado: ${command.date}.${a.reminderSent ? " Lembrete D-2 consolidado nesta confirmação." : ""}`,
      );
      break;
    }
    case "DECLINE": {
      editable(s);
      executor(s, actor);
      assert(reason, "REASON", "Informe motivo da recusa.");
      const a = s.assignments.findLast(
        (a) => a.personId === actor.id && a.status === "AGUARDANDO_ACEITE",
      );
      assert(a, "STATE", "Atribuição não está pendente.");
      a.status = "RECUSADA";
      out(
        m,
        "NEW_TRIAGE_V1",
        `Recusa declarada por ${actor.name}: ${reason}. Responsabilidade anterior preservada.`,
      );
      break;
    }
    case "EXTENSION": {
      editable(s);
      executor(s, actor);
      assert(
        s.status === "EM_EXECUCAO",
        "STATE",
        "Prorrogação exige demanda em execução.",
      );
      const a = activeAssignment(s);
      assert(
        a && a.personId === actor.id && a.due,
        "STATE",
        "Aceite e prazo inicial são necessários.",
      );
      assert(
        command.date &&
          validDate(command.date) &&
          command.date >= localDate(at) &&
          command.date > a.due,
        "DATE",
        "Nova data deve ser posterior ao prazo vigente e não anterior a hoje.",
      );
      assert(
        !s.requests.some(
          (r) =>
            r.type === "PRORROGACAO" &&
            [
              "INCOMPLETA",
              "AGUARDANDO_GESTOR",
              "AGUARDANDO_CONDICOES",
            ].includes(r.status),
        ),
        "PENDING",
        "Já existe pedido de prorrogação pendente.",
        409,
      );
      request("PRORROGACAO", {
        date: command.date,
        status: reason ? "AGUARDANDO_GESTOR" : "INCOMPLETA",
      });
      out(
        reason ? m : actor,
        reason ? "MANAGER_APPROVAL_V1" : "ASK_EXTENSION_REASON_V1",
        reason
          ? `Prorrogação proposta para ${command.date}. Justificativa declarada: ${reason}. Prazo vigente preservado.`
          : "Informe somente a justificativa que falta. Prazo vigente preservado.",
      );
      verification = "DECLARADO";
      break;
    }
    case "COMPLETE_REQUEST": {
      editable(s);
      executor(s, actor);
      const r = s.requests.find(
        (r) => r.id === command.requestId && r.status === "INCOMPLETA",
      );
      assert(r, "REQUEST", "Pedido incompleto não encontrado.");
      assert(reason, "REASON", "Informe a justificativa.");
      r.reason = reason;
      r.status = "AGUARDANDO_GESTOR";
      r.expectedVersion = s.version + 1;
      out(
        m,
        "MANAGER_APPROVAL_V1",
        `Pedido ${r.type}. Nova data: ${r.date || "Não informada"}. Justificativa declarada: ${reason}.`,
      );
      verification = "DECLARADO";
      break;
    }
    case "TRANSFER":
    case "SUPPORT": {
      editable(s);
      executor(s, actor);
      assert(
        activeAssignment(s)?.personId === actor.id,
        "FORBIDDEN",
        "Somente o responsável atual pode propor alterações na execução.",
        403,
      );
      assert(
        s.status === "EM_EXECUCAO",
        "STATE",
        "Esta ação exige demanda em execução.",
      );
      assert(reason, "REASON", "Informe a justificativa.");
      const p = people.find(
        (p) =>
          p.id === command.personId &&
          p.active &&
          p.roles.includes("EXECUTOR") &&
          p.department,
      );
      assert(
        p && p.id !== actor.id,
        "PERSON",
        "Novo executor deve estar identificado no cadastro.",
      );
      request(command.type === "TRANSFER" ? "TRANSFERENCIA" : "APOIO", {
        personId: p.id,
      });
      out(
        m,
        "MANAGER_APPROVAL_V1",
        `${command.type === "TRANSFER" ? "Transferência" : "Apoio"} proposto para ${p.name}. Motivo declarado: ${reason}. Responsabilidade atual preservada.`,
      );
      verification = "DECLARADO";
      break;
    }
    case "DECIDE": {
      manager(s, actor);
      const r = s.requests.find((r) => r.id === command.requestId);
      assert(
        r && ["AGUARDANDO_GESTOR", "AGUARDANDO_CONDICOES"].includes(r.status),
        "REQUEST",
        "Solicitação já decidida ou inexistente.",
        409,
      );
      assert(
        r.expectedVersion === s.version,
        "STALE_APPROVAL",
        "A proposta está obsoleta; revise o estado e renove a solicitação.",
        409,
      );
      assert(
        ["APPROVE", "CONDITIONAL", "REJECT", "CLARIFY", "OTHER"].includes(
          command.decision || "",
        ),
        "DECISION",
        "Decisão inválida.",
      );
      if (command.decision === "CONDITIONAL") {
        assert(
          command.conditions?.trim(),
          "CONDITIONS",
          "Descreva as ressalvas e sua aplicabilidade.",
        );
        r.conditions = command.conditions!.trim();
        r.status = "AGUARDANDO_CONDICOES";
        r.expectedVersion = s.version + 1;
        out(
          m,
          "MANAGER_APPROVAL_V1",
          "Ressalvas registradas. Confirme expressamente, em nova decisão, quando as condições permitirem efetivar a mudança.",
        );
        break;
      }
      if (command.decision === "CLARIFY" || command.decision === "OTHER") {
        assert(reason, "REASON", "Informe o esclarecimento ou a providência.");
        r.status = "INCOMPLETA";
        out(
          people.find((p) => p.id === activeAssignment(s)?.personId) || m,
          "ASK_EXTENSION_REASON_V1",
          reason,
        );
        break;
      }
      r.status = command.decision === "REJECT" ? "INDEFERIDA" : "APROVADA";
      r.decidedBy = actor.id;
      r.decidedAt = at;
      const a = activeAssignment(s);
      if (r.status === "APROVADA") {
        if (r.type === "PRORROGACAO") {
          assert(
            a && a.status === "ATIVA" && r.date,
            "STATE",
            "Atribuição não está ativa.",
          );
          a.due = r.date;
          a.dueRevision++;
          a.reminderDate = reminderDate(r.date);
          a.reminderSent = a.reminderDate <= localDate(at);
          out(
            people.find((p) => p.id === a.personId)!,
            "REMINDER_V1",
            `Prorrogação autorizada para ${r.date}. Prazo original preservado: ${a.originalDue}.`,
          );
        }
        if (r.type === "TRANSFERENCIA") {
          const p = people.find(
            (p) => p.id === r.personId && p.active && p.department,
          );
          assert(p, "PERSON", "Pessoa não está ativa no cadastro.");
          assert(
            !s.assignments.some((a) => a.status === "AGUARDANDO_ACEITE"),
            "PENDING",
            "Há um aceite pendente.",
          );
          s.assignments.push({
            id: crypto.randomUUID(),
            personId: p.id,
            department: p.department!,
            status: "AGUARDANDO_ACEITE",
            originalDue: null,
            due: null,
            dueRevision: 0,
            acceptedAt: null,
            declaredAt: null,
            createdAt: at,
            reminderDate: null,
            reminderSent: false,
          });
          r.status = "AGUARDANDO_ACEITE";
          out(
            p,
            "INITIAL_DUE_REQUEST_V1",
            "Transferência aprovada, aguardando seu aceite e previsão. O responsável anterior permanece até lá.",
          );
        }
        if (r.type === "CONCLUSAO") {
          assert(
            s.status === "AGUARDANDO_VALIDACAO",
            "STATE",
            "É necessária declaração de conclusão antes de encerrar.",
          );
          s.status = "ENCERRADA";
          s.closedAt = at;
          s.closedBy = actor.id;
          s.assignments
            .filter((a) => a.status === "CONCLUSA_DECLARADA")
            .forEach((a) => (a.status = "VALIDADA"));
          out(
            m,
            null,
            "Encerramento definitivo autorizado expressamente pelo gestor.",
          );
        }
        if (r.type === "DEMANDA_FILHA") {
          assert(
            command.childId && command.childCode && r.title,
            "CHILD",
            "Identificação da demanda filha ausente.",
          );
          const child = createAggregate(
            command.childId,
            command.childCode,
            r.title,
            r.reason,
            s.managerId,
            at,
            s.id,
          );
          child.version = 1;
          mail(
            child,
            m,
            "ASK_MANUEL_IDENTITY_V1",
            "Demanda filha criada sem executor, seção, prioridade ou prazo presumidos.",
            at,
            `${command.id}:child`,
            hosts,
          );
          s.childIds.push(child.id);
          children.push(child);
        }
      } else if (r.type === "CONCLUSAO") {
        s.status = "EM_EXECUCAO";
        s.validationAt = null;
        if (a?.status === "CONCLUSA_DECLARADA") {
          a.status = "ATIVA";
          a.declaredAt = null;
        }
      }
      if (
        ["CONCLUSAO", "DEMANDA_FILHA"].includes(r.type) &&
        ["APROVADA", "INDEFERIDA"].includes(r.status)
      )
        s.requests
          .filter(
            (other) =>
              other.id !== r.id &&
              other.createdAt === r.createdAt &&
              other.expectedVersion === original.version &&
              other.status === "AGUARDANDO_GESTOR" &&
              ["CONCLUSAO", "DEMANDA_FILHA"].includes(other.type),
          )
          .forEach((other) => (other.expectedVersion = s.version + 1));
      break;
    }
    case "DECLARE": {
      editable(s);
      executor(s, actor);
      assert(
        s.status === "EM_EXECUCAO",
        "STATE",
        "Só é possível declarar conclusão de demanda em execução.",
      );
      assert(reason, "RESULT", "Descreva o resultado e a documentação.");
      const a = activeAssignment(s);
      assert(
        a && a.personId === actor.id && a.status === "ATIVA",
        "STATE",
        "Atribuição não está ativa.",
      );
      a.status = "CONCLUSA_DECLARADA";
      a.declaredAt = at;
      s.status = "AGUARDANDO_VALIDACAO";
      s.validationAt = at;
      s.requests
        .filter((r) =>
          ["INCOMPLETA", "AGUARDANDO_GESTOR", "AGUARDANDO_CONDICOES"].includes(
            r.status,
          ),
        )
        .forEach((r) => (r.status = "OBSOLETA"));
      request("CONCLUSAO");
      if (command.createChild) {
        assert(
          command.title?.trim(),
          "CHILD_TITLE",
          "Informe o objeto da nova demanda.",
        );
        request("DEMANDA_FILHA", { title: command.title!, reason });
      }
      out(
        command.createChild ? actor : m,
        command.createChild ? "DOCUMENTATION_V1" : "MANAGER_APPROVAL_V1",
        `Conclusão DECLARADA, sem verificação externa: ${reason}. O encerramento depende de ato separado do gestor.`,
      );
      verification = "DECLARADO";
      break;
    }
    case "DOCUMENT": {
      executor(s, actor);
      assert(
        s.status === "AGUARDANDO_VALIDACAO" &&
          s.activeMenus[actor.id] === "DOCUMENTATION_V1",
        "MENU",
        "Confirmação documental fora do contexto.",
      );
      s.requests
        .filter((r) => r.status === "AGUARDANDO_GESTOR")
        .forEach((r) => (r.expectedVersion = s.version + 1));
      out(
        m,
        "MANAGER_DOUBLE_DECISION_V1",
        "Relatório, fotos e juntada declarados; não verificados. Chamado de reparo ainda não aberto. Decida A e B independentemente.",
      );
      verification = "DECLARADO";
      break;
    }
    case "PRIORITY": {
      editable(s);
      manager(s, actor);
      assert(
        ["BAIXA", "MEDIA", "ALTA"].includes(command.priority || "") && reason,
        "PRIORITY",
        "Escolha Baixa, Média ou Alta e informe motivo.",
      );
      s.priority = command.priority as Priority;
      break;
    }
    case "PROCESS": {
      editable(s);
      manager(s, actor);
      assert(reason, "REASON", "Informe o motivo.");
      if (command.processUrl) {
        const url = safeSei(command.processUrl, hosts);
        assert(
          url,
          "SEI_URL",
          "Use URL HTTPS em domínio SEI autorizado, sem credenciais nem redirecionamento.",
        );
        s.processUrl = url;
      } else s.processUrl = null;
      if (command.processReference !== undefined)
        s.processReference = command.processReference.slice(0, 120);
      break;
    }
    case "BLOCK": {
      editable(s);
      executor(s, actor);
      assert(
        activeAssignment(s)?.personId === actor.id,
        "FORBIDDEN",
        "Somente o responsável atual pode alterar impedimentos.",
        403,
      );
      assert(reason, "REASON", "Descreva o impedimento.");
      s.blockedAt ||= at;
      verification = "DECLARADO";
      out(
        m,
        "MANAGER_APPROVAL_V1",
        `Impedimento declarado: ${reason}. Nenhuma alteração de prazo foi autorizada.`,
      );
      break;
    }
    case "UNBLOCK": {
      editable(s);
      executor(s, actor);
      assert(
        activeAssignment(s)?.personId === actor.id,
        "FORBIDDEN",
        "Somente o responsável atual pode alterar impedimentos.",
        403,
      );
      assert(
        reason && s.blockedAt,
        "REASON",
        "Informe o resultado do impedimento.",
      );
      s.waitDays += Math.max(0, days(localDate(s.blockedAt!), localDate(at)));
      s.blockedAt = null;
      verification = "DECLARADO";
      break;
    }
    case "TIME": {
      executor(s, actor);
      assert(
        activeAssignment(s)?.personId === actor.id,
        "FORBIDDEN",
        "O apontamento exige atribuição efetiva.",
        403,
      );
      assert(
        Number.isInteger(command.minutes) &&
          command.minutes! > 0 &&
          command.minutes! <= 1440 &&
          reason,
        "MINUTES",
        "Informe 1 a 1440 minutos e descrição do trabalho declarado.",
      );
      s.workMinutes = (s.workMinutes ?? 0) + command.minutes!;
      verification = "DECLARADO";
      break;
    }
    case "ARCHIVE":
    case "CANCEL": {
      editable(s);
      manager(s, actor);
      assert(reason, "REASON", "Justificativa obrigatória.");
      if (command.type === "ARCHIVE")
        assert(
          ["NOVA_TRIAGEM", "AGUARDANDO_ATRIBUICAO"].includes(s.status),
          "STATE",
          "Arquivamento informativo restrito à triagem.",
        );
      s.status =
        command.type === "ARCHIVE" ? "ARQUIVADA_SEM_DEMANDA" : "CANCELADA";
      s.assignments
        .filter((a) => a.status === "AGUARDANDO_ACEITE")
        .forEach((a) => (a.status = "RECUSADA"));
      break;
    }
    case "CLARIFY": {
      editable(s);
      executor(s, actor);
      s.clarifications++;
      out(
        s.clarifications >= 2 ? m : actor,
        "ASK_TRANSFER_SCOPE_V1",
        s.clarifications >= 2
          ? "Esclarecimentos não resolvidos: intervenção do gestor necessária."
          : "Esclareça se deseja apoio, transferência ou uma nova demanda. Informe data e motivo quando cabível.",
      );
      break;
    }
    case "REMIND": {
      assert(
        actor.id === "system",
        "FORBIDDEN",
        "Rotina exclusiva do sistema.",
        403,
      );
      const a = activeAssignment(s);
      assert(
        a &&
          a.status === "ATIVA" &&
          s.status === "EM_EXECUCAO" &&
          !a.reminderSent &&
          a.reminderDate &&
          a.reminderDate <= localDate(at),
        "NOT_DUE",
        "Lembrete não devido.",
        409,
      );
      a.reminderSent = true;
      out(
        people.find((p) => p.id === a.personId)!,
        "REMINDER_V1",
        "Acompanhamento preventivo D-2.",
      );
      break;
    }
    default:
      throw new DomainError("COMMAND", "Ação desconhecida.");
  }
  s.version++;
  s.updatedAt = at;
  s.events.push({
    id: command.id,
    type: command.type,
    actorId: actor.id,
    at,
    before,
    after: structuredClone({
      ...(command.type === "UPDATE_METADATA"
        ? {
            title: s.title,
            description: s.description,
            processReference: s.processReference,
          }
        : {}),
      status: s.status,
      priority: s.priority,
      department: s.department,
      assignment: activeAssignment(s),
      processUrl: s.processUrl,
      requests: s.requests,
    }),
    verification,
    origin: command.origin || "DASHBOARD",
    reason: reason || command.text || "Ato registrado com controle de estado.",
  });
  return { state: s, children };
}
