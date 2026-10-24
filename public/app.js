const $ = (s, root = document) => root.querySelector(s),
  $$ = (s, root = document) => [...root.querySelectorAll(s)];
const e = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const states = {
  NOVA_TRIAGEM: "Nova triagem",
  AGUARDANDO_ATRIBUICAO: "Aguardando atribuição",
  EM_EXECUCAO: "Em execução",
  AGUARDANDO_VALIDACAO: "Aguardando validação",
  ENCERRADA: "Encerrada",
  ARQUIVADA_SEM_DEMANDA: "Arquivada",
  CANCELADA: "Cancelada",
};
const priorities = { ALTA: "Alta", MEDIA: "Média", BAIXA: "Baixa" };
const eventNames = {
  CREATE: "Demanda provisória registrada",
  ASSIGN: "Atribuição proposta pelo gestor",
  ACCEPT: "Aceite e prazo inicial registrados",
  EXTENSION: "Prorrogação solicitada",
  COMPLETE_REQUEST: "Justificativa complementada",
  DECIDE: "Decisão expressa do gestor",
  DECLARE: "Conclusão declarada pelo executor",
  DOCUMENT: "Documentação declarada",
  PRIORITY: "Prioridade alterada",
  UPDATE_METADATA: "Informações atualizadas por planilha",
  PROCESS: "Referência de processo atualizada",
  TRANSFER: "Transferência solicitada",
  SUPPORT: "Apoio solicitado",
  TIME: "Tempo de trabalho declarado",
  BLOCK: "Impedimento declarado",
  UNBLOCK: "Impedimento superado",
  REMIND: "Lembrete D-2 registrado",
  CLARIFY: "Esclarecimento solicitado",
  ARCHIVE: "Mensagem arquivada",
  CANCEL: "Demanda cancelada",
};
const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: value.length === 10 ? "UTC" : "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(value.length === 10 ? value + "T12:00:00Z" : value))
    : "Sem prazo";
const formatTime = (value) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "Não realizada";
let context = {
    actor: { roles: ["SDG_LEITOR"] },
    authenticated: false,
    csrf: "",
  },
  directory = { people: [], departments: [] },
  data,
  view = "dashboard",
  page = 1,
  shortcut = "",
  age = "",
  requestSequence = 0,
  opener,
  detailState,
  toastTimer;
const filters = $("#filters"),
  dialog = $("#dialog");
