import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { cookies, headers } from "next/headers";
import { Poppins } from "next/font/google";
import Image from "next/image";
import { AppProviders } from "@/components/app-providers";
import { HeaderLogo } from "@/components/header-logo";
import { AppTopNav } from "@/components/app-top-nav";
import { AuthenticatedShellChrome } from "@/components/authenticated-shell-chrome";
import { HeaderUserSection } from "@/components/header-user-section";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getAccessContext } from "@/lib/access";
import { personalDashboardHrefWithUserPlanQuery } from "@/lib/personal-dashboard-url";
import { loadRootLayoutShellData } from "@/lib/load-root-layout-shell-data";
import { TEAM_CONTEXT_COOKIE } from "@/lib/team-context-cookie";
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
const HelpCenter = dynamic(
  () => import("@/components/help-center").then((mod) => mod.HelpCenter),
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
  const [
    access,
    cookieStore,
    headerStore,
  ] = await Promise.all([
    getAccessContext(),
    cookies(),
    headers(),
  ]);

  const {
    userId,
    isPro,
    activeTeamPlan,
    hasProPlusInterfacePalette,
    hasPrioritySupport,
    hasClerkPersonalPro,
    hasClerkPersonalProPlus,
  } = access;

  const teamContext = cookieStore.get(TEAM_CONTEXT_COOKIE)?.value;
  const proCookieValue = cookieStore.get(PRO_UI_THEME_COOKIE)?.value;
  const freeCookieValue = cookieStore.get(FREE_UI_THEME_COOKIE)?.value;
  const pathnameHeader = headerStore.get("x-pathname") ?? "";
  const xSearch = headerStore.get("x-search") ?? "";

  const shell = await loadRootLayoutShellData({
    pathname: pathnameHeader,
    access,
    teamContextCookie: teamContext,
  });

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
    userId != null && shell.showWorkspaceSwitcher
      ? dashboardHrefWithUserQuery
      : "/dashboard";

  const allowedWorkspaceIds = new Set(shell.workspaceTeams.map((t) => t.id));
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
  const isTeamAdminRoute = shell.profile === "team-admin";
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
            {showHeaderChrome && (
              <AuthenticatedShellChrome>
                <header
                  className={
                    isTeamInviteRoute
                      ? "flex items-center justify-start border-b border-border px-3 py-2 sm:px-6 sm:py-3 relative z-10"
                      : "grid grid-cols-[1fr_auto_1fr] items-center border-b border-border px-3 py-2 sm:px-6 sm:py-3 relative z-10 gap-2"
                  }
                >
                  <div className="flex min-w-0 items-center gap-2 sm:gap-4 justify-self-start">
                    <HeaderLogo dashboardHref={dashboardHrefWithUserQuery} />
                    {!isTeamInviteRoute && (
                      <AppTopNav
                        homeHref={dashboardHrefWithUserQuery}
                        signedIn={Boolean(userId)}
                      />
                    )}
                  </div>
                  {!isTeamInviteRoute &&
                    userId &&
                    shell.teamAdminHeaderTeams.length > 0 && (
                    <div className="flex min-w-0 justify-center justify-self-center px-1 sm:px-2">
                      <TeamAdminHeaderSwitcherClient
                        teams={shell.teamAdminHeaderTeams}
                        userId={userId}
                      />
                    </div>
                  )}
                  {userId && !isTeamInviteRoute && (
                    <div className="flex min-w-0 items-center justify-end justify-self-end gap-1 sm:gap-2">
                      <HeaderUserSection
                        currentProTheme={proUiThemeSelection}
                        currentFreeTheme={freeUiThemeSelection}
                        showWorkspaceSwitcher={shell.showWorkspaceSwitcher}
                        workspaceTeams={shell.workspaceTeams}
                        workspaceTeamsTotalEligible={
                          shell.workspaceTeamsTotalEligible
                        }
                        activeWorkspaceTeamId={activeWorkspaceTeamId}
                        personalWorkspaceHref={personalWorkspaceHref}
                        personalPlanLabelForWorkspace={
                          shell.personalPlanLabelForWorkspace
                        }
                        personalAccountPlanLabel={
                          shell.personalAccountPlanLabel
                        }
                        showAffiliatePortal={shell.showAffiliatePortal}
                        teamDashFallback={shell.teamDashFallback}
                        resolvedIsPro={isPro}
                        resolvedActiveTeamPlan={activeTeamPlan}
                        resolvedHasProPlusInterfacePalette={
                          hasProPlusInterfacePalette
                        }
                        inboxUnreadCount={shell.inboxUnreadCount}
                      />
                    </div>
                  )}
                </header>
                {userId && !isTeamInviteRoute && !shell.hideHelpCenter ? (
                  <HelpCenter
                    showPrioritySupport={hasPrioritySupport}
                    showTrigger={false}
                  />
                ) : null}
                <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0">
                  <Image
                    src={LOGO_PUBLIC_URL}
                    alt=""
                    width={800}
                    height={300}
                    className="object-contain opacity-[0.08] select-none"
                    priority={false}
                    unoptimized
                  />
                </div>
              </AuthenticatedShellChrome>
            )}
            <div
              className="relative flex-1 flex flex-col"
              data-shell={isTeamAdminRoute ? "team-admin" : undefined}
            >
              <TooltipProvider>{children}</TooltipProvider>
            </div>
        </AppProviders>
      </body>
    </html>
  );
}
