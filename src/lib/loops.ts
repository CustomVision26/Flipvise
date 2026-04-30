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
    await client.createContact(email, {
      userId: props.userId,
      ...(props.firstName ? { firstName: props.firstName } : {}),
      ...(props.lastName ? { lastName: props.lastName } : {}),
      userGroup: props.userGroup ?? "free",
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
    await client.updateContact(email, {
      userId: props.userId,
      ...(props.firstName != null ? { firstName: props.firstName } : {}),
      ...(props.lastName != null ? { lastName: props.lastName } : {}),
      ...(props.userGroup ? { userGroup: props.userGroup } : {}),
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
};

/**
 * Sends a quiz-result transactional email via Loops.
 * Template ID is read from LOOPS_QUIZ_RESULT_TRANSACTIONAL_ID.
 * Silently no-ops when the variable is absent or Loops is unconfigured.
 *
 * Pass `pdfBuffer` to include the quiz result PDF as an email attachment.
 */
export async function loopsSendQuizResultEmail(
  payload: QuizResultEmailPayload,
  pdfBuffer?: Buffer,
): Promise<void> {
  const transactionalId = process.env.LOOPS_QUIZ_RESULT_TRANSACTIONAL_ID;
  if (!transactionalId) return;

  const safeName = payload.deckName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const attachments: EmailAttachment[] | undefined = pdfBuffer
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
      correct: payload.correct,
      incorrect: payload.incorrect,
      unanswered: payload.unanswered,
      total: payload.total,
      percent: payload.percent,
      elapsedSeconds: payload.elapsedSeconds,
      isOwnerCopy: payload.isOwnerCopy,
    },
    attachments,
  );
}

// ---------------------------------------------------------------------------
// Send a transactional email by its Loops template ID
// ---------------------------------------------------------------------------

type EmailAttachment = {
  /** File name shown to the recipient (e.g. "quiz_result.pdf"). */
  filename: string;
  contentType: string;
  /** Base-64 encoded file content. */
  data: string;
};

export async function loopsSendTransactional(
  email: string,
  transactionalId: string,
  dataVariables?: Record<string, string | number>,
  attachments?: EmailAttachment[],
): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    await client.sendTransactionalEmail({
      transactionalId,
      email,
      ...(dataVariables ? { dataVariables } : {}),
      ...(attachments?.length ? { attachments } : {}),
    });
  } catch (err) {
    console.error(`[Loops] sendTransactionalEmail(${transactionalId}) failed:`, err);
  }
}