async function api(path, options = {}) {
  const { method = "GET", body } = options;
  const r = await fetch("/api" + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" ? { "X-CSRF-Token": context.csrf } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await r.json();
  if (r.status === 401 && (path === "/session" || context.passwordLogin))
    location.assign("/login");
  if (!r.ok)
    throw new Error(result.message || "Não foi possível completar a ação.");
  return result;
}
async function downloadFile(path, fallback) {
  const response = await fetch(path);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Falha no download.");
  }
  const blob = await response.blob(),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download =
    response.headers
      .get("Content-Disposition")
      ?.match(/filename="([\w.-]+)"/)?.[1] || fallback;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
let auditQuery = new URLSearchParams();
async function showAccess(target) {
  const result = await api("/auth/accounts");
  target.innerHTML = `<section class="operation-panel"><h2>Usuários e acessos</h2><p>1. Cadastre a pessoa com o e-mail real e o perfil. 2. Habilite a conta abaixo. 3. Autorize o mesmo e-mail no Cloudflare Access. A senha temporária aparece uma única vez e deve ser trocada no primeiro acesso.</p><p class="subtext">Executor atua nas suas atribuições. SDG consulta. Gestor administra demandas; somente Emerson encerra definitivamente. Administrador gerencia cadastros e acessos.</p><button id="access-add-person" class="spaced">Cadastrar pessoa e perfil</button><form id="access-form" class="detail-form"><label>Pessoa cadastrada<select name="userId" required><option value="">Selecione</option>${directory.people
    .filter((p) => p.active)
    .map(
      (p) =>
        `<option value="${e(p.id)}">${e(p.name)} · ${e(p.roles.join(", "))}</option>`,
    )
    .join(
      "",
    )}</select></label><label>Nome de usuário<input name="username" required minlength="3" maxlength="60" pattern="[a-z0-9][a-z0-9._-]{2,59}" autocomplete="off" placeholder="Ex.: nome.sobrenome"></label><p class="subtext">Reemitir a senha encerra as sessões e invalida links antigos da pessoa. A senha anterior deixa de funcionar.</p><button type="submit" class="primary">Habilitar acesso / emitir senha temporária</button></form><div id="access-result" role="status"></div><h3 class="spaced">Contas habilitadas</h3>${result.accounts.map((a) => `<div class="mail-item"><strong>${e(a.full_name)} · ${e(a.username)}</strong><p>${e(a.email)} · ${a.enabled && a.active ? "Habilitado" : "Desabilitado"} · ${a.must_change ? "Troca inicial obrigatória" : "Senha pessoal definida"}</p><p class="subtext">${result.accessEmails.includes(a.email.toLowerCase()) ? "E-mail incluído na lista de acesso da aplicação; a política Cloudflare também precisa autorizar." : "Aguardando inclusão do e-mail no Cloudflare Access e na lista autorizada da aplicação."}</p>${a.user_id !== "u-gestor" && a.user_id !== context.actor.id && a.enabled ? `<button data-disable-access="${e(a.user_id)}">Desabilitar acesso</button>` : ""}</div>`).join("") || "<p>Nenhuma conta com senha habilitada.</p>"}</section>`;
  $("#access-add-person").onclick = () => personForm();
  $("#access-form").onsubmit = async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const button = ev.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const input = Object.fromEntries(new FormData(ev.currentTarget)),
        r = await api("/auth/accounts", { method: "POST", body: input });
      $("#access-result").innerHTML =
        `<p class="spaced">Guarde e entregue a credencial por canal restrito. Ela não será exibida novamente após sair desta tela.</p><pre class="temporary-access">Usuário: ${e(r.username)}\nSenha temporária: ${e(r.temporaryPassword)}\nE-mail vinculado: ${e(r.email)}</pre><p>A troca será obrigatória no primeiro acesso. A identidade Cloudflare precisa corresponder ao e-mail cadastrado.</p>`;
      form.reset();
    } catch (error) {
      $("#access-result").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
  $$("[data-disable-access]").forEach(
    (button) =>
      (button.onclick = async () => {
        button.disabled = true;
        try {
          await api("/auth/accounts/disable", {
            method: "POST",
            body: { userId: button.dataset.disableAccess },
          });
          await loadOperation();
          toast("Acesso desabilitado e sessões encerradas.");
        } catch (error) {
          toast(error.message);
          button.disabled = false;
        }
      }),
  );
}
async function showAudit(target) {
  const r = await api("/audit/log?" + auditQuery);
  target.innerHTML = `<section class="operation-panel"><h2>Log detalhado</h2><p>Horários em São Paulo; instante UTC e identificador da requisição nos detalhes. Registros preservados sem edição pelo aplicativo.</p><form id="audit-filter" class="detail-form"><label>Usuário<select name="actor"><option value="">Todos</option>${directory.people.map((p) => `<option value="${e(p.id)}" ${auditQuery.get("actor") === p.id ? "selected" : ""}>${e(p.name)}</option>`).join("")}</select></label><label>Ação<input name="action" maxlength="100" value="${e(auditQuery.get("action") || "")}" placeholder="Ex.: SPREADSHEET_APPLIED"></label><label>Resultado<select name="outcome"><option value="">Todos</option><option ${auditQuery.get("outcome") === "SUCESSO" ? "selected" : ""}>SUCESSO</option><option ${auditQuery.get("outcome") === "NEGADO" ? "selected" : ""}>NEGADO</option></select></label><label>Desde (São Paulo)<input type="datetime-local" name="from" value="${e(auditQuery.get("from") ? new Date(new Date(auditQuery.get("from")).getTime() - 10800000).toISOString().slice(0, 16) : "")}"></label><label>Até (São Paulo)<input type="datetime-local" name="to" value="${e(auditQuery.get("to") ? new Date(new Date(auditQuery.get("to")).getTime() - 10800000).toISOString().slice(0, 16) : "")}"></label><button type="submit">Filtrar log</button></form><button id="audit-download" class="spaced">Baixar arquivo de log (.jsonl)</button><p class="subtext">${r.total} registro(s). Exportação limitada a 5.000 por recorte; o arquivo informa eventual truncamento.</p><div id="audit-entries">${r.entries.map((ev) => `<details class="mail-item"><summary><strong>${e(ev.action)}</strong> · ${e(ev.outcome)}<span class="subtext">${e(ev.actor_name)} · ${e(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "medium" }).format(new Date(ev.occurred_at)))}</span></summary><p>Usuário: ${e(ev.actor_id || "não autenticado")} · ${e(ev.roles.join(", "))}</p><p>UTC: ${e(ev.occurred_at)} · Origem: ${e(ev.source)}</p><p>Recurso: ${e(ev.resource)} · HTTP: ${e(ev.http_status || "—")} · ${e(ev.duration_ms ?? "—")} ms</p><p>Requisição: ${e(ev.request_id)}</p><pre>${e(JSON.stringify(ev.details, null, 2))}</pre></details>`).join("") || "<p>Nenhum registro neste recorte.</p>"}</div><div class="audit-pages"><button id="audit-prev" ${r.page <= 1 ? "disabled" : ""}>Anterior</button><span>Página ${r.page} de ${Math.max(1, Math.ceil(r.total / r.size))}</span><button id="audit-next" ${r.page * r.size >= r.total ? "disabled" : ""}>Próxima</button></div></section>`;
  $("#audit-filter").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    auditQuery = new URLSearchParams();
    for (const [k, v] of new FormData(ev.currentTarget)) {
      if (v)
        auditQuery.set(
          k,
          ["from", "to"].includes(k)
            ? new Date(v + ":00-03:00").toISOString()
            : v,
        );
    }
    await loadOperation();
  });
  $("#audit-download").onclick = () =>
    downloadFile("/api/audit/export?" + auditQuery, "siga-log.jsonl").catch(
      (error) => toast(error.message),
    );
  for (const [id, delta] of [
    ["audit-prev", -1],
    ["audit-next", 1],
  ])
    $("#" + id).onclick = async () => {
      auditQuery.set("page", String(r.page + delta));
      await loadOperation();
    };
}
function showSheets(target) {
  target.innerHTML = `<section class="operation-panel"><h2>Atualizar por Excel</h2><p>Exporte os registros atuais, edite a planilha e valide o arquivo. A confirmação aplica o lote inteiro e registra a auditoria.</p><p>Nas demandas, edite título, descrição, prioridade e processo. Prazos, responsáveis e encerramento seguem seus fluxos no painel.</p><p class="subtext">Até 5 MB, 1.000 linhas e 100 alterações por confirmação. Prévia válida por 15 minutos. Somente arquivos .xlsx sem fórmulas ou macros.</p><form id="sheet-form" class="detail-form"><label>Dados para atualizar<select name="kind"><option value="demands">Demandas</option><option value="people">Pessoas</option></select></label><div class="sheet-actions"><button type="button" id="sheet-template">Baixar template vazio</button><button type="button" id="sheet-export">Exportar dados atuais</button></div><label>Arquivo Excel<input name="file" type="file" accept=".xlsx" required></label><button type="submit" class="primary">Validar e mostrar prévia</button></form><div id="sheet-preview" role="status" aria-live="polite"></div></section>`;
  const form = $("#sheet-form");
  $("#sheet-template").onclick = () =>
    downloadFile(
      "/SIGA-modelo-atualizacao.xlsx",
      "SIGA-modelo-atualizacao.xlsx",
    ).catch((error) => toast(error.message));
  $("#sheet-export").onclick = () =>
    downloadFile(
      "/api/spreadsheets/export?kind=" + form.elements.kind.value,
      "siga.xlsx",
    ).catch((error) => toast(error.message));
  form.addEventListener("change", () => {
    $("#sheet-preview").replaceChildren();
  });
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const button = form.querySelector('[type="submit"]'),
      file = form.elements.file.files[0],
      result = $("#sheet-preview");
    button.disabled = true;
    result.textContent = "Validando arquivo…";
    try {
      if (!file || file.size > 5000000)
        throw new Error("Escolha um arquivo .xlsx de até 5 MB.");
      const response = await fetch(
        "/api/spreadsheets/preview?kind=" + form.elements.kind.value,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "X-CSRF-Token": context.csrf,
          },
          body: file,
        },
      );
      const r = await response.json();
      if (!response.ok) throw new Error(r.message);
      result.innerHTML = `<h3 class="spaced">Prévia da atualização</h3><p>${r.rows} linha(s), ${r.changes} alteração(ões), ${r.unchanged} sem mudança. ${r.errorCount} erro(s).</p>${r.errors.map((x) => `<p class="sheet-error">Linha ${x.row}: ${e(x.message)}</p>`).join("")}${r.errorCount ? "<p>Corrija o arquivo e valide novamente. Nenhuma alteração foi aplicada.</p>" : ""}${r.preview.map((x) => `<details class="mail-item"><summary>Linha ${x.row} · ${e(x.id)} · ${x.fields.length} campo(s)</summary>${x.changes.map((c) => `<p><strong>${e(c.field)}</strong><span class="subtext">Antes: ${e(c.before) || "vazio"}</span><span class="subtext">Depois: ${e(c.after) || "vazio"}</span></p>`).join("")}</details>`).join("")}${r.previewId ? '<button id="sheet-confirm" class="primary spaced">Confirmar alterações</button><button id="sheet-cancel" class="spaced">Descartar prévia</button>' : ""}`;
      $("#sheet-cancel")?.addEventListener("click", () => {
        result.textContent = "Prévia descartada. Nenhum dado foi alterado.";
      });
      $("#sheet-confirm")?.addEventListener("click", async (event) => {
        event.currentTarget.disabled = true;
        try {
          const applied = await api("/spreadsheets/apply", {
            method: "POST",
            body: { previewId: r.previewId },
          });
          result.textContent = `${applied.count} alteração(ões) aplicada(s) e registrada(s) no log.`;
          directory = await api("/directory");
          await load();
        } catch (error) {
          result.textContent = error.message;
        }
      });
    } catch (error) {
      result.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
}
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 5500);
}
function barSizes() {
  for (const x of $$("[data-width]"))
    x.style.width = Math.max(0, Math.min(100, Number(x.dataset.width))) + "%";
  for (const x of $$("[data-height]"))
    x.style.height =
      Math.max(8, Math.min(110, Number(x.dataset.height))) + "px";
}
function badge(priority) {
  return `<span class="badge priority-${e(priority || "NONE")}">${e(priorities[priority] || "Não definida")}</span>`;
}
function linkSei(url) {
  return url
    ? `<a class="sei-link" href="${e(url)}" target="_blank" rel="noopener noreferrer">Abrir no SEI ↗</a>`
    : '<span class="subtext">Sem link SEI</span>';
}
function showDialog(title, html, eyebrow = "SIGA / DETALHE") {
  opener = document.activeElement;
  $("#dialog-title").textContent = title;
  $("#dialog-eyebrow").textContent = eyebrow;
  $("#dialog-content").innerHTML = html;
  if (!dialog.open) dialog.showModal();
  $("#dialog-close").focus();
}
function closeDialog() {
  dialog.close();
  opener?.focus();
}
$("#dialog-close").addEventListener("click", closeDialog);
dialog.addEventListener("cancel", () => setTimeout(() => opener?.focus(), 0));
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      closeDialog();
  }
});
function drawer(open) {
  $("#sidebar").classList.toggle("open", open);
  $("#drawer-shade").hidden = !open;
  $("#menu-open").setAttribute("aria-expanded", String(open));
  if (open) {
    $("#menu-close").focus();
  } else $("#menu-open").focus();
}
$("#menu-open").addEventListener("click", () =>
  drawer(!$("#sidebar").classList.contains("open")),
);
$("#menu-close").addEventListener("click", () => drawer(false));
$("#drawer-shade").addEventListener("click", () => drawer(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && $("#sidebar").classList.contains("open"))
    drawer(false);
  if (event.key === "Tab" && $("#sidebar").classList.contains("open")) {
    const items = $$("a,button", $("#sidebar")).filter(
      (x) => x.offsetParent !== null,
    );
    const first = items[0],
      last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
$("#mobile-filters").addEventListener("click", () => {
  const open = filters.classList.toggle("open");
  $("#mobile-filters").setAttribute("aria-expanded", String(open));
  if (open) filters.scrollIntoView({ block: "nearest" });
});
$("#more-filters").addEventListener("click", () => {
  const panel = $("#advanced-filters");
  panel.hidden = !panel.hidden;
  $("#more-filters").setAttribute("aria-expanded", String(!panel.hidden));
});
function params() {
  const p = new URLSearchParams();
  for (const [k, v] of new FormData(filters)) if (v) p.set(k, v);
  if (shortcut) p.set("shortcut", shortcut);
  if (age) p.set("age", age);
  if ($("#sort").value) p.set("sort", $("#sort").value);
  p.set("page", String(page));
  p.set("size", "12");
  return p;
}
function saveUrl() {
  const p = params();
  p.delete("page");
  p.delete("size");
  history.replaceState(
    null,
    "",
    location.pathname + (p.size ? "?" + p : "") + "#" + view,
  );
  const count = [...p.keys()].filter(
    (k) => !["sort", "axis", "deadline"].includes(k),
  ).length;
  $("#mobile-filters").textContent =
    "Filtros" + (count ? " (" + count + ")" : "");
}
function personOptions() {
  const selected = $("#person").value,
    dept = $("#department").value;
  $("#person").innerHTML =
    '<option value="">Todos os servidores</option>' +
    directory.people
      .filter(
        (p) =>
          p.active &&
          p.roles.includes("EXECUTOR") &&
          (!dept || p.department === dept),
      )
      .map(
        (p) =>
          `<option value="${e(p.id)}">${e(p.name.replace(" · demonstração", ""))}</option>`,
      )
      .join("");
  if ($$("#person option").some((o) => o.value === selected))
    $("#person").value = selected;
}
filters.addEventListener("change", (event) => {
  if (event.target.name === "department") personOptions();
  page = 1;
  load();
});
let searchTimer;
filters.addEventListener("input", (event) => {
  if (event.target.name === "q") {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      page = 1;
      load();
    }, 300);
  }
});
filters.addEventListener("submit", (event) => {
  event.preventDefault();
  page = 1;
  load();
});
function clearFilters() {
  filters.reset();
  personOptions();
  shortcut = "";
  age = "";
  page = 1;
  $("#sort").value = "";
  load();
}
$("#clear-filters").addEventListener("click", clearFilters);
$("#empty-clear").addEventListener("click", clearFilters);
$("#sort").addEventListener("change", () => {
  page = 1;
  load();
});
$$("[data-shortcut]").forEach((b) =>
  b.addEventListener("click", () => {
    shortcut = b.dataset.shortcut;
    age = "";
    page = 1;
    load();
  }),
);
$("#previous").addEventListener("click", () => {
  page--;
  load();
});
$("#next").addEventListener("click", () => {
  page++;
  load();
});
$("#refresh").addEventListener("click", () => load(true));
async function load(showToast = false) {
  if (!["dashboard", "demands", "alerts", "team", "reports"].includes(view))
    return loadOperation();
  const sequence = ++requestSequence;
  saveUrl();
  $("#workspace").setAttribute("aria-busy", "true");
  try {
    const result = await api("/dashboard?" + params());
    if (sequence !== requestSequence) return;
    data = result;
    render();
    if (showToast) toast("Dados do banco atualizados.");
  } catch (error) {
    toast(error.message);
    $("#result-count").textContent =
      "Falha ao carregar. Use Atualizar dados para tentar novamente.";
  } finally {
    $("#workspace").setAttribute("aria-busy", "false");
  }
}
function selectFilter(key, value) {
  filters.elements[key].value = value;
  page = 1;
  age = "";
  if (key === "department") {
    personOptions();
  }
  load();
}
function kpiFilter(name) {
  shortcut = name === "originalRate" ? "closed" : name;
  page = 1;
  age = "";
  load();
  $("#demand-list").scrollIntoView({ block: "start" });
}
function render() {
  const k = data.kpis;
  $("#nav-count").textContent = k.active;
  $("#late-count").textContent = k.late;
  $("#data-cutoff").textContent =
    "Corte: " + formatDate(data.cutoff) + " · dias corridos";
  $("#sync-status").textContent = data.simulation
    ? "Gmail: não conectado · modo simulado"
    : "Gmail: " + formatTime(data.syncAt);
  $("#updated-status").textContent =
    "Painel atualizado: " + formatTime(data.updatedAt) + " · São Paulo";
  if (
    !data.simulation &&
    (!data.syncAt || Date.now() - Date.parse(data.syncAt) > 30 * 60000)
  ) {
    $("#notice").textContent =
      "Sincronização Gmail ausente ou defasada. O painel reflete somente os dados persistidos.";
  }
  const metrics = [
    [
      "active",
      "Demandas abertas",
      k.active,
      "Carteira atual, incluindo validação",
      "",
    ],
    [
      "late",
      "Prazos vencidos",
      k.late,
      `Maior atraso: ${k.maxLate} dias`,
      "attention",
    ],
    ["d2", "Vencem em até 2 dias", k.d2, "Hoje, amanhã e D-2", "warning"],
    [
      "high",
      "Prioridade alta",
      k.high,
      "Demandas abertas com prioridade alta",
      "attention",
    ],
    [
      "missing",
      "Sem prazo ou responsável",
      k.missing,
      "Pendências de definição",
      "warning",
    ],
    [
      "validation",
      "Aguardando validação",
      k.validation,
      "Conclusão declarada, sem encerramento",
      "",
    ],
    [
      "closed",
      "Encerradas no recorte",
      k.closed,
      "Ato definitivo do gestor",
      "success",
    ],
    [
      "originalRate",
      "No prazo original",
      k.originalRate === null ? "—" : k.originalRate + "%",
      `${k.originalDenominator} encerradas com dados elegíveis`,
      "success",
    ],
  ];
  $("#kpis").innerHTML = metrics
    .map(
      ([name, label, value, sub, style]) =>
        `<button class="kpi ${style}" data-kpi="${name}" aria-label="${e(label)}: ${value}. Ver demandas"><span class="kpi-label">${label}<span aria-hidden="true">↗</span></span><strong class="kpi-value">${value}</strong><span class="kpi-sub">${sub}</span></button>`,
    )
    .join("");
  $$("[data-kpi]").forEach((b) =>
    b.addEventListener("click", () => kpiFilter(b.dataset.kpi)),
  );
  const maxSection = Math.max(1, ...data.sections.map((s) => s.total));
  $("#section-chart").innerHTML = data.sections
    .filter((s) => s.total || s.name !== "Não classificada")
    .map(
      (s) =>
        `<button class="chart-row" data-department="${s.name === "Não classificada" ? "NONE" : s.name}" aria-label="${e(s.name)}: ${s.total} abertas, Alta ${s.high}, Média ${s.medium}, Baixa ${s.low}, Não definida ${s.undefined}"><span class="chart-label">${e(s.name)}</span><span class="chart-track">${[
          ["high", s.high],
          ["medium", s.medium],
          ["low", s.low],
          ["undefined", s.undefined],
        ]
          .map(
            ([c, n]) =>
              `<i class="${c}" data-width="${(100 * n) / maxSection}"></i>`,
          )
          .join(
            "",
          )}</span><span class="chart-value">${s.total}</span></button>`,
    )
    .join("");
  const maxAge = Math.max(1, ...data.age.map((s) => s.count));
  $("#age-chart").innerHTML = data.age
    .map(
      (s) =>
        `<button class="chart-row" data-age="${s.min}-${s.max}" aria-label="${e(s.name)}: ${s.count} demandas"><span class="chart-label">${e(s.name)}</span><span class="chart-track"><i class="bar-green" data-width="${(100 * s.count) / maxAge}"></i></span><span class="chart-value">${s.count}</span></button>`,
    )
    .join("");
  const maxPeople = Math.max(1, ...data.people.map((p) => p.active));
  $("#people-chart").innerHTML =
    data.people
      .map(
        (p) =>
          `<button class="chart-row" data-person="${e(p.id)}" aria-label="${e(p.name)}: ${p.active} ativas, ${p.late} vencidas"><span class="chart-label">${e(p.name?.replace(" · demonstração", ""))}</span><span class="chart-track"><i class="bar-green" data-width="${(100 * p.active) / maxPeople}"></i></span><span class="chart-value">${p.active}</span></button>`,
      )
      .join("") ||
    '<p class="empty-chart">Nenhuma atribuição neste recorte.</p>';
  const maxFlow = Math.max(
    1,
    ...data.series.flatMap((s) => [s.received, s.closed]),
  );
  $("#flow-chart").innerHTML =
    '<div class="flow-row">' +
    data.series
      .slice(-12)
      .map(
        (s) =>
          `<div class="flow-month"><div class="flow-bars"><button class="flow-in" data-flow="${e(s.month)}" data-height="${(110 * s.received) / maxFlow}" aria-label="${e(s.month)}: ${s.received} entradas">${s.received}</button><button class="flow-out" data-flow="${e(s.month)}" data-height="${(110 * s.closed) / maxFlow}" aria-label="${e(s.month)}: ${s.closed} encerramentos">${s.closed}</button></div><span>${e(s.month.split("-").reverse().join("/"))}</span><small>Estoque: ${s.stock}</small></div>`,
      )
      .join("") +
    "</div>";
  $("#department-cards").innerHTML = data.sections
    .filter((s) => s.name !== "Não classificada")
    .map(
      (s) =>
        `<button class="department-card" data-department="${s.name}" aria-label="Filtrar seção ${s.name}"><strong>${s.name}</strong><span class="section-total">${s.total}</span><p>${e(directory.departments.find((d) => d.code === s.name)?.name || "")}</p><dl><dt>Prioridade alta</dt><dd>${s.high}</dd><dt>Vencidas</dt><dd>${s.late}</dd><dt>Em validação</dt><dd>${s.validation}</dd><dt>Idade média</dt><dd>${s.averageAge} dias</dd><dt>Entradas / encerradas</dt><dd>${s.received} / ${s.closed}</dd></dl></button>`,
    )
    .join("");
  $$("[data-department]").forEach((b) =>
    b.addEventListener("click", () =>
      selectFilter("department", b.dataset.department),
    ),
  );
  $$("[data-person]").forEach((b) =>
    b.addEventListener("click", () => selectFilter("person", b.dataset.person)),
  );
  $$("[data-age]").forEach((b) =>
    b.addEventListener("click", () => {
      age = b.dataset.age;
      page = 1;
      load();
    }),
  );
  $$("[data-flow]").forEach((b) =>
    b.addEventListener("click", () => {
      showDialog(
        "Fluxo da coorte selecionada",
        `<p>${e(data.definitions.flow)}</p><div class="table-wrap team-table"><table><thead><tr><th>Mês</th><th>Entradas</th><th>Encerradas</th><th>Estoque da coorte</th></tr></thead><tbody>${data.series.map((s) => `<tr><td>${e(s.month)}</td><td>${s.received}</td><td>${s.closed}</td><td>${s.stock}</td></tr>`).join("")}</tbody></table></div>`,
      );
    }),
  );
  $("#result-count").textContent =
    `${data.total} demanda${data.total === 1 ? "" : "s"} no recorte selecionado`;
  $("#demand-rows").innerHTML = data.rows
    .map(
      (r) =>
        `<tr><td><button class="demand-link" data-detail="${e(r.id)}">${e(r.code)}</button><span class="demand-title">${e(r.title)}</span>${r.parentId ? '<span class="subtext">↳ Demanda filha</span>' : ""}</td><td>${e(r.department || "Não classificada")}<span class="subtext">${e(r.assignee?.replace(" · demonstração", "") || "Sem responsável")}</span></td><td>${badge(r.priority)}<span class="state">${e(states[r.status])}</span></td><td>${formatDate(r.due)}${r.revision > 1 ? '<span class="subtext">Prazo prorrogado</span>' : ""}</td><td>${r.openDays} dias</td><td class="${r.lateDays ? "late-text" : ""}">${r.lateDays ? r.lateDays + " dias" : r.status === "AGUARDANDO_VALIDACAO" ? "Em validação" : "—"}</td><td>${r.idleDays} dias<span class="subtext">${formatTime(r.updatedAt)}</span></td><td>${linkSei(r.processUrl)}</td></tr>`,
    )
    .join("");
  $("#demand-cards").innerHTML = data.rows
    .map(
      (r) =>
        `<article class="demand-card"><div class="demand-card-head"><button class="demand-link" data-detail="${e(r.id)}">${e(r.code)} ↗</button>${badge(r.priority)}</div><h3>${e(r.title)}</h3><span class="state">${e(states[r.status])}</span><dl><div><dt>Seção / responsável</dt><dd>${e(r.department || "Não classificada")} · ${e(r.assignee?.replace(" · demonstração", "") || "Sem responsável")}</dd></div><div><dt>Prazo vigente</dt><dd>${formatDate(r.due)}</dd></div><div><dt>Dias em aberto</dt><dd>${r.openDays} dias</dd></div><div><dt>Atraso de execução</dt><dd class="${r.lateDays ? "late-text" : ""}">${r.status === "AGUARDANDO_VALIDACAO" ? "Em validação" : r.lateDays + " dias"}</dd></div><div><dt>Sem atualização</dt><dd>${r.idleDays} dias</dd></div><div><dt>Última movimentação</dt><dd>${formatTime(r.updatedAt)}</dd></div></dl>${linkSei(r.processUrl)}</article>`,
    )
    .join("");
  $$("[data-detail]").forEach((b) =>
    b.addEventListener("click", () => openDemand(b.dataset.detail)),
  );
  $("#empty-state").hidden = data.total !== 0;
  $(".table-wrap").hidden = data.total === 0;
  $("#page-info").textContent = data.total
    ? `${(data.page - 1) * data.size + 1}–${Math.min(data.page * data.size, data.total)} de ${data.total}`
    : "0 resultados";
  $("#previous").disabled = data.page <= 1;
  $("#next").disabled = data.page * data.size >= data.total;
  $$("[data-shortcut]").forEach((b) => {
    b.classList.toggle("selected", b.dataset.shortcut === shortcut);
    b.setAttribute("aria-pressed", String(b.dataset.shortcut === shortcut));
  });
  renderTeam();
  renderReports();
  barSizes();
}
function renderTeam() {
  const admin = context.actor.roles.includes("ADMIN");
  $("#team-content").innerHTML =
    `<div class="operation-panel"><h2>Equipe e lotação</h2><p>Os snapshots de atribuição preservam a seção da época. Alterar a lotação atual não reescreve o histórico.</p><div class="table-wrap team-table"><table><thead><tr><th>Servidor</th><th>Seção atual</th><th>Perfis</th><th>Cadastro</th></tr></thead><tbody>${directory.people.map((p) => `<tr><td>${e(p.name)}</td><td>${e(p.department || "Não classificada")}</td><td>${e(p.roles.join(" · "))}</td><td>${p.active ? "Ativo" : "Inativo"}${admin && p.id !== "u-gestor" ? ` <button data-edit-person="${e(p.id)}">Editar</button>` : ""}</td></tr>`).join("")}</tbody></table></div>${admin ? '<div class="form-actions"><button id="import-people">Importar CSV</button><button class="primary" id="add-person">＋ Cadastrar servidor</button></div>' : ""}</div>`;
  $("#add-person")?.addEventListener("click", () => personForm());
  $("#import-people")?.addEventListener("click", importPeople);
  $$("[data-edit-person]").forEach((b) =>
    b.addEventListener("click", () =>
      personForm(directory.people.find((p) => p.id === b.dataset.editPerson)),
    ),
  );
}
function renderReports() {
  $("#reports-content").innerHTML =
    `<div class="operation-panel"><h2>Indicadores no recorte</h2><p>${e(data.definitions.rates)}</p><div class="report-grid"><div class="report-metric">Prazo original<strong>${data.kpis.originalRate === null ? "Não informado" : data.kpis.originalRate + "%"}</strong><p>${data.kpis.originalDenominator} encerradas com datas elegíveis.</p></div><div class="report-metric">Prazo vigente<strong>${data.kpis.currentRate === null ? "Não informado" : data.kpis.currentRate + "%"}</strong><p>Prazo revisado preserva a comparação original.</p></div><div class="report-metric">Horas de trabalho<strong>Por apontamento</strong><p>Consulte os lançamentos em cada demanda. Sem registro, não informado.</p></div></div><div class="table-wrap team-table"><table><thead><tr><th>Servidor / seção</th><th>Ativas</th><th>Vencidas</th><th>Altas</th><th>D-2</th><th>Sem movimento ≥7d</th><th>Encerradas</th><th>Ciclo mediano</th></tr></thead><tbody>${data.people.map((p) => `<tr><td>${e(p.name)} / ${e(p.department)}</td><td>${p.active}</td><td>${p.late}</td><td>${p.high}</td><td>${p.d2}</td><td>${p.idle}</td><td>${p.closed}</td><td>${p.medianCycle === null ? "Não informado" : p.medianCycle + " dias"}</td></tr>`).join("")}</tbody></table></div><h3 class="spaced">Distribuição por situação</h3>${data.statuses.map((s) => `<button class="chart-row" data-status-filter="${e(s.status)}"><span>${e(states[s.status])}</span><strong class="chart-value">${s.count}</strong></button>`).join("")}<p class="spaced">${e(data.definitions.flow)} ${e(data.definitions.hours)}</p></div>`;
  $$("[data-status-filter]").forEach((b) =>
    b.addEventListener("click", () => {
      view = "demands";
      location.hash = "demands";
      selectFilter("status", b.dataset.statusFilter);
    }),
  );
}
const formField = (label, name, type = "text", value = "", required = true) =>
  `<label>${label}<input name="${name}" type="${type}" value="${e(value)}" ${required ? "required" : ""}></label>`;
