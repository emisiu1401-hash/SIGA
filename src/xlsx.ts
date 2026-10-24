import { XMLParser } from "fast-xml-parser";
import { assert } from "./domain.ts";

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const encoder = new TextEncoder(),
  decoder = new TextDecoder("utf-8", { fatal: true });
const MAX_FILE = 5 * 1024 * 1024,
  MAX_XML = 4 * 1024 * 1024;
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export const crc32 = (bytes: Uint8Array) => {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const xml = (s: unknown) =>
  String(s ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const column = (n: number) => {
  let s = "";
  for (n++; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
export function zipStored(files: Record<string, string | Uint8Array>) {
  const locals: Uint8Array[] = [],
    central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const fileName = encoder.encode(name),
      data = typeof content === "string" ? encoder.encode(content) : content,
      crc = crc32(data);
    const local = new Uint8Array(30 + fileName.length + data.length),
      l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, 0x800, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, data.length, true);
    l.setUint32(22, data.length, true);
    l.setUint16(26, fileName.length, true);
    local.set(fileName, 30);
    local.set(data, 30 + fileName.length);
    const dir = new Uint8Array(46 + fileName.length),
      d = new DataView(dir.buffer);
    d.setUint32(0, 0x02014b50, true);
    d.setUint16(4, 20, true);
    d.setUint16(6, 20, true);
    d.setUint16(8, 0x800, true);
    d.setUint32(16, crc, true);
    d.setUint32(20, data.length, true);
    d.setUint32(24, data.length, true);
    d.setUint16(28, fileName.length, true);
    d.setUint32(42, offset, true);
    dir.set(fileName, 46);
    locals.push(local);
    central.push(dir);
    offset += local.length;
  }
  const directorySize = central.reduce((n, x) => n + x.length, 0),
    end = new Uint8Array(22),
    e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, central.length, true);
  e.setUint16(10, central.length, true);
  e.setUint32(12, directorySize, true);
  e.setUint32(16, offset, true);
  const result = new Uint8Array(offset + directorySize + 22);
  let at = 0;
  for (const part of [...locals, ...central, end]) {
    result.set(part, at);
    at += part.length;
  }
  return result;
}
export function writeWorkbook(
  sheets: { name: string; rows: (string | number | null)[][] }[],
) {
  const files: Record<string, string> = {};
  files["[Content_Types].xml"] =
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`;
  files["_rels/.rels"] =
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  files["xl/workbook.xml"] =
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`;
  files["xl/_rels/workbook.xml.rels"] =
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  files["xl/styles.xml"] =
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF173C34"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0" fillId="0" borderId="0" xfId="0"/><xf fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`;
  sheets.forEach((sheet, i) => {
    const width = Math.max(1, ...sheet.rows.map((r) => r.length));
    files[`xl/worksheets/sheet${i + 1}.xml`] =
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${Array.from({ length: width }, (_, c) => `<col min="${c + 1}" max="${c + 1}" width="${c === 0 ? 38 : 24}" customWidth="1"/>`).join("")}</cols><sheetData>${sheet.rows.map((row, r) => `<row r="${r + 1}">${row.map((value, c) => `<c r="${column(c)}${r + 1}" s="${r === 0 ? 1 : 0}" ${typeof value === "number" ? 't="n"' : 't="inlineStr"'}>${typeof value === "number" ? `<v>${Number.isFinite(value) ? value : 0}</v>` : `<is><t xml:space="preserve">${xml(value)}</t></is>`}</c>`).join("")}</row>`).join("")}</sheetData><autoFilter ref="A1:${column(width - 1)}${Math.max(1, sheet.rows.length)}"/></worksheet>`;
  });
  return zipStored(files);
}
async function inflated(data: Uint8Array, method: number, expected: number) {
  if (method === 0) {
    assert(
      data.length === expected,
      "XLSX_ZIP",
      "Tamanho de arquivo Excel inválido.",
    );
    return data;
  }
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader(),
    chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      assert(
        total <= MAX_XML && total <= expected,
        "XLSX_SIZE",
        "Arquivo Excel excede o limite descompactado.",
        413,
      );
      chunks.push(value);
    }
  } catch (e) {
    await reader.cancel().catch(() => {});
    throw e;
  }
  assert(
    total === expected,
    "XLSX_ZIP",
    "Tamanho de arquivo Excel inconsistente.",
  );
  const result = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    result.set(c, at);
    at += c.length;
  }
  return result;
}
export async function unzipXml(input: Uint8Array) {
  assert(
    input.length >= 22 && input.length <= MAX_FILE,
    "XLSX_SIZE",
    "Envie arquivo .xlsx de até 5 MB.",
    413,
  );
  const d = new DataView(input.buffer, input.byteOffset, input.byteLength);
  let end = -1;
  for (let i = input.length - 22; i >= Math.max(0, input.length - 65557); i--)
    if (d.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  assert(
    end >= 0 && end + 22 + d.getUint16(end + 20, true) === input.length,
    "XLSX_ZIP",
    "Arquivo .xlsx inválido ou incompleto.",
  );
  const count = d.getUint16(end + 10, true),
    start = d.getUint32(end + 16, true),
    directorySize = d.getUint32(end + 12, true);
  assert(
    d.getUint16(end + 4, true) === 0 &&
      d.getUint16(end + 6, true) === 0 &&
      count === d.getUint16(end + 8, true) &&
      count > 0 &&
      count <= 200 &&
      start + directorySize === end,
    "XLSX_ZIP",
    "Estrutura Excel não suportada.",
  );
  const files: Record<string, string> = Object.create(null);
  const names = new Set<string>();
  let at = start,
    total = 0;
  for (let n = 0; n < count; n++) {
    assert(
      at + 46 <= end && d.getUint32(at, true) === 0x02014b50,
      "XLSX_ZIP",
      "Diretório Excel inválido.",
    );
    const flags = d.getUint16(at + 8, true),
      method = d.getUint16(at + 10, true),
      crc = d.getUint32(at + 16, true),
      packed = d.getUint32(at + 20, true),
      size = d.getUint32(at + 24, true),
      nameLength = d.getUint16(at + 28, true),
      extra = d.getUint16(at + 30, true),
      comment = d.getUint16(at + 32, true),
      local = d.getUint32(at + 42, true);
    assert(
      at + 46 + nameLength + extra + comment <= end,
      "XLSX_ZIP",
      "Diretório Excel incompleto.",
    );
    const name = decoder.decode(input.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extra + comment;
    assert(
      !names.has(name) &&
        !name.includes("..") &&
        !name.includes("\\") &&
        !name.startsWith("/") &&
        !(flags & 1) &&
        [0, 8].includes(method),
      "XLSX_ZIP",
      "Arquivo Excel contém estrutura não permitida.",
    );
    names.add(name);
    assert(
      !/vbaProject|externalLinks|embeddings|macrosheets|\.bin$/i.test(name),
      "XLSX_ACTIVE",
      "Macros, objetos e vínculos externos não são aceitos.",
    );
    total += size;
    assert(
      size <= MAX_XML && total <= 16 * 1024 * 1024,
      "XLSX_SIZE",
      "Conteúdo descompactado excede o limite seguro.",
      413,
    );
    assert(
      local + 30 <= start &&
        d.getUint32(local, true) === 0x04034b50 &&
        d.getUint16(local + 8, true) === method,
      "XLSX_ZIP",
      "Cabeçalho Excel inválido.",
    );
    const localName = d.getUint16(local + 26, true),
      localExtra = d.getUint16(local + 28, true),
      dataAt = local + 30 + localName + localExtra;
    assert(
      dataAt + packed <= start &&
        decoder.decode(input.subarray(local + 30, local + 30 + localName)) ===
          name,
      "XLSX_ZIP",
      "Entrada Excel inconsistente.",
    );
    if (/\.rels$/.test(name)) {
      const relBytes = await inflated(
        input.subarray(dataAt, dataAt + packed),
        method,
        size,
      );
      assert(crc32(relBytes) === crc, "XLSX_ZIP", "Arquivo Excel corrompido.");
      assert(
        !/TargetMode\s*=\s*["']External["']|<!DOCTYPE|<!ENTITY/i.test(
          decoder.decode(relBytes),
        ),
        "XLSX_ACTIVE",
        "Vínculos externos não são aceitos.",
      );
    }
    if (
      !/^(?:\[Content_Types\]\.xml|xl\/workbook\.xml|xl\/_rels\/workbook\.xml\.rels|xl\/sharedStrings\.xml|xl\/worksheets\/sheet\d+\.xml)$/.test(
        name,
      )
    )
      continue;
    const bytes = await inflated(
      input.subarray(dataAt, dataAt + packed),
      method,
      size,
    );
    assert(crc32(bytes) === crc, "XLSX_ZIP", "Arquivo Excel corrompido.");
    const text = decoder.decode(bytes);
    assert(
      !/<!DOCTYPE|<!ENTITY/i.test(text),
      "XLSX_XML",
      "Definições XML externas não são permitidas.",
    );
    files[name] = text;
  }
  assert(at === end, "XLSX_ZIP", "Diretório Excel inconsistente.");
  assert(
    !/macroEnabled|vbaProject|externalLink/i.test(
      files["[Content_Types].xml"] || "",
    ),
    "XLSX_ACTIVE",
    "Conteúdo ativo não é aceito.",
  );
  return files;
}
type XNode = Record<string, unknown>;
const object = (x: unknown): XNode =>
  x && typeof x === "object" ? (x as XNode) : {};
const list = (x: unknown): unknown[] =>
  x === undefined ? [] : Array.isArray(x) ? x : [x];
const text = (x: unknown): string =>
  typeof x === "string"
    ? x
    : typeof x === "number"
      ? String(x)
      : String(object(x)["#text"] || "");
const entities = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, key: string) => {
    if (key[0] === "#") {
      const n =
        key[1].toLowerCase() === "x"
          ? parseInt(key.slice(2), 16)
          : parseInt(key.slice(1), 10);
      assert(
        n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff),
        "XLSX_XML",
        "Caractere XML inválido.",
      );
      return String.fromCodePoint(n);
    }
    return (
      (
        { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<
          string,
          string
        >
      )[key] || ""
    );
  });
