// Uses the existing local Git credential helper without printing or persisting tokens.
import { execFileSync } from "node:child_process";
const raw = execFileSync("git", ["credential", "fill"], {
  input: "protocol=https\nhost=github.com\n\n",
  encoding: "utf8",
  env: { ...process.env, GCM_INTERACTIVE: "never", GIT_TERMINAL_PROMPT: "0" },
  stdio: ["pipe", "pipe", "pipe"],
});
const token = raw
  .split("\n")
  .find((x) => x.startsWith("password="))
  ?.slice(9);
if (!token) throw new Error("GitHub authentication unavailable");
const headers = {
  Authorization: "Bearer " + token,
  "User-Agent": "SIGA setup",
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};
const profile = await (
  await fetch("https://api.github.com/user", { headers })
).json();
const name = profile.login + "/SIGA";
let response = await fetch("https://api.github.com/repos/" + name, { headers });
if (response.status === 404)
  response = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "SIGA",
      description:
        "Sistema Inteligente de Gestão de Atividades — núcleo auditável, painel executivo responsivo e adaptadores Gmail/IA para Cloudflare Workers e D1.",
      private: false,
      has_issues: true,
      has_projects: true,
      auto_init: false,
    }),
  });
if (!response.ok)
  throw new Error("GitHub repository request failed: " + response.status);
const repository = await response.json();
if (repository.private)
  throw new Error(
    "Existing repository is private; refusing to change visibility implicitly",
  );
console.log(
  JSON.stringify({
    url: repository.html_url,
    clone: repository.clone_url,
    created: response.status === 201,
  }),
);
