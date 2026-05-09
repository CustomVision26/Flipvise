"use client";

import { UserButton, useAuth, useUser } from "@clerk/nextjs";
import { UserBillingPage } from "@/components/user-billing-page";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { UserAppearanceSettingsPage } from "@/components/user-appearance-settings-page";
import { HelpCenter } from "@/components/help-center";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProUiThemeId } from "@/lib/pro-ui-theme";
import type { FreeUiThemeId } from "@/lib/free-ui-theme";
import {
  type TeamPlanId,
  TEAM_PLAN_LABELS,
  isTeamPlanId,
} from "@/lib/team-plans";
import type { WorkspaceTeamOption } from "@/components/workspace-context-dropdown";
import { WorkspaceContextDropdown } from "@/components/workspace-context-dropdown";
import { InboxNavIconButton } from "@/components/inbox-nav-icon-button";
import {
  shouldHidePlatformAdminNav,
  shouldHideWorkspaceSwitcher,
} from "@/lib/hide-platform-admin-nav";
import { cn } from "@/lib/utils";
import { isClerkPlatformAdminRole } from "@/lib/clerk-platform-admin-role";
import { CreditCard, Palette, Shield } from "lucide-react";

interface HeaderUserSectionProps {
  currentProTheme?: ProUiThemeId;
  currentFreeTheme?: FreeUiThemeId;
  /** When true, Help Center is not shown (team member in team workspace mode). Off for platform admins / complimentary Pro. */
  hideHelpCenter?: boolean;
  /** Personal vs team-tier workspace cookie for `/dashboard`. */
  showWorkspaceSwitcher?: boolean;
  workspaceTeams?: WorkspaceTeamOption[];
  /** Full count of eligible team workspaces (may exceed `workspaceTeams` for free personal). */
  workspaceTeamsTotalEligible?: number;
  activeWorkspaceTeamId?: number | null;
  /** Personal dashboard target when selecting “Personal Dash” (may include `?userid=` / `plan=`). */
  personalWorkspaceHref?: string;
  /** Shown next to "Personal Dash" in the workspace dropdown (team tier display name, Pro, or Free). */
  personalPlanLabelForWorkspace?: string;
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
}

export function HeaderUserSection({
  currentProTheme,
  currentFreeTheme,
  hideHelpCenter = false,
  showWorkspaceSwitcher = false,
  workspaceTeams = [],
  workspaceTeamsTotalEligible = 0,
  activeWorkspaceTeamId = null,
  personalWorkspaceHref = "/dashboard",
  personalPlanLabelForWorkspace = "Free",
  teamDashFallback = null,
  resolvedIsPro = false,
  resolvedActiveTeamPlan = null,
  resolvedHasProPlusInterfacePalette = false,
  inboxUnreadCount = 0,
}: HeaderUserSectionProps) {
  const pathname = usePathname();
  const { userId } = useAuth();
  const { user } = useUser();
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

  const planName = activeTeamPlan
    ? TEAM_PLAN_LABELS[activeTeamPlan]
    : isPro
      ? "Pro"
      : "Free";

  const planNameLinkTooltip = useMemo(() => {
    let planLabel: string;
    if (activeTeamPlan != null) {
      planLabel = `${planName} plan`;
    } else if (isPro) {
      planLabel = adminGranted
        ? "Pro plan (complimentary)"
        : "Pro plan";
    } else {
      planLabel = "Free plan";
    }
    return `${planLabel} — Opens the pricing page`;
  }, [activeTeamPlan, planName, isPro, adminGranted]);

  if (!userId) {
    return null;
  }

  const hidePlatformAdminLink = shouldHidePlatformAdminNav(pathname);

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {isAdmin && !hidePlatformAdminLink && (
        <Link
          href="/admin/all-users"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "inline-flex h-8 items-center gap-1.5 px-2.5 text-xs sm:px-3",
          )}
        >
          <Shield className="size-3.5 shrink-0" aria-hidden />
          Platform Admin
        </Link>
      )}
      <Tooltip>
        <TooltipTrigger
          render={(props) => (
            <Link
              href="/pricing"
              {...props}
              className={cn("lg:hidden inline-flex", props.className)}
            >
              <Badge
                variant={isPro ? "default" : "secondary"}
                className="text-[10px] sm:text-xs font-semibold tracking-wide px-1.5 sm:px-2 cursor-pointer hover:opacity-80 transition-opacity"
              >
                {isPro ? "Pro" : "Free"}
              </Badge>
            </Link>
          )}
        />
        <TooltipContent side="bottom">{planNameLinkTooltip}</TooltipContent>
      </Tooltip>
      <div className="flex min-w-0 flex-row items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            render={(props) => (
              <Link
                href="/pricing"
                {...props}
                className={cn(
                  "order-1 hidden min-w-0 max-w-[11rem] shrink truncate text-sm font-medium text-muted-foreground hover:text-foreground transition-colors lg:inline-flex",
                  isPro && "text-foreground",
                  "xl:max-w-[16rem]",
                  props.className,
                )}
              >
                {planName}
              </Link>
            )}
          />
          <TooltipContent side="bottom">{planNameLinkTooltip}</TooltipContent>
        </Tooltip>
        {showWorkspaceSwitcher &&
          (workspaceTeams.length > 0 ||
            (activeTeamPlan != null && isTeamPlanId(activeTeamPlan))) &&
          !hideWorkspaceSwitcherOnWorkspaceManagement &&
          !hideWorkspaceSwitcherOnTeamRoute &&
          !hideWorkspaceSwitcherOnPricingForTeamTier && (
            <span className="order-2 inline-flex max-w-full min-w-0 shrink">
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
          className="order-3 inline-flex shrink-0 items-center"
          title="Account"
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
      </div>
      <InboxNavIconButton unreadCount={inboxUnreadCount} />
      {!hideHelpCenter && <HelpCenter />}
    </div>
  );
}
