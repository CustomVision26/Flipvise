import type { ClerkUserFieldDisplay } from "@/lib/clerk-user-display";

const GENERIC_OWNER_LABELS = new Set(["Subscriber", "You", ""]);

function isClerkUserId(value: string): boolean {
  return value.startsWith("user_");
}

function labelFromEmail(email: string): string {
  const trimmed = email.trim();
  if (!trimmed) return trimmed;
  const local = trimmed.split("@")[0]?.trim();
  return local || trimmed;
}

/** Human-readable workspace plan owner — matches the online workspace switcher. */
export function resolveWorkspaceOwnerDisplayName(input: {
  navOwnerDisplayName?: string | null;
  ownerEmail?: string | null;
  ownerResolved?: Pick<ClerkUserFieldDisplay, "primaryLine" | "primaryEmail"> | null;
}): { ownerDisplayName: string; ownerEmail: string | null } {
  const navLabel = input.navOwnerDisplayName?.trim() ?? "";
  const email =
    input.ownerResolved?.primaryEmail?.trim() ??
    input.ownerEmail?.trim() ??
    null;
  const primaryLine = input.ownerResolved?.primaryLine?.trim() ?? "";

  const fromFields =
    primaryLine &&
    !isClerkUserId(primaryLine) &&
    !GENERIC_OWNER_LABELS.has(primaryLine)
      ? primaryLine
      : null;

  const fromNav =
    navLabel && !GENERIC_OWNER_LABELS.has(navLabel) ? navLabel : null;

  const fromEmail = email ? labelFromEmail(email) : null;

  const ownerDisplayName =
    fromFields ?? fromNav ?? fromEmail ?? (navLabel || "Subscriber");

  return { ownerDisplayName, ownerEmail: email };
}
