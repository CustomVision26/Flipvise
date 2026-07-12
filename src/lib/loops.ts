import { LoopsClient } from "loops";
import { resolveAppUrl } from "@/lib/stripe";

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
 * **When it sends:** `inviteTeamMemberAction` calls this only when the invitee email has
 * **no** matching Clerk account at invite time. Registered users receive the invitation in
 * **dashboard inbox** (and optional native push) — no Loops email.
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
// Marketing affiliate invitation (transactional)
// ---------------------------------------------------------------------------

/**
 * Data variables for `LOOPS_AFFILIATE_INVITATION_TRANSACTIONAL_ID`.
 * Define the same keys in Loops (case-sensitive).
 *
 * **`inviteAffiliateAction` / reopened expired pending edits:** transactional email sends only when the invitee email
 * has **no** Clerk match at save time — registered invitees rely on dashboard inbox (`clearAffiliateInboxUnreadForInvitee`).
 *
 * | Variable | Purpose |
 * |----------|---------|
 * | `subjectLine` | Full subject (Loops Subject can be `{DATA_VARIABLE:subjectLine}`). |
 * | `acceptAffiliateUrl` | Primary CTA — `/affiliate/accept?token=…` (sign in with invited email to accept). |
 * | `dashboardInboxUrl` | `/dashboard/inbox` for users who already see the invite in-app. |
 * | `inviteeEmail` | Invited address (normalized). |
 * | `affiliateName` | Display name for this affiliate arrangement. |
 * | `planAssigned` | Plan slug (e.g. `pro`, `pro_team_basic`). |
 * | `planLabel` | Human-readable plan name. |
 * | `affiliateEndsAt` | Grant end date copy for the email body. |
 * | `inviteExpiresInDays` | Number of days the accept link stays valid (matches server policy). |
 * | `inviteExpiresAt` | Human-readable date/time when the accept link expires. |
 * | `inviterName` | Platform admin who sent the invite. |
 */
export type AffiliateInvitationEmailPayload = {
  inviteeEmail: string;
  affiliateName: string;
  planAssigned: string;
  planLabel: string;
  /** e.g. "May 2, 2027" */
  affiliateEndsAt: string;
  /** Integer day count for the invite acceptance window. */
  inviteExpiresInDays: number;
  /** e.g. "May 16, 2026" — when the link stops working if not accepted. */
  inviteExpiresAt: string;
  inviterName: string;
  acceptAffiliateUrl: string;
  dashboardInboxUrl: string;
  subjectLine: string;
};

export async function loopsSendAffiliateInvitationEmail(
  payload: AffiliateInvitationEmailPayload,
): Promise<void> {
  if (!process.env.LOOPS_API_KEY?.trim()) {
    return;
  }

  const transactionalId = process.env.LOOPS_AFFILIATE_INVITATION_TRANSACTIONAL_ID?.trim();
  if (!transactionalId) {
    console.warn(
      "[AffiliateInviteEmail] LOOPS_API_KEY is set but LOOPS_AFFILIATE_INVITATION_TRANSACTIONAL_ID is missing — affiliate invitation emails will not send. Add the transactional template ID from Loops (Settings → API → transactional emails).",
    );
    return;
  }

  await loopsSendTransactional(payload.inviteeEmail, transactionalId, {
    subjectLine: payload.subjectLine,
    acceptAffiliateUrl: payload.acceptAffiliateUrl,
    dashboardInboxUrl: payload.dashboardInboxUrl,
    inviteeEmail: payload.inviteeEmail,
    affiliateName: payload.affiliateName,
    planAssigned: payload.planAssigned,
    planLabel: payload.planLabel,
    affiliateEndsAt: payload.affiliateEndsAt,
    inviteExpiresInDays: payload.inviteExpiresInDays,
    inviteExpiresAt: payload.inviteExpiresAt,
    inviterName: payload.inviterName,
  });
}

// ---------------------------------------------------------------------------
// Marketing affiliate arrangement updated (active / post-acceptance)
// ---------------------------------------------------------------------------

