import { db } from "@/db";
import { affiliates } from "@/db/schema";
import { eq, desc, or, and } from "drizzle-orm";

export async function listAffiliates() {
  return db.select().from(affiliates).orderBy(desc(affiliates.createdAt));
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
      status: data.status ?? "pending",
    })
    .returning({ id: affiliates.id });
  return rows[0]?.id ?? null;
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
  },
) {
  await db
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
    })
    .where(eq(affiliates.id, id));
}
