import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import {
  countTeamAdminNavLeaves,
  teamAdminDashboardNavForAddons,
  type TeamAdminAddonNavFlags,
} from "@/lib/team-admin-dashboard-nav";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import { cn } from "@/lib/utils";

export function TeamAdminHome({
  addonNavFlags,
}: {
  addonNavFlags?: TeamAdminAddonNavFlags;
}) {
  const showAddons =
    addonNavFlags?.showLiveClassroom === true ||
    addonNavFlags?.showMemberAddons === true;
  const linkCount = countTeamAdminNavLeaves(
    teamAdminDashboardNavForAddons(
      addonNavFlags ?? { showLiveClassroom: false, showMemberAddons: false },
    ),
  );

  return (
    <Card className={cn(teamAdminCardClass, "backdrop-blur-sm")}>
      <CardHeader className="gap-2">
        <h2 className="text-base font-semibold text-foreground">Welcome</h2>
        <CardDescription className="text-sm leading-relaxed">
          Use the sidebar to open any team admin page. Team & members, deck manager,
          {showAddons ? " add-ons," : ""} and Study Modes (including Quiz Mode) are
          grouped by category. You have {linkCount} pages available in this
          workspace.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
