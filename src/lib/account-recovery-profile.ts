import { z } from "zod";
import { isWorldCountryName } from "@/data/world-countries";

/** Account type / status collected at sign-up for recovery and support. */
export const ACCOUNT_TYPE_VALUES = [
  "student",
  "teacher",
  "parent",
  "education_institution",
  "corporation",
] as const;

export type AccountType = (typeof ACCOUNT_TYPE_VALUES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  student: "Student",
  teacher: "Teacher",
  parent: "Parent",
  education_institution: "Education Institution",
  corporation: "Corporation",
};

/** Selectable security question prompts (user picks 3 distinct ones). */
export const SECURITY_QUESTION_IDS = [
  "birth_city",
  "first_school",
  "first_pet",
  "mother_maiden_name",
  "favorite_teacher",
  "childhood_street",
  "best_friend_childhood",
  "first_car",
] as const;

export type SecurityQuestionId = (typeof SECURITY_QUESTION_IDS)[number];

export const SECURITY_QUESTION_LABELS: Record<SecurityQuestionId, string> = {
  birth_city: "In what city were you born?",
  first_school: "What was the name of your first school?",
  first_pet: "What was the name of your first pet?",
  mother_maiden_name: "What is your mother's maiden name?",
  favorite_teacher: "What was the name of your favorite teacher?",
  childhood_street: "What street did you grow up on?",
  best_friend_childhood: "What was the first name of your childhood best friend?",
  first_car: "What was the make or model of your first car?",
};

export const SECURITY_QUESTION_SLOT_COUNT = 3;

export function accountTypeRequiresOrganizationName(
  accountType: AccountType,
): boolean {
  return (
    accountType === "education_institution" || accountType === "corporation"
  );
}

export function organizationNameLabel(accountType: AccountType): string {
  if (accountType === "education_institution") {
    return "Name of institution";
  }
  if (accountType === "corporation") {
    return "Name of corporation";
  }
  return "Organization name";
}

const phoneSchema = z
  .string()
  .trim()
  .min(7, "Enter a valid phone number.")
  .max(32, "Phone number is too long.")
  .regex(/^[+]?[\d\s().-]{7,32}$/, "Enter a valid phone number.");

/**
 * Base address shape. Subdivision-list checks live in
 * `world-country-subdivisions` so admin SSR does not load `country-state-city`.
 */
export const mailingAddressFieldsSchema = z.object({
  streetAddress: z
    .string()
    .trim()
    .min(3, "Enter your street address.")
    .max(200, "Street address is too long."),
  city: z.string().trim().min(2, "Enter your city.").max(120, "City is too long."),
  stateProvince: z.string().trim().max(120, "State / province is too long."),
  /** Optional — leave blank when the locality does not use postal codes. */
  postalCode: z.string().trim().max(32, "Postal code is too long."),
  country: z
    .string()
    .trim()
    .min(1, "Select your country.")
    .refine(isWorldCountryName, "Select a country from the list."),
});

export type MailingAddressFields = z.infer<typeof mailingAddressFieldsSchema>;

const securityAnswerSchema = z
  .string()
  .trim()
  .min(2, "Enter an answer (at least 2 characters).")
  .max(100, "Answer is too long.");

const securityQuestionEntrySchema = z.object({
  questionId: z.enum(SECURITY_QUESTION_IDS),
  answer: securityAnswerSchema,
});

export const accountRecoveryProfileSchema = z
  .object({
    phoneNumber: phoneSchema,
    mailingAddress: mailingAddressFieldsSchema,
    accountType: z.enum(ACCOUNT_TYPE_VALUES),
    organizationName: z.string().trim().max(200).optional(),
    securityQuestions: z
      .array(securityQuestionEntrySchema)
      .length(SECURITY_QUESTION_SLOT_COUNT, "Choose and answer 3 security questions."),
  })
  .superRefine((data, ctx) => {
    if (accountTypeRequiresOrganizationName(data.accountType)) {
      const name = data.organizationName?.trim() ?? "";
      if (!name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["organizationName"],
          message:
            data.accountType === "corporation"
              ? "Enter the name of the corporation."
              : "Enter the name of the institution.",
        });
      }
    }

    const ids = data.securityQuestions.map((q) => q.questionId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["securityQuestions"],
        message: "Choose 3 different security questions.",
      });
    }
  });

export type AccountRecoveryProfileInput = z.infer<
  typeof accountRecoveryProfileSchema
>;

export type SecurityQuestionEntry = z.infer<typeof securityQuestionEntrySchema>;

/** Keys stored on Clerk `publicMetadata` (must not collide with billing keys). */
export type AccountRecoveryPublicMetadata = {
  accountType?: AccountType;
  organizationName?: string;
  recoveryPhone?: string;
  /** Structured mailing address; legacy string values are migrated on read. */
  mailingAddress?: MailingAddressFields | string;
  /** True only when phone, mailing address, type/status, and 3 security Q&As are saved. */
  accountRecoveryProfileComplete?: boolean;
};

export function emptyMailingAddressFields(): MailingAddressFields {
  return {
    streetAddress: "",
    city: "",
    stateProvince: "",
    postalCode: "",
    country: "",
  };
}

