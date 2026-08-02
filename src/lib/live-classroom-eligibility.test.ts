import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  defaultMaxConcurrentLiveSessions,
  isLiveClassroomEligiblePlanSlug,
  liveClassroomAllowsConcurrentOverride,
  liveClassroomParticipantLimitForPlan,
  LIVE_CLASSROOM_ELIGIBLE_PLAN_IDS,
} from "@/lib/live-classroom-eligibility";
import {
  canStartWithParticipantCount,
  distributeParticipantsRandomly,
  scoreLiveClassroomAnswer,
} from "@/lib/live-classroom-scoring";

describe("Live Classroom eligibility", () => {
  it("allows only team and education team plans", () => {
    for (const slug of LIVE_CLASSROOM_ELIGIBLE_PLAN_IDS) {
      assert.equal(isLiveClassroomEligiblePlanSlug(slug), true);
    }
    assert.equal(isLiveClassroomEligiblePlanSlug("free"), false);
    assert.equal(isLiveClassroomEligiblePlanSlug("pro"), false);
    assert.equal(isLiveClassroomEligiblePlanSlug("pro_plus"), false);
    assert.equal(isLiveClassroomEligiblePlanSlug("education_plus"), false);
  });

  it("inherits participant limits from licensed seats", () => {
    assert.equal(liveClassroomParticipantLimitForPlan("pro_plus_team_basic"), 5);
    assert.equal(liveClassroomParticipantLimitForPlan("pro_plus_team_gold"), 15);
    assert.equal(
      liveClassroomParticipantLimitForPlan("pro_plus_platinum_plan"),
      25,
    );
    assert.equal(liveClassroomParticipantLimitForPlan("pro_plus_enterprise"), 35);
    assert.equal(liveClassroomParticipantLimitForPlan("education_gold"), 25);
    assert.equal(liveClassroomParticipantLimitForPlan("education_enterprise"), 45);
    assert.equal(liveClassroomParticipantLimitForPlan("free"), 0);
  });

  it("allows concurrent override only on enterprise tiers", () => {
    assert.equal(liveClassroomAllowsConcurrentOverride("pro_plus_enterprise"), true);
    assert.equal(
      liveClassroomAllowsConcurrentOverride("education_enterprise"),
      true,
    );
    assert.equal(liveClassroomAllowsConcurrentOverride("pro_plus_team_basic"), false);
    assert.equal(defaultMaxConcurrentLiveSessions("pro_plus_team_basic"), 1);
    assert.equal(defaultMaxConcurrentLiveSessions("pro_plus_enterprise"), 3);
  });
});

describe("Live Classroom scoring", () => {
  it("scores individual correct answers with speed and participation", () => {
    const result = scoreLiveClassroomAnswer({
      battleMode: "individual_team",
      correct: true,
      responseTimeMs: 0,
      timeLimitSec: 30,
    });
    assert.equal(result.points, 100 + 50 + 10);
    assert.equal(result.speedBonus, 50);
    assert.equal(result.participation, 10);
    assert.equal(result.eliminated, false);
  });

  it("scores collaborative captain submits at 500", () => {
    const result = scoreLiveClassroomAnswer({
      battleMode: "collaborative_team",
      correct: true,
      responseTimeMs: 1000,
      timeLimitSec: 30,
    });
    assert.equal(result.points, 500);
  });

  it("marks survival wrong answers as eliminated without shield", () => {
    const result = scoreLiveClassroomAnswer({
      battleMode: "survival",
      correct: false,
      responseTimeMs: 1000,
      timeLimitSec: 30,
    });
    assert.equal(result.eliminated, true);
    assert.equal(result.points, 0);
  });

  it("shield prevents elimination on wrong survival answers", () => {
    const result = scoreLiveClassroomAnswer({
      battleMode: "survival",
      correct: false,
      responseTimeMs: 1000,
      timeLimitSec: 30,
      shielded: true,
    });
    assert.equal(result.eliminated, false);
    assert.equal(result.points, 10);
  });

  it("doubles points when strategy card is active", () => {
    const result = scoreLiveClassroomAnswer({
      battleMode: "individual_team",
      correct: true,
      responseTimeMs: 0,
      timeLimitSec: 30,
      doublePoints: true,
    });
    assert.equal(result.points, (100 + 50 + 10) * 2);
  });
});

describe("Live Classroom team assignment helpers", () => {
  it("distributes participants evenly", () => {
    const buckets = distributeParticipantsRandomly(
      ["a", "b", "c", "d", "e", "f"],
      3,
    );
    assert.equal(buckets.length, 3);
    assert.equal(buckets.flat().length, 6);
    const sizes = buckets.map((b) => b.length).sort();
    assert.deepEqual(sizes, [2, 2, 2]);
  });

  it("enforces licensed seat participant bounds", () => {
    assert.equal(canStartWithParticipantCount(0, 5), false);
    assert.equal(canStartWithParticipantCount(1, 5), true);
    assert.equal(canStartWithParticipantCount(5, 5), true);
    assert.equal(canStartWithParticipantCount(6, 5), false);
  });
});
