"use server";

import { createClerkClient } from "@clerk/backend";
import { z } from "zod";
import { auth } from "@/lib/clerk-auth";
import { revalidatePath } from "next/cache";
import { getAdminUserRecords, type AdminUserRecords } from "@/db/queries/admin-user-records";
import {
  adminPlanRecordLimits,
  markOwnedRecordsAllowed,
  setOwnedWorkspaceActiveForPlan,
  setOwnedWorkspaceMemberActiveForPlan,
  type AdminPlanRecordLimits,
} from "@/db/queries/admin-plan-record-access";
import { resolveAdminUserPlanBillingContext } from "@/lib/admin-user-plan-label";
import {
  isClerkPlatformAdminRole,
  isClerkSuperadminRole,
} from "@/lib/clerk-platform-admin-role";
import { isPlatformSuperadminAllowListed } from "@/lib/platform-superadmin";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

const recordsSchema = z.object({
  targetUserId: z.string().min(1),
});

export type AdminUserDirectoryName = {
  name: string;
  email: string | null;
};

export type AdminUserRecordsResult = AdminUserRecords & {
  names: Record<string, AdminUserDirectoryName>;
  planAccess: AdminPlanRecordLimits;
};

const toggleSchema = z.object({
  ownerUserId: z.string().min(1),
  teamId: z.number().int().positive(),
  memberUserId: z.string().min(1).optional(),
  active: z.boolean(),
});

async function requirePlatformAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const caller = await clerkClient.users.getUser(userId);
  const role = (caller.publicMetadata as { role?: string })?.role;
  if (
    !isClerkPlatformAdminRole(role) &&
    !isClerkSuperadminRole(role) &&
    !isPlatformSuperadminAllowListed(userId)
  ) {
    throw new Error("Forbidden");
  }
}

function displayName(user: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  id: string;
}): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.username || user.id;
}

export async function getAdminUserRecordsAction(
  input: z.infer<typeof recordsSchema>,
): Promise<AdminUserRecordsResult> {
  await requirePlatformAdmin();
  const parsed = recordsSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid input");

  return loadAdminUserRecords(parsed.data.targetUserId);
}

async function ownerPlanSlug(userId: string): Promise<string> {
  const user = await clerkClient.users.getUser(userId);
  const plan = resolveAdminUserPlanBillingContext(
    (user.publicMetadata ?? {}) as Parameters<typeof resolveAdminUserPlanBillingContext>[0],
  );
  return plan.effectivePlanSlug ?? "free";
}

async function loadAdminUserRecords(targetUserId: string): Promise<AdminUserRecordsResult> {
  const [records, planSlug] = await Promise.all([
    getAdminUserRecords(targetUserId),
    ownerPlanSlug(targetUserId),
  ]);
  const names = await directoryNames(records);
  return {
    ...records,
    ownedWorkspaces: markOwnedRecordsAllowed(records.ownedWorkspaces, planSlug),
    names,
    planAccess: adminPlanRecordLimits(planSlug),
  };
}

async function directoryNames(
  records: AdminUserRecords,
): Promise<Record<string, AdminUserDirectoryName>> {
  const ids = new Set<string>();
  for (const workspace of records.ownedWorkspaces) {
    for (const member of workspace.members) ids.add(member.userId);
    for (const assignment of workspace.assignments) ids.add(assignment.memberUserId);
  }
  const names: Record<string, AdminUserDirectoryName> = {};
  await Promise.all(
    [...ids].slice(0, 80).map(async (id) => {
      try {
        const user = await clerkClient.users.getUser(id);
        names[id] = {
          name: displayName(user),
          email: user.emailAddresses[0]?.emailAddress ?? null,
        };
      } catch {
        names[id] = { name: id, email: null };
      }
    }),
  );
  return names;
}

export async function setAdminPlanRecordActiveAction(
  input: z.infer<typeof toggleSchema>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await requirePlatformAdmin();
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input" };

  const planSlug = await ownerPlanSlug(parsed.data.ownerUserId);
  const result = parsed.data.memberUserId
    ? await setOwnedWorkspaceMemberActiveForPlan({
        ownerUserId: parsed.data.ownerUserId,
        teamId: parsed.data.teamId,
        memberUserId: parsed.data.memberUserId,
        active: parsed.data.active,
        planSlug,
      })
    : await setOwnedWorkspaceActiveForPlan({
        ownerUserId: parsed.data.ownerUserId,
        teamId: parsed.data.teamId,
        active: parsed.data.active,
        planSlug,
      });
  if (!result.ok) return result;

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  return { ok: true };
}
