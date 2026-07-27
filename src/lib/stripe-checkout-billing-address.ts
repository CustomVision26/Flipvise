import { countryCodeFromName } from "@/data/world-countries";
import { stateProvinceToStripeCode } from "@/data/world-country-subdivisions";

/** Countries where Stripe Tax / Checkout need state + postal for a complete address. */
const REQUIRES_STATE_AND_POSTAL = new Set(["US", "CA"]);

/** Country codes Stripe Checkout cannot use for billing (e.g. uninhabited territories). */
const STRIPE_UNSUPPORTED_BILLING_COUNTRIES = new Set(["UM", "AQ", "BV", "HM", "TF"]);

export type StripeCheckoutBillingContact = {
  name: string | null;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postal_code?: string;
    country: string;
  };
};

export type StripeBillingAddressInput = {
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postal_code?: string | null;
  country: string;
};

export type NormalizeStripeBillingResult =
  | { ok: true; contact: StripeCheckoutBillingContact }
  | { ok: false; message: string; invalidRegion?: boolean };

const INVALID_REGION_MESSAGE =
  "This address uses a country or region Stripe cannot accept for billing. Enter a valid billing address manually (use a real US state like Florida / FL, not Baker Island or similar territories).";

function countryRequiresStateAndPostal(countryCode: string): boolean {
  return REQUIRES_STATE_AND_POSTAL.has(countryCode);
}

/** Whether a Checkout session billing contact has the fields Stripe needs to confirm. */
export function isStripeBillingContactComplete(
  contact: {
    address?: {
      line1?: string | null;
      city?: string | null;
      state?: string | null;
      postal_code?: string | null;
      country?: string | null;
    } | null;
  } | null,
): boolean {
  const address = contact?.address;
  if (!address) return false;
  const line1 = address.line1?.trim() ?? "";
  const city = address.city?.trim() ?? "";
  const country = address.country?.trim() ?? "";
  if (!line1 || !city || !country) return false;
  if (countryRequiresStateAndPostal(country)) {
    const state = address.state?.trim() ?? "";
    const postal = address.postal_code?.trim() ?? "";
    if (!state || !postal) return false;
    if ((country === "US" || country === "CA") && state.length !== 2) return false;
  }
  return true;
}

/**
 * Normalize a raw address into a Stripe Checkout billing contact.
 * Converts subdivision names (e.g. "Florida") to ISO codes ("FL") and rejects
 * Stripe-invalid regions (e.g. Baker Island / UM-81).
 */
export async function normalizeStripeCheckoutBillingAddress(
  input: StripeBillingAddressInput,
  name: string,
): Promise<NormalizeStripeBillingResult> {
  const line1 = input.line1.trim();
  const city = input.city.trim();
  const country = input.country.trim().toUpperCase();
  const postal = (input.postal_code ?? "").trim();
  const rawState = (input.state ?? "").trim();
  const line2 = (input.line2 ?? "").trim();

  if (!line1 || !city || !country) {
    return { ok: false, message: "Enter a complete billing address." };
  }

  if (STRIPE_UNSUPPORTED_BILLING_COUNTRIES.has(country)) {
    return { ok: false, message: INVALID_REGION_MESSAGE, invalidRegion: true };
  }

  let stateCode: string | undefined;
  if (rawState) {
    const resolved = await stateProvinceToStripeCode(country, rawState);
    if (!resolved) {
      return { ok: false, message: INVALID_REGION_MESSAGE, invalidRegion: true };
    }
    stateCode = resolved;
  }

  if (countryRequiresStateAndPostal(country)) {
    if (!stateCode || !postal) {
      return {
        ok: false,
        message:
          country === "US"
            ? "Enter a complete US billing address including state and ZIP code."
            : "Enter a complete billing address including province and postal code.",
        invalidRegion: !stateCode && Boolean(rawState),
      };
    }
  }

  return {
    ok: true,
    contact: {
      name: name.trim() || null,
      address: {
        line1,
        city,
        country,
        ...(line2 ? { line2 } : {}),
        ...(stateCode ? { state: stateCode } : {}),
        ...(postal ? { postal_code: postal } : {}),
      },
    },
  };
}

export async function normalizeManualBillingAddress(input: {
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  countryName: string;
  name: string;
}): Promise<NormalizeStripeBillingResult> {
  const country = countryCodeFromName(input.countryName);
  if (!country) {
    return { ok: false, message: "Select a country or region." };
  }
  return normalizeStripeCheckoutBillingAddress(
    {
      line1: input.line1,
      city: input.city,
      state: input.state,
      postal_code: input.postalCode,
      country,
    },
    input.name,
  );
}
