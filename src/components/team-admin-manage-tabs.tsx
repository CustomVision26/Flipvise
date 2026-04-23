"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TeamInviteForm, type TeamInviteWorkspaceOption } from "@/components/team-invite-form";
import {
  TeamActiveInvitationsTable,
  TeamInvitationHistoryTable,
} from "@/components/team-admin-invitation-tables";
import { TeamMemberTable } from "@/components/team-member-table";
import { TeamWorkspaceHistoryTable } from "@/components/team-workspace-history-table";
import {
  TeamDeckAssignList,
  type TeamAssignWorkspaceSnapshot,
} from "@/components/team-deck-assign-list";
import type { TeamWorkspaceEventRow } from "@/db/queries/team-workspace-events";
import type { InferSelectModel } from "drizzle-orm";
import { teamInvitations, teamMembers } from "@/db/schema";
import type { ClerkUserFieldDisplay } from "@/lib/clerk-user-display";
import { TEAM_INVITE_EXPIRY_DAYS } from "@/lib/team-invite-expiry";

type InvitationRow = InferSelectModel<typeof teamInvitations>;
type MemberRow = InferSelectModel<typeof teamMembers>;

export type { TeamAssignWorkspaceSnapshot };

export type TeamAdminManageTabsProps = {
  teamId: number;
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
  assignWorkspaceSnapshots: TeamAssignWorkspaceSnapshot[];
};

export function TeamAdminManageTabs({
  teamId,
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
  assignWorkspaceSnapshots,
}: TeamAdminManageTabsProps) {
  return (
    <Tabs defaultValue="assign-decks" className="w-full gap-4">
      <TabsList
        variant="line"
        className="h-auto w-full min-w-0 flex-wrap justify-start gap-0 border-b border-border bg-transparent p-0"
      >
        <TabsTrigger
          value="assign-decks"
          className="shrink-0 rounded-none border-b-2 border-transparent px-2.5 py-2 text-xs data-active:border-primary data-active:bg-transparent sm:px-3 sm:text-sm"
        >
          Deck Manager
        </TabsTrigger>
        <TabsTrigger
          value="members"
          className="shrink-0 rounded-none border-b-2 border-transparent px-2.5 py-2 text-xs data-active:border-primary data-active:bg-transparent sm:px-3 sm:text-sm"
        >
          Members
        </TabsTrigger>
        <TabsTrigger
          value="workspace-history"
          className="shrink-0 rounded-none border-b-2 border-transparent px-2.5 py-2 text-xs data-active:border-primary data-active:bg-transparent sm:px-3 sm:text-sm"
        >
          Workspace history
        </TabsTrigger>
        <TabsTrigger
          value="invite"
          className="shrink-0 rounded-none border-b-2 border-transparent px-2.5 py-2 text-xs data-active:border-primary data-active:bg-transparent sm:px-3 sm:text-sm"
        >
          Invite members
        </TabsTrigger>
      </TabsList>

      <TabsContent value="assign-decks" className="mt-0">
        <Card>
          <CardHeader>
            <CardTitle>Deck Manager</CardTitle>
            <CardDescription>
              Normal members only see decks you assign; team admins see all team decks. Use the
              tabs below to assign decks or move decks between workspaces you manage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TeamDeckAssignList
              workspaces={assignWorkspaceSnapshots}
              defaultWorkspaceId={defaultWorkspaceId}
              userFieldDisplayById={userFieldDisplayById}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="members" className="mt-0">
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
      </TabsContent>

      <TabsContent value="workspace-history" className="mt-0">
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
      </TabsContent>

      <TabsContent value="invite" className="mt-0">
        <Card>
          <CardHeader>
            <CardTitle>Invite members</CardTitle>
            <CardDescription>
              Send invitations, manage active invites, or review history for this workspace. Invites
              expire in {TEAM_INVITE_EXPIRY_DAYS} days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="compose" className="w-full gap-4">
              <TabsList
                variant="line"
                className="h-auto w-full min-w-0 flex-wrap justify-start gap-0 border-b border-border bg-transparent p-0"
              >
                <TabsTrigger
                  value="compose"
                  className="shrink-0 rounded-none border-b-2 border-transparent px-2.5 py-2 text-xs data-active:border-primary data-active:bg-transparent sm:px-3 sm:text-sm"
                >
                  Send invite
                </TabsTrigger>
                <TabsTrigger
                  value="pending-invites"
                  className="shrink-0 rounded-none border-b-2 border-transparent px-2.5 py-2 text-xs data-active:border-primary data-active:bg-transparent sm:px-3 sm:text-sm"
                >
                  Pending invitations
                </TabsTrigger>
                <TabsTrigger
                  value="invite-history"
                  className="shrink-0 rounded-none border-b-2 border-transparent px-2.5 py-2 text-xs data-active:border-primary data-active:bg-transparent sm:px-3 sm:text-sm"
                >
                  Invitation history
                </TabsTrigger>
              </TabsList>
              <TabsContent value="compose" className="mt-0">
                <p className="text-muted-foreground mb-4 text-sm">
                  Choose a workspace, then enter an email and role. Subscribers see every workspace they
                  own; co-admins only see workspaces they were invited to manage.
                </p>
                <TeamInviteForm
                  key={`${teamId}-${defaultWorkspaceId}`}
                  workspaces={workspaces}
                  aggregatedMemberEmailSuggestions={inviteAggregatedMemberEmails}
                  defaultWorkspaceId={defaultWorkspaceId}
                />
              </TabsContent>
              <TabsContent value="pending-invites" className="mt-0">
                <p className="text-muted-foreground mb-4 text-sm">
                  Active invites only. Revoke to withdraw a link before it is accepted or before it
                  expires.
                </p>
                {pendingInvitations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending invitations.</p>
                ) : (
                  <TeamActiveInvitationsTable
                    teamId={teamId}
                    ownerUserId={ownerUserId}
                    invitations={pendingInvitations}
                    userFieldDisplayById={userFieldDisplayById}
                  />
                )}
              </TabsContent>
              <TabsContent value="invite-history" className="mt-0">
                <p className="text-muted-foreground mb-4 text-sm">
                  Accepted, declined, expired, and revoked invitations for this workspace.
                </p>
                <TeamInvitationHistoryTable
                  ownerUserId={ownerUserId}
                  rows={invitationHistory}
                  userFieldDisplayById={userFieldDisplayById}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
