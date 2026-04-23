import { listTeamInvitationsForInviteeEmail } from "@/db/queries/teams";
import { getClerkUserDisplayNameById } from "@/lib/clerk-user-display";
import { isTeamInviteExpired } from "@/lib/team-invite-expiry";
import { resolveTeamInviteInboxOutcome } from "@/lib/team-invite-inbox-outcome";
import { tryTeamQuery } from "@/lib/team-query-fallback";
import {
  TeamInviteInboxClient,
  type TeamInviteInboxItemView,
} from "@/components/team-invite-inbox-client";

const PAGE_DESCRIPTION =
  "Team invitations sent to your account email. Accept or decline open requests, or review past responses.";

export async function TeamInviteInboxSection({
  userEmail,
  mode = "embedded",
}: {
  userEmail: string;
  /** `embedded`: hide when empty. `page`: always show inbox UI (empty state on dedicated route). */
  mode?: "embedded" | "page";
}) {
  const rows = await tryTeamQuery(
    () => listTeamInvitationsForInviteeEmail(userEmail),
    [],
  );
  if (rows.length === 0 && mode === "embedded") return null;

  if (rows.length === 0 && mode === "page") {
    return (
      <TeamInviteInboxClient
        items={[]}
        heading="Inbox"
        description={PAGE_DESCRIPTION}
      />
    );
  }

  const items: TeamInviteInboxItemView[] = await Promise.all(
    rows.map(async (r) => {
      const inviterId =
        r.invitation.invitedByUserId ?? r.team.ownerUserId;
      const inviterDisplayName = await getClerkUserDisplayNameById(inviterId);
      const expired = isTeamInviteExpired(r.invitation.expiresAt);
      const outcome = resolveTeamInviteInboxOutcome(
        r.invitation.status,
        expired,
      );
      return {
        invitationId: r.invitation.id,
        teamName: r.team.name,
        role: r.invitation.role,
        inviterDisplayName,
        expiresAtIso: r.invitation.expiresAt.toISOString(),
        createdAtIso: r.invitation.createdAt.toISOString(),
        outcome,
      };
    }),
  );

  return (
    <TeamInviteInboxClient
      items={items}
      heading={mode === "page" ? "Inbox" : "Team invitations"}
      description={mode === "page" ? PAGE_DESCRIPTION : undefined}
    />
  );
}
