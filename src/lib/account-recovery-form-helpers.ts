import { mailingAddressSubdivisionError } from "@/data/world-country-subdivisions";
import {
  ACCOUNT_TYPE_VALUES,
  SECURITY_QUESTION_IDS,
  accountRecoveryProfileSchema,
  accountTypeRequiresOrganizationName,
  emptyAccountRecoveryFieldsValue,
  emptySecurityQuestionSlots,
  isMailingAddressComplete,
  mailingAddressFieldsSchema,
  parseMailingAddressFromPublicMetadata,
  parseSecurityQuestionsFromPrivateMetadata,
  type AccountRecoveryFieldsValue,
  type AccountType,
  type SecurityQuestionId,
} from "@/lib/account-recovery-profile";

export type { AccountRecoveryFieldsValue };
export { emptyAccountRecoveryFieldsValue };

export const ACCOUNT_RECOVERY_FIELD_STEPS = [
  {
    id: 1 as const,
    title: "Contact",
    heading: "Contact information",
    description:
      "Provide a reachable phone number and your current mailing address.",
  },
  {
    id: 2 as const,
    title: "Account type",
    heading: "Account classification",
    description: "Select the option that best describes how you use Flipvise.",
  },
  {
    id: 3 as const,
    title: "Security",
    heading: "Identity verification",
    description:
      "Choose three different questions and provide answers known only to you.",
  },
] as const;

export type AccountRecoveryFieldStepId =
  (typeof ACCOUNT_RECOVERY_FIELD_STEPS)[number]["id"];

export async function validateAccountRecoveryStep(
  step: AccountRecoveryFieldStepId,
  profile: AccountRecoveryFieldsValue,
): Promise<{ success: true } | { success: false; error: string }> {
  if (step === 1) {
    const phone = profile.phoneNumber.trim();
    if (phone.length < 7) {
      return { success: false, error: "Enter a valid phone number." };
    }
    if (!/^[+]?[\d\s().-]{7,32}$/.test(phone)) {
      return { success: false, error: "Enter a valid phone number." };
    }
    const addressCheck = mailingAddressFieldsSchema.safeParse(
      profile.mailingAddress,
    );
    if (!addressCheck.success) {
      return {
        success: false,
        error:
          addressCheck.error.issues[0]?.message ??
          "Complete every mailing address field.",
      };
    }
    const subdivisionError = await mailingAddressSubdivisionError(
      profile.mailingAddress.country,
      profile.mailingAddress.stateProvince,
    );
    if (subdivisionError) {
      return { success: false, error: subdivisionError };
    }
    return { success: true };
  }

  if (step === 2) {
    if (
      !profile.accountType ||
      !ACCOUNT_TYPE_VALUES.includes(profile.accountType as AccountType)
    ) {
      return { success: false, error: "Select your type / status." };
    }
    if (
      accountTypeRequiresOrganizationName(profile.accountType as AccountType) &&
      !profile.organizationName.trim()
    ) {
      return {
        success: false,
        error:
          profile.accountType === "corporation"
            ? "Enter the name of the corporation."
            : "Enter the name of the institution.",
      };
    }
    return { success: true };
  }

  for (let i = 0; i < profile.securityQuestions.length; i++) {
    const slot = profile.securityQuestions[i]!;
    if (
      !slot.questionId ||
      !SECURITY_QUESTION_IDS.includes(slot.questionId as SecurityQuestionId)
    ) {
      return {
        success: false,
        error: `Select security question ${i + 1}.`,
      };
    }
    if (slot.answer.trim().length < 2) {
      return {
        success: false,
        error: `Enter an answer for security question ${i + 1}.`,
      };
    }
  }

  const ids = profile.securityQuestions.map((slot) => slot.questionId);
  if (new Set(ids).size !== ids.length) {
    return {
      success: false,
      error: "Choose 3 different security questions.",
    };
  }

  return { success: true };
}

export function profileFieldsFromClerkMetadata(
  publicMeta: Record<string, unknown> | undefined,
  privateMeta?: Record<string, unknown> | null,
): AccountRecoveryFieldsValue {
  const accountTypeRaw =
    typeof publicMeta?.accountType === "string" ? publicMeta.accountType.trim() : "";
  const accountType =
    accountTypeRaw && ACCOUNT_TYPE_VALUES.includes(accountTypeRaw as AccountType)
      ? (accountTypeRaw as AccountType)
      : "";

  const savedQuestions = parseSecurityQuestionsFromPrivateMetadata(privateMeta);
  const securityQuestions = savedQuestions
    ? savedQuestions.map((entry) => ({
        questionId: entry.questionId as SecurityQuestionId | "",
        answer: entry.answer,
      }))
    : emptySecurityQuestionSlots();

  return {
    phoneNumber:
      typeof publicMeta?.recoveryPhone === "string" ? publicMeta.recoveryPhone : "",
    mailingAddress: parseMailingAddressFromPublicMetadata(publicMeta),
    accountType,
    organizationName:
      typeof publicMeta?.organizationName === "string"
        ? publicMeta.organizationName
        : "",
    securityQuestions,
  };
}

export async function parseAccountRecoveryFieldsValue(
  profile: AccountRecoveryFieldsValue,
) {
  if (
    !profile.accountType ||
    !ACCOUNT_TYPE_VALUES.includes(profile.accountType as AccountType)
  ) {
    return {
      success: false as const,
      error: "Select your type / status.",
    };
  }

  if (!isMailingAddressComplete(profile.mailingAddress)) {
    const addressCheck = mailingAddressFieldsSchema.safeParse(
      profile.mailingAddress,
    );
    return {
      success: false as const,
      error:
        addressCheck.error.issues[0]?.message ??
        "Complete every mailing address field.",
    };
  }

  const subdivisionError = await mailingAddressSubdivisionError(
    profile.mailingAddress.country,
    profile.mailingAddress.stateProvince,
  );
  if (subdivisionError) {
    return { success: false as const, error: subdivisionError };
  }

  for (let i = 0; i < profile.securityQuestions.length; i++) {
    const slot = profile.securityQuestions[i]!;
    if (
      !slot.questionId ||
      !SECURITY_QUESTION_IDS.includes(slot.questionId as SecurityQuestionId)
    ) {
      return {
        success: false as const,
        error: `Select security question ${i + 1}.`,
      };
    }
    if (!slot.answer.trim()) {
      return {
        success: false as const,
        error: `Enter an answer for security question ${i + 1}.`,
      };
    }
  }

  const parsed = accountRecoveryProfileSchema.safeParse({
    phoneNumber: profile.phoneNumber,
    mailingAddress: profile.mailingAddress,
    accountType: profile.accountType,
    organizationName: profile.organizationName || undefined,
    securityQuestions: profile.securityQuestions.map((slot) => ({
      questionId: slot.questionId,
      answer: slot.answer,
    })),
  });

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid account details.",
    };
  }

  return { success: true as const, data: parsed.data };
}
