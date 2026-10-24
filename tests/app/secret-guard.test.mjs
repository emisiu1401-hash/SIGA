import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
const scanner = resolve("scripts/check-secrets.mjs");
test("guarda de segredos bloqueia token no index mesmo se arquivo de trabalho foi limpo", () => {
  const root = mkdtempSync(join(tmpdir(), "siga-secret-guard-"));
  assert.equal(dirname(resolve(root)), resolve(tmpdir()));
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, stdio: "pipe" });
  const scan = () =>
    spawnSync(process.execPath, [scanner], { cwd: root, encoding: "utf8" });
  try {
    git("init", "-q");
    writeFileSync(join(root, "settings.txt"), "safe example");
    writeFileSync(
      join(root, ".env.example"),
      "AI_API_KEY=\nSESSION_SECRET=\n# No secrets\n",
    );
    git("add", ".env.example");
    git("add", "settings.txt");
    assert.equal(scan().status, 0);
    const fake = "sk-proj-" + "X".repeat(40);
    writeFileSync(join(root, "settings.txt"), fake);
    git("add", "settings.txt");
    writeFileSync(join(root, "settings.txt"), "safe working copy");
    const denied = scan();
    assert.equal(denied.status, 1);
    assert(!denied.stderr.includes(fake));
    assert(denied.stderr.includes("settings.txt"));
    git("add", "settings.txt");
    mkdirSync(join(root, ".local"));
    writeFileSync(join(root, ".local", "private.json"), "{}");
    git("add", "-f", ".local/private.json");
    assert.equal(scan().status, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
