/** Shapes for `/admin` Server Component serialization; safe to import from the server. */

export type SerializedUser = {
  id: string;
  fullName: string;
  email: string | null;
  /** Platform owner (`superadmin` or env allow-list). */
  isSuperadmin: boolean;
  /** Co-admin (`admin`) or platform owner — anyone with `/admin` access. */
  isAdmin: boolean;
  isBanned: boolean;
  isPaidPro: boolean;
  adminGranted: boolean;
  isPro: boolean;
  /** Current product/plan resolved from Clerk billing or metadata. */
  clerkPlan: string;
  /** Latest plan value explicitly assigned in Clerk public metadata by admin actions. */
  adminAssignedPlan: string;
  /** Effective personal plan after comparing admin metadata timestamp vs Clerk billing timestamp. */
  currentPersonalPlan: string;
  /** Current timestamp shown alongside the effective personal plan. */
  currentPersonalPlanDateTime: string;
  /**
   * Billing: Clerk `publicMetadata.plan` or `teamPlanId`, else DB workspace owner `plan_slug`,
   * or platform role / complimentary Pro. See `getAdminUserPlanColumnLabel`.
   */
  planDisplayName: string;
  /** Workspace tier(s) for teams the user accepted an invite on (DB `team_invitations` = accepted). */
  associatePlan: string | null;
  isOnline: boolean;
  activeSessionCount: number;
  /** Team-tier plan slug (for workspace management), null for non team-tier users. */
  teamTierPlanSlug: string | null;
  /** Number of workspaces currently created by this user as owner. */
  workspaceCreatedCount: number;
  /** Total workspaces allowed by the user's team-tier plan; null when not applicable. */
  workspaceTotalCount: number | null;
  /** Remaining workspaces allowed on the team-tier plan; null when not applicable. */
  workspaceRemainingCount: number | null;
  /** Total invitees across all owned workspaces on the team-tier plan. */
  totalInviteesCount: number;
  /** Workspace-level breakdown shown in Team Workspace Management expandable rows. */
  workspaces: SerializedAdminWorkspace[];
  lastUpdated: string | null;
  /** ISO timestamp of when the user's current plan was activated; null for free users with no plan history. */
  planSetAt: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  /** Stripe-sourced plan slug (billingPlan metadata key). */
  billingPlan: string | null;
  /** Stripe subscription status (billingStatus metadata key). */
  billingStatus: string | null;
  /** ISO timestamp of last Stripe billing write. */
  billingPlanUpdatedAt: string | null;
  /** Admin-assigned plan slug (adminPlan metadata key). */
  adminPlan: string | null;
  /** ISO timestamp of last admin plan assignment. */
  adminPlanUpdatedAt: string | null;
};

export type SerializedAdminWorkspace = {
  id: number;
  name: string;
  href: string;
  ownerName: string;
  inviteeTotal: number;
  inviteeAdminTotal: number;
  inviteeMemberTotal: number;
  deckTotal: number;
  cardTotal: number;
  invitees: SerializedAdminWorkspaceInvitee[];
};

export type SerializedAdminWorkspaceInvitee = {
  userId: string | null;
  name: string | null;
  email: string | null;
  role: "admin" | "member";
  membershipStatus: "active" | "pending";
  assignedDeckNames: string[];
};

export type SerializedLog = {
  id: number;
  targetUserId: string;
  targetUserName: string;
  grantedByUserId: string;
  grantedByName: string;
  action: "granted" | "revoked" | "superadmin_granted" | "superadmin_revoked";
  createdAt: string;
};

export type SerializedAdminSubscription = {
  userId: string;
  userName: string;
  email: string | null;
  planSlug: string;
  status: string;
  currency: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  nextPaymentDate: string | null;
  cancelAtPeriodEnd: boolean;
  sourceUpdatedAt: string | null;
};

export type SerializedAffiliate = {
  id: number;
  invitedEmail: string;
  invitedUserId: string | null;
  affiliateName: string;
  planAssigned: string;
  startedAt: string;
  endsAt: string;
  addedByUserId: string;
  addedByName: string;
  status: "pending" | "active" | "revoked";
  /** Accept token — present only for pending invites served to the invitee. */
  token: string | null;
  inviteAcceptedAt: string | null;
  revokedAt: string | null;
  revokedByName: string | null;
  createdAt: string;
};

export type SerializedPlanAssignmentLog = {
  id: number;
  targetUserId: string;
  targetUserName: string;
  targetUserEmail: string | null;
  action: "plan_assigned" | "plan_removed" | "user_banned" | "user_unbanned";
  planName: string | null;
  previousPlanName: string | null;
  assignedByUserId: string;
  assignedByName: string;
  createdAt: string;
};

export type SerializedAdminInvoice = {
  id: string;
  userId: string;
  userName: string;
  email: string | null;
  invoiceNumber: string;
  status: string;
  amountDue: number | null;
  currency: string | null;
  createdAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  /** Human-readable discount label, e.g. "LAUNCH50 — 50% off". Null when no discount. */
  discount: string | null;
};