/**
 * Data variables for `LOOPS_AFFILIATE_ARRANGEMENT_UPDATE_TRANSACTIONAL_ID`.
 * Use the same keys in Loops (case-sensitive).
 *
 * **Deployment note:** `updateAffiliateAction` defers active plan/end changes via in-app inbox only
 * (this helper is not wired there). Kept for forks or re-enabling transactional mail.
 *
 * | Variable | Purpose |
 * |----------|---------|
 * | `subjectLine` | Full subject (e.g. `{DATA_VARIABLE:subjectLine}`). |
 * | `affiliateName` | Arrangement display name. |
 * | `planAssigned` | Plan slug. |
 * | `planLabel` | Human-readable plan. |
 * | `affiliateEndsAt` | New grant end date (long format). |
 * | `previousAffiliateEndsAt` | Prior grant end date (long format). |
 * | `dashboardInboxUrl` | Link to `/dashboard/inbox`. |
 * | `inviteeEmail` | Recipient. |
 * | `inviterName` | Admin who saved the update. |
 * | `confirmArrangementChangeUrl` | Affiliate confirms via `/affiliate/confirm-arrangement?token=` before the plan/date change applies. |
 * | `confirmationExpiresAt` | When that link expires (long format). |
 * | `currentPlanLabel` | Human-readable plan still in effect until they accept. |
 * | `currentEndsAtFormatted` | Affiliation end date still in effect until they accept. |
 */
export type AffiliateArrangementUpdateEmailPayload = {
  inviteeEmail: string;
  affiliateName: string;
  planAssigned: string;
  planLabel: string;
  affiliateEndsAt: string;
  previousAffiliateEndsAt: string;
  inviterName: string;
  dashboardInboxUrl: string;
  subjectLine: string;
  confirmArrangementChangeUrl: string;
  confirmationExpiresAt: string;
  currentPlanLabel: string;
  currentEndsAtFormatted: string;
};

export async function loopsSendAffiliateArrangementUpdateEmail(
  payload: AffiliateArrangementUpdateEmailPayload,
): Promise<void> {
  if (!process.env.LOOPS_API_KEY?.trim()) {
    return;
  }

  const transactionalId = process.env.LOOPS_AFFILIATE_ARRANGEMENT_UPDATE_TRANSACTIONAL_ID?.trim();
  if (!transactionalId) {
    console.warn(
      "[AffiliateArrangementUpdateEmail] LOOPS_API_KEY is set but LOOPS_AFFILIATE_ARRANGEMENT_UPDATE_TRANSACTIONAL_ID is missing — arrangement update emails will not send.",
    );
    return;
  }

  await loopsSendTransactional(payload.inviteeEmail, transactionalId, {
    subjectLine: payload.subjectLine,
    affiliateName: payload.affiliateName,
    planAssigned: payload.planAssigned,
    planLabel: payload.planLabel,
    affiliateEndsAt: payload.affiliateEndsAt,
    previousAffiliateEndsAt: payload.previousAffiliateEndsAt,
    dashboardInboxUrl: payload.dashboardInboxUrl,
    inviteeEmail: payload.inviteeEmail,
    inviterName: payload.inviterName,
    confirmArrangementChangeUrl: payload.confirmArrangementChangeUrl,
    confirmationExpiresAt: payload.confirmationExpiresAt,
    currentPlanLabel: payload.currentPlanLabel,
    currentEndsAtFormatted: payload.currentEndsAtFormatted,
  });
}

// ---------------------------------------------------------------------------
// Account banned / unbanned (admin action)
// ---------------------------------------------------------------------------

