import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveAiRecallAccess } from "./ai-recall-eligibility";

describe("resolveAiRecallAccess", () => {
  it("denies Free and Pro", () => {
    assert.equal(resolveAiRecallAccess({ personalPlanSlug: null }), false);
    assert.equal(resolveAiRecallAccess({ personalPlanSlug: "free" }), false);
    assert.equal(resolveAiRecallAccess({ personalPlanSlug: "pro" }), false);
  });

  it("allows Pro Plus and Education Plus", () => {
    assert.equal(resolveAiRecallAccess({ personalPlanSlug: "pro_plus" }), true);
    assert.equal(
      resolveAiRecallAccess({ personalPlanSlug: "education_plus" }),
      true,
    );
  });

  it("allows team and education team plans", () => {
    assert.equal(
      resolveAiRecallAccess({ activeTeamPlan: "pro_plus_team_basic" }),
      true,
    );
    assert.equal(
      resolveAiRecallAccess({
        activeEducationTeamPlan: "education_gold",
      }),
      true,
    );
    assert.equal(
      resolveAiRecallAccess({
        studyWorkspacePlanSlug: "pro_plus_enterprise",
      }),
      true,
    );
  });

  it("allows platform admins", () => {
    assert.equal(resolveAiRecallAccess({ isPlatformAdmin: true }), true);
  });
});
