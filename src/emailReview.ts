import {
  assessEmail,
  EMAIL_SECURITY_POLICY,
  type EmailAssessment,
} from "./emailSecurity.ts";
import { assert } from "./domain.ts";
import type { Repository } from "./repository.ts";
import type { Interpretation } from "./interpreter.ts";

export async function storeEmailReview(
  repo: Repository,
  input: {
    mailbox: string;
    providerId: string;
    sender: string;
    assessment: EmailAssessment;
    reason: string;
    proposal?: Interpretation;
  },
) {
  const id = crypto.randomUUID(),
    at = new Date().toISOString(),
    a = input.assessment;
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(a.subject + "\n" + a.text),
      ),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
  await repo.db.batch([
    repo.db
      .prepare(
        "INSERT OR IGNORE INTO ingestion_reviews(id,mailbox_id,provider_message_id,sender,subject,fresh_text,reason,created_at,security_status,security_flags_json,content_hash,ai_proposal_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        id,
        input.mailbox,
        input.providerId,
        input.sender.slice(0, 254),
        a.subject,
        a.text,
        input.reason.slice(0, 1000),
        at,
        a.status,
        JSON.stringify(a.flags),
        hash,
        input.proposal ? JSON.stringify(input.proposal) : null,
      ),
    repo.db
      .prepare(
        "INSERT INTO audit_log(id,request_id,occurred_at,actor_id,actor_name,roles_json,action,resource,source,outcome,details_json) SELECT ?,?,?,'system','SIGA · ingestão','[]',?,?,'GMAIL',?,? WHERE EXISTS(SELECT 1 FROM ingestion_reviews WHERE id=?)",
      )
      .bind(
        crypto.randomUUID(),
        repo.requestId || id,
        at,
        a.status === "QUARANTINED"
          ? "EMAIL_QUARANTINED"
          : "EMAIL_REVIEW_QUEUED",
        id,
        a.status === "QUARANTINED" ? "NEGADO" : "REVISAO",
        JSON.stringify({
          policy: EMAIL_SECURITY_POLICY,
          mailbox: input.mailbox,
          contentHash: hash,
          flags: a.flags,
          aiProposal: !!input.proposal,
        }),
        id,
      ),
  ]);
}
export function reviewAssessment(row: {
  subject: string;
  fresh_text: string;
  security_status?: string;
  security_flags_json?: string;
}) {
  const result = assessEmail(row.subject, row.fresh_text);
  if (row.security_status === "QUARANTINED") {
    result.status = "QUARANTINED";
    try {
      const flags: unknown = JSON.parse(row.security_flags_json || "[]");
      if (Array.isArray(flags))
        result.flags = [
          ...new Set([
            ...result.flags,
            ...flags.filter((x) => typeof x === "string"),
          ]),
        ];
    } catch {
      result.flags.push("LEGACY_REVIEW");
    }
  }
  return result;
}
export function curatedEmail(
  row: {
    subject: string;
    fresh_text: string;
    security_status?: string;
    security_flags_json?: string;
  },
  input: Record<string, unknown>,
) {
  const assessment = reviewAssessment(row);
  if (assessment.status !== "QUARANTINED")
    return {
      subject: assessment.subject,
      text: assessment.text,
      curated: false,
      reason: "",
    };
  assert(
    input.confirm === true &&
      typeof input.subject === "string" &&
      typeof input.text === "string" &&
      typeof input.reason === "string" &&
      input.reason.trim().length >= 10,
    "EMAIL_QUARANTINED",
    "Mensagem em quarentena. Reescreva somente o pedido administrativo e justifique o aproveitamento antes de criar a triagem.",
    409,
  );
  const curated = assessEmail(input.subject, input.text);
  assert(
    curated.status === "REVIEW" &&
      curated.subject.length >= 3 &&
      curated.text.length >= 3 &&
      input.reason.length <= 1000,
    "EMAIL_CURATED_CONTENT",
    "O texto reescrito ainda contém conteúdo suspeito ou está incompleto. Use apenas o pedido administrativo.",
  );
  return {
    subject: curated.subject,
    text: curated.text,
    curated: true,
    reason: input.reason.trim(),
  };
}
