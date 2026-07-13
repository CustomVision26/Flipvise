"use client";

import { UserButton, useAuth, useUser } from "@clerk/nextjs";
import { UserBillingPage } from "@/components/user-billing-page";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button-variants";
import { UserAppearanceSettingsPage } from "@/components/user-appearance-settings-page";
import type { ProUiThemeId } from "@/lib/pro-ui-theme";
import type { FreeUiThemeId } from "@/lib/free-ui-theme";
import { type TeamPlanId, isTeamPlanId } from "@/lib/team-plans";
import type { WorkspaceTeamOption } from "@/components/workspace-context-dropdown";
import { WorkspaceContextDropdown } from "@/components/workspace-context-dropdown";
import { InboxNavIconButton } from "@/components/inbox-nav-icon-button";
import { DocsNavIconButton } from "@/components/docs-nav-icon-button";
import { HelpCenterNavIconButton } from "@/components/help-center-nav-icon-button";
import { TeacherNavIconButton } from "@/components/teacher-nav-icon-button";
import { HeaderNavTooltip } from "@/components/header-nav-tooltip";
import {
  shouldHidePlatformAdminNav,
  shouldHideWorkspaceSwitcher,
} from "@/lib/hide-platform-admin-nav";
import { cn } from "@/lib/utils";
import { isClerkPlatformAdminRole } from "@/lib/clerk-platform-admin-role";
import { clerkAuthHandoffDelayMs } from "@/lib/clerk-auth-handoff";
import {
  isFlipviseNativeApp,
  isFlipviseNativeShell,
  navigateToOfflineShellFast,
} from "@/lib/offline/is-flipvise-native-app";
import { useClientMounted } from "@/lib/use-client-mounted";
import { NATIVE_SIGNING_OUT_KEY } from "@/components/native-home-sign-out-guard";
import { AccountDeleteDialog } from "@/components/account-delete-dialog";
import { CreditCard, Megaphone, Palette, Shield } from "lucide-react";

const NATIVE_AFTER_SIGN_OUT_URL = "/native-signout";

interface HeaderUserSectionProps {
  currentProTheme?: ProUiThemeId;
  currentFreeTheme?: FreeUiThemeId;
  /** Personal vs team-tier workspace cookie for `/dashboard`. */
  showWorkspaceSwitcher?: boolean;
  workspaceTeams?: WorkspaceTeamOption[];
  /** Full count of eligible team workspaces (may exceed `workspaceTeams` for free personal). */
  workspaceTeamsTotalEligible?: number;
  activeWorkspaceTeamId?: number | null;
  /** Personal dashboard target when selecting “Personal Dash” (may include `?userid=` / `plan=`). */
  personalWorkspaceHref?: string;
  /** Shown next to "Personal Dash" in the workspace dropdown (access role or grant type). */
  personalPlanLabelForWorkspace?: string;
  /** Billing tier link to `/pricing` (e.g. Team Basic, Pro Plus). */
  personalAccountPlanLabel?: string;
  /** Active marketing-affiliate arrangement — show link to `/dashboard/affiliate`. */
  showAffiliatePortal?: boolean;
  /** When nav has no owned team-tier row, Team Dash href still targets this admin workspace. */
  teamDashFallback?: {
    teamId: number;
    planSlug: string;
    teamMemberUrlParam: number;
  } | null;
  /** Server-resolved effective Pro state from `getAccessContext()`. */
  resolvedIsPro?: boolean;
  /** Server-resolved active team plan from `getAccessContext()`. */
  resolvedActiveTeamPlan?: TeamPlanId | null;
  /** education_gold / education_enterprise workspace tier from `getAccessContext()`. */
  resolvedActiveEducationTeamPlan?: import("@/lib/education-plans").EducationTeamPlanId | null;
  /** Server-resolved Pro Plus interface palette (12 colors) vs Pro-only (8), from `getAccessContext()`. */
  resolvedHasProPlusInterfacePalette?: boolean;
  /** Server-resolved platform admin from `getAccessContext()` (includes env superadmin allow-list). */
  resolvedIsPlatformAdmin?: boolean;
  /** Count of open (pending + non-expired) inbox invitations for the nav badge. */
  inboxUnreadCount?: number;
  /** When true, show the Help Center question-mark icon (hidden for team workspace members). */
  showHelpCenter?: boolean;
  /** When true, show Teacher Dashboard nav link on team-admin routes (education plans only). */
  showTeacherDashboard?: boolean;
}

