import type { SerializedContactMessage } from "@/lib/contact-us-admin-dto";

const SIGNED_IN_STATUS_LABELS: Record<SerializedContactMessage["status"], string> = {
  open: "Open",
  read: "Read",
  archived: "Resolved",
};

export function isGuestContactUsMessage(message: { userId: string | null }): boolean {
  return message.userId == null;
}

export function isActiveContactUsDialogue(status: SerializedContactMessage["status"]): boolean {
  return status === "open" || status === "read";
}

export function getContactUsAdminStatusLabel(message: SerializedContactMessage): string {
  if (isGuestContactUsMessage(message)) {
    return isActiveContactUsDialogue(message.status) ? "Active" : "Unactive Archived";
  }
  return SIGNED_IN_STATUS_LABELS[message.status];
}

export function contactUsAdminStatusBadgeClass(message: SerializedContactMessage): string {
  if (isGuestContactUsMessage(message)) {
    return isActiveContactUsDialogue(message.status)
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
