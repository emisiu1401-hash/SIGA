import { freshText } from "./domain.ts";

export const EMAIL_SECURITY_POLICY = "email-boundary-v1";
export type EmailAssessment = {
  status: "REVIEW" | "QUARANTINED";
  flags: string[];
  text: string;
  subject: string;
};
export function assessEmail(
  subject: string,
  body: string,
  extraFlags: string[] = [],
): EmailAssessment {
  const flags = new Set(extraFlags),
    raw = (subject + "\n" + body).slice(0, 26000);
  if (subject.length > 250 || body.length > 24000) flags.add("CONTENT_LIMIT");
  if (
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/.test(
      raw,
    )
  )
    flags.add("HIDDEN_CONTROL");
  const scan = raw
    .normalize("NFKC")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g,
      "",
    )
    .toLowerCase();
  const patterns: [string, RegExp][] = [
    [
      "INSTRUCTION_OVERRIDE",
      /\b(?:ignore|ignorar|desconsidere|esqueca|forget|override|bypass)\b[^\n]{0,140}\b(?:regras|instrucoes|instructions|system|sistema|policy|guardrails|previous)\b/,
    ],
    [
      "ROLE_IMPERSONATION",
      /<\|(?:im_start|system|developer)|\[(?:system|inst)\]|\brole\s*[:=]\s*["']?(?:system|developer)|\b(?:voce|you)\b[^\n]{0,45}\b(?:administrador|root|developer mode|system administrator)\b/,
    ],
    [
      "SECRET_REQUEST",
      /\b(?:revele|reveal|exiba|imprima|envie|exporte|mostre|extract|exfiltrate)\b[^\n]{0,100}\b(?:senha|password|token|segredo|secret|api.?key|system prompt|prompt do sistema|chave de api)\b/,
    ],
    [
      "ACTIVE_HTML",
      /<\s*(?:script|iframe|object|embed|svg)\b|\bon(?:error|load|click|focus)\s*=|javascript\s*:/,
    ],
    [
      "DATABASE_CODE",
      /\b(?:drop|truncate|alter)\s+(?:table|database|schema)\b|\bdelete\s+from\b|\bupdate\s+(?:users|user_roles|app_settings|login_accounts)\b|\bgrant\s+(?:all|admin|select)\b/,
    ],
    [
      "SYSTEM_COMMAND",
      /\brm\s+-[a-z]*r[a-z]*\b|\bpowershell\b[^\n]{0,100}-(?:enc|encodedcommand)\b|\b(?:curl|wget)\b[^\n]{0,160}\|\s*(?:sh|bash)\b|\b(?:eval|exec|require)\s*\(/,
    ],
    [
      "ENCODED_INSTRUCTION",
      /\b(?:base64|rot13|hex|decodifique|decode)\b[^\n]{0,100}\b(?:execute|executar|obede|run|instruction|instrucao|comando)\b|\b(?:execute|run)\b[^\n]{0,60}\b(?:base64|rot13|hex)\b/,
    ],
    [
      "POLICY_CHANGE",
      /\b(?:desative|desabilite|disable|remova|remove|altere)\b[^\n]{0,100}\b(?:auditoria|audit log|seguranca|security|autenticacao|authentication|csrf|mfa|permissoes|permissions)\b/,
    ],
    ["CODE_BLOCK", /```|~~~(?:sql|javascript|python|powershell|bash|sh)/],
  ];
  for (const [flag, pattern] of patterns)
    if (pattern.test(scan)) flags.add(flag);
  const blocked = flags.size > 0;
  const visible = (value: string) =>
    value.replace(
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g,
      "[controle removido]",
    );
  return {
    status: blocked ? "QUARANTINED" : "REVIEW",
    flags: [...flags],
    subject: visible(freshText(subject)).slice(0, 250),
    text: visible(freshText(body)).slice(0, 12000),
  };
}
export type MimePart = {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: MimePart[];
};
export function safeMimeContent(root: MimePart) {
  const flags = new Set<string>(),
    plain: string[] = [],
    html: string[] = [],
    raw: string[] = [];
  let count = 0,
    total = 0,
    attachments = 0;
  const walk = (part: MimePart, depth: number) => {
    if (depth > 12 || ++count > 100) {
      flags.add("MIME_LIMIT");
      return;
    }
    const disposition =
      part.headers?.find((h) => h.name.toLowerCase() === "content-disposition")
        ?.value || "";
    if (
      part.filename ||
      part.body?.attachmentId ||
      /^attachment\b/i.test(disposition) ||
      part.mimeType === "message/rfc822"
    ) {
      attachments++;
      // Attachments are never downloaded, interpreted, rendered, or executed.
      if (
        /\.(?:exe|dll|com|bat|cmd|ps1|vbs|js|jse|hta|html?|svg|jar|scr|msi|zip|7z|rar|docm|xlsm)$/i.test(
          part.filename || "",
        ) ||
        part.mimeType === "message/rfc822"
      )
        flags.add("ACTIVE_ATTACHMENT");
      return;
    }
    if (part.mimeType === "text/plain" || part.mimeType === "text/html") {
      const data = part.body?.data || "";
      if (data.length > 32000 || (part.body?.size || 0) > 24000) {
        flags.add("CONTENT_LIMIT");
        return;
      }
      try {
        const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
          Uint8Array.from(
            atob(data.replace(/-/g, "+").replace(/_/g, "/")),
            (c) => c.charCodeAt(0),
          ),
        );
        total += decoded.length;
        if (total > 24000) {
          flags.add("CONTENT_LIMIT");
          return;
        }
        raw.push(decoded);
        (part.mimeType === "text/plain" ? plain : html).push(decoded);
      } catch {
        flags.add("MIME_INVALID");
      }
    }
    for (const child of part.parts?.slice(0, 101) || []) walk(child, depth + 1);
  };
  walk(root, 0);
  return {
    text: freshText((plain.length ? plain : html).join("\n")),
    scanText: raw.join("\n"),
    flags: [...flags],
    attachments,
  };
}
