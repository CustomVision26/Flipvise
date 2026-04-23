import { createClerkClient } from "@clerk/backend";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export type SessionUserNameFields = {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
};

export function formatSessionUserDisplayName(user: SessionUserNameFields): string {
  const full = user.fullName?.trim();
  if (full) return full;
  const combined = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  if (user.username?.trim()) return user.username.trim();
  const email = user.primaryEmailAddress?.emailAddress;
  if (email) {
    const local = email.split("@")[0]?.trim();
    if (local) return local;
  }
  return "You";
}

export async function getClerkUserDisplayNameById(userId: string): Promise<string> {
  try {
    const u = await clerkClient.users.getUser(userId);
    return formatSessionUserDisplayName({
      fullName: u.fullName,
      firstName: u.firstName,
      lastName: u.lastName,
      username: u.username,
      primaryEmailAddress: u.primaryEmailAddress,
    });
  } catch {
    return "Subscriber";
  }
}

/** Primary line = friendly name; secondary = @username · email (for admin tables). */
export type ClerkUserFieldDisplay = {
  primaryLine: string;
  secondaryLine: string | null;
  /** Primary email address (for “Added by” / audit columns). */
  primaryEmail: string | null;
};

function buildUsernameEmailLine(
  username: string | null | undefined,
  email: string | null | undefined,
): string | null {
  const u = username?.trim();
  const e = email?.trim();
  const bits: string[] = [];
  if (u) bits.push(`@${u}`);
  if (e) bits.push(e);
  return bits.length > 0 ? bits.join(" · ") : null;
}

export async function getClerkUserFieldDisplayById(
  userId: string,
): Promise<ClerkUserFieldDisplay> {
  try {
    const u = await clerkClient.users.getUser(userId);
    const email = u.primaryEmailAddress?.emailAddress?.trim() ?? null;
    return {
      primaryLine: formatSessionUserDisplayName({
        fullName: u.fullName,
        firstName: u.firstName,
        lastName: u.lastName,
        username: u.username,
        primaryEmailAddress: u.primaryEmailAddress,
      }),
      secondaryLine: buildUsernameEmailLine(
        u.username,
        u.primaryEmailAddress?.emailAddress,
      ),
      primaryEmail: email,
    };
  } catch {
    return { primaryLine: userId, secondaryLine: null, primaryEmail: null };
  }
}

export async function getClerkUserFieldDisplaysByIds(
  userIds: string[],
): Promise<Record<string, ClerkUserFieldDisplay>> {
  const unique = [...new Set(userIds)];
  const pairs = await Promise.all(
    unique.map(async (id) => [id, await getClerkUserFieldDisplayById(id)] as const),
  );
  return Object.fromEntries(pairs);
}

/** Primary Clerk email per user (deduped, sorted) for pickers like team invite email. */
export async function getClerkPrimaryEmailsByUserIds(userIds: string[]): Promise<string[]> {
  const unique = [...new Set(userIds)].filter(Boolean);
  const emails: string[] = [];
  await Promise.all(
    unique.map(async (id) => {
      try {
        const u = await clerkClient.users.getUser(id);
        const e = u.primaryEmailAddress?.emailAddress?.trim();
        if (e) emails.push(e);
      } catch {
        // omit unresolved users
      }
    }),
  );
  return [...new Set(emails)].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}
