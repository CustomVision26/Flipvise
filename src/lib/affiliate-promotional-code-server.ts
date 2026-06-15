import { randomInt } from "node:crypto";

/** New affiliate row promotional id — base + 4 digits, lowercased, max 32 chars. */
export function buildAffiliatePromotionalCandidate(base: string): string {
  const digits = String(1000 + randomInt(9000));
  return `${base}${digits}`.toLowerCase().slice(0, 32);
}