/**
 * Data variables for `LOOPS_ACCOUNT_BANNED_TRANSACTIONAL_ID` and
 * `LOOPS_ACCOUNT_UNBANNED_TRANSACTIONAL_ID`. Define the same keys in each Loops
 * template (case-sensitive).
 *
 * | Variable | Purpose |
 * |----------|---------|
 * | `subjectLine` | Full subject (`{DATA_VARIABLE:subjectLine}` in Loops). |
 * | `accountState` | `"banned"` or `"unbanned"` (matches which template fired). |
 * | `statusHeadLine` | Short title — use in **banned** template (`{DATA_VARIABLE:statusHeadLine}`). |
 * | `statusHeadline` | Same value — use in **unbanned** template if it expects lowercase `line`. |
 * | `statusMessage` | Plain-language explanation of what changed. |
 * | `userName` | Display name of the affected user. |
 * | `userEmail` | Recipient address (duplicate for template convenience). |
 * | `homeUrl` | App origin from `NEXT_PUBLIC_APP_URL`. |
 * | `signInUrl` | Same as `homeUrl` — homepage sign-in entry point. |
 * | `actionAt` | When the ban/unban was applied (locale-formatted). |
 */
export type AccountStatusEmailPayload = {
  email: string;
  userName: string;
  accountState: "banned" | "unbanned";
};

export type AccountStatusEmailResult =
  | { sent: true }
  | { sent: false; reason: string };

function formatAccountStatusActionAt(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function resolveAccountStatusTransactionalId(
  accountState: AccountStatusEmailPayload["accountState"],
): string | null {
  const legacy = process.env.LOOPS_ACCOUNT_STATUS_TRANSACTIONAL_ID?.trim();
  const bannedId = process.env.LOOPS_ACCOUNT_BANNED_TRANSACTIONAL_ID?.trim();
  const unbannedId = process.env.LOOPS_ACCOUNT_UNBANNED_TRANSACTIONAL_ID?.trim();
  if (accountState === "banned") {
    return bannedId || legacy || null;
  }
  return unbannedId || legacy || null;
}

function accountStatusEmailFailureReason(err: unknown): string {
  if (isLoopsLikeErr(err)) {
    if (err.statusCode === 404) {
      return "Loops transactional template not found — confirm the template is published and the env transactional ID matches.";
    }
    const detail =
      err.json && typeof err.json === "object" && "message" in err.json
        ? String((err.json as { message: unknown }).message)
        : err.message;
    return detail?.trim() ? detail : `Loops API error (HTTP ${err.statusCode})`;
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return "Loops failed to send the notification email.";
}

export async function loopsSendAccountStatusEmail(
  payload: AccountStatusEmailPayload,
): Promise<AccountStatusEmailResult> {
  const client = getClient();
  if (!client) {
    return { sent: false, reason: "Loops is not configured (LOOPS_API_KEY missing)." };
  }

  const transactionalId = resolveAccountStatusTransactionalId(payload.accountState);
  if (!transactionalId) {
    const envHint =
      payload.accountState === "banned"
        ? "LOOPS_ACCOUNT_BANNED_TRANSACTIONAL_ID"
        : "LOOPS_ACCOUNT_UNBANNED_TRANSACTIONAL_ID";
    return {
      sent: false,
      reason: `${envHint} is not set — add your published Loops transactional ID to env.`,
    };
  }

  const appUrl = resolveAppUrl();
  const isBanned = payload.accountState === "banned";
  const subjectLine = isBanned
    ? "Your Flipvise account has been suspended"
    : "Your Flipvise account has been restored";
  const statusHeadLine = isBanned ? "Account suspended" : "Account restored";
  const statusMessage = isBanned
    ? "A platform administrator has suspended your Flipvise account. You can no longer sign in or use the app until your account is restored. If you believe this was done in error, contact support with the email address on this account."
    : "Your Flipvise account has been restored. You can sign in again and use Flipvise as usual.";

  try {
    await client.sendTransactionalEmail({
      transactionalId,
      email: payload.email,
      dataVariables: {
        subjectLine,
        accountState: payload.accountState,
        statusHeadLine,
        // Loops templates are case-sensitive; banned vs unbanned IDs may use different keys.
        statusHeadline: statusHeadLine,
        statusMessage,
        userName: payload.userName,
        userEmail: payload.email,
        homeUrl: appUrl,
        signInUrl: appUrl,
        actionAt: formatAccountStatusActionAt(new Date()),
      },
    });
    return { sent: true };
  } catch (err) {
    const reason = accountStatusEmailFailureReason(err);
    console.error(
      `[AccountStatusEmail] send failed (${payload.accountState}, ${transactionalId}):`,
      err,
    );
    return { sent: false, reason };
  }
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
      if (reportErr.statusCode === 404) {
        console.warn(
          "[Loops] 404 usually means the transactional is still a draft: open Loops → Transactional emails, open this template, finish the message, then click Publish. Confirm the env transactional ID matches this published template (same workspace as LOOPS_API_KEY).",
        );
      }
    } else {
      console.error(`[Loops] sendTransactionalEmail(${transactionalId}) failed:`, reportErr);
    }
  }
}

