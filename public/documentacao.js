const $ = (selector) => document.querySelector(selector);
const articles = [...document.querySelectorAll("#help-articles > details")];
const normalize = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
function search() {
  const words = normalize($("#help-search").value.trim())
    .split(/\s+/)
    .filter(Boolean);
  let count = 0;
  for (const article of articles) {
    const content = normalize(
      article.textContent + " " + article.dataset.codes,
    );
    article.hidden = !words.every((word) => content.includes(word));
    if (!article.hidden) count++;
  }
  $("#help-count").textContent = `${count} orientação(ões) encontrada(s).`;
  $("#help-empty").hidden = count !== 0;
}
$("#help-search").addEventListener("input", search);
search();
const code = new URL(location.href).searchParams.get("erro");
const target = articles.find((article) =>
  article.dataset.codes.split(" ").includes(code),
);
if (target) {
  target.open = true;
  target.scrollIntoView();
}
function revealAnchor() {
  const article = articles.find((item) => "#" + item.id === location.hash);
  if (article) {
    $("#help-search").value = "";
    search();
    article.open = true;
  }
}
revealAnchor();
window.addEventListener("hashchange", revealAnchor);

let report = null;
const diagnosticButton = $("#diagnostic-refresh");
async function readJson(path) {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("SESSION");
  return response.json();
}
function values(rows) {
  const list = $("#diagnostic-values");
  list.replaceChildren();
  for (const [label, value] of rows) {
    const item = document.createElement("div"),
      term = document.createElement("dt"),
      description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    item.append(term, description);
    list.append(item);
  }
  list.hidden = false;
}
async function diagnose() {
  report = null;
  diagnosticButton.disabled = true;
  $("#diagnostic-copy").disabled = true;
  $("#copy-fallback").hidden = true;
  $("#diagnostic-report").value = "";
  $("#copy-status").textContent = "";
  $("#diagnostic-values").hidden = true;
  $("#diagnostic-next").textContent = "";
  $("#diagnostic-time").textContent = "";
  $("#diagnostic-summary").textContent = "Consultando a sessão…";
  try {
    const session = await readJson("/api/session");
    if (session.deployment === "demo") {
      $("#diagnostic-summary").textContent =
        "Demonstração pública · sem consulta ao ambiente privado";
      $("#diagnostic-next").textContent =
        "Abra este guia pelo menu Documentação do SIGA privado para consultar a sua conexão.";
      return;
    }
    if (!session.authenticated || session.mustChangePassword)
      throw new Error("SESSION");
    if (
      !session.actor?.roles?.some((role) => ["ADMIN", "GESTOR"].includes(role))
    ) {
      $("#diagnostic-summary").textContent =
        "Guia disponível · diagnóstico restrito à gestão";
      $("#diagnostic-next").textContent =
        "Somente Gestor ou ADMIN pode consultar as configurações. Peça ao administrador que confira a caixa de comunicações.";
      return;
    }
    const settings = await readJson("/api/settings"),
      gmail = settings.gmail;
    if (
      !gmail ||
      typeof gmail.connected !== "boolean" ||
      typeof settings.simulation !== "boolean"
    )
      throw new Error("RESPONSE");
    values([
      ["Ambiente", settings.privateEnvironment ? "Privado" : "Desenvolvimento"],
      [
        "Conta de comunicações",
        gmail.connected ? gmail.email || "Conectada" : "Nenhuma conectada",
      ],
      [
        "Conexão",
        gmail.connected
          ? gmail.paused
            ? "Conectada · pausada"
            : "Conectada · retomada"
          : "Aguardando conexão",
      ],
      [
        "Integrações",
        settings.simulation
          ? "Simulação · sem operação real"
          : "Modo real habilitado",
      ],
      [
        "Permissão Google de envio",
        gmail.sendAuthorized ? "Concedida" : "Não concedida nesta conexão",
      ],
      ["Envio efetivo", settings.sendEnabled ? "Habilitado" : "Desativado"],
      ["Mensagens retidas após troca", String(gmail.heldMessages || 0)],
      [
        "Motor de IA",
        settings.aiConfigured
          ? settings.simulation || settings.aiProvider === "mock"
            ? "Credencial cadastrada · em simulação"
            : "Configurado para uso real"
          : "Credencial não configurada",
      ],
    ]);
    $("#diagnostic-summary").textContent = gmail.connected
      ? "Conexão Google concluída"
      : gmail.oauthReady
        ? "Configuração OAuth presente · falta autorizar a conta"
        : "Configuração OAuth inicial pendente";
    $("#diagnostic-next").textContent = !gmail.connected
      ? "Próximo passo: Configurações → conectar conta Google. Use a configuração inicial se o formulário não aparecer."
      : settings.simulation
        ? "Próximo passo: revisar a conta e a fila. As integrações ainda estão em simulação; a ativação depende do administrador da implantação."
        : gmail.paused
          ? "Próximo passo: conferir o endereço e as mensagens retidas; depois, o administrador pode retomar em Configurações."
          : !settings.sendEnabled
            ? "A conexão foi retomada. O envio permanece desativado; confira a permissão Google e a configuração de envio antes de usar comunicações de saída."
            : "Conexão retomada e envio habilitado. Confira as entradas em Correspondência e mantenha a revisão humana.";
    const checkedAt = new Date().toISOString();
    $("#diagnostic-time").textContent =
      "Consultado em " +
      new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "medium",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(checkedAt)) +
      " (São Paulo). Reconsulte após mudanças.";
    // Allowlist deliberately excludes email, user identity, secrets and URL/query.
    report = {
      application: "SIGA",
      checkedAt,
      privateEnvironment: !!settings.privateEnvironment,
      oauthReady: !!gmail.oauthReady,
      connected: gmail.connected,
      paused: !!gmail.paused,
      simulation: settings.simulation,
      sendAuthorized: !!gmail.sendAuthorized,
      sendEnabled: !!settings.sendEnabled,
      heldMessages: Number(gmail.heldMessages) || 0,
      aiConfigured: !!settings.aiConfigured,
      aiProvider: settings.aiProvider === "openai" ? "openai" : "mock",
    };
    $("#diagnostic-copy").disabled = false;
  } catch {
    $("#diagnostic-summary").textContent =
      "Não foi possível consultar o diagnóstico desta sessão";
    $("#diagnostic-next").textContent =
      "O guia continua disponível. Entre no SIGA privado com sua própria conta e senha, volte à Documentação e atualize o diagnóstico. Se persistir, informe a etapa ao suporte.";
  } finally {
    diagnosticButton.disabled = false;
  }
}
diagnosticButton.addEventListener("click", diagnose);
$("#diagnostic-copy").addEventListener("click", async () => {
  if (!report) return;
  const text = JSON.stringify(report, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    $("#copy-status").textContent =
      "Diagnóstico copiado, sem endereço de e-mail, token ou senha.";
  } catch {
    $("#copy-fallback").hidden = false;
    $("#copy-fallback").open = true;
    $("#diagnostic-report").value = text;
    $("#diagnostic-report").focus();
    $("#diagnostic-report").select();
    $("#copy-status").textContent = "Selecione e copie o diagnóstico abaixo.";
  }
});
$("#copy-callback").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("#oauth-callback").textContent);
    $("#callback-copy-status").textContent = "Endereço copiado.";
  } catch {
    $("#callback-copy-status").textContent = "Copie o endereço exibido acima.";
  }
});
await diagnose();
if (target) {
  target.scrollIntoView({ block: "start" });
  target.querySelector("summary").focus({ preventScroll: true });
}
