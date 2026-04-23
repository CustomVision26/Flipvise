import type { InferSelectModel } from "drizzle-orm";
import { supportTickets } from "@/db/schema";

export type SerializedTicket = {
  id: number;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  subject: string;
  message: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
};

export type SupportStats = {
  byCategory: { category: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  totals: {
    total: number;
    openCount: number;
    resolvedCount: number;
    urgentCount: number;
  };
};

export function serializeSupportTicketRow(
  row: InferSelectModel<typeof supportTickets>,
): SerializedTicket {
  return {
    id: row.id,
    userId: row.userId,
    userEmail: row.userEmail ?? null,
    userName: row.userName ?? null,
    subject: row.subject,
    message: row.message,
    category: row.category,
    status: row.status,
    priority: row.priority,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
