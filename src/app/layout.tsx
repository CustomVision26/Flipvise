import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Poppins } from "next/font/google";
import Image from "next/image";
import { AppProviders } from "@/components/app-providers";
import { HeaderLogo } from "@/components/header-logo";
import { HeaderUserSection } from "@/components/header-user-section";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getAccessContext } from "@/lib/access";
import { isTeamPlanId, TEAM_PLAN_LABELS } from "@/lib/team-plans";
import { personalDashboardHref } from "@/lib/personal-dashboard-url";
import { tryTeamQuery } from "@/lib/team-query-fallback";
import {
  getTeamsForTeamDashboard,
  getWorkspaceNavTeamsForUser,
  userHasTeamAdminDashboardAccess,
} from "@/db/queries/teams";
import { TeamAdminHeaderSwitcherClient } from "@/components/team-admin-header-switcher-client";
import { TEAM_CONTEXT_COOKIE } from "@/lib/team-context-cookie";
import { shouldHideHelpCenter } from "@/lib/team-help";
import {
  PRO_UI_THEME_COOKIE,
  resolveProUiThemeDataAttribute,
  resolveProUiThemeSelection,
} from "@/lib/pro-ui-theme";
import {
  FREE_UI_THEME_COOKIE,
  resolveFreeUiThemeDataAttribute,
  resolveFreeUiThemeSelection,
} from "@/lib/free-ui-theme";
import { LOGO_PUBLIC_URL } from "@/lib/branding";
import {
  parseSearchParamsRecordFromSearchString,
  teamWorkspaceTeamIdFromUrlShapeIfValid,
} from "@/lib/resolve-team-workspace-url";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Flipvise",
  description: "Flashcard app to supercharge your learning",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId, isPro, adminGranted, isAdmin, activeTeamPlan } =
    await getAccessContext();

  const personalPlanLabelForWorkspace =
    activeTeamPlan !== null
      ? TEAM_PLAN_LABELS[activeTeamPlan]
      : isPro
        ? "Pro"
        : "Free";

  const teamAdminHeaderPayload =
    userId != null
      ? await tryTeamQuery(async () => {
          const canAccess = await userHasTeamAdminDashboardAccess(userId);
          if (!canAccess) {
            return {
              teamAdminHeaderTeams: [] as {
                id: number;
                name: string;
                ownerUserId: string;
                workspacePlanQuery?: string;
              }[],
            };
          }
          const teams = await getTeamsForTeamDashboard(userId);
          return {
            teamAdminHeaderTeams: teams.map((t) => ({
              id: t.id,
              name: t.name,
              ownerUserId: t.ownerUserId,
              workspacePlanQuery: isTeamPlanId(t.planSlug)
                ? t.planSlug
                : undefined,
            })),
          };
        }, { teamAdminHeaderTeams: [] })
      : { teamAdminHeaderTeams: [] };

  const teamAdminHeaderTeams = teamAdminHeaderPayload.teamAdminHeaderTeams;

  const workspaceNav =
    userId != null
      ? await tryTeamQuery(
          () =>
            getWorkspaceNavTeamsForUser(userId, {
              personalProUnlocked: isPro,
            }),
          { teams: [], totalEligibleCount: 0 },
        )
      : { teams: [], totalEligibleCount: 0 };
  const workspaceTeams = workspaceNav.teams;
  const workspaceTeamsTotalEligible = workspaceNav.totalEligibleCount;
  const showWorkspaceSwitcher = workspaceTeamsTotalEligible > 0;

  const dashboardHrefWithUserQuery =
    userId != null
      ? personalDashboardHref(userId, activeTeamPlan, isPro)
      : "/dashboard";
  const personalWorkspaceHref =
    userId != null && showWorkspaceSwitcher
      ? dashboardHrefWithUserQuery
      : "/dashboard";

  const cookieStore = await cookies();
  const teamContext = cookieStore.get(TEAM_CONTEXT_COOKIE)?.value;

  const allowedWorkspaceIds = new Set(workspaceTeams.map((t) => t.id));
  const headerStore = await headers();
  const pathnameHeader = headerStore.get("x-pathname") ?? "";
  const xSearch = headerStore.get("x-search") ?? "";
  const teamIdFromUrlShape = teamWorkspaceTeamIdFromUrlShapeIfValid(
    parseSearchParamsRecordFromSearchString(xSearch),
  );
  const activeFromUrl =
    teamIdFromUrlShape != null && allowedWorkspaceIds.has(teamIdFromUrlShape)
      ? teamIdFromUrlShape
      : null;
  const parsedCtx = teamContext ? Number(teamContext) : NaN;
  const activeFromCookie =
    Number.isFinite(parsedCtx) && allowedWorkspaceIds.has(parsedCtx)
      ? parsedCtx
      : null;
  /** URL wins over cookie so the switcher matches `/dashboard?team=…` on first paint (layout runs before the page sets the cookie). */
  const activeWorkspaceTeamId = activeFromUrl ?? activeFromCookie;
  const hideHelpCenter =
    userId != null &&
    !isAdmin &&
    !adminGranted &&
    (await shouldHideHelpCenter(userId, teamContext));
  
  const proCookieValue = cookieStore.get(PRO_UI_THEME_COOKIE)?.value;
  const proUiTheme = resolveProUiThemeDataAttribute(isPro, proCookieValue);
  const proUiThemeSelection = resolveProUiThemeSelection(proCookieValue);
  
  const freeCookieValue = cookieStore.get(FREE_UI_THEME_COOKIE)?.value;
  const freeUiTheme = resolveFreeUiThemeDataAttribute(isPro, freeCookieValue);
  const freeUiThemeSelection = resolveFreeUiThemeSelection(freeCookieValue);
  
  const appliedTheme = isPro ? proUiTheme : freeUiTheme;
  const isTeamInviteRoute = pathnameHeader.startsWith("/invite/team");
  const showHeaderChrome = Boolean(userId) || isTeamInviteRoute;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${poppins.variable} h-full antialiased`}
      data-ui-theme={appliedTheme}
    >
      <body className="min-h-full flex flex-col relative">
        <AppProviders>
          <TooltipProvider>
            {showHeaderChrome && (
              <>
                <header
                  className={
                    isTeamInviteRoute
                      ? "flex items-center justify-start border-b border-border px-3 py-2 sm:px-6 sm:py-3 relative z-10"
                      : "grid grid-cols-[1fr_auto_1fr] items-center border-b border-border px-3 py-2 sm:px-6 sm:py-3 relative z-10 gap-2"
                  }
                >
                  <div className="flex min-w-0 items-center gap-2 justify-self-start">
                    <HeaderLogo dashboardHref={dashboardHrefWithUserQuery} />
                  </div>
                  {!isTeamInviteRoute && userId && teamAdminHeaderTeams.length > 0 && (
                    <div className="flex min-w-0 justify-center justify-self-center px-1 sm:px-2">
                      <TeamAdminHeaderSwitcherClient
                        teams={teamAdminHeaderTeams}
                        userId={userId}
                      />
                    </div>
                  )}
                  {userId && !isTeamInviteRoute && (
                    <div className="flex min-w-0 items-center justify-end justify-self-end gap-1 sm:gap-2">
                      <HeaderUserSection
                        currentProTheme={proUiThemeSelection}
                        currentFreeTheme={freeUiThemeSelection}
                        hideHelpCenter={hideHelpCenter}
                        showWorkspaceSwitcher={showWorkspaceSwitcher}
                        workspaceTeams={workspaceTeams}
                        workspaceTeamsTotalEligible={workspaceTeamsTotalEligible}
                        activeWorkspaceTeamId={activeWorkspaceTeamId}
                        personalWorkspaceHref={personalWorkspaceHref}
                        personalPlanLabelForWorkspace={
                          personalPlanLabelForWorkspace
                        }
                      />
                    </div>
                  )}
                </header>
                {/* Faded background logo watermark */}
                <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0">
                  <Image
                    src={LOGO_PUBLIC_URL}
                    alt=""
                    width={800}
                    height={300}
                    className="object-contain opacity-[0.08] select-none"
                    priority={false}
                  />
                </div>
              </>
            )}
            <div className="relative flex-1 flex flex-col">
              {children}
            </div>
          </TooltipProvider>
        </AppProviders>
      </body>
    </html>
  );
}
