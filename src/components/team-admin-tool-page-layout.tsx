import type { ReactNode } from "react";
import { TEAM_ADMIN_SIDEBAR_NAV_ENABLED } from "@/lib/team-admin-dashboard-nav";
import { teamAdminPageMetaForPath } from "@/lib/team-admin-page-meta";
import type { TeamAdminPageContext } from "@/lib/load-team-admin-page-context";
import { TeamAdminPageChrome } from "@/components/team-admin-page-chrome";

export function TeamAdminToolPageLayout({
  pathname,
  ctx,
  legacyHeader,
  children,
}: {
  pathname: string;
  ctx: TeamAdminPageContext;
  legacyHeader: ReactNode;
  children: ReactNode;
}) {
  if (!TEAM_ADMIN_SIDEBAR_NAV_ENABLED) {
    return (
      <div className="flex flex-1 flex-col gap-8 p-4 sm:p-8">
        {legacyHeader}
        {children}
      </div>
    );
  }

  const meta = teamAdminPageMetaForPath(pathname);

  return (
    <TeamAdminPageChrome
      section={meta.section}
      title={meta.title}
      description={meta.description}
      workspaceName={ctx.selected.name}
      planLabel={ctx.planLabel}
    >
      {children}
    </TeamAdminPageChrome>
  );
}
