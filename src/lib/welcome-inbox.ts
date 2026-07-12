import type { UnifiedInboxItem } from "@/lib/inbox-item-types";
import type { listWelcomeInboxMessagesForUser } from "@/db/queries/welcome-inbox";

type WelcomeInboxRow = Awaited<
  ReturnType<typeof listWelcomeInboxMessagesForUser>
>[number];

export function welcomeInboxRowsToInboxItems(
  rows: WelcomeInboxRow[],
  readSet: Set<string>,
): UnifiedInboxItem[] {
  return rows.map((row) => {
    const itemId = String(row.id);
    const key = `welcome:${itemId}`;
    return {
      type: "welcome",
      key,
      title: row.title,
      description: row.description,
      dateIso: row.createdAt.toISOString(),
      isRead: readSet.has(key),
      requiresAction: false,
      payload: {
        messageId: row.id,
      },
    };
  });
}
