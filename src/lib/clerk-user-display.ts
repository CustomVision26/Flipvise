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

/**
 * Prefer Clerk primary; otherwise first verified address; otherwise first address on file.
 * Quiz Loops sends require a recipient email — some accounts have no primary set yet.
 */
function pickBestEmailFromClerkUser(u: {
  primaryEmailAddress?: { emailAddress: string } | null;
  emailAddresses?: Array<{ emailAddress: string; verification?: { status: string } | null }>;
}): string | null {
  const primary = u.primaryEmailAddress?.emailAddress?.trim();
  if (primary) return primary;
  for (const ea of u.emailAddresses ?? []) {
    if (ea.verification?.status === "verified" && ea.emailAddress?.trim()) {
      return ea.emailAddress.trim();
    }
  }
  const first = u.emailAddresses?.[0]?.emailAddress?.trim();
  return first ?? null;
}

export async function getClerkUserFieldDisplayById(
  userId: string,
): Promise<ClerkUserFieldDisplay> {
  try {
    const u = await clerkClient.users.getUser(userId);
    const email = pickBestEmailFromClerkUser(u);
    return {
      primaryLine: formatSessionUserDisplayName({
        fullName: u.fullName,
        firstName: u.firstName,
        lastName: u.lastName,
        username: u.username,
        primaryEmailAddress:
          email != null ? { emailAddress: email } : u.primaryEmailAddress,
      }),
      secondaryLine: buildUsernameEmailLine(u.username, email),
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
        const e = pickBestEmailFromClerkUser(u);
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
