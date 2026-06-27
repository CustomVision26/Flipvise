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
  navigateToOfflineShell,
} from "@/lib/offline/is-flipvise-native-app";
import { AccountDeleteDialog } from "@/components/account-delete-dialog";
import { CreditCard, Megaphone, Palette, Shield } from "lucide-react";

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
  /** Server-resolved Pro Plus interface palette (12 colors) vs Pro-only (8), from `getAccessContext()`. */
  resolvedHasProPlusInterfacePalette?: boolean;
  /** Count of open (pending + non-expired) inbox invitations for the nav badge. */
  inboxUnreadCount?: number;
  /** When true, show the Help Center question-mark icon (hidden for team workspace members). */
  showHelpCenter?: boolean;
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
  resolvedHasProPlusInterfacePalette = false,
  inboxUnreadCount = 0,
  showHelpCenter = false,
}: HeaderUserSectionProps) {
  const pathname = usePathname();
  const { userId } = useAuth();
  const { user } = useUser();

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
    // Native app: land back in the bundled offline shell (works without a
    // connection) instead of the live homepage's sign-in screen.
    if (isFlipviseNativeApp()) {
      void navigateToOfflineShell();
    } else {
      window.location.replace("/");
    }
  }, [isSigningOut]);
  const meta = user?.publicMetadata as
    | { adminGranted?: boolean; role?: string }
    | undefined;
  const adminGranted = meta?.adminGranted === true;
  const isAdmin = isClerkPlatformAdminRole(meta?.role);
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
    const delay = clerkAuthHandoffDelayMs();
    if (delay === 0) {
      setPortalsReady(true);
      return;
    }
    const timer = window.setTimeout(() => setPortalsReady(true), delay);
    return () => window.clearTimeout(timer);
  }, [userId]);

  // Never signed in on this page → nothing to render. When signing out we keep
  // the tree (and the Clerk UserButton) mounted until `window.location.replace`
  // reloads, to avoid the React 19 portal-teardown crash.
  if (!userId && !everSignedInRef.current) {
    return null;
  }

  const hidePlatformAdminLink = shouldHidePlatformAdminNav(pathname);

  const workspaceDropdownEligible =
    workspaceTeams.length > 0 ||
    workspaceTeamsTotalEligible > 0 ||
    (activeTeamPlan != null && isTeamPlanId(activeTeamPlan)) ||
    teamDashFallback != null ||
    isPro;

  return (
    <div className="flex items-center gap-1 sm:gap-2">
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
            Platform Admin
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
            Affiliate
          </Link>
        </HeaderNavTooltip>
      )}
      <div className="flex min-w-0 flex-row items-center gap-2">
        <HeaderNavTooltip label={`${personalAccountPlanLabel} plan — view pricing`}>
          <Link
            href="/pricing"
            className={cn(
              "min-w-0 max-w-[9rem] shrink truncate text-sm font-medium text-muted-foreground hover:text-foreground transition-colors sm:max-w-[11rem] xl:max-w-[14rem]",
              isPro && "text-foreground",
            )}
            aria-label={`${personalAccountPlanLabel} plan — view pricing`}
          >
            {personalAccountPlanLabel}
          </Link>
        </HeaderNavTooltip>
        {portalsReady ? (
          <>
            {showWorkspaceSwitcher &&
              workspaceDropdownEligible &&
              !hideWorkspaceSwitcherOnWorkspaceManagement &&
              !hideWorkspaceSwitcherOnTeamRoute &&
              !hideWorkspaceSwitcherOnPricingForTeamTier && (
                <span className="inline-flex max-w-full min-w-0 shrink">
                  <WorkspaceContextDropdown
                    teams={workspaceTeams}
                    totalEligibleTeamCount={workspaceTeamsTotalEligible}
                    activeTeamId={activeWorkspaceTeamId}
                    personalWorkspaceHref={personalWorkspaceHref}
                    personalPlanLabel={personalPlanLabelForWorkspace}
                    teamDashFallback={teamDashFallback}
                  />
                </span>
              )}
            {/* Avoid Tooltip wrapping UserButton (both use portals) — teardown race → removeChild on null parent. */}
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
      </div>
      {portalsReady ? <DocsNavIconButton /> : null}
      {portalsReady && showHelpCenter ? <HelpCenterNavIconButton /> : null}
      {portalsReady ? <InboxNavIconButton unreadCount={inboxUnreadCount} /> : null}
    </div>
  );
}
