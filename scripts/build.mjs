import { build } from "esbuild";
import { readFile, mkdir, readdir } from "node:fs/promises";
await mkdir("dist", { recursive: true });
const assets = {};
for (const name of await readdir("public")) {
  const type = name.endsWith(".html")
    ? "text/html; charset=utf-8"
    : name.endsWith(".css")
      ? "text/css; charset=utf-8"
      : name.endsWith(".js")
        ? "text/javascript; charset=utf-8"
        : "image/svg+xml";
  const binary = name.endsWith(".xlsx");
  assets["/" + name] = {
    type: binary
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : type,
    binary,
    body: binary
      ? (await readFile("public/" + name)).toString("base64")
      : await readFile("public/" + name, "utf8"),
  };
}
await build({
  entryPoints: ["src/worker.ts"],
  outfile: "dist/worker.js",
  bundle: true,
  format: "esm",
  target: "es2023",
  platform: "browser",
  external: ["node:crypto", "node:buffer"],
  define: { __ASSETS__: JSON.stringify(assets) },
  minify: true,
});
await build({
  entryPoints: ["src/testing.ts"],
  outfile: "dist/testing.js",
  bundle: true,
  format: "esm",
  target: "es2023",
  platform: "node",
  packages: "external",
  define: { __ASSETS__: JSON.stringify(assets) },
});
console.log("SIGA build concluído: Worker + assets locais + módulos de teste.");
