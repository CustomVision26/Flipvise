/**
 * ISO 3166-1 alpha-2 region codes (countries and common territories).
 * Display names are resolved with `Intl.DisplayNames` in English.
 * Keep this module free of heavy dependencies — it is imported by server/admin code.
 */
const ISO_3166_1_ALPHA_2_CODES = [
  "AF", "AX", "AL", "DZ", "AS", "AD", "AO", "AI", "AQ", "AG", "AR", "AM", "AW",
  "AU", "AT", "AZ", "BS", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BM", "BT",
  "BO", "BQ", "BA", "BW", "BV", "BR", "IO", "BN", "BG", "BF", "BI", "CV", "KH",
  "CM", "CA", "KY", "CF", "TD", "CL", "CN", "CX", "CC", "CO", "KM", "CG", "CD",
  "CK", "CR", "CI", "HR", "CU", "CW", "CY", "CZ", "DK", "DJ", "DM", "DO", "EC",
  "EG", "SV", "GQ", "ER", "EE", "SZ", "ET", "FK", "FO", "FJ", "FI", "FR", "GF",
  "PF", "TF", "GA", "GM", "GE", "DE", "GH", "GI", "GR", "GL", "GD", "GP", "GU",
  "GT", "GG", "GN", "GW", "GY", "HT", "HM", "VA", "HN", "HK", "HU", "IS", "IN",
  "ID", "IR", "IQ", "IE", "IM", "IL", "IT", "JM", "JP", "JE", "JO", "KZ", "KE",
  "KI", "KP", "KR", "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI", "LT",
  "LU", "MO", "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MQ", "MR", "MU", "YT",
  "MX", "FM", "MD", "MC", "MN", "ME", "MS", "MA", "MZ", "MM", "NA", "NR", "NP",
  "NL", "NC", "NZ", "NI", "NE", "NG", "NU", "NF", "MK", "MP", "NO", "OM", "PK",
  "PW", "PS", "PA", "PG", "PY", "PE", "PH", "PN", "PL", "PT", "PR", "QA", "RE",
  "RO", "RU", "RW", "BL", "SH", "KN", "LC", "MF", "PM", "VC", "WS", "SM", "ST",
  "SA", "SN", "RS", "SC", "SL", "SG", "SX", "SK", "SI", "SB", "SO", "ZA", "GS",
  "SS", "ES", "LK", "SD", "SR", "SJ", "SE", "CH", "SY", "TW", "TJ", "TZ", "TH",
  "TL", "TG", "TK", "TO", "TT", "TN", "TR", "TM", "TC", "TV", "UG", "UA", "AE",
  "GB", "US", "UM", "UY", "UZ", "VU", "VE", "VN", "VG", "VI", "WF", "EH", "YE",
  "ZM", "ZW",
] as const;

function buildCountryNameMaps(): {
  names: string[];
  nameToCode: Map<string, string>;
} {
  const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
  const nameToCode = new Map<string, string>();
  for (const code of ISO_3166_1_ALPHA_2_CODES) {
    const name = displayNames.of(code);
    if (name && !nameToCode.has(name)) {
      nameToCode.set(name, code);
    }
  }
  const names = Array.from(nameToCode.keys()).sort((a, b) =>
    a.localeCompare(b, "en"),
  );
  return { names, nameToCode };
}

const { names: WORLD_COUNTRY_NAMES_LIST, nameToCode: WORLD_COUNTRY_NAME_TO_CODE } =
  buildCountryNameMaps();

/** Alphabetized English country / territory names for address forms. */
export const WORLD_COUNTRY_NAMES = WORLD_COUNTRY_NAMES_LIST;

const WORLD_COUNTRY_NAME_SET = new Set(WORLD_COUNTRY_NAMES);

export function isWorldCountryName(value: string): boolean {
  return WORLD_COUNTRY_NAME_SET.has(value.trim());
}

export function countryCodeFromName(countryName: string): string | null {
  return WORLD_COUNTRY_NAME_TO_CODE.get(countryName.trim()) ?? null;
}
