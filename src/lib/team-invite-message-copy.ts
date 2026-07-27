import type { TeamInviteInboxOutcome } from "@/lib/team-invite-inbox-outcome";

/** Display label for invitation roles (inbox + Loops `roleLabel`). */
export function teamInviteRoleLabel(
  role: "team_admin" | "team_member",
): string {
  return role === "team_admin" ? "Team Admin" : "Member";
}

export function formatTeamInviteInboxTitle(workspaceName: string): string {
  return `Workspace invitation — ${workspaceName}`;
}

/**
 * Formal body copy for dashboard inbox (and history).
 * Includes workspace name, role, plan owner (when known), and inviting
 * team admin (when known and different from the plan owner).
 */
export function formatTeamInviteInboxDescription(input: {
  workspaceName: string;
  role: "team_admin" | "team_member";
  ownerName: string | null;
  inviterName: string | null;
  outcome: TeamInviteInboxOutcome;
}): string {
  const workspace = input.workspaceName.trim() || "this workspace";
  const roleLabel = teamInviteRoleLabel(input.role);
  const owner = input.ownerName?.trim() || null;
  const inviter = input.inviterName?.trim() || null;
  const inviterIsOwner = namesMatch(owner, inviter);

  const ownershipTail = formatOwnershipTail({
    owner,
    inviter,
    inviterIsOwner,
  });

  switch (input.outcome) {
    case "needs_response":
      return (
        `You have been invited to join the workspace "${workspace}" as a ${roleLabel}.` +
        ownershipTail
      );
    case "accepted":
      return (
        `You accepted an invitation to join the workspace "${workspace}" as a ${roleLabel}.` +
        ownershipTail
      );
    case "rejected":
      return (
        `You declined an invitation to join the workspace "${workspace}" as a ${roleLabel}.` +
        ownershipTail
      );
    case "pending_expired":
    case "expired":
      return (
        `An invitation to join the workspace "${workspace}" as a ${roleLabel} has expired.` +
        ownershipTail
      );
    case "revoked":
      return (
        `An invitation to join the workspace "${workspace}" as a ${roleLabel} was withdrawn.` +
        ownershipTail
      );
    default:
      return (
        `You have been invited to join the workspace "${workspace}" as a ${roleLabel}.` +
        ownershipTail
      );
  }
}

function formatOwnershipTail(input: {
  owner: string | null;
  inviter: string | null;
  inviterIsOwner: boolean;
}): string {
  const { owner, inviter, inviterIsOwner } = input;
  if (owner && inviter && !inviterIsOwner) {
    return ` The plan owner is ${owner}. This invitation was sent by ${inviter}.`;
  }
  if (owner && (inviterIsOwner || !inviter)) {
    return ` The plan owner is ${owner}.`;
  }
  if (inviter) {
    return ` This invitation was sent by ${inviter}.`;
  }
  return "";
}

/** Loops / push subject-style line for team invitations. */
export function formatTeamInviteSubjectLine(workspaceName: string): string {
  const name = workspaceName.trim() || "a Flipvise workspace";
  return `Invitation to join ${name}`;
}

/**
 * One-line summary for secondary inbox meta (expanded row).
 * Prefer full description for the primary message body.
 */
export function formatTeamInviteInboxMetaLine(input: {
  role: "team_admin" | "team_member";
  ownerName: string | null;
  inviterName: string | null;
}): string {
  const roleLabel = teamInviteRoleLabel(input.role);
  const owner = input.ownerName?.trim() || null;
  const inviter = input.inviterName?.trim() || null;
  const inviterIsOwner = namesMatch(owner, inviter);

  const parts: string[] = [`Role: ${roleLabel}`];
  if (owner) parts.push(`Plan owner: ${owner}`);
  if (inviter && !inviterIsOwner) parts.push(`Invited by: ${inviter}`);
  else if (inviter && !owner) parts.push(`Invited by: ${inviter}`);
  return parts.join(" · ");
}

function namesMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0;
}
