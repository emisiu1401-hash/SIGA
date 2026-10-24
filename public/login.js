const $ = (s) => document.querySelector(s);
let mode = "login",
  resetToken = "",
  csrf = "";
const query = new URLSearchParams(location.search),
  hash = new URLSearchParams(location.hash.slice(1));
if (hash.has("reset")) {
  resetToken = hash.get("reset");
  history.replaceState(null, "", "/login");
  mode = "reset";
} else if (query.has("change")) mode = "change";
function render() {
  const changing = ["change", "reset"].includes(mode),
    forgot = mode === "forgot";
  $("#auth-title").textContent = {
    login: "Bem-vindo ao SIGA",
    forgot: "Recuperar acesso",
    reset: "Defina uma nova senha",
    change: "Troque sua senha",
  }[mode];
  $("#auth-description").textContent = {
    login: "Entre com seu usuário ou e-mail e sua senha.",
    forgot:
      "Enviaremos um link de uso único para o e-mail cadastrado, se houver acesso habilitado.",
    reset: "O link vale por 15 minutos e só pode ser usado uma vez.",
    change:
      "No primeiro acesso, substitua a senha temporária por uma senha pessoal.",
  }[mode];
  $("#account-field").hidden = changing;
  $("#account-field input").disabled = changing;
  $("#current-field").hidden = forgot || mode === "reset";
  $("#current-field input").disabled = forgot || mode === "reset";
  $("#current-field").firstChild.textContent =
    mode === "change" ? "Senha atual" : "Senha";
  for (const id of ["new", "confirm"]) {
    $("#" + id + "-field").hidden = !changing;
    $("#" + id + "-field input").disabled = !changing;
    $("#" + id + "-field input").required = changing;
  }
  $("#password-help").hidden = !changing;
  $("#auth-submit").textContent = {
    login: "Entrar",
    forgot: "Enviar instruções",
    reset: "Redefinir senha",
    change: "Salvar nova senha",
  }[mode];
  $("#auth-forgot").hidden = mode !== "login";
  $("#auth-back").hidden = mode === "login";
  $("#auth-message").textContent = "";
}
async function call(path, body) {
  const response = await fetch("/api" + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      },
      body: JSON.stringify(body),
    }),
    r = await response.json();
  if (!response.ok) throw Error(r.message || "Não foi possível concluir.");
  return r;
}
$("#auth-forgot").onclick = () => {
  mode = "forgot";
  render();
};
$("#auth-back").onclick = () => {
  mode = "login";
  resetToken = "";
  history.replaceState(null, "", "/login");
  render();
};
$("#auth-form").onsubmit = async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  $("#auth-submit").disabled = true;
  const input = Object.fromEntries(new FormData(e.currentTarget));
  try {
    if (
      ["change", "reset"].includes(mode) &&
      input.newPassword !== input.confirm
    )
      throw Error("As duas novas senhas devem ser iguais.");
    if (mode === "login") {
      const r = await call("/login", {
        account: input.account,
        password: input.password,
      });
      form.reset();
      location.assign(r.mustChangePassword ? "/login?change=1" : "/");
      return;
    }
    const result = await call(
      mode === "forgot"
        ? "/auth/forgot"
        : mode === "reset"
          ? "/auth/reset"
          : "/auth/change",
      mode === "forgot"
        ? { account: input.account }
        : mode === "reset"
          ? { token: resetToken, newPassword: input.newPassword }
          : { currentPassword: input.password, newPassword: input.newPassword },
    );
    form.reset();
    const previous = mode;
    if (previous !== "forgot") {
      mode = "login";
      resetToken = "";
      history.replaceState(null, "", "/login");
      render();
    }
    $("#auth-message").textContent = result.message;
  } catch (error) {
    $("#auth-message").textContent = error.message;
  } finally {
    $("#auth-submit").disabled = false;
  }
};
render();
window.addEventListener("hashchange", () => {
  const fragment = new URLSearchParams(location.hash.slice(1));
  if (fragment.has("reset")) {
    resetToken = fragment.get("reset");
    history.replaceState(null, "", "/login");
    mode = "reset";
    $("#auth-form").reset();
    render();
  }
});
if (mode === "change") $("#auth-submit").disabled = true;
try {
  const response = await fetch("/api/auth/meta");
  if (response.ok) {
    const meta = await response.json();
    if (meta.email)
      $("#access-identity").textContent =
        "Identidade verificada: " + meta.email;
  }
} catch {
  $("#auth-message").textContent =
    "Não foi possível verificar a conexão. Atualize a página.";
}
if (mode === "change") {
  try {
    const response = await fetch("/api/session");
    if (!response.ok) throw Error();
    const session = await response.json();
    csrf = session.csrf;
  } catch {
    mode = "login";
    render();
    $("#auth-message").textContent = "Entre primeiro para trocar sua senha.";
  }
  $("#auth-submit").disabled = false;
}
