import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { cookies, headers } from "next/headers";
import { Poppins } from "next/font/google";
import Image from "next/image";
import { AppProviders } from "@/components/app-providers";
import { HeaderLogo } from "@/components/header-logo";
import { HeaderUserSection } from "@/components/header-user-section";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getAccessContext } from "@/lib/access";
import { isTeamPlanId } from "@/lib/team-plans";
import { personalDashboardHrefWithUserPlanQuery } from "@/lib/personal-dashboard-url";
import {
  getPersonalWorkspaceAccessLabel,
  getPersonalWorkspaceAccountPlanLabel,
} from "@/lib/personal-workspace-plan-label";
import { tryTeamQuery } from "@/lib/team-query-fallback";
import {
  countPendingInvitationsForEmail,
  getRootLayoutTeamNavPayload,
} from "@/db/queries/teams";
import { countUnreadAffiliateBroadcastInboxForUser } from "@/db/queries/affiliate-broadcast-inbox";
import { getActiveAffiliateForUser } from "@/db/queries/affiliates";
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

/** Turbopack: avoid static SSR import of these client chunks from the root layout. */
const TeamAdminHeaderSwitcherClient = dynamic(
  () => import("@/components/team-admin-header-switcher-client"),
  { loading: () => null },
);
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
    {
      userId,
      isPro,
      adminGranted,
      isAdmin,
      activeTeamPlan,
      hasProPlusInterfacePalette,
      hasClerkPersonalPro,
      hasClerkPersonalProPlus,
      primaryEmail,
    },
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

  // Batch 2: layout nav + help + inbox — team bootstrap is shared (no duplicate Drizzle loads).
  const [teamNavPayload, hideHelpCenter, inboxUnreadCount, activeAffiliateRow] =
    await Promise.all([
    userId != null
      ? tryTeamQuery(
          () =>
            getRootLayoutTeamNavPayload(userId, { personalProUnlocked: isPro }),
          {
            teamAdminHeaderTeams: [],
            workspaceNav: { teams: [], totalEligibleCount: 0 },
          },
        )
      : Promise.resolve({
          teamAdminHeaderTeams: [],
          workspaceNav: { teams: [], totalEligibleCount: 0 },
        }),

    userId != null && !isAdmin && !adminGranted
      ? shouldHideHelpCenter(userId, teamContext)
      : Promise.resolve(false),

    userId != null
      ? Promise.all([
          primaryEmail != null && primaryEmail !== ""
            ? countPendingInvitationsForEmail(primaryEmail).catch(() => 0)
            : Promise.resolve(0),
          tryTeamQuery(() => countUnreadAffiliateBroadcastInboxForUser(userId), 0),
        ]).then(([invites, affiliateBroadcasts]) => invites + affiliateBroadcasts)
      : Promise.resolve(0),

    userId != null
      ? getActiveAffiliateForUser(
          userId,
          primaryEmail?.toLowerCase() ?? null,
        ).catch(() => null)
      : Promise.resolve(null),
  ]);
  const showAffiliatePortal = activeAffiliateRow != null;

  const teamAdminHeaderTeams = teamNavPayload.teamAdminHeaderTeams;
  const workspaceTeams = teamNavPayload.workspaceNav.teams;
  const workspaceTeamsTotalEligible = teamNavPayload.workspaceNav.totalEligibleCount;
  /** Team-tier subscribers often have zero `workspaceTeams` (owned tier workspaces are omitted from nav). Still show Personal · Team X + Team Admin link like invited-workspace users. */
  const showWorkspaceSwitcher =
    workspaceTeamsTotalEligible > 0 ||
    (activeTeamPlan != null && isTeamPlanId(activeTeamPlan));

  /** Next to “Personal Dash” — SuperAdmin, Co-Admin, plan name, Subscriber, Complimentary, or Free / tier. */
  const personalPlanLabelForWorkspace = userId
    ? await getPersonalWorkspaceAccessLabel()
    : "Free";
  const personalAccountPlanLabel = userId
    ? await getPersonalWorkspaceAccountPlanLabel()
    : "Free";
  /** When the workspace nav lacks subscriber-owned team rows, still link Team Dash from admin scope. */
  const teamDashFallback =
    userId != null &&
    activeTeamPlan != null &&
    isTeamPlanId(activeTeamPlan) &&
    teamAdminHeaderTeams.length > 0
      ? (() => {
          const match = teamAdminHeaderTeams.find(
            (t) => t.workspacePlanQuery === activeTeamPlan,
          );
          const pick = match ?? teamAdminHeaderTeams[0];
          const planSlug = pick.workspacePlanQuery ?? activeTeamPlan;
          return {
            teamId: pick.id,
            planSlug,
            teamMemberUrlParam: pick.teamMemberUrlParam,
          };
        })()
      : null;

  const dashboardHrefWithUserQuery =
    userId != null
      ? personalDashboardHrefWithUserPlanQuery({
          userId,
          activeTeamPlan,
          isPro,
          hasClerkPersonalPro,
          hasClerkPersonalProPlus,
        })
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

  const proUiTheme = resolveProUiThemeDataAttribute(
    isPro,
    proCookieValue,
    hasProPlusInterfacePalette,
  );
  const proUiThemeSelection = resolveProUiThemeSelection(
    proCookieValue,
    hasProPlusInterfacePalette,
  );
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
                        personalAccountPlanLabel={personalAccountPlanLabel}
                        showAffiliatePortal={showAffiliatePortal}
                        teamDashFallback={teamDashFallback}
                        resolvedIsPro={isPro}
                        resolvedActiveTeamPlan={activeTeamPlan}
                        resolvedHasProPlusInterfacePalette={
                          hasProPlusInterfacePalette
                        }
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
