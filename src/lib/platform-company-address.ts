import { z } from "zod";
import { isWorldCountryName } from "@/data/world-countries";

/** Seller block on Stripe invoices/receipts and the Contact Us company address field. */
export type PlatformCompanyAddress = {
  name: string;
  streetAddress: string;
  line2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
};

export const DEFAULT_PLATFORM_COMPANY_ADDRESS: PlatformCompanyAddress = {
  name: "Flipvise Studio LLC",
  streetAddress: "6450 Aragon Way",
  line2: "apt 205",
  city: "Fort Myers",
  stateProvince: "Florida",
  postalCode: "33966",
  country: "United States",
};

/** Stripe invoice/receipt handle shown next to the company name (image 3). */
export const STRIPE_INVOICE_SELLER_HANDLE = "@flipvise";

export function formatInvoiceSellerName(name: string): string {
  const trimmed = name.trim() || DEFAULT_PLATFORM_COMPANY_ADDRESS.name;
  const handle = STRIPE_INVOICE_SELLER_HANDLE;
  if (trimmed.toLowerCase().includes(handle.toLowerCase())) return trimmed;
  return `${trimmed} ${handle}`;
}

/**
 * Invoice/receipt seller lines: company name, street, apartment, city/state/postal,
 * country, optional phone. Matches the Contact Us company address.
 */
export function formatPlatformCompanyAddressInvoiceLines(
  address: PlatformCompanyAddress | null | undefined,
  phone?: string | null,
): string[] {
  const lines = formatPlatformCompanyAddressLines(address);
  const trimmedPhone = phone?.trim();
  if (trimmedPhone) lines.push(trimmedPhone);
  return lines;
}

export function formatPlatformCompanyAddressForInvoice(
  address: PlatformCompanyAddress | null | undefined,
  phone?: string | null,
): string {
  return formatPlatformCompanyAddressInvoiceLines(address, phone).join("\n");
}

export function formatPlatformCompanyAddressInvoiceCompact(
  address: PlatformCompanyAddress | null | undefined,
  phone?: string | null,
): string {
  return formatPlatformCompanyAddressInvoiceLines(address, phone)
    .join(", ")
    .slice(0, 140);
}

export const platformCompanyAddressSchema = z.object({
  name: z.string().trim().min(1).max(120),
  streetAddress: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200),
  city: z.string().trim().min(1).max(120),
  stateProvince: z.string().trim().max(120),
  postalCode: z.string().trim().max(32),
  country: z
    .string()
    .trim()
    .min(1)
    .refine(isWorldCountryName, "Select a country from the list."),
});

export function parsePlatformCompanyAddress(
  value: unknown,
): PlatformCompanyAddress {
  const parsed = platformCompanyAddressSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  return { ...DEFAULT_PLATFORM_COMPANY_ADDRESS };
}

export function formatPlatformCompanyAddressLines(
  address: PlatformCompanyAddress | null | undefined,
): string[] {
  const resolved = parsePlatformCompanyAddress(address);
  const cityState = [resolved.city, resolved.stateProvince]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
  const cityLine = [cityState, resolved.postalCode.trim()]
    .filter(Boolean)
    .join(" ");
  return [
    resolved.name.trim(),
    resolved.streetAddress.trim(),
    resolved.line2.trim(),
    cityLine,
    resolved.country.trim(),
  ].filter(Boolean);
}

export function formatPlatformCompanyAddress(
  address: PlatformCompanyAddress | null | undefined,
): string {
  return formatPlatformCompanyAddressLines(address).join("\n");
}
