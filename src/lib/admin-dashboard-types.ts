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
  /**
   * Billing: Clerk `publicMetadata.plan` or `teamPlanId`, else DB workspace owner `plan_slug`,
   * or platform role / complimentary Pro. See `getAdminUserPlanColumnLabel`.
   */
  planDisplayName: string;
  /** Workspace tier(s) for teams the user accepted an invite on (DB `team_invitations` = accepted). */
  associatePlan: string | null;
  isOnline: boolean;
  activeSessionCount: number;
  lastUpdated: string | null;
  createdAt: string;
  lastSignInAt: string | null;
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
