"use server";

import { createClerkClient } from "@clerk/backend";
import { z } from "zod";
import { auth } from "@/lib/clerk-auth";
import { getAdminUserRecords, type AdminUserRecords } from "@/db/queries/admin-user-records";
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
};

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

  const records = await getAdminUserRecords(parsed.data.targetUserId);
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
  return { ...records, names };
}