export function HeaderUserSection({
  currentProTheme,
  currentFreeTheme,
  showWorkspaceSwitcher = false,
  workspaceTeams = [],
  workspaceTeamsTotalEligible = 0,
  activeWorkspaceTeamId = null,
  personalWorkspaceHref = "/dashboard",
  personalPlanLabelForWorkspace = "Free",
  personalAccountPlanLabel = "Free",
  showAffiliatePortal = false,
  teamDashFallback = null,
  resolvedIsPro = false,
  resolvedActiveTeamPlan = null,
  resolvedActiveEducationTeamPlan = null,
  resolvedHasProPlusInterfacePalette = false,
  resolvedIsPlatformAdmin = false,
  inboxUnreadCount = 0,
  showHelpCenter = false,
  showTeacherDashboard = false,
}: HeaderUserSectionProps) {
  const pathname = usePathname();
  const { userId, isLoaded: authLoaded } = useAuth();
  const { user } = useUser();
  const clientMounted = useClientMounted();

  /**
   * Sign-out teardown guard. Clerk's `<UserButton>` flips `userId` to null the
   * moment the user signs out, while its popover portal is still being removed.
   * Unmounting the button in that same commit triggers React 19's
   * "removeChild on null parent" crash → the whole tree dies and the app freezes
   * on the leftover watermark. We instead keep the button mounted and force a
   * full-document navigation, which tears everything down atomically.
   */
  const everSignedInRef = useRef(false);
  if (userId) everSignedInRef.current = true;
  const isSigningOut = !userId && everSignedInRef.current;

  useEffect(() => {
    if (!isSigningOut) return;

    void (async () => {
      if (isFlipviseNativeApp()) {
        try {
          sessionStorage.setItem(NATIVE_SIGNING_OUT_KEY, "1");
        } catch {
          // ignore
        }
        try {
          const session = await import("@/lib/offline/session");
          await session.setRequireManualSignIn(true);
          // Leave the live site immediately — do not await network revoke (that
          // race let Clerk paint `/` before offline study opened).
          navigateToOfflineShellFast({ immediate: true });
          const token = await session.getStoredSyncToken().catch(() => null);
          if (token) {
            void fetch(`${window.location.origin}/api/native/revoke-sync-token`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            }).catch(() => {});
          }
          void session.clearStoredSyncCredentials().catch(() => {});
        } catch {
          navigateToOfflineShellFast({ immediate: true });
        }
      } else if (
        document.documentElement.dataset.flipviseNativeShell === "1" ||
        isFlipviseNativeShell()
      ) {
        // Clerk UserButton no longer accepts afterSignOutUrl — send native shell
        // here so we skip flashing the marketing homepage.
        window.location.replace(NATIVE_AFTER_SIGN_OUT_URL);
      } else {
        window.location.replace("/");
      }
    })();
  }, [isSigningOut]);
  const meta = user?.publicMetadata as
    | { adminGranted?: boolean; role?: string }
    | undefined;
  const adminGranted = meta?.adminGranted === true;
  const isAdmin =
    resolvedIsPlatformAdmin || isClerkPlatformAdminRole(meta?.role);
  const activeTeamPlan = resolvedActiveTeamPlan;
  const isPro = resolvedIsPro || adminGranted || isAdmin;

  const workspaceNavUnlocked = isAdmin || adminGranted;
  /** Team onboarding route: hide for non–platform-admin users only. */
  const hideWorkspaceSwitcherOnTeamRoute =
    !workspaceNavUnlocked && pathname === "/dashboard/team";

  const hideWorkspaceSwitcherOnWorkspaceManagement =
    shouldHideWorkspaceSwitcher(pathname);

  const hideWorkspaceSwitcherOnPricingForTeamTier =
    !workspaceNavUnlocked &&
    activeTeamPlan != null &&
    (pathname === "/pricing" || pathname.startsWith("/pricing/"));

  /** Defer Clerk / Radix portals briefly after sign-in handoff only (removeChild race). */
  const [portalsReady, setPortalsReady] = useState(false);
  useEffect(() => {
    if (!userId) {
      // Mid sign-out: keep portals mounted so Clerk can tear its own popover
      // down before the hard navigation reloads the document.
      if (everSignedInRef.current) return;
      setPortalsReady(false);
      return;
    }

    // Native WebView: wait until the page is hydrated + Clerk auth is loaded
    // before mounting UserButton — otherwise Clerk UI chunks time out at 10s.
    if (!clientMounted || !authLoaded) {
      setPortalsReady(false);
      return;
    }

    const nativeShell =
      typeof document !== "undefined" &&
      (document.documentElement.dataset.flipviseNativeShell === "1" ||
        isFlipviseNativeShell());

    if (nativeShell) {
      setPortalsReady(false);
      const timer = window.setTimeout(() => setPortalsReady(true), 400);
      return () => window.clearTimeout(timer);
    }

    if (process.env.NODE_ENV === "development") {
      setPortalsReady(true);
      return;
    }

    const delay = clerkAuthHandoffDelayMs();
    if (delay === 0) {
      setPortalsReady(true);
      return;
    }

    setPortalsReady(false);
    const timer = window.setTimeout(() => setPortalsReady(true), delay);
    return () => {
      window.clearTimeout(timer);
      setPortalsReady(true);
    };
  }, [userId, clientMounted, authLoaded]);

  // Never signed in on this page → nothing to render. When signing out we keep
  // the tree (and the Clerk UserButton) mounted until `window.location.replace`
  // reloads, to avoid the React 19 portal-teardown crash.
  if (!userId && !everSignedInRef.current) {
    return null;
  }

  const hidePlatformAdminLink = shouldHidePlatformAdminNav(pathname);

  const isTeacherRoute =
    pathname === "/teacher" || pathname.startsWith("/teacher/");
  const isTeamAdminRoute =
    pathname === "/dashboard/team-admin" ||
    pathname.startsWith("/dashboard/team-admin/");

  const showTeacherNavButton = showTeacherDashboard && isTeamAdminRoute;

  const workspaceDropdownEligible =
    workspaceTeams.length > 0 ||
    workspaceTeamsTotalEligible > 0 ||
    (activeTeamPlan != null && isTeamPlanId(activeTeamPlan)) ||
    resolvedActiveEducationTeamPlan != null ||
    teamDashFallback != null ||
    isPro;

  const showWorkspaceSwitcherUi =
    showWorkspaceSwitcher &&
    workspaceDropdownEligible &&
    !hideWorkspaceSwitcherOnWorkspaceManagement &&
    !hideWorkspaceSwitcherOnTeamRoute &&
    !hideWorkspaceSwitcherOnPricingForTeamTier;

  const toolIconClass = "h-8 w-8 shrink-0 rounded-full";

  return (
    <div
      data-header-user-section
      className="contents lg:flex lg:min-w-0 lg:flex-1 lg:items-center lg:justify-end lg:gap-2"
    >
      <div
        data-header-tools
        className="col-start-2 row-start-1 flex min-w-0 shrink-0 items-center gap-0.5 justify-self-end sm:gap-1 lg:order-3"
      >
        <div
          data-header-promo-links
          className="mr-0.5 flex shrink-0 items-center gap-1 sm:mr-1"
        >
          {showTeacherNavButton ? (
            <span className="inline-flex shrink-0 items-center">
              <TeacherNavIconButton />
            </span>
          ) : null}
          {(isAdmin && !hidePlatformAdminLink) || showAffiliatePortal ? (
            <div className="flex items-center gap-1">
              {isAdmin && !hidePlatformAdminLink && (
                <HeaderNavTooltip label="Platform Admin">
                  <Link
                    href="/admin/all-users"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "inline-flex h-8 items-center gap-1.5 px-2.5 text-xs sm:px-3",
                    )}
                    aria-label="Platform Admin"
                  >
                    <Shield className="size-3.5 shrink-0" aria-hidden />
                    <span className="hidden xl:inline">Platform Admin</span>
                  </Link>
                </HeaderNavTooltip>
              )}
              {showAffiliatePortal && (
                <HeaderNavTooltip label="Affiliate portal">
                  <Link
                    href="/dashboard/affiliate"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "inline-flex h-8 items-center gap-1.5 border-violet-500/30 px-2.5 text-xs sm:px-3",
                    )}
                    aria-label="Affiliate portal"
                  >
                    <Megaphone className="size-3.5 shrink-0 text-violet-300" aria-hidden />
                    <span className="hidden xl:inline">Affiliate</span>
                  </Link>
                </HeaderNavTooltip>
              )}
            </div>
          ) : null}
        </div>
        <div
          data-header-icon-tools
          className="flex shrink-0 items-center gap-0.5 sm:gap-1"
        >
        {portalsReady ? (
          <HeaderNavTooltip label={`${personalAccountPlanLabel} plan — view pricing`}>
            <Link
              href="/pricing"
              className={cn(
                "mr-0.5 inline-block max-w-[5.5rem] shrink-0 truncate text-xs font-medium text-muted-foreground transition-colors hover:text-foreground min-[380px]:max-w-[7rem] sm:mr-1 sm:max-w-[9rem] sm:text-sm lg:max-w-[11rem]",
                isPro && "text-foreground",
              )}
              aria-label={`${personalAccountPlanLabel} plan — view pricing`}
            >
              {personalAccountPlanLabel}
            </Link>
          </HeaderNavTooltip>
        ) : null}
        {portalsReady ? (
          <>
            <span
              className="inline-flex shrink-0 items-center"
              title="Account — profile, appearance, and billing"
            >
              <UserButton>
                <UserButton.UserProfilePage
                  label="Appearance"
                  url="appearance"
                  labelIcon={<Palette className="size-4" />}
                >
                  <UserAppearanceSettingsPage
                    currentProTheme={currentProTheme}
                    currentFreeTheme={currentFreeTheme}
                    isPro={isPro}
                    hasProPlusInterfacePalette={resolvedHasProPlusInterfacePalette}
                  />
                </UserButton.UserProfilePage>
                <UserButton.UserProfilePage
                  label="Billing"
                  url="billing"
                  labelIcon={<CreditCard className="size-4" />}
                >
                  <UserBillingPage />
                </UserButton.UserProfilePage>
              </UserButton>
            </span>
            <AccountDeleteDialog />
          </>
        ) : null}
        {portalsReady ? (
          <span className={toolIconClass}>
            <DocsNavIconButton />
          </span>
        ) : null}
        {portalsReady && showHelpCenter ? (
          <span className={toolIconClass}>
            <HelpCenterNavIconButton />
          </span>
        ) : null}
        {portalsReady ? (
          <span className={toolIconClass}>
            <InboxNavIconButton unreadCount={inboxUnreadCount} />
          </span>
        ) : null}
        </div>
      </div>

      {portalsReady && showWorkspaceSwitcherUi ? (
        <div
          data-header-workspace
          className="col-span-2 row-start-2 flex w-full min-w-0 items-center gap-2 lg:order-2 lg:w-auto"
        >
          <span className="inline-flex min-w-0 flex-1 lg:flex-initial">
            <WorkspaceContextDropdown
              teams={workspaceTeams}
              totalEligibleTeamCount={workspaceTeamsTotalEligible}
              activeTeamId={activeWorkspaceTeamId}
              personalWorkspaceHref={personalWorkspaceHref}
              personalPlanLabel={personalPlanLabelForWorkspace}
              personalHasTeamTierPlan={
                (resolvedActiveTeamPlan != null &&
                  isTeamPlanId(resolvedActiveTeamPlan)) ||
                resolvedActiveEducationTeamPlan != null
              }
              teamDashFallback={teamDashFallback}
              showTeacherDashboard={showTeacherDashboard}
            />
          </span>
        </div>
      ) : null}
    </div>
  );
}
