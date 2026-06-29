import { db } from "@/db";
import { supportTickets, supportTicketReplies } from "@/db/schema";
import { eq, desc, count, sql, and } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import {
  isMissingSupportTicketReplyImageUrlColumnError,
  warnMissingSupportTicketReplyImageUrlColumnOnce,
} from "@/lib/support-ticket-db-fallback";

type SupportTicketReplyRow = InferSelectModel<typeof supportTicketReplies>;

const supportTicketReplyRowSelectLegacy = {
  id: supportTicketReplies.id,
  ticketId: supportTicketReplies.ticketId,
  authorUserId: supportTicketReplies.authorUserId,
  authorName: supportTicketReplies.authorName,
  authorRole: supportTicketReplies.authorRole,
  adminId: supportTicketReplies.adminId,
  adminName: supportTicketReplies.adminName,
  message: supportTicketReplies.message,
  createdAt: supportTicketReplies.createdAt,
} as const;

function withDefaultReplyImageUrl(
  row: Omit<SupportTicketReplyRow, "imageUrl">,
): SupportTicketReplyRow {
  return { ...row, imageUrl: null };
}

async function listRepliesForTicket(ticketId: number): Promise<SupportTicketReplyRow[]> {
  try {
    return await db
      .select()
      .from(supportTicketReplies)
      .where(eq(supportTicketReplies.ticketId, ticketId))
      .orderBy(supportTicketReplies.createdAt);
  } catch (error) {
    if (!isMissingSupportTicketReplyImageUrlColumnError(error)) throw error;
    warnMissingSupportTicketReplyImageUrlColumnOnce();
    const rows = await db
      .select(supportTicketReplyRowSelectLegacy)
      .from(supportTicketReplies)
      .where(eq(supportTicketReplies.ticketId, ticketId))
      .orderBy(supportTicketReplies.createdAt);
    return rows.map(withDefaultReplyImageUrl);
  }
}

function isMissingSupportTicketsTableError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth++) {
    const obj = current as Record<string, unknown>;
    const message = typeof obj.message === "string" ? obj.message : "";
    if (
      /support_tickets/i.test(message) &&
      /(does not exist|undefined table|relation .* does not exist)/i.test(message)
    ) {
      return true;
    }
    current = obj.cause;
  }
  const flat = String(error);
  return (
    (/42P01/i.test(flat) || /does not exist/i.test(flat)) &&
    /support_tickets/i.test(flat)
  );
}

function isSupportTicketsSchemaMismatch(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth++) {
    const obj = current as Record<string, unknown>;
    if (obj.code === "42703") {
      const message = typeof obj.message === "string" ? obj.message : "";
      if (/support_tickets/i.test(message)) return true;
    }
    current = obj.cause;
  }
  const flat = String(error);
  return /42703/.test(flat) && /support_tickets/i.test(flat);
}

function isRecoverableSupportTicketsReadError(error: unknown): boolean {
  if (isMissingSupportTicketsTableError(error)) return true;
  if (isSupportTicketsSchemaMismatch(error)) return true;
  let current: unknown = error;
  for (let depth = 0; depth < 10 && current && typeof current === "object"; depth++) {
    const obj = current as Record<string, unknown>;
    if (obj["neon:retryable"] === true) return true;
    const message = typeof obj.message === "string" ? obj.message : "";
    if (
      /too many database connection attempts/i.test(message) ||
      /failed to acquire permit/i.test(message)
    ) {
      return true;
    }
    current = obj.cause;
  }
  const flat = String(error);
  return (
    /too many database connection attempts/i.test(flat) ||
    /failed to acquire permit/i.test(flat)
  );
}

export type SupportCategory =
  | "general_support"
  | "bug_report"
  | "feature_request"
  | "feedback"
  | "billing"
  | "account";

export type SupportPriority = "low" | "normal" | "high" | "urgent";

export type SupportStatus = "open" | "in_progress" | "resolved" | "closed";

export interface CreateSupportTicketParams {
  userId: string;
  userEmail?: string;
  userName?: string;
  subject: string;
  message: string;
  category: SupportCategory;
  priority?: SupportPriority;
  attachmentUrl?: string | null;
}

// ── User-facing ────────────────────────────────────────────────────────────

export async function createSupportTicket(params: CreateSupportTicketParams) {
  const [ticket] = await db
    .insert(supportTickets)
    .values({
      userId: params.userId,
      userEmail: params.userEmail,
      userName: params.userName,
      subject: params.subject,
      message: params.message,
      category: params.category,
      priority: params.priority ?? "normal",
      attachmentUrl: params.attachmentUrl ?? null,
    })
    .returning();
  return ticket;
}

export async function getSupportTicketByIdForUser(ticketId: number, userId: string) {
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, userId)));
  return ticket ?? null;
}

