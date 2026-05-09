import { db } from "@/db";
import { supportTickets, supportTicketReplies } from "@/db/schema";
import { eq, desc, count, sql } from "drizzle-orm";

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
    })
    .returning();
  return ticket;
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

  const replies = await db
    .select()
    .from(supportTicketReplies)
    .where(eq(supportTicketReplies.ticketId, ticketId))
    .orderBy(supportTicketReplies.createdAt);

  return { ticket, replies };
}

export async function addTicketReply(params: {
  ticketId: number;
  adminId: string;
  adminName: string;
  message: string;
}) {
  return db.transaction(async (tx) => {
    const [reply] = await tx
      .insert(supportTicketReplies)
      .values(params)
      .returning();
    const [ticket] = await tx
      .update(supportTickets)
      .set({ updatedAt: new Date() })
      .where(eq(supportTickets.id, params.ticketId))
      .returning();
    return { reply, ticket: ticket ?? null };
  });
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
