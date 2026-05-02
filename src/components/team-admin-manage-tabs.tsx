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
import { cn } from "@/lib/utils";

type InvitationRow = TeamInvitationRow;
type MemberRow = TeamMemberRow;

function teamAdminLineTabClass(isActive: boolean) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-none border-b-2 px-2.5 py-2 text-xs sm:px-3 sm:text-sm",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    isActive
      ? "border-primary bg-transparent text-foreground"
      : "border-transparent bg-transparent text-muted-foreground hover:text-foreground",
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
    <Link href={href} className={teamAdminLineTabClass(isActive)}>
      {children}
    </Link>
  );
}

export type TeamAdminManageTabsProps = {
  teamId: number;
  /** Bookmarkable Deck Manager URL for the current workspace (`?team=`). */
  deckManagerHref: string;
  /** Members panel URL (`/dashboard/team-admin/members?team=`). */
  membersHref: string;
  /** Workspace history panel URL (`/dashboard/team-admin/ws-history?team=`). */
  workspaceHistoryHref: string;
  /** Invite members — send invite (`/dashboard/team-admin/invite-members/send-invite?team=`). */
  inviteSendHref: string;
  /** Invite members — pending invitations (`/dashboard/team-admin/invite-members/pending-invitations?team=`). */
  invitePendingHref: string;
  /** Invite members — invitation history (`/dashboard/team-admin/invite-members/invitation-history?team=`). */
  inviteHistoryHref: string;
  /** Quiz results (`/dashboard/team-admin/quiz-results?team=`). */
  quizResultsHref: string;
  teamName: string;
  ownerUserId: string;
  /** `teams.createdAt` for the selected workspace. */
  teamCreatedAt: Date;
  currentUserId: string;
  isOwner: boolean;
  workspaces: TeamInviteWorkspaceOption[];
  /** When set (subscriber owns ≥1 listed workspace), invite email picker lists these across owned workspaces. */
  inviteAggregatedMemberEmails?: string[];
  defaultWorkspaceId: number;
  members: MemberRow[];
  userFieldDisplayById: Record<string, ClerkUserFieldDisplay>;
  pendingInvitations: InvitationRow[];
  invitationHistory: InvitationRow[];
  workspaceHistory?: TeamWorkspaceEventRow[] | null;
  /** Maps normalized email → suggested invitee display name (members + prior invites across subscriber workspaces). */
  inviteDisplayHintsByEmail: Record<string, string>;
  /** Normalized primary email of the workspace subscriber; used to block inviting the owner from the form. */
  subscriberOwnerPrimaryEmail: string | null;
  teamQuizResults: QuizResultRow[];
};

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
    <div className="group/tabs flex w-full flex-col gap-4">
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="inline-flex h-auto w-full min-w-0 flex-wrap justify-start gap-0 border-b border-border bg-transparent p-0 text-muted-foreground"
      >
        <Link href={membersHref} className={teamAdminLineTabClass(membersLinkActive)} role="tab">
          Members
        </Link>
        <TeamAdminDeckManagerNavLink href={deckManagerHref}>Deck Manager</TeamAdminDeckManagerNavLink>
        <Link
          href={workspaceHistoryHref}
          className={teamAdminLineTabClass(workspaceHistoryLinkActive)}
          role="tab"
        >
          Workspace history
        </Link>
        <Link
          href={inviteSendHref}
          className={teamAdminLineTabClass(inviteMembersLinkActive)}
          role="tab"
        >
          Invite members
        </Link>
        <Link href={quizResultsHref} className={teamAdminLineTabClass(quizResultsLinkActive)} role="tab">
          Quiz results
        </Link>
      </div>

      {mainPanel === "members" && !invitePanelVisible ? (
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              Change roles or remove members. Subscribers and team admins can access this dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TeamMemberTable
              teamId={teamId}
              ownerUserId={ownerUserId}
              teamCreatedAt={teamCreatedAt}
              members={members}
              currentUserId={currentUserId}
              isOwner={isOwner}
              userFieldDisplayById={userFieldDisplayById}
            />
          </CardContent>
        </Card>
      ) : null}

      {mainPanel === "workspace-history" ? (
        <Card>
          <CardHeader>
            <CardTitle>Workspace history</CardTitle>
            <CardDescription>
              When this workspace was created, renamed, or removed. Each row is recorded at the time
              the change happened.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TeamWorkspaceHistoryTable rows={workspaceHistory} />
          </CardContent>
        </Card>
      ) : null}

      {invitePanelVisible ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite members</CardTitle>
            <CardDescription>
              Send invitations, manage active invites, or review history for this workspace. Invites
              expire in {TEAM_INVITE_EXPIRY_DAYS} days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              role="tablist"
              aria-orientation="horizontal"
              className="mb-4 inline-flex h-auto w-full min-w-0 flex-wrap justify-start gap-0 border-b border-border bg-transparent p-0"
            >
              <Link
                href={inviteSendHref}
                className={teamAdminLineTabClass(isTeamAdminInviteSendPath(pathname))}
                role="tab"
              >
                Send invite
              </Link>
              <Link
                href={invitePendingHref}
                className={teamAdminLineTabClass(isTeamAdminInvitePendingPath(pathname))}
                role="tab"
              >
                Pending invitations
              </Link>
              <Link
                href={inviteHistoryHref}
                className={teamAdminLineTabClass(isTeamAdminInviteHistoryPath(pathname))}
                role="tab"
              >
                Invitation history
              </Link>
            </div>
            {isTeamAdminInviteSendPath(pathname) ? (
              <>
                <p className="text-muted-foreground mb-4 text-sm">
                  Choose a workspace, then enter an email and role. Subscribers see every workspace they
                  own; co-admins only see workspaces they were invited to manage.
                </p>
                <TeamInviteForm
                  key={`${teamId}-${defaultWorkspaceId}`}
                  workspaces={workspaces}
                  aggregatedMemberEmailSuggestions={inviteAggregatedMemberEmails}
                  inviteDisplayHintsByEmail={inviteDisplayHintsByEmail}
                  subscriberOwnerPrimaryEmail={subscriberOwnerPrimaryEmail}
                  defaultWorkspaceId={defaultWorkspaceId}
                />
              </>
            ) : null}
            {isTeamAdminInvitePendingPath(pathname) ? (
              <>
                <p className="text-muted-foreground mb-4 text-sm">
                  Active invites for the workspace selected in the dashboard header ({teamName}).
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
              </>
            ) : null}
            {isTeamAdminInviteHistoryPath(pathname) ? (
              <>
                <p className="text-muted-foreground mb-4 text-sm">
                  Accepted, declined, expired, and revoked invitations for this workspace.
                </p>
                <TeamInvitationHistoryTable
                  ownerUserId={ownerUserId}
                  workspaceName={teamName}
                  rows={invitationHistory}
                  userFieldDisplayById={userFieldDisplayById}
                />
              </>
            ) : null}
          </CardContent>
        </Card>
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
