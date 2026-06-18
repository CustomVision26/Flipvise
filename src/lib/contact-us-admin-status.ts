import type { SerializedContactMessage } from "@/lib/contact-us-admin-dto";

/** Guest chat UI is considered open when last seen is within this window. */
export const GUEST_CHAT_UI_ACTIVE_TTL_MS = 45_000;

const SIGNED_IN_STATUS_LABELS: Record<SerializedContactMessage["status"], string> = {
  open: "Open",
  read: "Read",
  archived: "Resolved",
};

export function isGuestContactUsMessage(message: { userId: string | null }): boolean {
  return message.userId == null;
}

export function isGuestChatUiCurrentlyOpen(
  message: Pick<SerializedContactMessage, "status" | "userId" | "guestChatLastSeenAt">,
  nowMs: number = Date.now(),
): boolean {
  if (!isGuestContactUsMessage(message)) return false;
  if (message.status === "archived") return false;
  if (!message.guestChatLastSeenAt) return false;
  return nowMs - new Date(message.guestChatLastSeenAt).getTime() < GUEST_CHAT_UI_ACTIVE_TTL_MS;
}

export function getContactUsAdminStatusLabel(message: SerializedContactMessage): string {
  if (isGuestContactUsMessage(message)) {
    return isGuestChatUiCurrentlyOpen(message) ? "Active" : "Inactive Archived";
  }
  return SIGNED_IN_STATUS_LABELS[message.status];
}

export function contactUsAdminStatusBadgeClass(message: SerializedContactMessage): string {
  if (isGuestContactUsMessage(message)) {
    return isGuestChatUiCurrentlyOpen(message)
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : "border-border/60 bg-muted/30 text-muted-foreground";
  }

  if (message.status === "open") {
    return "border-sky-500/40 bg-sky-500/10 text-sky-300";
  }
  if (message.status === "read") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  }
  return "border-border/60 bg-muted/30 text-muted-foreground";
}

export function canReopenContactUsConversation(message: SerializedContactMessage): boolean {
  return message.status === "archived" && !isGuestContactUsMessage(message);
}
