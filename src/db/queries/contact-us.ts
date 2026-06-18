import { randomBytes } from "crypto";
import { db } from "@/db";
import { contactUsMessages, contactUsReplies, platformContactSettings } from "@/db/schema";
import { SUPPORT_EMAIL } from "@/lib/support-contact";
import {
  defaultPlatformContactSettingsRow,
  isContactUsSchemaUnavailableError,
  isMissingContactUsReplyImageUrlColumnError,
  warnMissingContactUsReplyImageUrlColumnOnce,
  withContactUsReadFallback,
} from "@/lib/contact-us-db-fallback";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";

export type ContactSocialLink = {
  platform: string;
  label: string;
  url: string;
};

export type ContactUsStatus = "open" | "read" | "archived";

export type ContactUsStats = {
  total: number;
  openCount: number;
  readCount: number;
  archivedCount: number;
  thisWeekCount: number;
};

const SETTINGS_ID = 1;

const EMPTY_CONTACT_US_STATS: ContactUsStats = {
  total: 0,
  openCount: 0,
  readCount: 0,
  archivedCount: 0,
  thisWeekCount: 0,
};

export async function getPlatformContactSettings() {
  return withContactUsReadFallback(async () => {
    const rows = await db
      .select()
      .from(platformContactSettings)
      .where(eq(platformContactSettings.id, SETTINGS_ID))
      .limit(1);

    if (rows[0]) return rows[0];

    await db
      .insert(platformContactSettings)
      .values({
        id: SETTINGS_ID,
        email: SUPPORT_EMAIL,
        phone: null,
        socialLinks: [],
      })
      .onConflictDoNothing();

    const seeded = await db
      .select()
      .from(platformContactSettings)
      .where(eq(platformContactSettings.id, SETTINGS_ID))
      .limit(1);

    return seeded[0] ?? defaultPlatformContactSettingsRow();
  }, defaultPlatformContactSettingsRow());
}

export async function upsertPlatformContactSettings(input: {
  email: string;
  phone: string | null;
  socialLinks: ContactSocialLink[];
  updatedByUserId: string;
}) {
  const now = new Date();
  await db
    .insert(platformContactSettings)
    .values({
      id: SETTINGS_ID,
      email: input.email,
      phone: input.phone,
      socialLinks: input.socialLinks,
      updatedByUserId: input.updatedByUserId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: platformContactSettings.id,
      set: {
        email: input.email,
        phone: input.phone,
        socialLinks: input.socialLinks,
        updatedByUserId: input.updatedByUserId,
        updatedAt: now,
      },
    });

  return getPlatformContactSettings();
}

export async function createContactUsMessage(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
  userId?: string | null;
}) {
  const accessToken = randomBytes(32).toString("hex");
  const now = new Date();
  const rows = await db
    .insert(contactUsMessages)
    .values({
      name: input.name,
      email: input.email,
      subject: input.subject,
      message: input.message,
      userId: input.userId ?? null,
      accessToken,
      guestChatLastSeenAt: input.userId ? null : now,
    })
    .returning();

  return rows[0]!;
}

export async function getContactUsWithReplies(messageId: number) {
  const message = await getContactUsMessageById(messageId);
  if (!message) return null;

  const replies = await listContactUsRepliesForMessage(messageId);
  return { message, replies };
}

async function listContactUsRepliesForMessage(messageId: number) {
  try {
    return await db
      .select()
      .from(contactUsReplies)
      .where(eq(contactUsReplies.messageId, messageId))
      .orderBy(contactUsReplies.createdAt);
  } catch (error) {
    if (!isMissingContactUsReplyImageUrlColumnError(error)) throw error;
    warnMissingContactUsReplyImageUrlColumnOnce();
    const rows = await db
      .select({
        id: contactUsReplies.id,
        messageId: contactUsReplies.messageId,
        authorUserId: contactUsReplies.authorUserId,
        authorName: contactUsReplies.authorName,
        authorRole: contactUsReplies.authorRole,
        message: contactUsReplies.message,
        createdAt: contactUsReplies.createdAt,
      })
      .from(contactUsReplies)
      .where(eq(contactUsReplies.messageId, messageId))
      .orderBy(contactUsReplies.createdAt);
    return rows.map((row) => ({ ...row, imageUrl: null }));
  }
}

