/** Stored on `billing_invoices.planSlug` for add-on-only invoices. */
export const ADDON_PLAN_SLUG_PREFIX = "addon:" as const;

export function addonBillingPlanSlug(addonKey: string): string {
  return `${ADDON_PLAN_SLUG_PREFIX}${addonKey.trim()}`;
}

export function isAddonBillingPlanSlug(
  planSlug: string | null | undefined,
): boolean {
  return Boolean(planSlug?.trim().startsWith(ADDON_PLAN_SLUG_PREFIX));
}

export function addonKeyFromBillingPlanSlug(
  planSlug: string | null | undefined,
): string | null {
  const slug = planSlug?.trim() ?? "";
  if (!slug.startsWith(ADDON_PLAN_SLUG_PREFIX)) return null;
  const key = slug.slice(ADDON_PLAN_SLUG_PREFIX.length).trim();
  return key || null;
}

export function displayNameForAddonBillingPlanSlug(
  planSlug: string,
  catalogName?: string | null,
): string {
  if (catalogName?.trim()) return `${catalogName.trim()} (Add-on)`;
  const key = addonKeyFromBillingPlanSlug(planSlug);
  if (!key) return "Add-on";
  const pretty = key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return `${pretty} (Add-on)`;
}
