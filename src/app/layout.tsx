import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Poppins } from "next/font/google";
import Image from "next/image";
import { AppProviders } from "@/components/app-providers";
import { HeaderLogo } from "@/components/header-logo";
import { HeaderUserSection } from "@/components/header-user-section";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getAccessContext } from "@/lib/access";
import { isTeamPlanId } from "@/lib/team-plans";
import { personalDashboardHref } from "@/lib/personal-dashboard-url";
import { tryTeamQuery } from "@/lib/team-query-fallback";
import {
  countPendingInvitationsForEmail,
  getTeamsForTeamDashboard,
  getWorkspaceNavTeamsForUser,
  userHasTeamAdminDashboardAccess,
} from "@/db/queries/teams";
import { currentUser } from "@/lib/clerk-auth";
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
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Flipvise — Smart Flashcards & Learning",
    template: "%s | Flipvise",
  },
  description:
    "Create AI-powered flashcard decks, study with flashcards or quizzes, and collaborate with your team. The smartest way to learn anything.",
  keywords: ["flashcards", "learning", "AI", "quiz", "study", "flashcard app", "spaced repetition"],
  openGraph: {
    title: "Flipvise — Smart Flashcards & Learning",
    description:
      "Create AI-powered flashcard decks, study with flashcards or quizzes, and collaborate with your team.",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Batch 1: session + cookies + headers — all independent, run in parallel
  const [
    { userId, isPro, adminGranted, isAdmin, activeTeamPlan, hasCustomColors },
    cookieStore,
    headerStore,
  ] = await Promise.all([
    getAccessContext(),
    cookies(),
    headers(),
  ]);

  // Extract cookie / header values synchronously
  const teamContext = cookieStore.get(TEAM_CONTEXT_COOKIE)?.value;
  const proCookieValue = cookieStore.get(PRO_UI_THEME_COOKIE)?.value;
  const freeCookieValue = cookieStore.get(FREE_UI_THEME_COOKIE)?.value;
  const pathnameHeader = headerStore.get("x-pathname") ?? "";
  const xSearch = headerStore.get("x-search") ?? "";

  // Batch 2: all DB queries — independent of each other, run in parallel
  const [teamAdminHeaderPayload, workspaceNav, hideHelpCenter, inboxUnreadCount] =
    await Promise.all([
      // Team admin header teams
      userId != null
        ? tryTeamQuery(async () => {
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
                workspacePlanQuery: isTeamPlanId(t.planSlug) ? t.planSlug : undefined,
              })),
            };
          }, { teamAdminHeaderTeams: [] })
        : Promise.resolve({ teamAdminHeaderTeams: [] }),

      // Workspace nav
      userId != null
        ? tryTeamQuery(
            () => getWorkspaceNavTeamsForUser(userId, { personalProUnlocked: isPro }),
            { teams: [], totalEligibleCount: 0 },
          )
        : Promise.resolve({ teams: [], totalEligibleCount: 0 }),

      // Help center visibility
      userId != null && !isAdmin && !adminGranted
        ? shouldHideHelpCenter(userId, teamContext)
        : Promise.resolve(false),

      // Inbox unread count
      userId != null
        ? (async () => {
            try {
              const sessionUser = await currentUser();
              const email = sessionUser?.primaryEmailAddress?.emailAddress ?? null;
              if (!email) return 0;
              return await countPendingInvitationsForEmail(email);
            } catch {
              return 0;
            }
          })()
        : Promise.resolve(0),
    ]);

  const teamAdminHeaderTeams = teamAdminHeaderPayload.teamAdminHeaderTeams;
  const workspaceTeams = workspaceNav.teams;
  const workspaceTeamsTotalEligible = workspaceNav.totalEligibleCount;
  const showWorkspaceSwitcher = workspaceTeamsTotalEligible > 0;

  // Team plan subscribers receive Pro on their personal workspace — show "Pro" here,
  // not the team plan name (which belongs only to the team owner dashboard).
  const personalPlanLabelForWorkspace = isPro ? "Pro" : "Free";

  const dashboardHrefWithUserQuery =
    userId != null
      ? personalDashboardHref()
      : "/dashboard";
  const personalWorkspaceHref =
    userId != null && showWorkspaceSwitcher
      ? dashboardHrefWithUserQuery
      : "/dashboard";

  const allowedWorkspaceIds = new Set(workspaceTeams.map((t) => t.id));
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

  const proUiTheme = resolveProUiThemeDataAttribute(isPro, proCookieValue);
  const proUiThemeSelection = resolveProUiThemeSelection(proCookieValue);
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
                        resolvedIsPro={isPro}
                        resolvedActiveTeamPlan={activeTeamPlan}
                        resolvedHasCustomColors={hasCustomColors}
                        inboxUnreadCount={inboxUnreadCount}
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
