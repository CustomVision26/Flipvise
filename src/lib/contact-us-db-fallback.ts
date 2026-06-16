import type { InferSelectModel } from "drizzle-orm";
import type { contactUsMessages, platformContactSettings } from "@/db/schema";
import { SUPPORT_EMAIL } from "@/lib/support-contact";
import type { ContactSocialLink } from "@/db/queries/contact-us";

export type PlatformContactSettingsRow = InferSelectModel<typeof platformContactSettings>;
export type ContactUsMessageRow = InferSelectModel<typeof contactUsMessages>;

const CONTACT_US_TABLE_PATTERN =
  /platform_contact_settings|contact_us_messages|contact_us_notifications|contact_us_replies/i;

function isMissingContactUsTableError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth++) {
    const obj = current as Record<string, unknown>;
    const message = typeof obj.message === "string" ? obj.message : "";
    if (
      CONTACT_US_TABLE_PATTERN.test(message) &&
      /(does not exist|undefined table|relation .* does not exist|Failed query)/i.test(message)
    ) {
      return true;
    }
    current = obj.cause;
  }
  const flat = String(error);
  return (
    (/42P01/i.test(flat) || /does not exist/i.test(flat) || /Failed query/i.test(flat)) &&
    CONTACT_US_TABLE_PATTERN.test(flat)
  );
}

export function defaultPlatformContactSettingsRow(): PlatformContactSettingsRow {
  return {
    id: 1,
    email: SUPPORT_EMAIL,
    phone: null,
    socialLinks: [] as ContactSocialLink[],
    updatedAt: new Date(),
    updatedByUserId: null,
  };
}

export function isContactUsSchemaUnavailableError(error: unknown): boolean {
  return isMissingContactUsTableError(error);
}

export async function withContactUsReadFallback<T>(
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isMissingContactUsTableError(error)) return fallback;
    throw error;
  }
}