const reasonField =
  '<label>Justificativa / resultado<textarea name="reason" required maxlength="6000"></textarea></label>';
function actionForm(title, type, fields, extra = {}) {
  showDialog(
    title,
    `<form id="action-form" class="detail-form">${fields}<div id="form-error" class="form-error" hidden></div><div class="form-actions"><button type="button" id="action-cancel">Cancelar</button><button type="submit" class="primary">Confirmar e registrar</button></div></form>`,
    "SIGA / AÇÃO AUDITÁVEL",
  );
  $("#action-cancel").addEventListener("click", closeDialog);
  $("#action-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget,
      button = $('button[type="submit"]', form);
    button.disabled = true;
    try {
      const values = Object.fromEntries(new FormData(form));
      await api("/demands/" + detailState.id + "/actions", {
        method: "POST",
        body: {
          ...values,
          ...extra,
          type,
          id: crypto.randomUUID(),
          expectedVersion: detailState.version,
          ...(type === "TIME" ? { minutes: Number(values.minutes) } : {}),
          ...(type === "DECLARE"
            ? { createChild: values.createChild === "true" }
            : {}),
        },
      });
      closeDialog();
      toast("Ação registrada na trilha da demanda.");
      await load();
      await openDemand(detailState.id);
    } catch (error) {
      $("#form-error").textContent = error.message;
      $("#form-error").hidden = false;
    } finally {
      button.disabled = false;
    }
  });
}
async function openDemand(id) {
  try {
    const result = await api("/demands/" + encodeURIComponent(id));
    const s = result.demand;
    detailState = s;
    const a = s.assignments.findLast((a) =>
      ["ATIVA", "CONCLUSA_DECLARADA", "VALIDADA"].includes(a.status),
    );
    const person = (id) => result.people.find((p) => p.id === id)?.name || id;
    const canManage =
        context.authenticated && context.actor.roles.includes("GESTOR"),
      canExecute =
        context.authenticated &&
        s.assignments.some(
          (a) =>
            a.personId === context.actor.id &&
            ["ATIVA", "AGUARDANDO_ACEITE", "CONCLUSA_DECLARADA"].includes(
              a.status,
            ),
        );
    const final = ["ENCERRADA", "CANCELADA", "ARQUIVADA_SEM_DEMANDA"].includes(
      s.status,
    );
    const items = [
      ["Código", s.code],
      ["Situação", states[s.status]],
      ["Prioridade", priorities[s.priority] || "Não definida"],
      ["Seção atual", s.department || "Não classificada"],
      ["Responsável", a ? person(a.personId) : "Sem responsável aceito"],
      ["Prazo original", formatDate(a?.originalDue)],
      ["Prazo vigente", formatDate(a?.due)],
      ["Abertura", formatTime(s.openedAt)],
      ["Última movimentação", formatTime(s.updatedAt)],
      [
        "Tempo declarado",
        s.workMinutes === null ? "Não informado" : s.workMinutes + " minutos",
      ],
      [
        "Espera explícita",
        s.waitDays + " dias" + (s.blockedAt ? " · em impedimento" : ""),
      ],
      [
        "Referência de processo",
        s.processReference
          ? s.processReference + " · não verificada"
          : "Não informada",
      ],
    ];
    showDialog(
      s.title,
      `${badge(s.priority)}<dl class="detail-grid">${items.map(([label, value]) => `<div><dt>${label}</dt><dd>${e(value)}</dd></div>`).join("")}</dl><p class="detail-description">${e(s.description)}</p>${linkSei(s.processUrl)}${s.processUrl ? '<p class="subtext">A validação é técnica do endereço. O acesso depende das permissões do SEI.</p>' : ""}${canManage && !final ? `<div class="form-actions"><button id="assign-action">Atribuir responsável</button><button id="priority-action">Prioridade</button><button id="process-action">Processo SEI</button><button id="archive-action">${s.status === "NOVA_TRIAGEM" ? "Arquivar" : "Cancelar demanda"}</button></div>` : ""}${canExecute && !final ? '<div class="form-actions"><button id="accept-action">Aceitar / previsão</button><button id="extension-action">Pedir prorrogação</button><button id="transfer-action">Transferência / apoio</button><button id="complete-action">Declarar conclusão</button><button id="time-action">Apontar tempo</button><button id="block-action">Impedimento</button></div>' : ""}
 <section class="detail-section"><h3>Solicitações e decisões</h3>${s.requests.length ? s.requests.map((r) => `<div class="request-block"><strong>${e(r.type.replaceAll("_", " "))}</strong> <span class="badge">${e(r.status.replaceAll("_", " "))}</span><p>${e(r.reason || "Justificativa pendente")}${r.date ? " · Nova data: " + formatDate(r.date) : ""}${r.title ? " · " + e(r.title) : ""}</p>${r.conditions ? "<p>Ressalvas: " + e(r.conditions) + "</p>" : ""}${canManage && (r.type !== "CONCLUSAO" || context.actor.id === "u-gestor") && ["AGUARDANDO_GESTOR", "AGUARDANDO_CONDICOES"].includes(r.status) ? `<div class="form-actions"><button class="primary" data-decide="${e(r.id)}" data-decision="APPROVE">Autorizar sem ressalvas</button><button data-decide="${e(r.id)}" data-decision="CONDITIONAL">Com ressalvas</button><button data-decide="${e(r.id)}" data-decision="REJECT">Indeferir</button><button data-decide="${e(r.id)}" data-decision="CLARIFY">Esclarecer</button></div>` : ""}${canExecute && r.status === "INCOMPLETA" ? `<button data-complete-request="${e(r.id)}">Complementar pedido</button>` : ""}</div>`).join("") : '<p class="subtext">Nenhuma solicitação registrada.</p>'}</section>
 <section class="detail-section"><h3>Atribuições e snapshots</h3>${s.assignments.map((a) => `<p class="spaced"><strong>${e(person(a.personId))}</strong> · ${e(a.department)} · ${e(a.status.replaceAll("_", " "))}<span class="subtext">Original: ${formatDate(a.originalDue)} · vigente: ${formatDate(a.due)} · revisão ${a.dueRevision}</span></p>`).join("") || "<p>Sem atribuição confirmada.</p>"}</section><section class="detail-section"><h3>Demandas relacionadas</h3>${result.parent ? `<button class="demand-link" data-related="${e(result.parent.id)}">↑ Origem: ${e(result.parent.code)} — ${e(result.parent.title)}</button>` : ""}${result.children.map((c) => `<p><button class="demand-link" data-related="${e(c.id)}">↳ ${e(c.code)} — ${e(c.title)}</button><span class="subtext">${e(states[c.status])}</span></p>`).join("")}${!result.parent && !result.children.length ? '<p class="subtext">Sem relação pai/filha.</p>' : ""}</section><section class="detail-section"><h3>Histórico auditável</h3><ol class="timeline">${[
   ...s.events,
 ]
   .reverse()
   .map(
     (ev) =>
       `<li><strong>${e(eventNames[ev.type] || ev.type)}</strong><time>${formatTime(ev.at)} · ${e(person(ev.actorId))} · ${e(ev.origin)}</time><p>${e(ev.reason)}</p><span class="badge">${e(ev.verification)}</span></li>`,
   )
   .join("")}</ol></section>`,
      "SIGA / " + s.code,
    );
    $("#assign-action")?.addEventListener("click", () =>
      actionForm(
        "Atribuir responsável",
        "ASSIGN",
        `<label>Executor<select name="personId" required>${directory.people
          .filter((p) => p.roles.includes("EXECUTOR") && p.active)
          .map(
            (p) =>
              `<option value="${e(p.id)}">${e(p.name)} · ${e(p.department)}</option>`,
          )
          .join(
            "",
          )}</select></label><label>Prioridade definida por Emerson<select name="priority" required><option value="">Selecione</option><option value="BAIXA">Baixa</option><option value="MEDIA">Média</option><option value="ALTA">Alta</option></select></label>${formField("Prazo se o gestor assumir pessoalmente", "date", "date", "", false)}${reasonField}`,
      ),
    );
    $("#priority-action")?.addEventListener("click", () =>
      actionForm(
        "Alterar prioridade",
        "PRIORITY",
        '<label>Nova prioridade<select name="priority"><option value="BAIXA">Baixa</option><option value="MEDIA">Média</option><option value="ALTA">Alta</option></select></label>' +
          reasonField,
      ),
    );
    $("#process-action")?.addEventListener("click", () =>
      actionForm(
        "Referência e link do processo",
        "PROCESS",
        formField(
          "Referência textual (opcional)",
          "processReference",
          "text",
          s.processReference || "",
          false,
        ) +
          formField(
            "URL HTTPS do SEI (opcional)",
            "processUrl",
            "url",
            s.processUrl || "",
            false,
          ) +
          reasonField,
      ),
    );
    $("#archive-action")?.addEventListener("click", () =>
      actionForm(
        s.status === "NOVA_TRIAGEM"
          ? "Arquivar como informativa"
          : "Cancelar demanda",
        s.status === "NOVA_TRIAGEM" ? "ARCHIVE" : "CANCEL",
        reasonField,
      ),
    );
    $("#accept-action")?.addEventListener("click", () =>
      actionForm(
        "Aceite e prazo inicial",
        "ACCEPT",
        formField("Previsão de entrega", "date", "date"),
      ),
    );
    $("#extension-action")?.addEventListener("click", () =>
      actionForm(
        "Solicitar prorrogação",
        "EXTENSION",
        formField("Nova data pretendida", "date", "date") + reasonField,
      ),
    );
    $("#transfer-action")?.addEventListener("click", () => {
      actionForm(
        "Solicitar transferência ou apoio",
        "TRANSFER",
        `<label>Pessoa indicada<select name="personId">${directory.people
          .filter(
            (p) => p.roles.includes("EXECUTOR") && p.id !== context.actor.id,
          )
          .map((p) => `<option value="${e(p.id)}">${e(p.name)}</option>`)
          .join(
            "",
          )}</select></label>${reasonField}<p>O responsável e sua seção são preservados até aprovação e aceite. Para apoio, use a ação correspondente.</p>`,
      );
    });
    $("#complete-action")?.addEventListener("click", () => {
      actionForm(
        "Declarar conclusão",
        "DECLARE",
        reasonField +
          '<label>Objeto de eventual demanda filha (opcional)<input name="title" maxlength="250"></label><label><select name="createChild"><option value="">Sem nova demanda</option><option value="true">Propor demanda filha independente</option></select></label>',
      );
      const f = $("#action-form");
      f.addEventListener("submit", () => {}, { once: true });
    });
    $("#time-action")?.addEventListener("click", () =>
      actionForm(
        "Tempo de trabalho declarado",
        "TIME",
        formField("Minutos de trabalho efetivo", "minutes", "number") +
          reasonField,
      ),
    );
    $("#block-action")?.addEventListener("click", () =>
      actionForm(
        s.blockedAt ? "Impedimento superado" : "Declarar impedimento",
        s.blockedAt ? "UNBLOCK" : "BLOCK",
        reasonField,
      ),
    );
    $$("[data-decide]").forEach((b) =>
      b.addEventListener("click", () => {
        const r = s.requests.find((r) => r.id === b.dataset.decide),
          decision = b.dataset.decision;
        actionForm(
          decision === "APPROVE"
            ? r.type === "CONCLUSAO"
              ? "Autorizar encerramento definitivo"
              : "Autorizar solicitação"
            : "Decisão do gestor",
          "DECIDE",
          `<p>${e(r.type)} · ${e(r.reason)}${r.date ? " · " + formatDate(r.date) : ""}</p>${decision === "CONDITIONAL" ? '<label>Condições e aplicabilidade<textarea name="conditions" required></textarea></label>' : reasonField}`,
          { requestId: r.id, decision },
        );
      }),
    );
    $$("[data-complete-request]").forEach((b) =>
      b.addEventListener("click", () =>
        actionForm(
          "Complementar justificativa",
          "COMPLETE_REQUEST",
          reasonField,
          { requestId: b.dataset.completeRequest },
        ),
      ),
    );
    $$("[data-related]").forEach((b) =>
      b.addEventListener("click", () => openDemand(b.dataset.related)),
    );
  } catch (error) {
    toast(error.message);
  }
}
function loginDialog() {
  showDialog(
    "Entrar no SIGA",
    `<form id="login-form" class="detail-form"><p>Use as credenciais privadas entregues com a aplicação. A consulta da base fictícia é pública.</p><label>Conta<select name="account"><option value="gestor">Emerson · gestor</option><option value="executor">Gabriela · executor de demonstração</option><option value="admin">Administrador</option></select></label><label>Senha<input type="password" name="password" required autocomplete="current-password"></label><div class="form-error" id="login-error" hidden></div><button class="primary" type="submit">Entrar</button></form>`,
    "SIGA / ACESSO",
  );
  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("button", event.currentTarget);
    button.disabled = true;
    try {
      const input = Object.fromEntries(new FormData(event.currentTarget));
      await api("/login", { method: "POST", body: input });
      await initialize();
      closeDialog();
      toast("Sessão iniciada. As permissões são verificadas na API.");
    } catch (error) {
      $("#login-error").textContent = error.message;
      $("#login-error").hidden = false;
    } finally {
      button.disabled = false;
    }
  });
}
$("#login-button").addEventListener("click", () =>
  context.deployment === "demo"
    ? location.assign("https://siga-private.emisiu1401.workers.dev/login")
    : context.authenticated
      ? logout()
      : loginDialog(),
);
$("#account-button").addEventListener("click", () =>
  context.deployment === "demo"
    ? location.assign("https://siga-private.emisiu1401.workers.dev/login")
    : context.authenticated
      ? logout()
      : loginDialog(),
);
async function logout() {
  if (context.passwordLogin) {
    try {
      await api("/logout", { method: "POST", body: {} });
      location.assign("/login");
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  if (context.accessProtected) {
    location.assign("/cdn-cgi/access/logout");
    return;
  }
  try {
    await api("/logout", { method: "POST", body: {} });
    location.hash = "dashboard";
    await initialize();
    toast("Sessão encerrada.");
  } catch (error) {
    toast(error.message);
  }
}
$("#new-demand").addEventListener("click", () => {
  showDialog(
    "Nova demanda para triagem",
    `<form id="create-form" class="detail-form">${formField("Objeto da demanda", "title")}<label>Descrição<textarea name="description" required></textarea></label><p>Prioridade e responsável serão definidos por Emerson após a triagem.</p><div class="form-error" id="create-error" hidden></div><button class="primary" type="submit">Registrar demanda</button></form>`,
  );
  $("#create-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("button", event.currentTarget);
    button.disabled = true;
    try {
      const result = await api("/demands", {
        method: "POST",
        body: {
          ...Object.fromEntries(new FormData(event.currentTarget)),
          commandId: crypto.randomUUID(),
        },
      });
      closeDialog();
      await load();
      await openDemand(result.id);
    } catch (error) {
      $("#create-error").textContent = error.message;
      $("#create-error").hidden = false;
    } finally {
      button.disabled = false;
    }
  });
});
function personForm(person) {
  const p = person || {
    name: "",
    email: "",
    department: "SLC",
    roles: ["EXECUTOR"],
    active: true,
  };
  showDialog(
    person ? "Editar cadastro" : "Cadastrar servidor",
    `<form id="person-form" class="detail-form">${formField("Nome completo", "name", "text", p.name)}${formField("E-mail autorizado", "email", "email", p.email)}<label>Seção<select name="department">${["SLC", "SAP", "SME", "AE"].map((d) => `<option ${d === p.department ? "selected" : ""}>${d}</option>`).join("")}</select></label><label>Perfil<select name="role">${["EXECUTOR", "GESTOR", "SDG_LEITOR", "ADMIN"].map((r) => `<option ${p.roles.includes(r) ? "selected" : ""}>${r}</option>`).join("")}</select></label><label>Cadastro<select name="active"><option value="true">Ativo</option><option value="false" ${p.active ? "" : "selected"}>Inativo</option></select></label><p>A lotação será registrada com histórico. Os snapshots anteriores permanecem preservados.</p><button type="submit" class="primary">Salvar cadastro</button><div id="person-error" class="form-error" hidden></div></form>`,
  );
  $("#person-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const r = await api("/directory", {
        method: "POST",
        body: {
          id: p.id || crypto.randomUUID(),
          name: values.name,
          email: values.email,
          department: values.department,
          roles: [values.role],
          active: values.active === "true",
        },
      });
      if (!r.results[0].ok) throw new Error(r.results[0].error);
      directory = await api("/directory");
      closeDialog();
      personOptions();
      renderTeam();
      if (view === "access") await loadOperation();
      toast("Cadastro e histórico de lotação atualizados.");
    } catch (error) {
      $("#person-error").textContent = error.message;
      $("#person-error").hidden = false;
    }
  });
}
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const split = (line) => {
    const result = [];
    let value = "",
      quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (quoted && line[i + 1] === '"') {
          value += '"';
          i++;
        } else quoted = !quoted;
      } else if (c === "," && !quoted) {
        result.push(value.trim());
        value = "";
      } else value += c;
    }
    result.push(value.trim());
    return result;
  };
  const header = split(lines.shift()).map((h) => h.toLowerCase());
  if (!["nome", "email", "secao"].every((h) => header.includes(h)))
    throw new Error("O cabeçalho deve conter nome,email,secao.");
  return lines.filter(Boolean).map((line) => {
    const columns = split(line);
    return {
      id: crypto.randomUUID(),
      name: columns[header.indexOf("nome")],
      email: columns[header.indexOf("email")],
      department: columns[header.indexOf("secao")],
      roles: ["EXECUTOR"],
      active: true,
    };
  });
}
function importPeople() {
  showDialog(
    "Importar servidores por CSV",
    '<form id="import-form" class="detail-form"><label>CSV (até 100 registros)<textarea name="csv" required placeholder="nome,email,secao&#10;Pessoa,usuario@exemplo.test,SLC"></textarea></label><p>E-mails duplicados e seções desconhecidas são rejeitados individualmente.</p><button class="primary" type="submit">Validar e importar</button><div id="import-results"></div></form>',
  );
  $("#import-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const people = parseCsv(new FormData(event.currentTarget).get("csv"));
      const r = await api("/directory", { method: "POST", body: { people } });
      $("#import-results").innerHTML = r.results
        .map((p) => `<p>${e(p.name)}: ${p.ok ? "cadastrado" : e(p.error)}</p>`)
        .join("");
      directory = await api("/directory");
      personOptions();
      renderTeam();
    } catch (error) {
      $("#import-results").textContent = error.message;
    }
  });
}
async function loadOperation() {
  const target = $("#operation-content");
  target.setAttribute("aria-busy", "true");
  try {
    if (view === "mail") {
      const r = await api("/mail");
      target.innerHTML = `<div class="operation-panel"><h2>Caixa de saída</h2><p>Mensagens geradas pelo domínio. SIMULADO não significa enviado.</p>${r.outbox.map((m) => `<details class="mail-item"><summary><span class="badge">${e(m.status)}</span>${e(m.subject)}<span class="subtext">${formatTime(m.created_at)}</span></summary><p>Caixa: ${e(m.mailbox_email)}</p><p>Para: ${e(m.recipient_email)}</p>${m.failure_reason ? `<p>Retenção/falha: ${e(m.failure_reason)}</p>` : ""}<pre>${e(m.body_text)}</pre></details>`).join("") || "<p>Sem mensagens geradas.</p>"}</div><div class="operation-panel"><h2>Mensagens para revisão</h2><p>Entradas ambíguas, falhas de extração ou aprovações que exigem corroboração humana.</p>${r.reviews.map((m) => `<details class="mail-item"><summary>${e(m.subject || "Sem assunto")}</summary><p>Caixa: ${e(m.mailbox_email)}</p><p>${e(m.reason)}</p><pre>${e(m.fresh_text)}</pre>${context.actor.roles.includes("GESTOR") ? `<button data-triage-review="${e(m.id)}">Registrar como nova demanda para triagem</button>` : ""}</details>`).join("") || "<p>Nenhuma mensagem aguardando revisão.</p>"}</div>`;
    } else if (view === "audit") {
      await showAudit(target);
    } else if (view === "access") {
      await showAccess(target);
    } else if (view === "sheets") {
      showSheets(target);
    } else if (view === "simulator") {
      target.innerHTML = `<div class="operation-grid"><section class="operation-panel"><h2>Simular uma mensagem</h2><p>Teste a interpretação e as regras com identidades fictícias. Nenhum e-mail será enviado.</p><form class="detail-form" id="simulate-form"><label>Remetente fictício<select name="senderId">${directory.people
        .filter(
          (p) => p.roles.includes("GESTOR") || p.roles.includes("EXECUTOR"),
        )
        .map((p) => `<option value="${e(p.id)}">${e(p.name)}</option>`)
        .join(
          "",
        )}</select></label>${formField("Código da demanda (deixe vazio para uma nova)", "demandId", "text", "", false)}${formField("Assunto", "subject", "text", "", false)}<label>Texto novo da mensagem<textarea name="text" required placeholder="Ex.: Mude para 30/10 porque preciso aguardar a vistoria."></textarea></label><button type="submit" class="primary">Interpretar e processar simulação</button></form></section><section class="operation-panel"><h2>Resultado da interpretação</h2><p>O interpretador propõe intenções. As políticas determinísticas decidem quais ações são admissíveis.</p><pre class="code-block" id="simulation-result">Aguardando uma mensagem fictícia.</pre><div id="simulation-link"></div></section></div>`;
      $("#simulate-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = $("button", event.currentTarget);
        button.disabled = true;
        try {
          const input = Object.fromEntries(new FormData(event.currentTarget));
          const result = await api("/simulate", {
            method: "POST",
            body: { ...input, commandId: crypto.randomUUID() },
          });
          $("#simulation-result").textContent = JSON.stringify(result, null, 2);
          $("#simulation-link").innerHTML = result.id
            ? `<button class="secondary" id="sim-detail">Abrir demanda e histórico ↗</button>`
            : "";
          $("#sim-detail")?.addEventListener("click", () =>
            openDemand(result.id),
          );
          toast(
            result.review
              ? "Mensagem registrada na fila de revisão."
              : "Simulação processada e persistida.",
          );
        } catch (error) {
          $("#simulation-result").textContent = error.message;
        } finally {
          button.disabled = false;
        }
      });
    } else if (view === "settings") {
      const s = await api("/settings");
      target.innerHTML = `<div class="operation-grid"><section class="operation-panel"><h2>Conexões e ambiente</h2><p>Credenciais ficam no servidor. Nenhum segredo é devolvido ao navegador.</p><div class="settings-row"><span>Cloudflare Worker + D1<small>Aplicação e persistência transacional</small></span><strong>Preparado</strong></div><div class="settings-row"><span>Modo de operação<small>${s.privateEnvironment ? "Ambiente privado; integrações controladas" : "Dados fictícios e saída simulada"}</small></span><strong>${s.privateEnvironment ? "PRIVADO" : "SIMULAÇÃO"}${s.simulation ? " · integrações desativadas" : ""}</strong></div><div class="settings-row"><span>Motor de IA<small>${e(s.aiProvider)} · ${e(s.aiModel)}</small></span><strong>${s.aiConfigured ? "Token configurado" : "Aguardando token"}</strong></div><div class="settings-row"><span>Gmail API<small>OAuth próprio da aplicação</small></span><strong>${s.gmailConfigured ? "Configurado" : "Aguardando OAuth"}</strong></div><div class="settings-row"><span>Envio real de e-mails</span><strong>${s.sendEnabled ? "Habilitado" : "Desativado"}</strong></div><div class="settings-row"><span>Domínios SEI autorizados</span><strong>${e(s.seiHosts.join(", "))}</strong></div><button id="sync-gmail" class="spaced">Sincronizar Gmail</button></section><section class="operation-panel"><h2>Configurar token de IA</h2><p>Token OpenAI criptografado no servidor com chave própria. Para armazenamento direto no cofre, use o Secret AI_API_KEY da Cloudflare.</p>${context.actor.roles.includes("ADMIN") ? '<form id="ai-form" class="detail-form"><label>Token da API<input type="password" name="token" autocomplete="off" required minlength="20" maxlength="512" placeholder="Insira seu token"></label><button class="primary" type="submit">Salvar token com segurança</button><div id="ai-result" role="status"></div></form>' : "<p>Entre como administrador para configurar o token.</p>"}<p class="spaced">Em simulação, a IA permanece local. A ativação do provedor e o uso institucional devem seguir o guia de operação.</p><h3 class="spaced">Configuração do Gmail</h3><p class="spaced">A configuração inicial usa um cliente OAuth Google protegido na Cloudflare. Depois, conecte e troque a caixa pelo formulário abaixo, sem editar código. O conector desta conversa não fornece credenciais ao aplicativo.</p></section></div>`;
      const gmail = s.gmail;
      const suggestedEmail =
        gmail.email ||
        directory.people.find((p) => p.id === context.actor.id)?.email ||
        "";
      target.insertAdjacentHTML(
        "beforeend",
        `<section class="operation-panel" id="gmail-account-panel"><h2>Conta Google das comunicações</h2><p>Esta caixa recebe e envia as comunicações do SIGA. Ela é independente do e-mail usado para entrar no sistema.</p><div class="settings-row"><span>Conta conectada</span><strong class="gmail-address">${gmail.email ? e(gmail.email) : "Nenhuma conta conectada"}</strong></div><div class="settings-row"><span>Situação</span><strong>${gmail.connected ? (gmail.paused ? "Pausada após conexão" : "Conectada") : "Aguardando autorização Google"}</strong></div><p>${gmail.oauthReady ? "Informe a nova conta e autorize o acesso na página do Google. O SIGA verifica se a caixa autorizada corresponde ao endereço informado." : 'A configuração inicial da conexão Google ainda precisa ser concluída. Consulte o <a href="https://github.com/emisiu1401-hash/SIGA/blob/main/docs/17_TROCA_DE_CONTA_GMAIL.md" target="_blank" rel="noopener noreferrer">guia de conexão</a>.'}</p>${context.actor.roles.includes("ADMIN") ? `<form id="gmail-account-form" class="detail-form"><label>E-mail Google para as comunicações<input type="email" name="email" value="${e(suggestedEmail)}" required maxlength="254" autocomplete="email" placeholder="Informe a conta Google"></label><label class="gmail-option"><input type="checkbox" name="allowSend">Solicitar também permissão para envio</label><p class="subtext">A troca pausa as comunicações. Mensagens pendentes ficam retidas para revisão e não são transferidas para a nova caixa. O histórico das demandas é preservado.</p><button type="submit" class="primary" ${gmail.oauthReady ? "" : "disabled"}>Conectar ou trocar conta Google</button><div id="gmail-account-result" role="status"></div></form>` : "<p>Somente o administrador pode trocar a conta.</p>"}${gmail.connected && gmail.paused ? `<button class="spaced" id="gmail-account-activate" ${gmail.integrationsEnabled ? "" : "disabled"}>Retomar comunicações desta conta</button><p class="subtext">${gmail.integrationsEnabled ? "A retomada mantém as permissões de leitura/envio configuradas na plataforma." : "A plataforma ainda está em simulação. Leitura e envio reais dependem da ativação das integrações."}</p>` : ""}${gmail.heldMessages ? `<p>${gmail.heldMessages} mensagem(ns) retida(s) após troca de conta. Consulte Correspondência antes de qualquer reenvio.</p>` : ""}</section>`,
      );
      $("#gmail-account-form")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget,
          button = $('button[type="submit"]', form);
        button.disabled = true;
        try {
          const result = await api("/settings/gmail/connect", {
            method: "POST",
            body: {
              email: form.elements.email.value,
              allowSend: form.elements.allowSend.checked,
            },
          });
          const destination = new URL(result.authorizationUrl);
          if (destination.origin !== "https://accounts.google.com")
            throw new Error("Endereço de autorização Google inválido.");
          location.assign(destination.toString());
        } catch (error) {
          $("#gmail-account-result").textContent = error.message;
          button.disabled = false;
        }
      });
      $("#gmail-account-activate")?.addEventListener("click", async () => {
        try {
          await api("/settings/gmail/activate", {
            method: "POST",
            body: { connectionId: gmail.connectionId, version: gmail.version },
          });
          await loadOperation();
          toast("Comunicações retomadas para a conta conectada.");
        } catch (error) {
          toast(error.message);
        }
      });
      $("#ai-form")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget,
          button = $("button", form);
        button.disabled = true;
        try {
          const r = await api("/settings/ai", {
            method: "POST",
            body: Object.fromEntries(new FormData(form)),
          });
          form.reset();
          $("#ai-result").textContent = r.message;
        } catch (error) {
          $("#ai-result").textContent = error.message;
        } finally {
          button.disabled = false;
        }
      });
      $("#sync-gmail").addEventListener("click", async () => {
        try {
          const r = await api("/gmail/sync", { method: "POST", body: {} });
          toast(r.message || `${r.imported} mensagens importadas.`);
        } catch (error) {
          toast(error.message);
        }
      });
    }
    $$("[data-triage-review]").forEach((button) =>
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          const r = await api(
            "/reviews/" + button.dataset.triageReview + "/triage",
            { method: "POST", body: {} },
          );
          toast("Triagem registrada por decisão expressa do gestor.");
          await openDemand(r.id);
        } catch (error) {
          toast(error.message);
        } finally {
          button.disabled = false;
        }
      }),
    );
  } catch (error) {
    target.innerHTML = `<div class="operation-panel"><h2>Acesso indisponível</h2><p>${e(error.message)}</p></div>`;
  } finally {
    target.setAttribute("aria-busy", "false");
  }
}
const views = {
  dashboard: [
    "Painel executivo",
    "Uma visão completa das demandas, dos prazos e das pessoas.",
  ],
  demands: [
    "Demandas",
    "Consulte a carteira e acompanhe o histórico de cada atividade.",
  ],
  alerts: [
    "Prazos e alertas",
    "Identifique vencimentos, pendências e demandas sem atualização.",
  ],
  team: [
    "Equipe e seções",
    "Cadastro e distribuição das responsabilidades na DAO.",
  ],
  reports: ["Indicadores", "Prazos, fluxo e carga de trabalho com contexto."],
  mail: [
    "Correspondência",
    "Entrada em revisão e mensagens geradas pelo SIGA.",
  ],
  simulator: [
    "Simulador de e-mail",
    "Exercite o fluxo principal com mensagens fictícias.",
  ],
  sheets: [
    "Planilhas Excel",
    "Exporte, valide e confirme atualizações em lote.",
  ],
  audit: [
    "Trilha de auditoria",
    "Decisões, mudanças de estado e eventos de segurança.",
  ],
  access: [
    "Usuários e acessos",
    "Cadastre pessoas, habilite o acesso e escolha os perfis.",
  ],
  settings: [
    "Configurações",
    "Conexões, motor de IA e parâmetros de operação.",
  ],
};
function setView() {
  const next = location.hash.slice(1) || "dashboard";
  view = views[next] ? next : "dashboard";
  $$("nav a").forEach((a) =>
    a.classList.toggle("active", a.dataset.view === view),
  );
  $("#page-title").innerHTML = e(views[view][0]) + "<span>.</span>";
  $("#page-description").textContent = views[view][1];
  document.title = views[view][0] + " · SIGA";
  const operation = [
    "mail",
    "simulator",
    "audit",
    "settings",
    "sheets",
    "access",
  ].includes(view);
  $("#workspace").hidden = operation;
  $("#operation-content").hidden = !operation;
  $("#dashboard-content").hidden = !["dashboard", "reports"].includes(view);
  $("#demand-list").hidden = ["team", "reports"].includes(view);
  $("#team-content").hidden = view !== "team";
  $("#reports-content").hidden = view !== "reports";
  if (view === "alerts" && !shortcut) shortcut = "late";
  if ($("#sidebar").classList.contains("open")) drawer(false);
  page = 1;
  load();
}
window.addEventListener("hashchange", setView);
$("#definitions").addEventListener("click", () =>
  showDialog(
    "Como os indicadores são calculados",
    `<ul class="checks">${Object.values(data?.definitions || {})
      .map((d) => `<li>${e(d)}</li>`)
      .join(
        "",
      )}<li>A consulta usa a seção e o responsável atuais. Snapshots de atribuições anteriores aparecem no detalhe.</li><li>D-2 usa dias corridos e antecipa fins de semana ao dia útil anterior. Feriados dependem de calendário institucional.</li><li>Encerramento só existe após decisão expressa de Emerson; conclusão declarada é validação pendente.</li></ul>`,
    "SIGA / MÉTRICAS",
  ),
);
async function initialize() {
  try {
    context = await api("/session");
    if (context.mustChangePassword) {
      location.assign("/login?change=1");
      return;
    }
    $("#change-password-link").hidden = !context.passwordLogin;
    $("#login-button").parentElement.append($("#change-password-link"));
    const demo = context.deployment === "demo";
    const privateEnvironment = context.deployment === "private";
    $('[data-view="access"]').hidden = !context.actor.roles.includes("ADMIN");
    $('[data-view="simulator"]').hidden = privateEnvironment || demo;
    $("#login-button").hidden = false;
    $("#account-button").disabled = demo;
    if (demo)
      $("#notice").textContent =
        "Demonstração pública somente para consulta. Não cadastre dados pessoais ou credenciais aqui.";
    if (privateEnvironment) {
      $(".demo-label").textContent = "ACESSO PRIVADO";
      $(".system-state").lastChild.textContent = "Ambiente privado";
      $(".sidebar-bottom > p").textContent =
        "Acesso restrito · integrações controladas";
      $("#notice").textContent =
        "Ambiente privado. Gmail e IA só serão usados após configuração e ativação expressa.";
    }
    directory = await api("/directory");
    personOptions();
    const p = new URLSearchParams(location.search);
    for (const [key, value] of p) {
      if (filters.elements[key]) filters.elements[key].value = value;
    }
    personOptions();
    if (p.has("person")) $("#person").value = p.get("person");
    shortcut = p.get("shortcut") || "";
    age = p.get("age") || "";
    $("#sort").value = p.get("sort") || "";
    const privateAccess =
      context.authenticated &&
      (context.actor.roles.includes("GESTOR") ||
        context.actor.roles.includes("ADMIN"));
    $(".private-nav").hidden = !privateAccess;
    $("#new-demand").hidden = !context.actor.roles.includes("GESTOR");
    $("#login-button").innerHTML = context.authenticated
      ? "Sair da sessão"
      : demo
        ? "Entrar no ambiente privado ↗"
        : 'Entrar na gestão <span aria-hidden="true">↗</span>';
    $("#account-name").innerHTML = context.authenticated
      ? e(context.actor.name) +
        "<small>" +
        e(context.actor.roles.join(" · ")) +
        "</small>"
      : "Direção-Geral<small>Acesso de consulta</small>";
    setView();
    if (p.has("gmail")) {
      const result = p.get("gmail"),
        reason = p.get("reason");
      const messages = {
        MAILBOX_MISMATCH:
          "Você autorizou uma conta diferente da informada. A conta anterior foi mantida.",
        GMAIL_OAUTH_SCOPES:
          "As permissões necessárias não foram concedidas. A conta anterior foi mantida.",
        GMAIL_OAUTH_REFRESH:
          "O Google não forneceu acesso contínuo. Conecte novamente com consentimento offline.",
        GMAIL_OAUTH_STATE:
          "Autorização expirada ou já utilizada. Inicie a conexão novamente.",
        GMAIL_OAUTH_CANCELLED:
          "Conexão cancelada. A conta anterior foi mantida.",
        GMAIL_BUSY:
          "Há processamento em andamento ou a conta mudou. Atualize e conecte novamente.",
      };
      toast(
        result === "connected"
          ? "Conta Google conectada e verificada. As comunicações estão pausadas até sua retomada."
          : messages[reason] ||
              "Não foi possível conectar o Google. A conta anterior foi mantida.",
      );
      const clean = new URL(location.href);
      clean.searchParams.delete("gmail");
      clean.searchParams.delete("reason");
      history.replaceState(null, "", clean);
    }
  } catch (error) {
    toast(error.message);
    $("#result-count").textContent =
      "Aplicação indisponível. Atualize a página.";
  }
}
await initialize();
setInterval(() => {
  if (
    !document.hidden &&
    !dialog.open &&
    ["dashboard", "demands", "alerts", "reports"].includes(view)
  )
    load();
}, 60000);