// ---------------------------------------------------------------------------
// Account deletion proration receipt (transactional)
// ---------------------------------------------------------------------------

/**
 * Data variables for `LOOPS_DELETION_PRORATION_RECEIPT_TRANSACTIONAL_ID`.
 * Keys are case-sensitive in Loops — use `{DATA_VARIABLE:key}` in the template.
 *
 * | Variable | Example | Purpose |
 * |----------|---------|---------|
 * | `subjectLine` | Your Flipvise refund receipt | Email subject (`{DATA_VARIABLE:subjectLine}`). |
 * | `statusHeadline` | Prorated refund confirmation | Short heading in the body. |
 * | `bodyMessage` | Full explanatory paragraph | Pre-written summary; edit in Loops if desired. |
 * | `userDisplayName` | Jane Doe | Greeting name (or "Flipvise customer"). |
 * | `userEmail` | jane@example.com | Account email the refund applies to. |
 * | `planLabel` | Pro Plus | Plan they had when they deleted. |
 * | `refundAmount` | $12.34 USD | Formatted refund total (Intl currency). |
 * | `deletedAt` | April 10, 2026 | Date account was deleted (long locale format). |
 * | `stripeRefundId` | re_abc123 or Pending | Stripe refund reference for support. |
 * | `homeUrl` | https://flipvise… | App origin (`NEXT_PUBLIC_APP_URL`). |
 * | `contactUrl` | https://flipvise…/contact | Contact/support page. |
 */
export type DeletionProrationReceiptPayload = {
  recipientEmail: string;
  userDisplayName: string;
  planLabel: string;
  refundAmount: string;
  deletedAt: string;
  stripeRefundId: string | null;
};

export async function sendDeletionProrationReceiptEmail(
  payload: DeletionProrationReceiptPayload,
): Promise<{ sent: boolean; reason?: string }> {
  const transactionalId =
    process.env.LOOPS_DELETION_PRORATION_RECEIPT_TRANSACTIONAL_ID?.trim();
  if (!transactionalId) {
    return {
      sent: false,
      reason:
        "LOOPS_DELETION_PRORATION_RECEIPT_TRANSACTIONAL_ID is not set — configure a Loops transactional template or rely on Stripe refund emails.",
    };
  }

  const appUrl = resolveAppUrl();
  const refundRef = payload.stripeRefundId?.trim() || "Pending";
  const subjectLine = `Your Flipvise refund receipt — ${payload.refundAmount}`;
  const statusHeadline = "Prorated refund confirmation";
  const bodyMessage = `You deleted your Flipvise account on ${payload.deletedAt} while your ${payload.planLabel} subscription still had unused paid time. We issued a prorated refund of ${payload.refundAmount} to your original payment method. Banks typically post refunds within 5–10 business days. Reference: ${refundRef}.`;

  try {
    await loopsSendTransactional(payload.recipientEmail, transactionalId, {
      subjectLine,
      statusHeadline,
      bodyMessage,
      userDisplayName: payload.userDisplayName,
      userEmail: payload.recipientEmail,
      planLabel: payload.planLabel,
      refundAmount: payload.refundAmount,
      deletedAt: payload.deletedAt,
      stripeRefundId: refundRef,
      homeUrl: appUrl,
      contactUrl: `${appUrl}/contact`,
    });
    return { sent: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Loops send failed.";
    console.error("[DeletionProrationReceipt] send failed:", err);
    return { sent: false, reason };
  }
}
