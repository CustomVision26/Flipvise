import type { User } from "@clerk/backend";
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_VALUES,
  SECURITY_QUESTION_LABELS,
  formatMailingAddress,
  parseMailingAddressFromPublicMetadata,
  parseSecurityQuestionsFromPrivateMetadata,
  type AccountType,
  type SecurityQuestionId,
} from "@/lib/account-recovery-profile";

export type AdminUserAccountDetails = {
  phoneNumber: string | null;
  mailingAddress: string | null;
  accountType: string | null;
  accountTypeLabel: string | null;
  organizationName: string | null;
  securityQuestions: Array<{ question: string; answer: string }> | null;
};

export function adminUserAccountDetailsFromClerkUser(
  user: User,
): AdminUserAccountDetails {
  const publicMeta = user.publicMetadata as Record<string, unknown>;
  const privateMeta = user.privateMetadata as Record<string, unknown>;

  const phoneNumber =
    typeof publicMeta.recoveryPhone === "string" && publicMeta.recoveryPhone.trim()
      ? publicMeta.recoveryPhone.trim()
      : null;

  const mailingFormatted = formatMailingAddress(
    parseMailingAddressFromPublicMetadata(publicMeta),
  );
  const mailingAddress = mailingFormatted || null;

  const accountTypeRaw =
    typeof publicMeta.accountType === "string" && publicMeta.accountType.trim()
      ? publicMeta.accountType.trim()
      : null;

  const accountType =
    accountTypeRaw && ACCOUNT_TYPE_VALUES.includes(accountTypeRaw as AccountType)
      ? (accountTypeRaw as AccountType)
      : null;

  const organizationName =
    typeof publicMeta.organizationName === "string" &&
    publicMeta.organizationName.trim()
      ? publicMeta.organizationName.trim()
      : null;

  const securityEntries = parseSecurityQuestionsFromPrivateMetadata(privateMeta);
  const securityQuestions = securityEntries
    ? securityEntries.map((entry) => ({
        question:
          SECURITY_QUESTION_LABELS[entry.questionId as SecurityQuestionId] ??
          entry.questionId,
        answer: entry.answer,
      }))
    : null;

  return {
    phoneNumber,
    mailingAddress,
    accountType,
    accountTypeLabel: accountType ? ACCOUNT_TYPE_LABELS[accountType] : accountTypeRaw,
    organizationName,
    securityQuestions,
  };
}
