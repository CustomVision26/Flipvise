"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TeamInviteForm, type TeamInviteWorkspaceOption } from "@/components/team-invite-form";
import {
  TeamActiveInvitationsTable,
  TeamInvitationHistoryTable,
} from "@/components/team-admin-invitation-tables";
import { TeamMemberTable } from "@/components/team-member-table";
import { TeamMemberHistoryTable } from "@/components/team-member-history-table";
import { TeamWorkspaceHistoryTable } from "@/components/team-workspace-history-table";
import type { TeamMemberHistoryRow } from "@/lib/team-member-history-types";
import type { TeamWorkspaceEventRow } from "@/db/queries/team-workspace-events";
import type { TeamInvitationRow, TeamMemberRow } from "@/db/schema";
import type { ClerkUserFieldDisplay } from "@/lib/clerk-user-display";
import { cn } from "@/lib/utils";
import { TEAM_INVITE_EXPIRY_DAYS } from "@/lib/team-invite-expiry";
import { TeamQuizResultsTab } from "@/components/team-quiz-results-tab";
import type { TeamQuizWorkspaceSnapshot } from "@/components/team-quiz-results-tab";
import {
  isTeamAdminDeckManagerPath,
  isTeamAdminInviteHistoryPath,
  isTeamAdminInviteMembersSubPath,
  isTeamAdminInvitePendingPath,
  isTeamAdminInviteSendPath,
  isTeamAdminMembersHistoryPath,
  isTeamAdminQuizResultsPath,
  isTeamAdminWsHistoryPath,
} from "@/lib/team-admin-url";
import {
  TEAM_ADMIN_PANEL_IDS,
  teamAdminActivePanelClass,
  teamAdminActivePanelTitleClass,
  teamAdminPanelHref,
  teamAdminPanelScrollClass,
  teamAdminSubTabClass,
  teamAdminSubTabPanelClass,
  teamAdminTabClass,
} from "@/components/team-admin-panel-styles";
import {
  scrollToTeamAdminPanel,
  TeamAdminPanelScroll,
} from "@/components/team-admin-panel-scroll";

type InvitationRow = TeamInvitationRow;
type MemberRow = TeamMemberRow;

function TeamAdminTabLink({
  href,
  panelId,
  isActive,
  children,
}: {
  href: string;
  panelId: string;
  isActive: boolean;
  children: ReactNode;
}) {
  const panelHref = teamAdminPanelHref(href, panelId);

  return (
    <Link
      href={panelHref}
      className={teamAdminTabClass(isActive)}
      role="tab"
      onClick={(e) => {
        if (isActive) {
          e.preventDefault();
          scrollToTeamAdminPanel(panelId);
        }
      }}
    >
      {children}
    </Link>
  );
}

function TeamAdminDeckManagerNavLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isActive = isTeamAdminDeckManagerPath(pathname);
  return (
    <TeamAdminTabLink
      href={href}
      panelId={TEAM_ADMIN_PANEL_IDS.deckManager}
      isActive={isActive}
    >
      {children}
    </TeamAdminTabLink>
  );
}

export type TeamAdminManageTabsProps = {
  teamId: number;
  deckManagerHref: string;
  membersHref: string;
  membersHistoryHref: string;
  workspaceHistoryHref: string;
  inviteSendHref: string;
  invitePendingHref: string;
  inviteHistoryHref: string;
  quizResultsHref: string;
  quizTimerHref: string;
  quizScheduleHref: string;
  quizSecurityHref: string;
  teamName: string;
  /** Deck names assigned to each member in this workspace (`team_members.userId` → names). */
  deckNamesByMemberUserId: Record<string, string[]>;
  /** All deck names linked to this workspace (for the subscriber owner row). */
  workspaceDeckNames: string[];
  ownerUserId: string;
  teamCreatedAt: Date;
  currentUserId: string;
  isOwner: boolean;
  workspaces: TeamInviteWorkspaceOption[];
  inviteAggregatedMemberEmails?: string[];
  defaultWorkspaceId: number;
  members: MemberRow[];
  userFieldDisplayById: Record<string, ClerkUserFieldDisplay>;
  pendingInvitations: InvitationRow[];
  invitationHistory: InvitationRow[];
  memberHistory?: TeamMemberHistoryRow[] | null;
  workspaceHistory?: TeamWorkspaceEventRow[] | null;
  inviteDisplayHintsByEmail: Record<string, string>;
  subscriberOwnerPrimaryEmail: string | null;
  workspaceQuizSnapshots: TeamQuizWorkspaceSnapshot[];
};

