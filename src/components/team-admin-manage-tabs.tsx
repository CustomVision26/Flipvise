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
import { TeamWorkspaceHistoryTable } from "@/components/team-workspace-history-table";
import type { TeamWorkspaceEventRow } from "@/db/queries/team-workspace-events";
import type { TeamInvitationRow, TeamMemberRow } from "@/db/schema";
import type { ClerkUserFieldDisplay } from "@/lib/clerk-user-display";
import { cn } from "@/lib/utils";
import { TEAM_INVITE_EXPIRY_DAYS } from "@/lib/team-invite-expiry";
import { TeamQuizResultsTab } from "@/components/team-quiz-results-tab";
import type { QuizResultRow } from "@/db/queries/quiz-results";
import {
  isTeamAdminDeckManagerPath,
  isTeamAdminInviteHistoryPath,
  isTeamAdminInviteMembersSubPath,
  isTeamAdminInvitePendingPath,
  isTeamAdminInviteSendPath,
  isTeamAdminQuizResultsPath,
  isTeamAdminWsHistoryPath,
} from "@/lib/team-admin-url";
import {
  TEAM_ADMIN_PANEL_IDS,
  teamAdminCardClass,
  teamAdminPanelHref,
  teamAdminPanelScrollClass,
  teamAdminSubTabClass,
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
  workspaceHistoryHref: string;
  inviteSendHref: string;
  invitePendingHref: string;
  inviteHistoryHref: string;
  quizResultsHref: string;
  teamName: string;
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
  workspaceHistory?: TeamWorkspaceEventRow[] | null;
  inviteDisplayHintsByEmail: Record<string, string>;
  subscriberOwnerPrimaryEmail: string | null;
  teamQuizResults: QuizResultRow[];
};

function TeamAdminPanelCard({
  panelId,
  title,
  description,
  children,
}: {
  panelId: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className={teamAdminCardClass}>
      <CardHeader className="space-y-2 pb-4">
        <CardTitle
          id={panelId}
          className={cn(
            "text-base font-medium tracking-tight sm:text-lg",
            teamAdminPanelScrollClass,
          )}
        >
          {title}
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function TeamAdminManageTabs({
  teamId,
  deckManagerHref,
  membersHref,
  workspaceHistoryHref,
  inviteSendHref,
  invitePendingHref,
  inviteHistoryHref,
  quizResultsHref,
  teamName,
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
  workspaceHistory = [],
  inviteDisplayHintsByEmail,
  subscriberOwnerPrimaryEmail,
  teamQuizResults,
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

      {mainPanel === "members" && !invitePanelVisible ? (
        <TeamAdminPanelCard
          panelId={TEAM_ADMIN_PANEL_IDS.members}
          title="Members"
          description="Change roles or remove members. Subscribers and team admins can access this dashboard."
        >
          <TeamMemberTable
            teamId={teamId}
            ownerUserId={ownerUserId}
            teamCreatedAt={teamCreatedAt}
            members={members}
            currentUserId={currentUserId}
            isOwner={isOwner}
            userFieldDisplayById={userFieldDisplayById}
          />
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
              <div className="space-y-4">
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
              <div className="space-y-4">
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
              <div className="space-y-4">
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
          results={teamQuizResults}
          teamName={teamName}
          ownerUserId={ownerUserId}
          members={members}
          userFieldDisplayById={userFieldDisplayById}
        />
      ) : null}
    </div>
  );
}
