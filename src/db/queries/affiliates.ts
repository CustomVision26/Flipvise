import { db } from "@/db";
import { affiliates } from "@/db/schema";
import { eq, desc, or, and, sql, inArray } from "drizzle-orm";
import {
  buildAffiliatePromotionalCandidate,
  slugifyAffiliatePromoBase,
} from "@/lib/affiliate-promotional-code";

export async function listAffiliates() {
  return db.select().from(affiliates).orderBy(desc(affiliates.createdAt));
}

/** Case-insensitive match for duplicate-invite prevention (stored email may vary in casing). */
export async function listAffiliatesMatchingInviteEmail(lowerTrimmed: string) {
  const norm = lowerTrimmed.trim().toLowerCase();
  return db
    .select()
    .from(affiliates)
    .where(sql`LOWER(TRIM(${affiliates.invitedEmail})) = ${norm}`);
}

/** Unique promotional code for new affiliate rows (lowercase). */
export async function allocateUniqueAffiliatePromotionalCode(
  affiliateName: string,
): Promise<string> {
  const base = slugifyAffiliatePromoBase(affiliateName);
  for (let attempt = 0; attempt < 48; attempt++) {
    const candidate = buildAffiliatePromotionalCandidate(base);
    const existing = await getAffiliateByPromotionalCode(candidate);
    if (!existing) return candidate;
  }
  throw new Error("Could not generate a unique promotional code. Try a different name.");
}

export async function insertAffiliate(data: {
  invitedEmail: string;
  invitedUserId?: string | null;
  affiliateName: string;
  planAssigned: string;
  endsAt: Date;
  inviteExpiresAt: Date;
  addedByUserId: string;
  addedByName: string;
  token: string;
  promotionalCode: string;
  status?: "pending" | "active";
}) {
  const rows = await db
    .insert(affiliates)
    .values({
      invitedEmail: data.invitedEmail,
      invitedUserId: data.invitedUserId ?? null,
      affiliateName: data.affiliateName,
      planAssigned: data.planAssigned,
      endsAt: data.endsAt,
      inviteExpiresAt: data.inviteExpiresAt,
      addedByUserId: data.addedByUserId,
      addedByName: data.addedByName,
      token: data.token,
      promotionalCode: data.promotionalCode.toLowerCase(),
      status: data.status ?? "pending",
    })
    .returning({ id: affiliates.id });
  return rows[0]?.id ?? null;
}

export async function getAffiliateByPromotionalCode(code: string) {
  const norm = code.trim().toLowerCase();
  const rows = await db
    .select()
    .from(affiliates)
    .where(eq(affiliates.promotionalCode, norm));
  return rows[0] ?? null;
}

/**
 * Increments paid-subscription counts for attribution from Stripe checkout metadata.
 * Rolls the monthly counter when the calendar month changes.
 */
export async function incrementAffiliatePaidReferral(affiliateId: number) {
  const row = await getAffiliateById(affiliateId);
  if (!row) return;

  const key = new Date().toISOString().slice(0, 7);
  const prevKey = row.paidReferralsMonthKey ?? null;
  const sameMonth = prevKey === key;
  const nextMonth = sameMonth ? (row.paidReferralsMonth ?? 0) + 1 : 1;

  await db
    .update(affiliates)
    .set({
      paidReferralsTotal: (row.paidReferralsTotal ?? 0) + 1,
      paidReferralsMonth: nextMonth,
      paidReferralsMonthKey: key,
    })
    .where(eq(affiliates.id, affiliateId));
}

export async function listActiveAffiliatesForBroadcast(opts?: {
  affiliateIds?: number[];
}) {
  const activeOnly = eq(affiliates.status, "active");
  const ids = opts?.affiliateIds?.filter((n) => Number.isFinite(n) && n > 0) ?? [];
  const whereClause =
    ids.length > 0 ? and(activeOnly, inArray(affiliates.id, ids)) : activeOnly;
  return db
    .select({
      id: affiliates.id,
      invitedEmail: affiliates.invitedEmail,
      invitedUserId: affiliates.invitedUserId,
      affiliateName: affiliates.affiliateName,
      promotionalCode: affiliates.promotionalCode,
    })
    .from(affiliates)
    .where(whereClause)
    .orderBy(desc(affiliates.createdAt));
}

export async function revokeAffiliateById(
  id: number,
  revokedByUserId: string,
  revokedByName: string,
) {
  await db
    .update(affiliates)
    .set({
      status: "revoked",
      revokedAt: new Date(),
      revokedByUserId,
      revokedByName,
      pendingPlanAssigned: null,
      pendingEndsAt: null,
      arrangementChangeToken: null,
      arrangementChangeExpiresAt: null,
    })
    .where(eq(affiliates.id, id));
}

export async function getAffiliateById(id: number) {
  const rows = await db
    .select()
    .from(affiliates)
    .where(eq(affiliates.id, id));
  return rows[0] ?? null;
}