export function parseMailingAddressFromPublicMetadata(
  publicMeta: Record<string, unknown> | null | undefined,
): MailingAddressFields {
  const raw = publicMeta?.mailingAddress;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    return {
      streetAddress:
        typeof record.streetAddress === "string" ? record.streetAddress : "",
      city: typeof record.city === "string" ? record.city : "",
      stateProvince:
        typeof record.stateProvince === "string" ? record.stateProvince : "",
      postalCode:
        typeof record.postalCode === "string" ? record.postalCode : "",
      country: typeof record.country === "string" ? record.country : "",
    };
  }
  if (typeof raw === "string" && raw.trim()) {
    // Legacy single-line address — keep content in street until the user re-saves.
    return {
      ...emptyMailingAddressFields(),
      streetAddress: raw.trim(),
    };
  }
  return emptyMailingAddressFields();
}

export function formatMailingAddress(
  address: MailingAddressFields | null | undefined,
): string {
  if (!address) return "";
  const cityState = [address.city, address.stateProvince]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
  const line2 = [cityState, address.postalCode.trim()]
    .filter(Boolean)
    .join(" ");
  return [address.streetAddress.trim(), line2, address.country.trim()]
    .filter(Boolean)
    .join("\n");
}

export function isMailingAddressComplete(
  address: MailingAddressFields | null | undefined,
): boolean {
  return mailingAddressFieldsSchema.safeParse(address).success;
}

/** Security answers live in privateMetadata (not exposed on the session JWT). */
export type AccountRecoveryPrivateMetadata = {
  securityQuestions?: SecurityQuestionEntry[];
};

export function parseSecurityQuestionsFromPrivateMetadata(
  privateMeta: Record<string, unknown> | null | undefined,
): SecurityQuestionEntry[] | null {
  if (!privateMeta || typeof privateMeta !== "object") return null;
  const raw = privateMeta.securityQuestions;
  if (!Array.isArray(raw) || raw.length !== SECURITY_QUESTION_SLOT_COUNT) {
    return null;
  }

  const parsed: SecurityQuestionEntry[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") return null;
    const questionId = (entry as { questionId?: unknown }).questionId;
    const answer = (entry as { answer?: unknown }).answer;
    if (
      typeof questionId !== "string" ||
      !SECURITY_QUESTION_IDS.includes(questionId as SecurityQuestionId)
    ) {
      return null;
    }
    if (typeof answer !== "string" || answer.trim().length < 2) {
      return null;
    }
    parsed.push({
      questionId: questionId as SecurityQuestionId,
      answer: answer.trim(),
    });
  }

  const ids = parsed.map((q) => q.questionId);
  if (new Set(ids).size !== ids.length) return null;
  return parsed;
}

export function isAccountRecoveryProfileComplete(
  publicMeta: Record<string, unknown> | null | undefined,
  privateMeta?: Record<string, unknown> | null,
): boolean {
  if (!publicMeta || typeof publicMeta !== "object") return false;

  const accountType = publicMeta.accountType;
  const phone =
    typeof publicMeta.recoveryPhone === "string"
      ? publicMeta.recoveryPhone.trim()
      : "";
  if (!phone) return false;
  if (!isMailingAddressComplete(parseMailingAddressFromPublicMetadata(publicMeta))) {
    return false;
  }
  if (
    typeof accountType !== "string" ||
    !ACCOUNT_TYPE_VALUES.includes(accountType as AccountType)
  ) {
    return false;
  }
  if (accountTypeRequiresOrganizationName(accountType as AccountType)) {
    const org =
      typeof publicMeta.organizationName === "string"
        ? publicMeta.organizationName.trim()
        : "";
    if (!org) return false;
  }

  return parseSecurityQuestionsFromPrivateMetadata(privateMeta) != null;
}

export function buildAccountRecoveryPublicMetadata(
  input: AccountRecoveryProfileInput,
): AccountRecoveryPublicMetadata {
  const organizationName = accountTypeRequiresOrganizationName(input.accountType)
    ? input.organizationName!.trim()
    : undefined;

  return {
    accountType: input.accountType,
    organizationName,
    recoveryPhone: input.phoneNumber.trim(),
    mailingAddress: {
      streetAddress: input.mailingAddress.streetAddress.trim(),
      city: input.mailingAddress.city.trim(),
      stateProvince: input.mailingAddress.stateProvince.trim(),
      postalCode: input.mailingAddress.postalCode.trim(),
      country: input.mailingAddress.country.trim(),
    },
    accountRecoveryProfileComplete: true,
  };
}

export function buildAccountRecoveryPrivateMetadata(
  input: AccountRecoveryProfileInput,
): AccountRecoveryPrivateMetadata {
  return {
    securityQuestions: input.securityQuestions.map((entry) => ({
      questionId: entry.questionId,
      answer: entry.answer.trim(),
    })),
  };
}

export const ACCOUNT_RECOVERY_ONBOARDING_PATH = "/onboarding/account-recovery";

export type AccountRecoveryFieldsValue = {
  phoneNumber: string;
  mailingAddress: MailingAddressFields;
  accountType: AccountType | "";
  organizationName: string;
  securityQuestions: Array<{
    questionId: SecurityQuestionId | "";
    answer: string;
  }>;
};

export function emptySecurityQuestionSlots(): AccountRecoveryFieldsValue["securityQuestions"] {
  return Array.from({ length: SECURITY_QUESTION_SLOT_COUNT }, () => ({
    questionId: "" as const,
    answer: "",
  }));
}

export function emptyAccountRecoveryFieldsValue(): AccountRecoveryFieldsValue {
  return {
    phoneNumber: "",
    mailingAddress: emptyMailingAddressFields(),
    accountType: "",
    organizationName: "",
    securityQuestions: emptySecurityQuestionSlots(),
  };
}
