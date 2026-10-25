import { Hand } from "lucide-react";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import {
  countTeamAdminNavLeaves,
  teamAdminDashboardNavForAddons,
  type TeamAdminAddonNavFlags,
} from "@/lib/team-admin-dashboard-nav";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";

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
    <Card className={teamAdminCardClass}>
      <CardHeader className="gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
            <Hand className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-semibold text-slate-900">Welcome</h2>
            <CardDescription className="text-sm leading-relaxed text-slate-600">
              Use the sidebar to open any team admin page. Team & members, deck manager,
              {showAddons ? " add-ons," : ""} and Study Modes (including Quiz Mode) are
              grouped by category. You have {linkCount} pages available in this
              workspace.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
