import type { PricingBillingPeriod } from "@/lib/pricing-billing-period";

export const PLAN_CHANGE_PENDING_ADDON_STORAGE_KEY =
  "flipvise.pendingPlanChangeAddon";

export type PlanChangePendingAddon = {
  addonKey: string;
  period: PricingBillingPeriod;
};

export function writePlanChangePendingAddon(
  value: PlanChangePendingAddon | null,
): void {
  if (typeof window === "undefined") return;
  try {
    if (!value) {
      window.sessionStorage.removeItem(PLAN_CHANGE_PENDING_ADDON_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(
      PLAN_CHANGE_PENDING_ADDON_STORAGE_KEY,
      JSON.stringify(value),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function readPlanChangePendingAddon(): PlanChangePendingAddon | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(
      PLAN_CHANGE_PENDING_ADDON_STORAGE_KEY,
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlanChangePendingAddon>;
    const addonKey =
      typeof parsed.addonKey === "string" ? parsed.addonKey.trim() : "";
    const period =
      parsed.period === "yearly" || parsed.period === "monthly"
        ? parsed.period
        : null;
    if (!addonKey || !period) return null;
    return { addonKey, period };
  } catch {
    return null;
  }
}

export function clearPlanChangePendingAddon(): void {
  writePlanChangePendingAddon(null);
}
