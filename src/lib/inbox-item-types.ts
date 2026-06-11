import type { QuizResultSummary } from "@/components/view-quiz-result-dialog";
import type { TeamInviteInboxOutcome } from "@/lib/team-invite-inbox-outcome";
import type { AdminPlanAssignment } from "@/lib/admin-assignable-plans";

export type InboxItemType =
  | "quiz_result"
  | "team_invite"
  | "billing"
  | "affiliate"
  | "affiliate_broadcast"
  | "affiliate_notice"
  | "admin_plan_log"
  | "admin_plan_invite"
  | "quiz_security_notice";

// ── Type-specific payload shapes ──────────────────────────────────────────────

export type QuizResultPayload = QuizResultSummary;

export type TeamInvitePayload = {
  invitationId: number;
  teamName: string;
  role: "team_admin" | "team_member";
  inviterName: string;
  expiresAtIso: string;
  outcome: TeamInviteInboxOutcome;
};

export type BillingPayload = {
  externalId: string;
  invoiceNumber: string | null;
  status: string;
  amountCents: number | null;
  currency: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  paidAtIso: string | null;
};

export type AffiliatePayload = {
  affiliateId: number;
  token: string | null;
  affiliateName: string;
  planAssigned: string;
  endsAtIso: string;
  /** When the accept link stops working. */
  inviteExpiresAtIso: string;
  status: "pending" | "active" | "revoked";
  inviteAcceptedAtIso: string | null;
  /** Pending plan/end change awaiting affiliate confirmation (active only). */
  arrangementChangeToken?: string | null;
  arrangementConfirmationExpiresAtIso?: string | null;
  pendingPlanAssigned?: string | null;
  pendingEndsAtIso?: string | null;
  /** Pending invite: invite link past deadline (server snapshot). */
  inviteAcceptLinkExpired: boolean;
  /** Active: grant end date in the past (server snapshot). */
  grantPeriodEnded: boolean;
  /** Active: staged arrangement can still be confirmed (server snapshot). */
  arrangementConfirmationOpen: boolean;
};

export type AffiliateNoticePayload = {
  kind: "revoked_access" | "revoked_invite" | "expired";
  affiliateId: number;
  affiliateName: string;
  planAssigned: string;
  /** Revoked at, invite period end, or scheduled grant end (ISO). */
  eventAtIso: string;
};

export type AffiliateBroadcastPayload = {
  broadcastId: number;
  variant: "general" | "codes";
  subject: string;
  messageBody: string;
  detailsBlock: string;
  pricingPageUrl: string;
};

export type AdminPlanLogPayload = {
  logId: number;
  assignedByName: string;
  previousPlanName: string | null;
  newPlanName: string | null;
  action: "plan_assigned" | "plan_removed";
  planApplicationPath: "stripe_proration" | "clerk_metadata_only" | null;
};

export type AdminPlanInvitePayload = {
  inviteId: number;
  assignedByName: string;
  offeredPlanSlug: AdminPlanAssignment;
  offeredPlanLabel: string;
  previousPlanLabel: string;
  status: "pending" | "declined" | "superseded";
};

export type QuizSecurityNoticePayload = {
  messageId: number;
  sessionId: number;
  deckName: string;
  teamName: string | null;
  /** True when the recipient is the workspace owner (admin copy). */
  isOwnerCopy: boolean;
  memberName: string | null;
};

// ── Discriminated union ───────────────────────────────────────────────────────

export type UnifiedInboxItem =
  | { type: "quiz_result"; key: string; title: string; description: string; dateIso: string; isRead: boolean; requiresAction: false; payload: QuizResultPayload }
  | { type: "team_invite"; key: string; title: string; description: string; dateIso: string; isRead: boolean; requiresAction: boolean; payload: TeamInvitePayload }
  | { type: "billing"; key: string; title: string; description: string; dateIso: string; isRead: boolean; requiresAction: false; payload: BillingPayload }
  | { type: "affiliate"; key: string; title: string; description: string; dateIso: string; isRead: boolean; requiresAction: boolean; payload: AffiliatePayload }
  | {
      type: "affiliate_broadcast";
      key: string;
      title: string;
      description: string;
      dateIso: string;
      isRead: boolean;
      requiresAction: false;
      payload: AffiliateBroadcastPayload;
    }
  | {
      type: "affiliate_notice";
      key: string;
      title: string;
      description: string;
      dateIso: string;
      isRead: boolean;
      requiresAction: false;
      payload: AffiliateNoticePayload;
    }
  | {
      type: "admin_plan_log";
      key: string;
      title: string;
      description: string;
      dateIso: string;
      isRead: boolean;
      requiresAction: false;
      payload: AdminPlanLogPayload;
    }
  | {
      type: "admin_plan_invite";
      key: string;
      title: string;
      description: string;
      dateIso: string;
      isRead: boolean;
      requiresAction: boolean;
      payload: AdminPlanInvitePayload;
    }
  | {
      type: "quiz_security_notice";
      key: string;
      title: string;
      description: string;
      dateIso: string;
      isRead: boolean;
      requiresAction: false;
      payload: QuizSecurityNoticePayload;
    };

export const INBOX_TYPE_LABELS: Record<InboxItemType, string> = {
  quiz_result: "Quiz Result",
  team_invite: "Team Invitation",
  billing: "Billing",
  affiliate: "Affiliate Invite",
  affiliate_broadcast: "Affiliate message",
  affiliate_notice: "Affiliate notice",
  admin_plan_log: "Plan update",
  admin_plan_invite: "Plan request",
  quiz_security_notice: "Quiz security",
};
