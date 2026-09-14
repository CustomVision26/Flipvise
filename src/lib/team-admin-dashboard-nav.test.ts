import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TEAM_ADMIN_DASHBOARD_NAV,
  countTeamAdminNavLeaves,
  teamAdminAddonNavFlagsForTeam,
  teamAdminDashboardNavForAddons,
} from "./team-admin-dashboard-nav";
describe("teamAdminAddonNavFlagsForTeam", () => {
  it("requires a workspace id that owns a compatible add-on", () => {
    const sets = {
      liveClassroomTeamIds: [12],
      memberAddonTeamIds: [],
    };
    assert.deepEqual(teamAdminAddonNavFlagsForTeam(12, sets), {
      showLiveClassroom: true,
      showMemberAddons: false,
    });
    assert.deepEqual(teamAdminAddonNavFlagsForTeam(99, sets), {
      showLiveClassroom: false,
      showMemberAddons: false,
    });
    assert.deepEqual(teamAdminAddonNavFlagsForTeam(null, sets), {
      showLiveClassroom: false,
      showMemberAddons: false,
    });
  });
});

describe("teamAdminDashboardNavForAddons", () => {
  it("hides Add-ons when the workspace has no compatible entitled add-on", () => {
    const nav = teamAdminDashboardNavForAddons({
      showLiveClassroom: false,
      showMemberAddons: false,
    });
    assert.equal(
      nav.some((section) => section.title === "Add-ons"),
      false,
    );
    assert.equal(nav, TEAM_ADMIN_DASHBOARD_NAV);
  });

  it("inserts Add-ons before Study Modes when Live Classroom is entitled", () => {
    const nav = teamAdminDashboardNavForAddons({
      showLiveClassroom: true,
      showMemberAddons: false,
    });
    const titles = nav.map((section) => section.title);
    assert.deepEqual(titles, [
      "Team & members",
      "Deck manager",
      "Add-ons",
      "Study Modes",
    ]);
    const addons = nav.find((section) => section.title === "Add-ons");
    assert.deepEqual(
      addons?.items.map((item) => item.title),
      ["Live Classroom™"],
    );
    assert.ok(
      countTeamAdminNavLeaves(nav) > countTeamAdminNavLeaves(TEAM_ADMIN_DASHBOARD_NAV),
    );
  });
});
