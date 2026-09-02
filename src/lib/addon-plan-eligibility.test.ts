import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isAccessEligibleForAddon,
  isPlanEligibleForAddon,
  resolvePlanSlugForAddonEligibility,
} from "./addon-plan-eligibility";

const essayPlans = [
  "pro",
  "pro_plus",
  "pro_plus_team_gold",
  "education_plus",
];

describe("isPlanEligibleForAddon", () => {
  it("rejects missing slugs", () => {
    assert.equal(isPlanEligibleForAddon(essayPlans, null), false);
    assert.equal(isPlanEligibleForAddon(essayPlans, "free"), false);
  });

  it("accepts listed slugs and legacy team aliases", () => {
    assert.equal(isPlanEligibleForAddon(essayPlans, "pro_plus"), true);
    assert.equal(
      isPlanEligibleForAddon(["pro_plus_team_gold"], "pro_team_gold"),
      true,
    );
  });
});

describe("resolvePlanSlugForAddonEligibility", () => {
  it("prefers an explicit paid slug over complimentary admin Pro Plus", () => {
    assert.equal(
      resolvePlanSlugForAddonEligibility({
        effectivePlanSlug: "pro_plus_team_gold",
        isAdmin: true,
      }),
      "pro_plus_team_gold",
    );
  });

  it("treats platform admins without a Stripe plan as pro_plus", () => {
    assert.equal(
      resolvePlanSlugForAddonEligibility({ isAdmin: true }),
      "pro_plus",
    );
  });

  it("treats complimentary adminGranted as pro_plus", () => {
    assert.equal(
      resolvePlanSlugForAddonEligibility({ adminGranted: true }),
      "pro_plus",
    );
  });

  it("falls back to Clerk personal Pro Plus then Pro", () => {
    assert.equal(
      resolvePlanSlugForAddonEligibility({ hasClerkPersonalProPlus: true }),
      "pro_plus",
    );
    assert.equal(
      resolvePlanSlugForAddonEligibility({ hasClerkPersonalPro: true }),
      "pro",
    );
  });
});

describe("isAccessEligibleForAddon", () => {
  it("lets complimentary platform admins purchase Pro Plus add-ons", () => {
    assert.equal(
      isAccessEligibleForAddon(essayPlans, { isAdmin: true }),
      true,
    );
  });

  it("does not treat complimentary Pro Plus as a team-only add-on", () => {
    assert.equal(
      isAccessEligibleForAddon(["pro_plus_team_gold"], { isAdmin: true }),
      false,
    );
  });

  it("lets a complimentary admin with an active team plan buy team-only add-ons", () => {
    assert.equal(
      isAccessEligibleForAddon(["pro_plus_team_gold"], {
        effectivePlanSlug: "pro_plus",
        isAdmin: true,
        activeTeamPlan: "pro_plus_team_gold",
      }),
      true,
    );
  });
});
