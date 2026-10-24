import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Never echo matching content: CI output is also public.
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const patterns = [
  /\b(?:sk-(?:proj-|ant-)?)[A-Za-z0-9_-]{32,}\b/,
  /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /^[\t ]*(?:AI_API_KEY|SESSION_SECRET|SECRET_ENCRYPTION_KEY|GOOGLE_CLIENT_SECRET|GOOGLE_REFRESH_TOKEN|(?:ADMIN|MANAGER|EXECUTOR)_PASSWORD)[\t ]*=[\t ]*\S+/m,
];
const blocked = [];
for (const file of files) {
  if (
    /^(?:\.dev\.vars(?:$|\.)|\.local\/|\.wrangler\/|\.env(?:$|\.))/.test(
      file,
    ) &&
    !file.endsWith(".example")
  ) {
    blocked.push(file);
    continue;
  }
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  const staged = execFileSync("git", ["show", ":" + file], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (patterns.some((p) => p.test(content) || p.test(staged)))
    blocked.push(file);
}
if (blocked.length) {
  console.error(
    "Possíveis segredos em arquivos versionados (revise sem publicar o conteúdo):\n" +
      blocked.join("\n"),
  );
  process.exitCode = 1;
} else
  console.log(
    "Verificação de segredos: nenhum padrão detectado nos arquivos versionados.",
  );
