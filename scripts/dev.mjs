import { createServer } from "node:http";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { parse as parseJsonc } from "jsonc-parser";
import { LocalD1 } from "./sqlite.mjs";
await import("./build.mjs");
const { fetchHandler, Repository, seedDemo } = await import(
  "../dist/testing.js"
);
mkdirSync(".local", { recursive: true });
if (!existsSync(".dev.vars")) {
  const config = {
    SESSION_SECRET: randomBytes(48).toString("base64url"),
    MANAGER_PASSWORD: randomBytes(24).toString("base64url"),
    EXECUTOR_PASSWORD: randomBytes(24).toString("base64url"),
    ADMIN_PASSWORD: randomBytes(24).toString("base64url"),
  };
  writeFileSync(
    ".dev.vars",
    Object.entries(config)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n",
  );
  console.log(
    "Credenciais geradas em .dev.vars (arquivo privado, ignorado pelo Git).",
  );
}
const secrets = Object.fromEntries(
  readFileSync(".dev.vars", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const db = new LocalD1(process.env.SIGA_DB_PATH || ".local/siga.sqlite");
db.migrate();
const env = {
  ...parseJsonc(readFileSync("wrangler.jsonc", "utf8")).vars,
  ...secrets,
  DB: db,
};
await seedDemo(new Repository(db));
const port = Number(process.env.PORT || 8787);
createServer(async (req, res) => {
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 24000) {
        res.writeHead(413);
        res.end("Payload too large");
        return;
      }
      chunks.push(chunk);
    }
    const method = req.method || "GET";
    const request = new Request(`http://127.0.0.1:${port}${req.url}`, {
      method,
      headers: req.headers,
      ...(["GET", "HEAD"].includes(method)
        ? {}
        : { body: Buffer.concat(chunks) }),
    });
    const result = await fetchHandler(request, env);
    res.writeHead(result.status, Object.fromEntries(result.headers));
    res.end(Buffer.from(await result.arrayBuffer()));
  } catch (e) {
    console.error(e.message);
    res.writeHead(500);
    res.end("Erro local");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`SIGA disponível em http://127.0.0.1:${port}`),
);