function TeamAdminPanelCard({
  panelId,
  title,
  description,
  headerAside,
  children,
}: {
  panelId: string;
  title: string;
  description: string;
  headerAside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className={teamAdminActivePanelClass}>
      <CardHeader className="space-y-2 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <CardTitle
              id={panelId}
              className={cn(teamAdminActivePanelTitleClass, teamAdminPanelScrollClass)}
            >
              {title}
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
          </div>
          {headerAside ? <div className="shrink-0 self-start">{headerAside}</div> : null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function TeamAdminManageTabs({
  teamId,
  deckManagerHref,
  membersHref,
  membersHistoryHref,
  workspaceHistoryHref,
  inviteSendHref,
  invitePendingHref,
  inviteHistoryHref,
  quizResultsHref,
  quizTimerHref,
  quizScheduleHref,
  quizSecurityHref,
  teamName,
  deckNamesByMemberUserId,
  workspaceDeckNames,
  ownerUserId,
  teamCreatedAt,
  currentUserId,
  isOwner,
  workspaces,
  inviteAggregatedMemberEmails,
  defaultWorkspaceId,
  members,
  userFieldDisplayById,
  pendingInvitations,
  invitationHistory,
  memberHistory = [],
  workspaceHistory = [],
  inviteDisplayHintsByEmail,
  subscriberOwnerPrimaryEmail,
  workspaceQuizSnapshots,
}: TeamAdminManageTabsProps) {
  const pathname = usePathname();
  const mainPanel = isTeamAdminWsHistoryPath(pathname)
    ? "workspace-history"
    : isTeamAdminQuizResultsPath(pathname)
      ? "quiz-results"
      : "members";

  const invitePanelVisible = isTeamAdminInviteMembersSubPath(pathname);

  const membersLinkActive =
    mainPanel === "members" && !isTeamAdminInviteMembersSubPath(pathname);
  const workspaceHistoryLinkActive = mainPanel === "workspace-history";
  const quizResultsLinkActive = mainPanel === "quiz-results";
  const inviteMembersLinkActive = invitePanelVisible;

  return (
    <div className="flex w-full flex-col gap-5">
      <TeamAdminPanelScroll />
      <div className="-mx-1 overflow-x-auto px-1">
        <div
          role="tablist"
          aria-orientation="horizontal"
          className="flex min-w-max gap-2 py-0.5 sm:gap-0 sm:border-b sm:border-border/80 sm:py-0"
        >
          <TeamAdminTabLink
            href={membersHref}
            panelId={TEAM_ADMIN_PANEL_IDS.members}
            isActive={membersLinkActive}
          >
            Members
          </TeamAdminTabLink>
          <TeamAdminDeckManagerNavLink href={deckManagerHref}>Deck Manager</TeamAdminDeckManagerNavLink>
          <TeamAdminTabLink
            href={workspaceHistoryHref}
            panelId={TEAM_ADMIN_PANEL_IDS.workspaceHistory}
            isActive={workspaceHistoryLinkActive}
          >
            Workspace history
          </TeamAdminTabLink>
          <TeamAdminTabLink
            href={inviteSendHref}
            panelId={TEAM_ADMIN_PANEL_IDS.inviteMembers}
            isActive={inviteMembersLinkActive}
          >
            Invite members
          </TeamAdminTabLink>
          <TeamAdminTabLink
            href={quizResultsHref}
            panelId={TEAM_ADMIN_PANEL_IDS.quizResults}
            isActive={quizResultsLinkActive}
          >
            Quiz results
          </TeamAdminTabLink>
        </div>
      </div>

      <div key={pathname} className="w-full">
      {mainPanel === "members" && !invitePanelVisible ? (
        <TeamAdminPanelCard
          panelId={TEAM_ADMIN_PANEL_IDS.members}
          title="Members"
          description={
            isTeamAdminMembersHistoryPath(pathname)
              ? "When members joined or were removed from this workspace, including who performed each action."
              : "Change roles or remove members. Double-click a row to view member details."
          }
          headerAside={
            <div
              role="tablist"
              aria-orientation="horizontal"
              className="inline-flex rounded-lg border border-border/80 bg-muted/20 p-1"
            >
              <Link
                href={membersHref}
                className={teamAdminSubTabClass(!isTeamAdminMembersHistoryPath(pathname))}
                role="tab"
              >
                Roster
              </Link>
              <Link
                href={membersHistoryHref}
                className={teamAdminSubTabClass(isTeamAdminMembersHistoryPath(pathname))}
                role="tab"
              >
                Membership history
              </Link>
            </div>
          }
        >
          {isTeamAdminMembersHistoryPath(pathname) ? (
            <div className={teamAdminSubTabPanelClass}>
              <TeamMemberHistoryTable
                rows={memberHistory}
                userFieldDisplayById={userFieldDisplayById}
              />
            </div>
          ) : (
            <TeamMemberTable
              teamId={teamId}
              teamName={teamName}
              deckNamesByMemberUserId={deckNamesByMemberUserId}
              workspaceDeckNames={workspaceDeckNames}
              ownerUserId={ownerUserId}
              teamCreatedAt={teamCreatedAt}
              members={members}
              currentUserId={currentUserId}
              isOwner={isOwner}
              userFieldDisplayById={userFieldDisplayById}
            />
          )}
        </TeamAdminPanelCard>
      ) : null}

      {mainPanel === "workspace-history" ? (
        <TeamAdminPanelCard
          panelId={TEAM_ADMIN_PANEL_IDS.workspaceHistory}
          title="Workspace history"
          description="When this workspace was created, renamed, or removed. Each row is recorded at the time the change happened."
        >
          <TeamWorkspaceHistoryTable rows={workspaceHistory} />
        </TeamAdminPanelCard>
      ) : null}

      {invitePanelVisible ? (
        <TeamAdminPanelCard
          panelId={TEAM_ADMIN_PANEL_IDS.inviteMembers}
          title="Invite members"
          description={`Send invitations, manage active invites, or review history for this workspace. Invites expire in ${TEAM_INVITE_EXPIRY_DAYS} days.`}
        >
          <div className="space-y-5">
            <div className="overflow-x-auto">
              <div
                role="tablist"
                aria-orientation="horizontal"
                className="inline-flex min-w-full rounded-lg border border-border/80 bg-muted/20 p-1 sm:min-w-0"
              >
                <Link
                  href={inviteSendHref}
                  className={teamAdminSubTabClass(isTeamAdminInviteSendPath(pathname))}
                  role="tab"
                >
                  Send invite
                </Link>
                <Link
                  href={invitePendingHref}
                  className={teamAdminSubTabClass(isTeamAdminInvitePendingPath(pathname))}
                  role="tab"
                >
                  Pending
                </Link>
                <Link
                  href={inviteHistoryHref}
                  className={teamAdminSubTabClass(isTeamAdminInviteHistoryPath(pathname))}
                  role="tab"
                >
                  History
                </Link>
              </div>
            </div>

            {isTeamAdminInviteSendPath(pathname) ? (
              <div className={cn(teamAdminSubTabPanelClass, "space-y-4")}>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Choose a workspace, then enter an email and role. Subscribers see every workspace
                  they own; co-admins only see workspaces they were invited to manage.
                </p>
                <TeamInviteForm
                  key={`${teamId}-${defaultWorkspaceId}`}
                  workspaces={workspaces}
                  aggregatedMemberEmailSuggestions={inviteAggregatedMemberEmails}
                  inviteDisplayHintsByEmail={inviteDisplayHintsByEmail}
                  subscriberOwnerPrimaryEmail={subscriberOwnerPrimaryEmail}
                  defaultWorkspaceId={defaultWorkspaceId}
                />
              </div>
            ) : null}

            {isTeamAdminInvitePendingPath(pathname) ? (
              <div className={cn(teamAdminSubTabPanelClass, "space-y-4")}>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Active invites for <span className="font-medium text-foreground">{teamName}</span>.
                  Revoke to withdraw a link before it is accepted or before it expires.
                </p>
                {pendingInvitations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending invitations.</p>
                ) : (
                  <TeamActiveInvitationsTable
                    teamId={teamId}
                    ownerUserId={ownerUserId}
                    workspaceName={teamName}
                    invitations={pendingInvitations}
                    userFieldDisplayById={userFieldDisplayById}
                  />
                )}
              </div>
            ) : null}

            {isTeamAdminInviteHistoryPath(pathname) ? (
              <div className={cn(teamAdminSubTabPanelClass, "space-y-4")}>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Accepted, declined, expired, and revoked invitations for this workspace.
                </p>
                <TeamInvitationHistoryTable
                  ownerUserId={ownerUserId}
                  workspaceName={teamName}
                  rows={invitationHistory}
                  userFieldDisplayById={userFieldDisplayById}
                />
              </div>
            ) : null}
          </div>
        </TeamAdminPanelCard>
      ) : null}

      {mainPanel === "quiz-results" ? (
        <TeamQuizResultsTab
          workspaces={workspaceQuizSnapshots}
          userFieldDisplayById={userFieldDisplayById}
          quizResultsHref={quizResultsHref}
          quizTimerHref={quizTimerHref}
          quizScheduleHref={quizScheduleHref}
          quizSecurityHref={quizSecurityHref}
        />
      ) : null}
      </div>
    </div>
  );
}
