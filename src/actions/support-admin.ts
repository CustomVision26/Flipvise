"use server";

import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { revalidatePath } from "next/cache";
import {
  updateSupportTicketStatus,
  addTicketReply,
  type SupportStatus,
} from "@/db/queries/support";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const caller = await clerkClient.users.getUser(userId);
  const role = (caller.publicMetadata as { role?: string })?.role;
  if (role !== "admin") throw new Error("Forbidden");
  const name =
    [caller.firstName, caller.lastName].filter(Boolean).join(" ") ||
    caller.username ||
    userId;
  return { userId, name };
}

// ── Schemas ────────────────────────────────────────────────────────────────

const updateStatusSchema = z.object({
  ticketId: z.number().int().positive(),
  status: z.enum(["open", "in_progress", "resolved", "closed"]),
});

const replySchema = z.object({
  ticketId: z.number().int().positive(),
  message: z.string().min(1, "Reply cannot be empty").max(5000),
});

// ── Types ──────────────────────────────────────────────────────────────────

export type AdminUpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type AdminReplyInput = z.infer<typeof replySchema>;

// ── Actions ────────────────────────────────────────────────────────────────

export async function adminUpdateTicketStatusAction(
  data: AdminUpdateStatusInput,
) {
  await requireAdmin();

  const parsed = updateStatusSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");

  await updateSupportTicketStatus(
    parsed.data.ticketId,
    parsed.data.status as SupportStatus,
  );

  revalidatePath("/admin");
}

export async function adminReplyToTicketAction(data: AdminReplyInput) {
  const { userId, name } = await requireAdmin();

  const parsed = replySchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");

  await addTicketReply({
    ticketId: parsed.data.ticketId,
    adminId: userId,
    adminName: name,
    message: parsed.data.message,
  });

  revalidatePath("/admin");
}
