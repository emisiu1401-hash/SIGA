import { assert, codes, localDate } from "./domain.ts";
import { boundedJson, configuredAi, interpret } from "./interpreter.ts";
import { Repository } from "./repository.ts";
import type { RuntimeEnv } from "./types.ts";
import { gmailOperation } from "./gmailAccounts.ts";

import {
  assessEmail,
  safeMimeContent,
  type MimePart,
} from "./emailSecurity.ts";
import { storeEmailReview } from "./emailReview.ts";
import type { Interpretation } from "./interpreter.ts";
type GmailPayload = MimePart;
type GmailMessage = {
  id: string;
  threadId: string;
  internalDate: string;
  payload: GmailPayload;
};
export function mimeText(p: GmailPayload): string {
  return safeMimeContent(p).text;
}
export function institutionAuthenticated(message: GmailMessage) {
  const h = message.payload.headers || [];
  const from = h.find((x) => x.name.toLowerCase() === "from")?.value || "";
  const sender = from.match(/<?([^<>\s]+@[^<>\s]+)>?/)?.[1]?.toLowerCase();
  const auth =
    h.find(
      (x) =>
        x.name.toLowerCase() === "authentication-results" &&
        /^mx\.google\.com\s*;/i.test(x.value),
    )?.value || "";
  return {
    sender,
    valid:
      !!sender &&
      sender.split("@")[1] === "tjmsp.jus.br" &&
      /dmarc=pass\b/i.test(auth) &&
      /header\.from=tjmsp\.jus\.br\b/i.test(auth) &&
      /dkim=pass\b/i.test(auth) &&
      !/auto-replied|auto-generated/i.test(
        h.find((x) => x.name.toLowerCase() === "auto-submitted")?.value || "",
      ),
  };
}
async function accessToken(
  env: RuntimeEnv,
  signal: AbortSignal = AbortSignal.timeout(15000),
) {
  assert(
    env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      env.GOOGLE_REFRESH_TOKEN,
    "GMAIL_CONFIG",
    "Configure OAuth do Gmail nos Secrets do Worker.",
    503,
  );
  // Native Workers fetch supports manual redirects; every caller rejects non-2xx.
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
    signal,
    redirect: "manual",
  });
  assert(r.ok, "GMAIL_AUTH", "Autorização Gmail indisponível.", 503);
  const body = (await boundedJson(r)) as { access_token: string };
  return body.access_token;
}
export async function synchronizeGmail(repo: Repository, env: RuntimeEnv) {
  if (env.SIMULATION_MODE === "true")
    return {
      simulation: true,
      imported: 0,
      message: "Simulação ativa; nenhuma caixa real foi lida.",
    };
  assert(env.MAILBOX_ID, "MAILBOX", "Configure a caixa Gmail autorizada.", 503);
  const mailboxKey = env.OUTBOX_MAILBOX_ID || "primary";
  const operation = await gmailOperation(repo, env);
  try {
    const lease = Date.now() + 60000;
    await repo.db
      .prepare(
        "INSERT OR IGNORE INTO gmail_sync_state(id,lease_until) VALUES(?,0)",
      )
      .bind(mailboxKey)
      .run();
    const claim = await repo.db
      .prepare(
        "UPDATE gmail_sync_state SET lease_until=? WHERE id=? AND lease_until<? RETURNING id",
      )
      .bind(lease, mailboxKey, Date.now())
      .first();
    assert(claim, "SYNC_BUSY", "Sincronização já em andamento.", 409);
    try {
      const token = await accessToken(env, operation.signal());
      const get = async (path: string) => {
        operation.check();
        const r = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/" + path,
          {
            headers: { Authorization: "Bearer " + token },
            signal: operation.signal(),
            redirect: "manual",
          },
        );
        return r;
      };
      const profileResponse = await get("profile");
      assert(
        profileResponse.ok,
        "GMAIL_PROFILE",
        "Falha ao verificar caixa Gmail.",
        503,
      );
      const profile = (await boundedJson(profileResponse)) as {
        emailAddress: string;
        historyId: string;
      };
      assert(
        profile.emailAddress.toLowerCase() === env.MAILBOX_ID.toLowerCase(),
        "MAILBOX_MISMATCH",
        "OAuth pertence a outra caixa. Coleta bloqueada.",
        403,
      );
      const state = await repo.db
        .prepare(
          "SELECT history_id,last_sync_at FROM gmail_sync_state WHERE id=?",
        )
        .bind(mailboxKey)
        .first<{ history_id: string | null; last_sync_at: string | null }>();
      if (!state?.history_id) {
        await repo.db
          .prepare(
            "UPDATE gmail_sync_state SET history_id=?,last_sync_at=?,last_error=NULL WHERE id=?",
          )
          .bind(profile.historyId, new Date().toISOString(), mailboxKey)
          .run();
        return {
          initialized: true,
          imported: 0,
          message:
            "Marco inicial registrado; mensagens anteriores não foram importadas.",
        };
      }
      const ids = new Set<string>();
      let page = "";
      let recovered = false;
      let pages = 0;
      do {
        assert(
          ++pages <= 20,
          "GMAIL_BACKLOG",
          "Volume acima do lote seguro; cursor preservado para recuperação supervisionada.",
          503,
        );
        const r = await get(
          "history?historyTypes=messageAdded&maxResults=100&startHistoryId=" +
            encodeURIComponent(state.history_id) +
            (page ? "&pageToken=" + encodeURIComponent(page) : ""),
        );
        if (r.status === 404) {
          recovered = true;
          break;
        }
        assert(r.ok, "GMAIL_SYNC", "Falha temporária; cursor preservado.", 503);
        const history = (await boundedJson(r)) as {
          history?: { messagesAdded?: { message: { id: string } }[] }[];
          nextPageToken?: string;
        };
        for (const h of history.history || [])
          for (const item of h.messagesAdded || []) ids.add(item.message.id);
        page = history.nextPageToken || "";
      } while (page);
      if (recovered) {
        // Bounded reconciliation, never silently reset past unknown messages.
        const since =
          Math.floor(
            new Date(state.last_sync_at || new Date().toISOString()).getTime() /
              1000,
          ) - 3600;
        let cursor = "";
        let n = 0;
        do {
          assert(
            ++n <= 20,
            "GMAIL_BACKLOG",
            "Ressincronização excede janela segura.",
            503,
          );
          const r = await get(
            "messages?maxResults=100&q=" +
              encodeURIComponent("after:" + since) +
              (cursor ? "&pageToken=" + encodeURIComponent(cursor) : ""),
          );
          assert(
            r.ok,
            "GMAIL_RECOVERY",
            "Falha na recuperação do histórico.",
            503,
          );
          const data = (await boundedJson(r)) as {
            messages?: { id: string }[];
            nextPageToken?: string;
          };
          for (const item of data.messages || []) ids.add(item.id);
          cursor = data.nextPageToken || "";
        } while (cursor);
      }
      const known = new Set(
        (
          await repo.db
            .prepare(
              "SELECT provider_message_id FROM ingestion_reviews WHERE mailbox_id=? AND provider_message_id IN (SELECT value FROM json_each(?))",
            )
            .bind(mailboxKey, JSON.stringify([...ids]))
            .all<{ provider_message_id: string }>()
        ).results.map((r) => r.provider_message_id),
      );
      const pending = [...ids].filter((id) => !known.has(id));
      const batch = pending.slice(0, 5);
      let imported = 0,
        aiCalls = 0;
      for (const id of batch) {
        operation.check();
        const r = await get(
          "messages/" + encodeURIComponent(id) + "?format=full",
        );
        if (r.status === 404) {
          // A deleted message must not occupy every subsequent bounded batch.
          await storeEmailReview(repo, {
            mailbox: mailboxKey,
            providerId: id,
            sender: "não analisado",
            assessment: assessEmail("Mensagem indisponível no Gmail", "", [
              "MESSAGE_UNAVAILABLE",
            ]),
            reason:
              "Mensagem removida ou indisponível na caixa. Sem interpretação ou ação; registro técnico permite continuar o lote.",
          });
          imported++;
          continue;
        }
        assert(
          r.ok,
          "GMAIL_MESSAGE",
          "Falha ao carregar mensagem; cursor preservado.",
          503,
        );
        let msg: GmailMessage;
        let content: ReturnType<typeof safeMimeContent>;
        try {
          msg = (await boundedJson(r, 500000)) as GmailMessage;
          content = safeMimeContent(msg.payload);
          assert(
            Array.isArray(msg.payload.headers),
            "GMAIL_FORMAT",
            "Cabeçalhos inválidos.",
          );
        } catch {
          await storeEmailReview(repo, {
            mailbox: mailboxKey,
            providerId: id,
            sender: "não analisado",
            assessment: assessEmail(
              "Mensagem excede limite ou formato inválido",
              "",
              ["MIME_INVALID"],
            ),
            reason:
              "Mensagem preservada no Gmail; corpo não importado. Revisão humana necessária. O lote continua para não bloquear a caixa.",
          });
          imported++;
          continue;
        }
        const auth = institutionAuthenticated(msg);
        const subject =
          msg.payload.headers?.find((x) => x.name.toLowerCase() === "subject")
            ?.value || "Sem assunto";
        const assessment = assessEmail(
          subject,
          content.scanText,
          content.flags,
        );
        // Scan every inline alternative before selecting the visible, fresh text.
        assessment.text = assessEmail("", content.text).text;
        const references = codes(subject + " " + assessment.text);
        let reason =
          assessment.status === "QUARANTINED"
            ? "Conteúdo isolado por política de segurança. Sem envio à IA ou aplicação automática. O original permanece no Gmail."
            : !auth.valid
              ? "Autenticidade insuficiente, mensagem automática ou domínio não permitido."
              : references.length > 1
                ? "Múltiplos códigos: correlação ambígua."
                : "Mensagem institucional: confirmar identidade e proposta no painel antes de aplicar. Aprovações por e-mail exigem corroboração humana.";
        if (content.attachments)
          reason += " Anexos ignorados: " + content.attachments + ".";
        let proposal: Interpretation | undefined;
        if (
          assessment.status === "REVIEW" &&
          auth.valid &&
          references.length <= 1 &&
          env.AI_PROVIDER === "openai" &&
          aiCalls < 2
        ) {
          aiCalls++;
          try {
            proposal = await interpret(
              assessment.text,
              null,
              localDate(new Date()),
              await configuredAi(env, repo),
            );
          } catch {
            reason +=
              " Falha de extração: entrada preservada para revisão humana.";
          }
        }
        await storeEmailReview(repo, {
          mailbox: mailboxKey,
          providerId: id,
          sender: auth.sender || "desconhecido",
          assessment,
          reason,
          proposal,
        });
        imported++;
      }
      operation.check();
      const hasMore = pending.length > batch.length;
      // Keep the history and recovery anchor until all messages have a durable
      // review record; subsequent batches skip records already stored.
      if (!hasMore)
        await repo.db
          .prepare(
            "UPDATE gmail_sync_state SET history_id=?,last_sync_at=?,last_error=NULL WHERE id=?",
          )
          .bind(profile.historyId, new Date().toISOString(), mailboxKey)
          .run();
      return {
        imported,
        recovered,
        hasMore,
        aiCalls,
        cutoff: localDate(new Date()),
      };
    } catch (e) {
      await repo.db
        .prepare("UPDATE gmail_sync_state SET last_error=? WHERE id=?")
        .bind(
          "Falha na comunicação Gmail; verifique a autorização da conta.",
          mailboxKey,
        )
        .run();
      throw e;
    } finally {
      await repo.db
        .prepare(
          "UPDATE gmail_sync_state SET lease_until=0 WHERE id=? AND lease_until=?",
        )
        .bind(mailboxKey, lease)
        .run();
    }
  } finally {
    await operation.release();
  }
}
export function rawMail(
  from: string,
  to: string,
  subject: string,
  body: string,
  id: string,
) {
  for (const value of [from, to, subject, id])
    assert(!/[\r\n]/.test(value), "MAIL_HEADER", "Cabeçalho inválido.");
  const headerSubject =
    "=?UTF-8?B?" +
    btoa(String.fromCharCode(...new TextEncoder().encode(subject))) +
    "?=";
  const text = `From: ${from}\r\nTo: ${to}\r\nSubject: ${headerSubject}\r\nMessage-ID: <${id.replace(/[^a-zA-Z0-9.-]/g, "-")}@siga.local>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${btoa(String.fromCharCode(...new TextEncoder().encode(body)))}`;
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function sendSecurityMail(
  env: RuntimeEnv,
  to: string,
  subject: string,
  body: string,
  signal: AbortSignal,
) {
  assert(
    env.SIMULATION_MODE !== "true" &&
      env.EMAIL_SEND_ENABLED === "true" &&
      env.MAILBOX_ID,
    "PASSWORD_MAIL_SETUP",
    "Envio de recuperação desativado.",
    503,
  );
  assert(
    /^[^\s@<>\r\n]+@[^\s@<>\r\n]+$/.test(to) && !to.endsWith(".invalid"),
    "MAIL_RECIPIENT",
    "Destinatário inválido.",
  );
  const token = await accessToken(env, signal);
  const profile = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    {
      headers: { Authorization: "Bearer " + token },
      signal,
      redirect: "manual",
    },
  );
  assert(profile.ok, "GMAIL_PROFILE", "Falha na comunicação Gmail.", 503);
  const data = (await boundedJson(profile, 24000)) as { emailAddress?: string };
  assert(
    data.emailAddress?.toLowerCase() === env.MAILBOX_ID.toLowerCase(),
    "MAILBOX_MISMATCH",
    "Envio bloqueado: conta Gmail divergente.",
    503,
  );
  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: rawMail(env.MAILBOX_ID, to, subject, body, crypto.randomUUID()),
      }),
      signal,
      redirect: "manual",
    },
  );
  assert(
    response.ok,
    "GMAIL_SEND",
    "Não foi possível enviar a recuperação.",
    503,
  );
  await boundedJson(response, 24000);
}
export async function dispatchMail(repo: Repository, env: RuntimeEnv) {
  if (env.SIMULATION_MODE === "true" || env.EMAIL_SEND_ENABLED !== "true")
    return { sent: 0, disabled: true };
  assert(env.MAILBOX_ID, "MAILBOX", "Caixa não configurada.");
  const operation = await gmailOperation(repo, env);
  try {
    const token = await accessToken(env, operation.signal());
    operation.check();
    const profileResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      {
        headers: { Authorization: "Bearer " + token },
        redirect: "manual",
        signal: operation.signal(),
      },
    );
    assert(
      profileResponse.ok,
      "GMAIL_PROFILE",
      "Falha ao verificar remetente Gmail.",
      503,
    );
    const profile = (await boundedJson(profileResponse, 24000)) as {
      emailAddress?: string;
    };
    assert(
      profile.emailAddress?.toLowerCase() === env.MAILBOX_ID.toLowerCase(),
      "MAILBOX_MISMATCH",
      "OAuth pertence a outra caixa. Envio bloqueado.",
      403,
    );
    const rows = (
      await repo.db
        .prepare(
          "SELECT * FROM outbound_messages WHERE status='PENDENTE' AND mailbox_id=? ORDER BY created_at,id LIMIT 10",
        )
        .bind(env.OUTBOX_MAILBOX_ID || repo.outboxMailboxId)
        .all<{
          id: string;
          recipient_email: string;
          subject: string;
          body_text: string;
        }>()
    ).results;
    let sent = 0;
    for (const row of rows) {
      operation.check();
      assert(
        !/\.(test|invalid)$/i.test(row.recipient_email),
        "SYNTHETIC_RECIPIENT",
        "Destinatário sintético não pode receber e-mail real.",
      );
      const claim = await repo.db
        .prepare(
          "UPDATE outbound_messages SET status='ERRO',failure_reason='EM_ENVIO: não repetir automaticamente sem reconciliar Message-ID' WHERE id=? AND status='PENDENTE' RETURNING id",
        )
        .bind(row.id)
        .first();
      if (!claim) continue;
      const response = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            raw: rawMail(
              env.MAILBOX_ID,
              row.recipient_email,
              row.subject,
              row.body_text,
              row.id,
            ),
          }),
          redirect: "manual",
          signal: operation.signal(),
        },
      );
      if (!response.ok) continue;
      const result = (await boundedJson(response)) as { id: string };
      await repo.db
        .prepare(
          "UPDATE outbound_messages SET status='ENVIADO',provider_message_id=?,dispatched_at=?,failure_reason=NULL WHERE id=?",
        )
        .bind(result.id, new Date().toISOString(), row.id)
        .run();
      sent++;
    }
    return { sent };
  } finally {
    await operation.release();
  }
}