export async function readWorkbook(input: Uint8Array, sheetName: string) {
  const files = await unzipXml(input),
    parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@",
      removeNSPrefix: true,
      parseTagValue: false,
      parseAttributeValue: false,
      trimValues: false,
      processEntities: false,
    });
  const parse = (name: string) => {
    assert(files[name], "XLSX_SHEET", "Aba ou estrutura Excel ausente.");
    return object(parser.parse(files[name]));
  };
  const book = object(parse("xl/workbook.xml").workbook),
    sheets = list(object(book.sheets).sheet).map(object),
    sheet = sheets.find((s) => entities(text(s["@name"])) === sheetName);
  assert(sheet, "XLSX_SHEET", `A planilha precisa da aba ${sheetName}.`);
  const rels = list(
      object(parse("xl/_rels/workbook.xml.rels").Relationships).Relationship,
    ).map(object),
    rel = rels.find((r) => r["@Id"] === sheet["@id"]);
  assert(
    rel && rel["@TargetMode"] !== "External",
    "XLSX_SHEET",
    "Relação de aba inválida.",
  );
  const target = text(rel["@Target"]),
    path = target.startsWith("/xl/") ? target.slice(1) : "xl/" + target;
  assert(
    /^xl\/worksheets\/sheet\d+\.xml$/.test(path),
    "XLSX_SHEET",
    "Caminho de aba inválido.",
  );
  const rich = (v: unknown): string => {
    const n = object(v);
    return entities(
      text(n.t) ||
        list(n.r)
          .map((r) => text(object(r).t))
          .join(""),
    );
  };
  const shared = files["xl/sharedStrings.xml"]
    ? list(object(parse("xl/sharedStrings.xml").sst).si).map(rich)
    : [];
  assert(
    shared.length <= 20000,
    "XLSX_SIZE",
    "Texto compartilhado excede o limite.",
    413,
  );
  const source = list(object(object(parse(path).worksheet).sheetData).row),
    rows: { row: number; values: string[] }[] = [];
  const seenRows = new Set<number>();
  let cells = 0;
  for (const item of source) {
    const row = object(item),
      number = Number(row["@r"]);
    assert(
      Number.isInteger(number) &&
        number > 0 &&
        number <= 10001 &&
        !seenRows.has(number),
      "XLSX_ROW",
      "Numeração de linha inválida.",
    );
    seenRows.add(number);
    const values: string[] = [],
      seen = new Set<number>();
    for (const c of list(row.c).map(object)) {
      assert(
        !("f" in c),
        "XLSX_FORMULA",
        `Fórmulas não são aceitas (linha ${number}).`,
      );
      const ref = text(c["@r"]),
        match = ref.match(/^([A-Z]{1,3})(\d+)$/);
      assert(
        match && Number(match[2]) === number,
        "XLSX_CELL",
        "Referência de célula inválida.",
      );
      const col =
        Array.from(match[1]).reduce(
          (n, ch) => n * 26 + ch.charCodeAt(0) - 64,
          0,
        ) - 1;
      assert(
        col < 30 && !seen.has(col) && ++cells <= 30000,
        "XLSX_SIZE",
        "A planilha excede o limite de células.",
        413,
      );
      seen.add(col);
      const type = text(c["@t"]);
      assert(
        type !== "e",
        "XLSX_CELL",
        `Célula com erro ou resultado de fórmula na linha ${number}.`,
      );
      let value =
        type === "inlineStr"
          ? rich(c.is)
          : type === "s"
            ? shared[Number(text(c.v))]
            : entities(text(c.v));
      assert(
        typeof value === "string" && value.length <= 12000,
        "XLSX_CELL",
        `Conteúdo inválido na linha ${number}.`,
      );
      assert(
        !/^[\s\u0000-\u001f]*[=+@]/.test(value),
        "XLSX_FORMULA",
        `Texto semelhante a fórmula na linha ${number}.`,
      );
      values[col] = value;
    }
    if (values.some((v) => v !== "")) rows.push({ row: number, values });
  }
  rows.sort((a, b) => a.row - b.row);
  assert(
    rows.length <= 1001,
    "XLSX_ROWS",
    "Máximo de 1.000 linhas preenchidas por arquivo.",
    413,
  );
  return rows;
}
