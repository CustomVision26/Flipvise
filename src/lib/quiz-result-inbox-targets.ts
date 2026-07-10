export const QUIZ_RESULT_INBOX_TARGETS = ["user", "owner", "team_admin"] as const;

export type QuizResultInboxTarget = (typeof QUIZ_RESULT_INBOX_TARGETS)[number];

/** Secured Education Gold / Enterprise quiz — auto-save to taker, owner, and team admins. */
export const SECURED_EDUCATION_QUIZ_INBOX_TARGETS: QuizResultInboxTarget[] = [
  "user",
  "owner",
  "team_admin",
];

export function resolveSecuredEducationQuizInboxTargets(
  securityEnabled: boolean,
  isEducationTeamPlan: boolean,
): QuizResultInboxTarget[] | undefined {
  if (securityEnabled && isEducationTeamPlan) {
    return SECURED_EDUCATION_QUIZ_INBOX_TARGETS;
  }
  return undefined;
}

export function resolveQuizResultInboxRecipients(
  userId: string,
  ownerUserId: string | null,
  inboxTargets?: QuizResultInboxTarget[],
  teamAdminUserIds: string[] = [],
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
  if (inboxTargets.includes("team_admin")) {
    recipients.push(...teamAdminUserIds);
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

export function shouldSendQuizResultEmailToTeamAdmin(
  inboxTargets: QuizResultInboxTarget[] | undefined,
): boolean {
  return Boolean(inboxTargets?.includes("team_admin"));
}
