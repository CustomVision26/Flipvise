import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appearanceAfterGlobalChange,
  appearanceAfterReadFailure,
  canUpdateGlobalAppearance,
  canUpdateUserAppearance,
  coalesceGlobalAppearance,
  coalesceUserAppearance,
  planAllowsIllustratedDesign,
  resolveEffectiveIllustratedDesign,
  resolveEffectiveReducedMotion,
  resolveSubjectArtwork,
  shouldApplyAppearanceSnapshot,
  STANDARD_APPEARANCE,
} from "./illustrated-appearance";

describe("resolveEffectiveIllustratedDesign", () => {
  it("is on only when the global switch, the user preference, and a non-free plan are all on", () => {
    assert.equal(resolveEffectiveIllustratedDesign(true, true, true), true);
    assert.equal(resolveEffectiveIllustratedDesign(true, false, true), false);
    assert.equal(resolveEffectiveIllustratedDesign(false, true, true), false);
    assert.equal(resolveEffectiveIllustratedDesign(false, false, true), false);
    assert.equal(resolveEffectiveIllustratedDesign(true, true, false), false);
  });
});

describe("planAllowsIllustratedDesign", () => {
  it("allows every plan except Free", () => {
    assert.equal(planAllowsIllustratedDesign("free"), false);
    assert.equal(planAllowsIllustratedDesign(" Free "), false);
    assert.equal(planAllowsIllustratedDesign(null), false);
    assert.equal(planAllowsIllustratedDesign(""), false);
    assert.equal(planAllowsIllustratedDesign("pro"), true);
    assert.equal(planAllowsIllustratedDesign("pro_plus"), true);
    assert.equal(planAllowsIllustratedDesign("pro_plus_team_gold"), true);
  });
});

describe("missing settings and read failures", () => {
  it("treats a missing row as standard appearance", () => {
    assert.deepEqual(coalesceUserAppearance(null), {
      illustratedDesignPreferred: false,
      reduceAnimations: false,
    });
    assert.equal(coalesceGlobalAppearance(undefined), false);
  });

  it("keeps the last snapshot for the same account after a failed read", () => {
    const previous = {
      userId: "user_a",
      globalEnabled: true,
      userPreferred: true,
      userReduceAnimations: false,
      planAllowsIllustrated: true,
    };
    assert.equal(appearanceAfterReadFailure(previous, "user_a"), previous);
  });

  it("falls back to the standard design when there is no snapshot for this account", () => {
    assert.deepEqual(appearanceAfterReadFailure(null, "user_b"), {
      userId: "user_b",
      ...STANDARD_APPEARANCE,
    });
    assert.deepEqual(
      appearanceAfterReadFailure(
        {
          userId: "user_a",
          globalEnabled: true,
          userPreferred: true,
          userReduceAnimations: true,
          planAllowsIllustrated: true,
        },
        "user_b",
      ),
      { userId: "user_b", ...STANDARD_APPEARANCE },
    );
  });
});

describe("global switch preserves user preference", () => {
  it("restores the saved choice when the master switch turns back on", () => {
    const off = appearanceAfterGlobalChange({
      userPreferred: true,
      nextGlobalEnabled: false,
      planAllowsIllustrated: true,
    });
    assert.equal(off.userPreferred, true);
    assert.equal(off.effectiveIllustratedDesign, false);

    const on = appearanceAfterGlobalChange({
      userPreferred: off.userPreferred,
      nextGlobalEnabled: true,
      planAllowsIllustrated: true,
    });
    assert.equal(on.userPreferred, true);
    assert.equal(on.effectiveIllustratedDesign, true);

    const free = appearanceAfterGlobalChange({
      userPreferred: true,
      nextGlobalEnabled: true,
      planAllowsIllustrated: false,
    });
    assert.equal(free.userPreferred, true);
    assert.equal(free.effectiveIllustratedDesign, false);
  });
});

describe("account switching", () => {
  it("does not apply a snapshot from another user", () => {
    assert.equal(shouldApplyAppearanceSnapshot("user_a", "user_a"), true);
    assert.equal(shouldApplyAppearanceSnapshot("user_a", "user_b"), false);
    assert.equal(shouldApplyAppearanceSnapshot(null, null), true);
    assert.equal(shouldApplyAppearanceSnapshot("user_a", null), false);
  });
});

describe("appearance authorization", () => {
  it("rejects non-admins and unsigned users", () => {
    assert.equal(canUpdateGlobalAppearance(false), false);
    assert.equal(canUpdateGlobalAppearance(true), true);
    assert.equal(canUpdateUserAppearance(null, "user_a"), false);
    assert.equal(canUpdateUserAppearance("user_a", "user_b"), false);
    assert.equal(canUpdateUserAppearance("user_a", "user_a"), true);
  });
});

describe("reduced motion", () => {
  it("follows either the user preference or the device preference", () => {
    assert.equal(resolveEffectiveReducedMotion(false, false), false);
    assert.equal(resolveEffectiveReducedMotion(true, false), true);
    assert.equal(resolveEffectiveReducedMotion(false, true), true);
  });
});

describe("resolveSubjectArtwork", () => {
  it("prefers an explicit cover, then subject, then keywords, then general", () => {
    assert.equal(
      resolveSubjectArtwork({
        name: "Algebra",
        coverImageUrl: "https://cdn.example/cover.png",
        subject: "history",
      }).source,
      "cover",
    );
    assert.equal(
      resolveSubjectArtwork({ name: "Deck", subject: "science" }).subject,
      "science",
    );
    assert.equal(
      resolveSubjectArtwork({
        name: "Social Studies: British History",
        description: "Learning British history and culture",
      }).subject,
      "history",
    );
    assert.equal(
      resolveSubjectArtwork({
        name: "Science : Environmental Science — Air pollution",
      }).subject,
      "science",
    );
    assert.equal(
      resolveSubjectArtwork({ name: "Math: Algebra 1" }).subject,
      "mathematics",
    );
    assert.deepEqual(resolveSubjectArtwork({ name: "Untitled deck" }), {
      subject: "general",
      source: "general",
      coverImageUrl: null,
    });
  });

  it("does not require deck data to be rewritten", () => {
    const resolved = resolveSubjectArtwork({
      name: "Geography of rivers",
      coverImageUrl: null,
    });
    assert.equal(resolved.subject, "geography");
    assert.equal(resolved.coverImageUrl, null);
  });
});
