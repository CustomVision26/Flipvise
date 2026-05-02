import { LoopsClient } from "loops";

// ---------------------------------------------------------------------------
// Singleton client — returns null if LOOPS_API_KEY is not configured so the
// app degrades gracefully in environments where the key is absent.
// ---------------------------------------------------------------------------
let _client: LoopsClient | null = null;

function getClient(): LoopsClient | null {
  if (_client) return _client;
  const apiKey = process.env.LOOPS_API_KEY;
  if (!apiKey) return null;
  _client = new LoopsClient(apiKey);
  return _client;
}

// ---------------------------------------------------------------------------
// Contact property shape we sync to Loops
// ---------------------------------------------------------------------------
type ContactProperties = {
  userId: string;
  firstName?: string | null;
  lastName?: string | null;
  userGroup?: string;
};

// ---------------------------------------------------------------------------
// Create a new contact when a user signs up
// ---------------------------------------------------------------------------
export async function loopsCreateContact(
  email: string,
  props: ContactProperties,
): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    await client.createContact({
      email,
      properties: {
        userId: props.userId,
        ...(props.firstName ? { firstName: props.firstName } : {}),
        ...(props.lastName ? { lastName: props.lastName } : {}),
        userGroup: props.userGroup ?? "free",
      },
    });
  } catch (err) {
    console.error("[Loops] createContact failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Keep contact data fresh on user.updated
// ---------------------------------------------------------------------------
export async function loopsUpdateContact(
  email: string,
  props: ContactProperties,
): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    await client.updateContact({
      email,
      properties: {
        userId: props.userId,
        ...(props.firstName != null ? { firstName: props.firstName } : {}),
        ...(props.lastName != null ? { lastName: props.lastName } : {}),
        ...(props.userGroup ? { userGroup: props.userGroup } : {}),
      },
    });
  } catch (err) {
    console.error("[Loops] updateContact failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Remove contact when a user deletes their account
// ---------------------------------------------------------------------------
export async function loopsDeleteContact(email: string): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    await client.deleteContact({ email });
  } catch (err) {
    console.error("[Loops] deleteContact failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Fire a named event — useful for welcome flow, plan upgrades, etc.
// The contact is created automatically if it doesn't exist yet.
// ---------------------------------------------------------------------------
export async function loopsSendEvent(
  email: string,
  eventName: string,
  contactProperties?: ContactProperties,
): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    await client.sendEvent({
      email,
      eventName,
      ...(contactProperties
        ? {
            contactProperties: {
              userId: contactProperties.userId,
              ...(contactProperties.firstName
                ? { firstName: contactProperties.firstName }
                : {}),
              ...(contactProperties.lastName
                ? { lastName: contactProperties.lastName }
                : {}),
              userGroup: contactProperties.userGroup ?? "free",
            },
          }
        : {}),
    });
  } catch (err) {
    console.error(`[Loops] sendEvent(${eventName}) failed:`, err);
  }
}

// ---------------------------------------------------------------------------
// Quiz-result notification email
// ---------------------------------------------------------------------------

export type QuizResultEmailPayload = {
  /** Recipient's primary email address. */
  email: string;
  /** Display name of the recipient (used in greeting). */
  userName: string;
  /**
   * Display name of the quiz-taker.
   * For personal quizzes this equals userName.
   * For owner-copy emails this is the team member who took the quiz.
   */
  memberName: string;
  deckName: string;
  /** Team workspace display name; empty string when the quiz is not on a team deck. */
  teamName: string;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  /** Integer 0–100. */
  percent: number;
  elapsedSeconds: number;
  /**
   * True when this email is sent to the team owner rather than the quiz-taker.
   * Pass as 1/0 because Loops dataVariables only accept string | number.
   */
  isOwnerCopy: 0 | 1;
  /** Absolute URL to view or download the result in the app (signed-in). */
  viewUrl: string;
  /** Full subject line text (Loops Subject field can be `{DATA_VARIABLE:subjectLine}` only). */
  subjectLine: string;
  /** Short motivational line for the template (e.g. quote excerpt or tier message). */
  performanceMessage: string;
  /**
   * Which transactional template ID to use (`LOOPS_QUIZ_RESULT_*` env vars).
   * - `taker`: personal deck, workspace owner on a team deck, or any save where the OWNER Loops template does not apply.
   * - `owner`: **only** team-workspace save when taker is an invited member/admin (two sends). See `.cursor/rules/loops-quiz-result-email.mdc`.
   */
  loopsTemplateRole: "taker" | "owner";
};

function resolveQuizResultTransactionalId(templateRole: "taker" | "owner"): string | null {
  const legacy = process.env.LOOPS_QUIZ_RESULT_TRANSACTIONAL_ID?.trim();
  const takerId = process.env.LOOPS_QUIZ_RESULT_TAKER_TRANSACTIONAL_ID?.trim();
  const ownerId = process.env.LOOPS_QUIZ_RESULT_OWNER_TRANSACTIONAL_ID?.trim();
  if (templateRole === "owner") {
    return ownerId || legacy || null;
  }
  return takerId || legacy || null;
}

/**
 * Sends a quiz-result transactional email via Loops.
 *
 * Template selection uses `payload.loopsTemplateRole`:
 * - `taker` → `LOOPS_QUIZ_RESULT_TAKER_TRANSACTIONAL_ID`, else legacy `LOOPS_QUIZ_RESULT_TRANSACTIONAL_ID`.
 * - `owner` → `LOOPS_QUIZ_RESULT_OWNER_TRANSACTIONAL_ID`, else legacy (team-workspace save, invited member/admin only — two sends; see `sendQuizResultEmails`).
 *
 * Silently no-ops when no transactional ID resolves or Loops is unconfigured.
 *
 * Pass `pdfBuffer` only when `LOOPS_QUIZ_RESULT_ATTACH_PDF=true`; otherwise omit (default).
 */
export async function loopsSendQuizResultEmail(
  payload: QuizResultEmailPayload,
  pdfBuffer?: Buffer,
): Promise<void> {
  if (!process.env.LOOPS_API_KEY?.trim()) {
    console.warn("[QuizEmail] Loops send skipped: LOOPS_API_KEY is not set.");
    return;
  }

  const transactionalId = resolveQuizResultTransactionalId(payload.loopsTemplateRole);
  if (!transactionalId) {
    const hint =
      payload.loopsTemplateRole === "owner"
        ? "Set LOOPS_QUIZ_RESULT_OWNER_TRANSACTIONAL_ID or LOOPS_QUIZ_RESULT_TRANSACTIONAL_ID."
        : "Set LOOPS_QUIZ_RESULT_TAKER_TRANSACTIONAL_ID or LOOPS_QUIZ_RESULT_TRANSACTIONAL_ID.";
    console.warn(`[QuizEmail] Loops send skipped (${payload.loopsTemplateRole} template): ${hint}`);
    return;
  }

  const attachPdf = isQuizResultPdfAttachmentEnabled();

  const safeName = payload.deckName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const attachments: EmailAttachment[] | undefined =
    attachPdf && pdfBuffer
      ? [
          {
            filename: `quiz_result_${safeName}.pdf`,
            contentType: "application/pdf",
            data: pdfBuffer.toString("base64"),
          },
        ]
      : undefined;

  await loopsSendTransactional(
    payload.email,
    transactionalId,
    {
      userName: payload.userName,
      memberName: payload.memberName,
      deckName: payload.deckName,
      teamName: payload.teamName,
      correct: payload.correct,
      incorrect: payload.incorrect,
      unanswered: payload.unanswered,
      total: payload.total,
      percent: payload.percent,
      elapsedSeconds: payload.elapsedSeconds,
      isOwnerCopy: payload.isOwnerCopy,
      viewUrl: payload.viewUrl,
      subjectLine: payload.subjectLine,
      performanceMessage: payload.performanceMessage,
    },
    attachments,
  );
}

// ---------------------------------------------------------------------------
// Team workspace invitation (transactional)
// ---------------------------------------------------------------------------

/**
 * Data variables sent to Loops for `LOOPS_TEAM_INVITATION_TRANSACTIONAL_ID`.
 * Use the same keys in your transactional template (case-sensitive).
 *
 * | Variable | Purpose |
 * |----------|---------|
 * | `subjectLine` | Full subject line (set Subject in Loops to `{DATA_VARIABLE:subjectLine}`). |
 * | `acceptInvitationUrl` | **Primary link** — opens the invite landing page; signing in with the invited email lets them accept (`/invite/team/{token}`). |
 * | `dashboardInboxUrl` | Link to `/dashboard/inbox` when they already have an account (invitation also appears in-app). |
 * | `inviteeEmail` | Normalized recipient email. |
 * | `inviteeName` | Optional label from the invite form; empty string if omitted. |
 * | `workspaceName` | Team workspace display name. |
 * | `roleLabel` | `"Member"` or `"Team admin"`. |
 * | `inviterName` | Display name of the person who sent the invite. |
 * | `expiresInDays` | Number of days until the invite link expires (matches app policy). |
 */
export type TeamInvitationEmailPayload = {
  inviteeEmail: string;
  inviteeDisplayName: string;
  workspaceName: string;
  /** `"Member"` or `"Team admin"` */
  roleLabel: string;
  inviterName: string;
  /** Absolute URL to `/invite/team/{token}` — use as the main “Accept invitation” button href. */
  acceptInvitationUrl: string;
  /** Absolute URL to `/dashboard/inbox` for signed-in users who see the invite in-app. */
  dashboardInboxUrl: string;
  expiresInDays: number;
  subjectLine: string;
};

export async function loopsSendTeamInvitationEmail(
  payload: TeamInvitationEmailPayload,
): Promise<void> {
  if (!process.env.LOOPS_API_KEY?.trim()) {
    // Intentionally quiet: many dev environments omit Loops; invite still succeeds in-app.
    return;
  }

  const transactionalId = process.env.LOOPS_TEAM_INVITATION_TRANSACTIONAL_ID?.trim();
  if (!transactionalId) {
    console.warn(
      "[TeamInviteEmail] LOOPS_API_KEY is set but LOOPS_TEAM_INVITATION_TRANSACTIONAL_ID is missing — invitation emails will not send. Add your transactional template ID from Loops (Settings → API → transactional emails).",
    );
    return;
  }

  await loopsSendTransactional(payload.inviteeEmail, transactionalId, {
    subjectLine: payload.subjectLine,
    acceptInvitationUrl: payload.acceptInvitationUrl,
    dashboardInboxUrl: payload.dashboardInboxUrl,
    inviteeEmail: payload.inviteeEmail,
    inviteeName: payload.inviteeDisplayName,
    workspaceName: payload.workspaceName,
    roleLabel: payload.roleLabel,
    inviterName: payload.inviterName,
    expiresInDays: payload.expiresInDays,
  });
}

// ---------------------------------------------------------------------------
// Send a transactional email by its Loops template ID
// ---------------------------------------------------------------------------

/**
 * Quiz-result emails attach a PDF only when `LOOPS_QUIZ_RESULT_ATTACH_PDF=true` (opt-in).
 * Default is off so Loops free/low tiers and CPU are not burned generating PDFs.
 */
export function isQuizResultPdfAttachmentEnabled(): boolean {
  const raw = process.env.LOOPS_QUIZ_RESULT_ATTACH_PDF;
  if (raw == null || raw === "") return false;
  const s = raw.replace(/^\uFEFF/, "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

type EmailAttachment = {
  /** File name shown to the recipient (e.g. "quiz_result.pdf"). */
  filename: string;
  contentType: string;
  /** Base-64 encoded file content. */
  data: string;
};

/** Loops returns 400 with path `attachments` when the workspace plan disallows API attachments. */
function isLoopsLikeErr(err: unknown): err is {
  statusCode: number;
  message?: string;
  json?: { path?: string; message?: string } | null;
  rawBody?: string;
} {
  return Boolean(
    err &&
      typeof err === "object" &&
      "statusCode" in err &&
      typeof (err as { statusCode: unknown }).statusCode === "number",
  );
}

function isLoopsAttachmentsDisallowedError(err: unknown): boolean {
  if (!isLoopsLikeErr(err) || err.statusCode !== 400) return false;
  const j = err.json ?? undefined;
  if (j && typeof j === "object" && "path" in j && (j as { path: string }).path === "attachments") {
    return true;
  }
  const msg =
    (j && typeof j === "object" && "message" in j && typeof (j as { message: unknown }).message === "string"
      ? (j as { message: string }).message
      : err.message) ?? "";
  return /attachment/i.test(msg) && /not allowed|upgrade|plan/i.test(msg);
}

export async function loopsSendTransactional(
  email: string,
  transactionalId: string,
  dataVariables?: Record<string, string | number>,
  attachments?: EmailAttachment[],
): Promise<void> {
  const client = getClient();
  if (!client) {
    console.warn("[Loops] sendTransactional skipped: LOOPS_API_KEY is not set.");
    return;
  }

  try {
    await client.sendTransactionalEmail({
      transactionalId,
      email,
      ...(dataVariables ? { dataVariables } : {}),
      ...(attachments?.length ? { attachments } : {}),
    });
  } catch (firstErr) {
    let reportErr: unknown = firstErr;

    if (attachments?.length && isLoopsAttachmentsDisallowedError(firstErr)) {
      console.warn(
        "[Loops] Attachments not allowed on your Loops plan — retrying email without PDF. Enable transactional attachments in Loops or leave quiz PDF attachments off (default). Set LOOPS_QUIZ_RESULT_ATTACH_PDF=true only if your Loops plan supports API attachments.",
      );
      try {
        await client.sendTransactionalEmail({
          transactionalId,
          email,
          ...(dataVariables ? { dataVariables } : {}),
        });
        return;
      } catch (retryErr) {
        reportErr = retryErr;
      }
    }

    if (isLoopsLikeErr(reportErr)) {
      console.error(
        `[Loops] sendTransactionalEmail(${transactionalId}) HTTP ${reportErr.statusCode}:`,
        reportErr.message,
        reportErr.json ?? reportErr.rawBody,
      );
    } else {
      console.error(`[Loops] sendTransactionalEmail(${transactionalId}) failed:`, reportErr);
    }
  }
}
