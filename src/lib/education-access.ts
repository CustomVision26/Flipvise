import type { EducationTeamPlanId } from "@/lib/education-plans";
import {
  canAccessTeacherTools,
  canonicalEducationPlanId,
  hasProPlusFeatures,
  isEducationTeamPlanId,
  resolveActiveEducationTeamPlanFromHas,
} from "@/lib/education-plans";
import { resolveEffectivePlan } from "@/lib/plan-metadata-billing-resolution";
import type { PersonalPlanResolution } from "@/lib/plan-metadata-billing-resolution";

export type EducationAccessFields = {
  effectivePlanSlug: string | null;
  canAccessTeacherTools: boolean;
  activeEducationTeamPlan: EducationTeamPlanId | null;
};

export function resolveEffectivePlanSlugFromMeta(
  meta: Record<string, unknown>,
): string | null {
  return resolveEffectivePlan(meta);
}

export function educationAccessFieldsFromPlanSlug(
  slug: string | null | undefined,
): EducationAccessFields {
  const effectivePlanSlug = slug?.trim() || null;
  const activeEducationTeamPlan =
    effectivePlanSlug && isEducationTeamPlanId(effectivePlanSlug)
      ? effectivePlanSlug
      : null;
  return {
    effectivePlanSlug,
    canAccessTeacherTools: canAccessTeacherTools(effectivePlanSlug),
    activeEducationTeamPlan,
  };
}

export function educationAccessFieldsFromSources(input: {
  meta: Record<string, unknown>;
  planResolution: PersonalPlanResolution;
  stripeDbPlanSlug?: string | null;
  has?: (a: { plan: string } | { feature: string }) => boolean | undefined;
}): EducationAccessFields {
  const fromMeta = resolveEffectivePlanSlugFromMeta(input.meta);
  const fromStripe =
    typeof input.meta.billingPlan === "string" &&
    (input.meta.billingStatus === "active" ||
      input.meta.billingStatus === "trialing")
      ? input.meta.billingPlan.trim()
      : null;
  const fromDb = input.stripeDbPlanSlug?.trim() || null;
  const jwtEducationTeam = resolveActiveEducationTeamPlanFromHas(input.has);

  let slug = fromMeta ?? fromStripe ?? fromDb ?? null;
  if (!slug && jwtEducationTeam) slug = jwtEducationTeam;
  if (!slug && input.planResolution.personalPro) {
    const effective = resolveEffectivePlan(input.meta);
    if (effective && canonicalEducationPlanId(effective)) slug = effective;
  }

  return educationAccessFieldsFromPlanSlug(slug);
}

/** Personal workspace gets Pro Plus caps when on any education plan. */
export function educationPlanGrantsProPlusPersonal(slug: string | null | undefined): boolean {
  return hasProPlusFeatures(slug);
}

/** True when subscriber has education team workspace tier (gold / enterprise). */
export function hasEducationTeamWorkspaceTier(
  fields: Pick<EducationAccessFields, "activeEducationTeamPlan">,
): boolean {
  return fields.activeEducationTeamPlan !== null;
}
