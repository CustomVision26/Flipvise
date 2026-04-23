/** Pending team invitations expire this many days after they are sent. */
export const TEAM_INVITE_EXPIRY_DAYS = 3;

/** Server-side invite expiry check (uses wall-clock time; not a React component). */
export function isTeamInviteExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() < Date.now();
}
