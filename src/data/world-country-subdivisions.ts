import { countryCodeFromName } from "@/data/world-countries";

/**
 * Subdivision helpers (states/provinces).
 * Loads `country-state-city` only inside these functions so RSC/SSR pages that
 * never call them do not pull the package into the server module graph.
 */

async function getStatesOfCountry(countryCode: string) {
  const { State } = await import("country-state-city");
  return State.getStatesOfCountry(countryCode);
}

/** Subdivision names for a country display name; empty when none are listed. */
export async function getStateProvinceNamesForCountry(
  countryName: string,
): Promise<string[]> {
  const code = countryCodeFromName(countryName);
  if (!code) return [];
  const states = await getStatesOfCountry(code);
  if (!states.length) return [];
  return Array.from(
    new Set(states.map((state) => state.name).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "en"));
}

export async function countryHasStateProvinceList(
  countryName: string,
): Promise<boolean> {
  const states = await getStateProvinceNamesForCountry(countryName);
  return states.length > 0;
}

export async function isValidStateProvinceForCountry(
  countryName: string,
  stateProvince: string,
): Promise<boolean> {
  const trimmed = stateProvince.trim();
  const states = await getStateProvinceNamesForCountry(countryName);
  if (states.length === 0) {
    if (!trimmed) return true;
    return trimmed.length >= 2 && trimmed.length <= 120;
  }
  return states.includes(trimmed);
}

export async function mailingAddressSubdivisionError(
  countryName: string,
  stateProvince: string,
): Promise<string | null> {
  if (!countryName.trim()) return "Select your country.";
  if (!(await isValidStateProvinceForCountry(countryName, stateProvince))) {
    if (await countryHasStateProvinceList(countryName)) {
      return "Select a state / province for the chosen country.";
    }
    return "Enter a valid state / province (or leave blank).";
  }
  return null;
}

/**
 * Resolve a Flipvise state/province label (or code) to the subdivision code Stripe
 * Checkout / Tax expects. Returns null when the region cannot be used with Stripe
 * (e.g. Baker Island → UM-81 under US is not a valid Stripe US state).
 */
export async function stateProvinceToStripeCode(
  countryCode: string,
  stateProvince: string,
): Promise<string | null> {
  const trimmed = stateProvince.trim();
  if (!trimmed) return null;

  const states = await getStatesOfCountry(countryCode);
  if (!states.length) {
    return trimmed.length >= 1 && trimmed.length <= 120 ? trimmed : null;
  }

  const upper = trimmed.toUpperCase();
  const match =
    states.find((state) => state.isoCode.toUpperCase() === upper) ??
    states.find(
      (state) => state.name.localeCompare(trimmed, undefined, { sensitivity: "accent" }) === 0,
    );

  if (!match?.isoCode) return null;

  const code = match.isoCode;
  // country-state-city nests some territories under US as "UM-81", etc.
  // Stripe expects ISO 3166-2 codes without a country prefix (e.g. "FL", "ON").
  if (code.includes("-")) return null;
  if ((countryCode === "US" || countryCode === "CA") && code.length !== 2) {
    return null;
  }
  return code;
}
