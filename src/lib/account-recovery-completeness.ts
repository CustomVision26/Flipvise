import { mailingAddressSubdivisionError } from "@/data/world-country-subdivisions";
import {
  isAccountRecoveryProfileComplete,
  parseMailingAddressFromPublicMetadata,
} from "@/lib/account-recovery-profile";

/**
 * Full completeness including country→state/province list rules.
 * Prefer calling from Server Actions / client code — not from RSC pages that
 * should stay free of heavy subdivision data loading.
 */
export async function isAccountRecoveryProfileFullyComplete(
  publicMeta: Record<string, unknown> | null | undefined,
  privateMeta?: Record<string, unknown> | null,
): Promise<boolean> {
  if (!isAccountRecoveryProfileComplete(publicMeta, privateMeta)) return false;
  const address = parseMailingAddressFromPublicMetadata(publicMeta);
  return (
    (await mailingAddressSubdivisionError(
      address.country,
      address.stateProvince,
    )) == null
  );
}
