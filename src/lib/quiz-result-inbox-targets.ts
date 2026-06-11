export const QUIZ_RESULT_INBOX_TARGETS = ["user", "owner"] as const;

export type QuizResultInboxTarget = (typeof QUIZ_RESULT_INBOX_TARGETS)[number];

export function resolveQuizResultInboxRecipients(
  userId: string,
  ownerUserId: string | null,
  inboxTargets?: QuizResultInboxTarget[],
): string[] {
  if (!inboxTargets) {
    const recipients = [userId];
    if (ownerUserId && ownerUserId !== userId) {
      recipients.push(ownerUserId);
    }
    return recipients;
  }

  const recipients: string[] = [];
  if (inboxTargets.includes("user")) {
    recipients.push(userId);
  }
  if (inboxTargets.includes("owner") && ownerUserId) {
    recipients.push(ownerUserId);
  }
  return [...new Set(recipients)];
}

export function shouldSendQuizResultEmailToUser(
  inboxTargets: QuizResultInboxTarget[] | undefined,
): boolean {
  return !inboxTargets || inboxTargets.includes("user");
}

export function shouldSendQuizResultEmailToOwner(
  inboxTargets: QuizResultInboxTarget[] | undefined,
): boolean {
  return !inboxTargets || inboxTargets.includes("owner");
}
