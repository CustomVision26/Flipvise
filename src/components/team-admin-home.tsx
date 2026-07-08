import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { TEAM_ADMIN_DASHBOARD_NAV } from "@/lib/team-admin-dashboard-nav";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import { cn } from "@/lib/utils";

export function TeamAdminHome() {
  const linkCount = TEAM_ADMIN_DASHBOARD_NAV.reduce(
    (count, section) => count + section.items.length,
    0,
  );

  return (
    <Card className={cn(teamAdminCardClass, "backdrop-blur-sm")}>
      <CardHeader className="gap-2">
        <h2 className="text-base font-semibold text-foreground">Welcome</h2>
        <CardDescription className="text-sm leading-relaxed">
          Use the sidebar to open any team admin page. Team & members, deck manager,
          and quiz administration are grouped by category. You have {linkCount} pages
          available in this workspace.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
