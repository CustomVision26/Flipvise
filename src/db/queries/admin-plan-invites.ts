import { db } from "@/db";
import { adminPlanAssignmentInvites } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export async function supersedePendingAdminPlanInvitesForUser(targetUserId: string) {
  await db
    .update(adminPlanAssignmentInvites)
    .set({ status: "superseded", respondedAt: new Date() })
    .where(
      and(
        eq(adminPlanAssignmentInvites.targetUserId, targetUserId),
        eq(adminPlanAssignmentInvites.status, "pending"),
      ),
    );
}

export async function insertAdminPlanAssignmentInvite(data: {
  targetUserId: string;
  assignedByUserId: string;
  assignedByName: string;
  targetUserName: string;
  assignment: string;
  previousPlanSlug: string | null;
}) {
  await db.insert(adminPlanAssignmentInvites).values({
    targetUserId: data.targetUserId,
    assignedByUserId: data.assignedByUserId,
    assignedByName: data.assignedByName,
    targetUserName: data.targetUserName,
    assignment: data.assignment,
    previousPlanSlug: data.previousPlanSlug,
    status: "pending",
  });
}

export async function listAdminPlanInvitesForInbox(targetUserId: string, limit = 80) {
  return db
    .select()
    .from(adminPlanAssignmentInvites)
    .where(eq(adminPlanAssignmentInvites.targetUserId, targetUserId))
    .orderBy(desc(adminPlanAssignmentInvites.createdAt))
    .limit(limit);
}

export async function getPendingAdminPlanInviteForUser(inviteId: number, targetUserId: string) {
  const [row] = await db
    .select()
    .from(adminPlanAssignmentInvites)
    .where(
      and(
        eq(adminPlanAssignmentInvites.id, inviteId),
        eq(adminPlanAssignmentInvites.targetUserId, targetUserId),
        eq(adminPlanAssignmentInvites.status, "pending"),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function markAdminPlanInviteAccepted(inviteId: number, targetUserId: string) {
  const updated = await db
    .update(adminPlanAssignmentInvites)
    .set({ status: "accepted", respondedAt: new Date() })
    .where(
      and(
        eq(adminPlanAssignmentInvites.id, inviteId),
        eq(adminPlanAssignmentInvites.targetUserId, targetUserId),
        eq(adminPlanAssignmentInvites.status, "pending"),
      ),
    )
    .returning({ id: adminPlanAssignmentInvites.id });
  return updated.length > 0;
}

export async function markAdminPlanInviteDeclined(inviteId: number, targetUserId: string) {
  const updated = await db
    .update(adminPlanAssignmentInvites)
    .set({ status: "declined", respondedAt: new Date() })
    .where(
      and(
        eq(adminPlanAssignmentInvites.id, inviteId),
        eq(adminPlanAssignmentInvites.targetUserId, targetUserId),
        eq(adminPlanAssignmentInvites.status, "pending"),
      ),
    )
    .returning({ id: adminPlanAssignmentInvites.id });
  return updated.length > 0;
}
