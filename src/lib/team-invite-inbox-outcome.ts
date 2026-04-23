export type TeamInviteInboxOutcome =
  | "needs_response"
  | "pending_expired"
  | "accepted"
  | "rejected"
  | "expired"
  | "revoked";

export function resolveTeamInviteInboxOutcome(
  status: "pending" | "accepted" | "expired" | "rejected" | "revoked",
  expired: boolean,
): TeamInviteInboxOutcome {
  if (status === "revoked") return "revoked";
  if (status === "pending") {
    return expired ? "pending_expired" : "needs_response";
  }
  if (status === "accepted") return "accepted";
  if (status === "rejected") return "rejected";
  return "expired";
}
