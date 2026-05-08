import { labelForTeamPlanSlug } from "@/lib/team-plans";

/** Human-readable plan name for billing slugs (Stripe, Clerk metadata, invoice history). */
export function displayNameForBillingPlanSlug(
  slug: string | null | undefined,
): string {
  if (!slug || slug === "free") return "Free";
  const s = slug.trim();
  if (s === "pro") return "Pro";
  if (s === "pro_plus") return "Pro Plus";
  const team = labelForTeamPlanSlug(s);
  if (team) return team;
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}