export async function getSupportTicketById(ticketId: number) {
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId));
  return ticket ?? null;
}

export async function getSupportTicketsByUser(userId: string) {
  return db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, userId))
    .orderBy(desc(supportTickets.createdAt));
}

// ── Admin-facing ───────────────────────────────────────────────────────────

export async function getAllSupportTickets() {
  try {
    return await db
      .select()
      .from(supportTickets)
      .orderBy(desc(supportTickets.createdAt));
  } catch (error) {
    if (isRecoverableSupportTicketsReadError(error)) return [];
    throw error;
  }
}

export async function getTicketWithReplies(ticketId: number) {
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId));

  if (!ticket) return null;

  const replies = await listRepliesForTicket(ticketId);

  return { ticket, replies };
}

export async function addTicketReply(params: {
  ticketId: number;
  authorUserId: string;
  authorName: string;
  authorRole: "admin" | "user";
  message: string;
  imageUrl?: string | null;
}) {
  // neon-http driver does not support transactions — insert reply then touch ticket row.
  let reply: SupportTicketReplyRow | undefined;
  try {
    [reply] = await db
      .insert(supportTicketReplies)
      .values({
        ticketId: params.ticketId,
        authorUserId: params.authorUserId,
        authorName: params.authorName,
        authorRole: params.authorRole,
        adminId: params.authorRole === "admin" ? params.authorUserId : null,
        adminName: params.authorRole === "admin" ? params.authorName : null,
        message: params.message,
        imageUrl: params.imageUrl ?? null,
      })
      .returning();
  } catch (error) {
    if (!isMissingSupportTicketReplyImageUrlColumnError(error)) throw error;
    if (params.imageUrl) {
      throw new Error(
        "Image attachments need a database update. Run: npm run db:ensure-support-ticket-reply-images",
      );
    }
    warnMissingSupportTicketReplyImageUrlColumnOnce();
    [reply] = await db
      .insert(supportTicketReplies)
      .values({
        ticketId: params.ticketId,
        authorUserId: params.authorUserId,
        authorName: params.authorName,
        authorRole: params.authorRole,
        adminId: params.authorRole === "admin" ? params.authorUserId : null,
        adminName: params.authorRole === "admin" ? params.authorName : null,
        message: params.message,
      })
      .returning();
    reply = withDefaultReplyImageUrl(reply!);
  }
  const [ticket] = await db
    .update(supportTickets)
    .set({ updatedAt: new Date() })
    .where(eq(supportTickets.id, params.ticketId))
    .returning();
  return { reply, ticket: ticket ?? null };
}

export async function updateSupportTicketStatus(
  ticketId: number,
  status: SupportStatus,
) {
  const [row] = await db
    .update(supportTickets)
    .set({ status, updatedAt: new Date() })
    .where(eq(supportTickets.id, ticketId))
    .returning();
  return row ?? null;
}

export async function getSupportTicketStats() {
  try {
    const [byCategory, byStatus, byPriority, totals] = await Promise.all([
      db
        .select({
          category: supportTickets.category,
          count: count(supportTickets.id),
        })
        .from(supportTickets)
        .groupBy(supportTickets.category),

      db
        .select({
          status: supportTickets.status,
          count: count(supportTickets.id),
        })
        .from(supportTickets)
        .groupBy(supportTickets.status),

      db
        .select({
          priority: supportTickets.priority,
          count: count(supportTickets.id),
        })
        .from(supportTickets)
        .groupBy(supportTickets.priority),

      db
        .select({
          total: count(supportTickets.id),
          openCount: sql<number>`cast(count(case when ${supportTickets.status} = 'open' then 1 end) as integer)`,
          resolvedCount: sql<number>`cast(count(case when ${supportTickets.status} = 'resolved' then 1 end) as integer)`,
          urgentCount: sql<number>`cast(count(case when ${supportTickets.priority} = 'urgent' then 1 end) as integer)`,
        })
        .from(supportTickets),
    ]);

    return {
      byCategory: byCategory.map((r) => ({
        category: r.category,
        count: Number(r.count),
      })),
      byStatus: byStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
      byPriority: byPriority.map((r) => ({
        priority: r.priority,
        count: Number(r.count),
      })),
      totals: {
        total: Number(totals[0]?.total ?? 0),
        openCount: Number(totals[0]?.openCount ?? 0),
        resolvedCount: Number(totals[0]?.resolvedCount ?? 0),
        urgentCount: Number(totals[0]?.urgentCount ?? 0),
      },
    };
  } catch (error) {
    if (!isRecoverableSupportTicketsReadError(error)) throw error;
    return {
      byCategory: [],
      byStatus: [],
      byPriority: [],
      totals: {
        total: 0,
        openCount: 0,
        resolvedCount: 0,
        urgentCount: 0,
      },
    };
  }
}
