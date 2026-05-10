import { isAffiliateInviteExpired } from "@/lib/affiliate-invite-expiry";

/** Minimal affiliate row shape for duplicate-invite detection (admin UI + invite action). */
export type AffiliateInviteConflictRow = {
  id: number;
  status: "pending" | "active" | "revoked";
  endsAt: Date | string;
  inviteExpiresAt: Date | string;
};

export type ResolvedAffiliateInviteConflict = {
  blockNewInvite: true;
  affiliateId: number | null;
  variant: "destructive" | "default";
  title: string;
  detail: string;
};

function toDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

/**
 * If this email cannot receive a duplicate invite row, explains why (active access,
 * open pending invite, or must use Edit instead of a fresh invite).
 */
export function resolveAffiliateInviteEmailConflict(
  matchingRows: AffiliateInviteConflictRow[],
  now: Date = new Date(),
): ResolvedAffiliateInviteConflict | null {
  if (matchingRows.length === 0) return null;

  const nowMs = now.getTime();
  const tableHint =
    "In Marketing Affiliates above, locate this email, double‑click their row to expand it, then use Edit.";

  const activeLive = matchingRows.some(
    (r) =>
      r.status === "active" &&
      toDate(r.endsAt).getTime() >= nowMs,
  );

  const pendingStillOpen = matchingRows.some(
    (r) =>
      r.status === "pending" &&
      !isAffiliateInviteExpired(toDate(r.inviteExpiresAt), now),
  );

  if (activeLive || pendingStillOpen) {
    const candidate =
      matchingRows.find(
        (r) =>
          r.status === "active" &&
          toDate(r.endsAt).getTime() >= nowMs,
      ) ??
      matchingRows.find(
        (r) =>
          r.status === "pending" &&
          !isAffiliateInviteExpired(toDate(r.inviteExpiresAt), now),
      );

    return {
      blockNewInvite: true,
      affiliateId: candidate?.id ?? null,
      variant: "destructive",
      title:
        pendingStillOpen && !activeLive
          ? "An invite is already pending for this email"
          : "This user is already an active affiliate",
      detail: `${tableHint} Do not invite them again from this dialog.`,
    };
  }

  const activeEnded = matchingRows.find(
    (r) => r.status === "active" && toDate(r.endsAt).getTime() < nowMs,
  );

  if (activeEnded) {
    return {
      blockNewInvite: true,
      affiliateId: activeEnded.id,
      variant: "default",
      title: "Affiliate access has ended — use Edit",
      detail: `${tableHint} Extend the affiliation end date (and plan if needed) instead of sending a new invite.`,
    };
  }

  const pendingInviteExpired = matchingRows.find(
    (r) =>
      r.status === "pending" &&
      isAffiliateInviteExpired(toDate(r.inviteExpiresAt), now),
  );

  if (pendingInviteExpired) {
    return {
      blockNewInvite: true,
      affiliateId: pendingInviteExpired.id,
      variant: "default",
      title: "Pending invite expired — renew from Edit",
      detail: `${tableHint} Save from Edit to mint a fresh accept link; new invites cannot be duplicated here.`,
    };
  }

  return null;
}
