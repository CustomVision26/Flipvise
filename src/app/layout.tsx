import type { Metadata, Viewport } from "next";
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
import { cn } from "@/lib/utils";
import {
  parseSearchParamsRecordFromSearchString,
  teamWorkspaceTeamIdFromUrlShapeIfValid,
} from "@/lib/resolve-team-workspace-url";
import "./globals.css";

/** Defer heavy optional UI — keep AppProviders static so Clerk hydrates without mismatch. */
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

/** Lets `env(safe-area-inset-*)` apply under the iOS status bar / home indicator in Capacitor. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(/FlipviseNative\\//.test(navigator.userAgent)||(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform())){document.documentElement.dataset.flipviseNativeShell="1"}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col relative">
        <AppProviders>
            {showHeaderChrome && (
              <AuthenticatedShellChrome>
                <header
                  data-app-header
                  className={
                    isTeamInviteRoute
                      ? "flex items-center justify-start border-b border-border px-3 pb-2 sm:px-6 sm:pb-3 relative z-10"
                      : cn(
                          "relative z-10 border-b border-border px-3 pb-2 sm:px-6 sm:pb-3",
                          "grid items-center gap-x-2 gap-y-2",
                          "grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto]",
                          "lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:grid-rows-1",
                          shell.teamAdminHeaderTeams.length > 0 && "has-team-admin",
                        )
                  }
                >
                  <div
                    data-header-brand
                    className="col-start-1 row-start-1 flex min-w-0 items-center gap-2 sm:gap-4 justify-self-start"
                  >
                    <HeaderLogo dashboardHref={dashboardHrefWithUserQuery} />
                    {!isTeamInviteRoute && !userId && (
                      <AppTopNav homeHref={dashboardHrefWithUserQuery} />
                    )}
                  </div>
                  {!isTeamInviteRoute &&
                    userId &&
                    shell.teamAdminHeaderTeams.length > 0 && (
                    <div
                      data-header-team-admin
                      className="col-span-2 row-start-2 flex min-w-0 justify-center px-1 sm:px-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:justify-self-center"
                    >
                      <TeamAdminHeaderSwitcherClient
                        teams={shell.teamAdminHeaderTeams}
                        userId={userId}
                      />
                    </div>
                  )}
                  {userId && !isTeamInviteRoute && (
                    <div
                      data-header-user
                      className="contents lg:col-start-3 lg:flex lg:min-w-0 lg:max-w-full lg:items-center lg:justify-end lg:gap-2"
                    >
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
                        showHelpCenter={!shell.hideHelpCenter}
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