export async function getContactUsByAccessToken(messageId: number, accessToken: string) {
  const rows = await db
    .select()
    .from(contactUsMessages)
    .where(
      and(
        eq(contactUsMessages.id, messageId),
        eq(contactUsMessages.accessToken, accessToken),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function addContactUsReply(input: {
  messageId: number;
  authorUserId: string | null;
  authorName: string;
  authorRole: "admin" | "user";
  message: string;
  imageUrl?: string | null;
}) {
  // neon-http driver does not support transactions — insert reply then update message.
  let reply;
  try {
    [reply] = await db
      .insert(contactUsReplies)
      .values({
        messageId: input.messageId,
        authorUserId: input.authorUserId,
        authorName: input.authorName,
        authorRole: input.authorRole,
        message: input.message,
        imageUrl: input.imageUrl ?? null,
      })
      .returning();
  } catch (error) {
    if (!isMissingContactUsReplyImageUrlColumnError(error)) throw error;
    if (input.imageUrl) {
      throw new Error(
        "Image attachments need a database update. Run: npm run db:ensure-contact-us-reply-images",
      );
    }
    warnMissingContactUsReplyImageUrlColumnOnce();
    [reply] = await db
      .insert(contactUsReplies)
      .values({
        messageId: input.messageId,
        authorUserId: input.authorUserId,
        authorName: input.authorName,
        authorRole: input.authorRole,
        message: input.message,
      })
      .returning();
    reply = { ...reply!, imageUrl: null };
  }

  const now = new Date();
  const patch =
    input.authorRole === "user"
      ? { updatedAt: now, status: "open" as const }
      : { updatedAt: now };

  await db
    .update(contactUsMessages)
    .set(patch)
    .where(eq(contactUsMessages.id, input.messageId));

  return reply!;
}

export async function listContactUsMessagesForUser(userId: string, email: string, limit = 50) {
  return withContactUsReadFallback(
    () =>
      db
        .select()
        .from(contactUsMessages)
        .where(
          sql`${contactUsMessages.userId} = ${userId} OR lower(${contactUsMessages.email}) = lower(${email})`,
        )
        .orderBy(desc(contactUsMessages.updatedAt))
        .limit(limit),
    [],
  );
}

export async function listContactUsMessages(limit = 200) {
  return withContactUsReadFallback(
    () =>
      db
        .select()
        .from(contactUsMessages)
        .orderBy(desc(contactUsMessages.createdAt))
        .limit(limit),
    [],
  );
}

export async function getContactUsMessageById(id: number) {
  return withContactUsReadFallback(async () => {
    const rows = await db
      .select()
      .from(contactUsMessages)
      .where(eq(contactUsMessages.id, id))
      .limit(1);
    return rows[0] ?? null;
  }, null);
}

export async function getContactUsStats(): Promise<ContactUsStats> {
  return withContactUsReadFallback(async () => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [totals, weekRows] = await Promise.all([
      db
        .select({
          total: sql<number>`cast(count(*) as integer)`,
          openCount: sql<number>`cast(count(*) filter (where ${contactUsMessages.status} = 'open') as integer)`,
          readCount: sql<number>`cast(count(*) filter (where ${contactUsMessages.status} = 'read') as integer)`,
          archivedCount: sql<number>`cast(count(*) filter (where ${contactUsMessages.status} = 'archived') as integer)`,
        })
        .from(contactUsMessages),
      db
        .select({ count: sql<number>`cast(count(*) as integer)` })
        .from(contactUsMessages)
        .where(gte(contactUsMessages.createdAt, weekAgo)),
    ]);

    const row = totals[0];
    return {
      total: Number(row?.total ?? 0),
      openCount: Number(row?.openCount ?? 0),
      readCount: Number(row?.readCount ?? 0),
      archivedCount: Number(row?.archivedCount ?? 0),
      thisWeekCount: Number(weekRows[0]?.count ?? 0),
    };
  }, EMPTY_CONTACT_US_STATS);
}

export async function markContactUsMessageRead(id: number, adminUserId: string) {
  const now = new Date();
  await db
    .update(contactUsMessages)
    .set({
      status: "read",
      readAt: now,
      readByUserId: adminUserId,
    })
    .where(and(eq(contactUsMessages.id, id), eq(contactUsMessages.status, "open")));

  return getContactUsMessageById(id);
}

export async function archiveContactUsMessage(id: number, adminUserId: string) {
  const now = new Date();
  await db
    .update(contactUsMessages)
    .set({
      status: "archived",
      readAt: now,
      readByUserId: adminUserId,
      updatedAt: now,
    })
    .where(eq(contactUsMessages.id, id));

  return getContactUsMessageById(id);
}

export async function unarchiveContactUsMessage(id: number) {
  const now = new Date();
  await db
    .update(contactUsMessages)
    .set({
      status: "read",
      updatedAt: now,
    })
    .where(and(eq(contactUsMessages.id, id), eq(contactUsMessages.status, "archived")));

  return getContactUsMessageById(id);
}

/** User closed the chat — mark resolved without admin attribution. */
export async function resolveContactUsMessageByParticipant(messageId: number) {
  const now = new Date();
  await db
    .update(contactUsMessages)
    .set({
      status: "archived",
      updatedAt: now,
    })
    .where(
      and(
        eq(contactUsMessages.id, messageId),
        inArray(contactUsMessages.status, ["open", "read"]),
      ),
    );

  return getContactUsMessageById(messageId);
}

/** Guest has the public thread page open — refresh UI presence for admin Active status. */
export async function touchContactUsGuestChatPresence(messageId: number) {
  const now = new Date();
  await db
    .update(contactUsMessages)
    .set({
      guestChatLastSeenAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(contactUsMessages.id, messageId),
        isNull(contactUsMessages.userId),
        inArray(contactUsMessages.status, ["open", "read"]),
      ),
    );
}

export function contactUsPreview(text: string, max = 500): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

export { isContactUsSchemaUnavailableError };