export async function getAffiliateByToken(token: string) {
  const rows = await db
    .select()
    .from(affiliates)
    .where(eq(affiliates.token, token));
  return rows[0] ?? null;
}

export async function getAffiliateByArrangementChangeToken(token: string) {
  const rows = await db
    .select()
    .from(affiliates)
    .where(eq(affiliates.arrangementChangeToken, token));
  return rows[0] ?? null;
}

export async function commitAffiliateConfirmedArrangementChange(
  id: number,
  planAssigned: string,
  endsAt: Date,
) {
  await db
    .update(affiliates)
    .set({
      planAssigned,
      endsAt,
      pendingPlanAssigned: null,
      pendingEndsAt: null,
      arrangementChangeToken: null,
      arrangementChangeExpiresAt: null,
    })
    .where(eq(affiliates.id, id));
}

/** Returns pending affiliate invites addressed to this email or userId. */
export async function getPendingAffiliatesByEmailOrUserId(
  email: string,
  userId: string | null,
) {
  const emailCondition = eq(affiliates.invitedEmail, email);
  const statusCondition = eq(affiliates.status, "pending");

  // If we have a userId, match by either email OR userId (handles cases where
  // the account was created after the invite was sent).
  const matchCondition = userId
    ? or(emailCondition, eq(affiliates.invitedUserId, userId))!
    : emailCondition;

  return db
    .select()
    .from(affiliates)
    .where(and(statusCondition, matchCondition));
}

/** Returns ALL affiliate records (any status) addressed to this email or userId. */
export async function getAllAffiliatesByEmailOrUserId(
  email: string,
  userId: string | null,
) {
  const emailCondition = eq(affiliates.invitedEmail, email);
  const matchCondition = userId
    ? or(emailCondition, eq(affiliates.invitedUserId, userId))!
    : emailCondition;

  return db
    .select()
    .from(affiliates)
    .where(matchCondition)
    .orderBy(desc(affiliates.createdAt));
}

/** Affiliate rows linked to this Clerk user (by email and/or invitedUserId). */
export async function listAffiliatesForPlanHistory(
  userId: string,
  emailLower: string | null,
) {
  if (emailLower) {
    return getAllAffiliatesByEmailOrUserId(emailLower, userId);
  }
  return db
    .select()
    .from(affiliates)
    .where(eq(affiliates.invitedUserId, userId))
    .orderBy(desc(affiliates.createdAt));
}

export async function acceptAffiliateByToken(token: string, userId: string) {
  await db
    .update(affiliates)
    .set({
      status: "active",
      inviteAcceptedAt: new Date(),
      invitedUserId: userId,
    })
    .where(eq(affiliates.token, token));
}

export async function cancelAffiliateInvite(id: number) {
  await db
    .update(affiliates)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(eq(affiliates.id, id));
}

export async function updateAffiliateById(
  id: number,
  data: {
    affiliateName: string;
    invitedEmail: string;
    planAssigned: string;
    endsAt: Date;
    /** Re-resolved Clerk user ID after an email change; undefined = no change. */
    invitedUserId?: string | null;
    /** When set (e.g. pending invite edited), extends the accept-by deadline. */
    inviteExpiresAt?: Date;
    /** When set, replaces the accept token (e.g. re-invite after link expiry). */
    token?: string | null;
    pendingPlanAssigned?: string | null;
    pendingEndsAt?: Date | null;
    arrangementChangeToken?: string | null;
    arrangementChangeExpiresAt?: Date | null;
  },
  /** When set, update only succeeds if the row currently has this status (accept-race guard). */
  options?: { onlyIfStatus?: "pending" | "active" },
): Promise<boolean> {
  const whereClause =
    options?.onlyIfStatus !== undefined
      ? and(eq(affiliates.id, id), eq(affiliates.status, options.onlyIfStatus))
      : eq(affiliates.id, id);

  const rows = await db
    .update(affiliates)
    .set({
      affiliateName: data.affiliateName,
      invitedEmail: data.invitedEmail,
      planAssigned: data.planAssigned,
      endsAt: data.endsAt,
      ...(data.invitedUserId !== undefined
        ? { invitedUserId: data.invitedUserId }
        : {}),
      ...(data.inviteExpiresAt !== undefined
        ? { inviteExpiresAt: data.inviteExpiresAt }
        : {}),
      ...(data.token !== undefined ? { token: data.token } : {}),
      ...(data.pendingPlanAssigned !== undefined
        ? { pendingPlanAssigned: data.pendingPlanAssigned }
        : {}),
      ...(data.pendingEndsAt !== undefined ? { pendingEndsAt: data.pendingEndsAt } : {}),
      ...(data.arrangementChangeToken !== undefined
        ? { arrangementChangeToken: data.arrangementChangeToken }
        : {}),
      ...(data.arrangementChangeExpiresAt !== undefined
        ? { arrangementChangeExpiresAt: data.arrangementChangeExpiresAt }
        : {}),
    })
    .where(whereClause)
    .returning({ id: affiliates.id });

  return rows.length > 0;
}
