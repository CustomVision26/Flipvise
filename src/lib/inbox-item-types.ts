import type { QuizResultSummary } from "@/components/view-quiz-result-dialog";
import type { TeamInviteInboxOutcome } from "@/lib/team-invite-inbox-outcome";

export type InboxItemType =
  | "quiz_result"
  | "team_invite"
  | "billing"
  | "affiliate"
  | "affiliate_notice"
  | "admin_plan_log";

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
};

export type AffiliateNoticePayload = {
  kind: "revoked_access" | "revoked_invite" | "expired";
  affiliateId: number;
  affiliateName: string;
  planAssigned: string;
  /** Revoked at, invite period end, or scheduled grant end (ISO). */
  eventAtIso: string;
};

export type AdminPlanLogPayload = {
  logId: number;
  assignedByName: string;
  previousPlanName: string | null;
  newPlanName: string | null;
  action: "plan_assigned" | "plan_removed";
  planApplicationPath: "stripe_proration" | "clerk_metadata_only" | null;
};

// ── Discriminated union ───────────────────────────────────────────────────────

export type UnifiedInboxItem =
  | { type: "quiz_result"; key: string; title: string; description: string; dateIso: string; isRead: boolean; requiresAction: false; payload: QuizResultPayload }
  | { type: "team_invite"; key: string; title: string; description: string; dateIso: string; isRead: boolean; requiresAction: boolean; payload: TeamInvitePayload }
  | { type: "billing"; key: string; title: string; description: string; dateIso: string; isRead: boolean; requiresAction: false; payload: BillingPayload }
  | { type: "affiliate"; key: string; title: string; description: string; dateIso: string; isRead: boolean; requiresAction: boolean; payload: AffiliatePayload }
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
    };

export const INBOX_TYPE_LABELS: Record<InboxItemType, string> = {
  quiz_result: "Quiz Result",
  team_invite: "Team Invitation",
  billing: "Billing",
  affiliate: "Affiliate Invite",
  affiliate_notice: "Affiliate notice",
  admin_plan_log: "Plan update",
};
