import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPeriodSnapshot,
  planDefaultAllowance,
  resolveAllowancePriority,
} from "./limits";

describe("planDefaultAllowance", () => {
  it("returns limited free/pro/pro_plus defaults", () => {
    assert.deepEqual(planDefaultAllowance("free"), {
      kind: "limited",
      generations: 20,
    });
    assert.equal(planDefaultAllowance("pro").kind, "limited");
    assert.equal(planDefaultAllowance("pro_plus").kind, "limited");
  });

  it("represents unlimited explicitly with null config", () => {
    assert.deepEqual(planDefaultAllowance("pro_plus_enterprise"), {
      kind: "unlimited",
    });
    assert.deepEqual(planDefaultAllowance("education_enterprise"), {
      kind: "unlimited",
    });
  });

  it("uses safe fallback for unknown plans", () => {
    assert.deepEqual(planDefaultAllowance("totally_unknown_plan"), {
      kind: "limited",
      generations: 20,
    });
  });
});

describe("resolveAllowancePriority", () => {
  it("prefers user override over team and plan", () => {
    const resolved = resolveAllowancePriority({
      isPlatformAdmin: false,
      userMonthlyAllowance: 42,
      teamMonthlyAllowance: 999,
      subscriptionPlan: "pro",
    });
    assert.deepEqual(resolved, {
      allowance: { kind: "limited", generations: 42 },
      source: "user_override",
    });
  });

  it("prefers team override over plan default", () => {
    const resolved = resolveAllowancePriority({
      isPlatformAdmin: false,
      teamMonthlyAllowance: 77,
      subscriptionPlan: "pro",
    });
    assert.deepEqual(resolved, {
      allowance: { kind: "limited", generations: 77 },
      source: "team_override",
    });
  });

  it("uses plan default when no overrides", () => {
    const resolved = resolveAllowancePriority({
      isPlatformAdmin: false,
      subscriptionPlan: "pro_plus",
    });
    assert.equal(resolved.source, "plan_default");
    assert.equal(resolved.allowance.kind, "limited");
  });

  it("makes platform admins unlimited", () => {
    const resolved = resolveAllowancePriority({
      isPlatformAdmin: true,
      subscriptionPlan: "free",
    });
    assert.deepEqual(resolved, {
      allowance: { kind: "unlimited" },
      source: "platform_admin",
    });
  });

  it("supports explicit user unlimited", () => {
    const resolved = resolveAllowancePriority({
      isPlatformAdmin: false,
      userUnlimited: true,
      subscriptionPlan: "free",
    });
    assert.deepEqual(resolved.allowance, { kind: "unlimited" });
    assert.equal(resolved.source, "user_override");
  });
});

describe("buildPeriodSnapshot", () => {
  it("computes status thresholds", () => {
    assert.equal(
      buildPeriodSnapshot({
        aiAccessEnabled: true,
        flagged: false,
        allowance: { kind: "limited", generations: 100 },
        usedGenerations: 50,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostMicros: 0,
      }).usageStatus,
      "normal",
    );
    assert.equal(
      buildPeriodSnapshot({
        aiAccessEnabled: true,
        flagged: false,
        allowance: { kind: "limited", generations: 100 },
        usedGenerations: 85,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostMicros: 0,
      }).usageStatus,
      "approaching",
    );
    assert.equal(
      buildPeriodSnapshot({
        aiAccessEnabled: true,
        flagged: false,
        allowance: { kind: "limited", generations: 100 },
        usedGenerations: 95,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostMicros: 0,
      }).usageStatus,
      "critical",
    );
    assert.equal(
      buildPeriodSnapshot({
        aiAccessEnabled: true,
        flagged: false,
        allowance: { kind: "limited", generations: 100 },
        usedGenerations: 100,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostMicros: 0,
      }).usageStatus,
      "limit_reached",
    );
  });

  it("shows unlimited without percentage", () => {
    const snap = buildPeriodSnapshot({
      aiAccessEnabled: true,
      flagged: false,
      allowance: { kind: "unlimited" },
      usedGenerations: 999,
      inputTokens: 1,
      outputTokens: 2,
      totalTokens: 3,
      estimatedCostMicros: 4,
    });
    assert.equal(snap.usageStatus, "unlimited");
    assert.equal(snap.percentUsed, null);
    assert.equal(snap.remainingGenerations, null);
  });

  it("marks disabled and flagged", () => {
    assert.equal(
      buildPeriodSnapshot({
        aiAccessEnabled: false,
        flagged: false,
        allowance: { kind: "unlimited" },
        usedGenerations: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostMicros: 0,
      }).usageStatus,
      "disabled",
    );
    assert.equal(
      buildPeriodSnapshot({
        aiAccessEnabled: true,
        flagged: true,
        allowance: { kind: "limited", generations: 10 },
        usedGenerations: 1,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostMicros: 0,
      }).usageStatus,
      "flagged",
    );
  });
});
