import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { platformAboutAuditLogs, platformAboutSettings } from "@/db/schema";
import {
  defaultAboutPageContent,
  parseAboutPageContent,
  type AboutLeader,
  type AboutPageContent,
} from "@/lib/about-page-content";

export type AboutAdminState = {
  tableReady: boolean;
  draft: AboutPageContent;
  hasSavedDraft: boolean;
  hasPublishedOverride: boolean;
  updatedAt: Date | null;
  publishedAt: Date | null;
  updatedByUserId: string | null;
};

function errorText(error: unknown, depth = 0): string {
  if (depth > 3 || !error || typeof error !== "object") return "";
  const record = error as { message?: unknown; cause?: unknown };
  const message = typeof record.message === "string" ? record.message : "";
  return `${message} ${errorText(record.cause, depth + 1)}`;
}

function isMissingAboutTable(error: unknown): boolean {
  const message = errorText(error);
  return message.includes("platform_about_settings") && message.includes("does not exist");
}

function contentOrDefault(value: unknown): AboutPageContent | null {
  const parsed = parseAboutPageContent(value);
  return parsed.ok ? parsed.content : null;
}

export async function getPublishedAboutContent(): Promise<AboutPageContent> {
  try {
    const [row] = await db
      .select({ published: platformAboutSettings.published })
      .from(platformAboutSettings)
      .where(eq(platformAboutSettings.id, 1))
      .limit(1);
    return contentOrDefault(row?.published) ?? defaultAboutPageContent();
  } catch (error) {
    if (!isMissingAboutTable(error)) {
      console.error("[getPublishedAboutContent]", error);
    }
    return defaultAboutPageContent();
  }
}

export async function getAboutAdminState(): Promise<AboutAdminState> {
  const fallback = defaultAboutPageContent();
  try {
    const [row] = await db
      .select()
      .from(platformAboutSettings)
      .where(eq(platformAboutSettings.id, 1))
      .limit(1);
    const draft = contentOrDefault(row?.draft);
    const published = contentOrDefault(row?.published);
    return {
      tableReady: true,
      draft: draft ?? published ?? fallback,
      hasSavedDraft: Boolean(draft),
      hasPublishedOverride: Boolean(published),
      updatedAt: row?.updatedAt ?? null,
      publishedAt: row?.publishedAt ?? null,
      updatedByUserId: row?.updatedByUserId ?? null,
    };
  } catch (error) {
    if (!isMissingAboutTable(error)) {
      console.error("[getAboutAdminState]", error);
    }
    return {
      tableReady: false,
      draft: fallback,
      hasSavedDraft: false,
      hasPublishedOverride: false,
      updatedAt: null,
      publishedAt: null,
      updatedByUserId: null,
    };
  }
}

export async function saveAboutDraft(userId: string, content: AboutPageContent) {
  const now = new Date();
  await db
    .insert(platformAboutSettings)
    .values({
      id: 1,
      draft: content,
      updatedAt: now,
      updatedByUserId: userId,
    })
    .onConflictDoUpdate({
      target: platformAboutSettings.id,
      set: {
        draft: content,
        updatedAt: now,
        updatedByUserId: userId,
      },
    });
  await db.insert(platformAboutAuditLogs).values({
    adminUserId: userId,
    action: "about_draft_saved",
  });
}

export async function publishAboutContent(userId: string, content: AboutPageContent) {
  const now = new Date();
  await db
    .insert(platformAboutSettings)
    .values({
      id: 1,
      draft: content,
      published: content,
      updatedAt: now,
      publishedAt: now,
      updatedByUserId: userId,
    })
    .onConflictDoUpdate({
      target: platformAboutSettings.id,
      set: {
        draft: content,
        published: content,
        updatedAt: now,
        publishedAt: now,
        updatedByUserId: userId,
      },
    });
  await db.insert(platformAboutAuditLogs).values({
    adminUserId: userId,
    action: "about_published",
  });
}

function withLeaders(content: AboutPageContent, leaders: AboutLeader[]): AboutPageContent {
  return { ...content, leaders };
}

function upsertLeader(leaders: AboutLeader[], leader: AboutLeader): AboutLeader[] {
  const index = leaders.findIndex((item) => item.id === leader.id);
  if (index === -1) return [...leaders, leader];
  const next = leaders.slice();
  next[index] = leader;
  return next;
}

export async function applyAboutLeaderChange(
  userId: string,
  change: { type: "upsert"; leader: AboutLeader } | { type: "remove"; leaderId: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const [row] = await db
    .select()
    .from(platformAboutSettings)
    .where(eq(platformAboutSettings.id, 1))
    .limit(1);
  const draftBase =
    contentOrDefault(row?.draft) ?? contentOrDefault(row?.published) ?? defaultAboutPageContent();
  const publishedBase = contentOrDefault(row?.published) ?? defaultAboutPageContent();
  const nextLeaders = (leaders: AboutLeader[]) =>
    change.type === "remove"
      ? leaders.filter((leader) => leader.id !== change.leaderId)
      : upsertLeader(leaders, change.leader);
  const draftParsed = parseAboutPageContent(withLeaders(draftBase, nextLeaders(draftBase.leaders)));
  const publishedParsed = parseAboutPageContent(
    withLeaders(publishedBase, nextLeaders(publishedBase.leaders)),
  );
  if (!draftParsed.ok || !publishedParsed.ok) {
    return {
      ok: false,
      message: draftParsed.ok ? publishedParsed.error : draftParsed.error,
    };
  }
  const now = new Date();
  const action = change.type === "remove" ? "about_leader_deleted" : "about_leader_published";
  await db
    .insert(platformAboutSettings)
    .values({
      id: 1,
      draft: draftParsed.content,
      published: publishedParsed.content,
      updatedAt: now,
      publishedAt: now,
      updatedByUserId: userId,
    })
    .onConflictDoUpdate({
      target: platformAboutSettings.id,
      set: {
        draft: draftParsed.content,
        published: publishedParsed.content,
        updatedAt: now,
        publishedAt: now,
        updatedByUserId: userId,
      },
    });
  await db.insert(platformAboutAuditLogs).values({
    adminUserId: userId,
    action,
  });
  return { ok: true };
}

export async function recordAboutPhotoUpload(userId: string) {
  await db.insert(platformAboutAuditLogs).values({
    adminUserId: userId,
    action: "about_leader_photo_uploaded",
  });
}

export async function listRecentAboutAudit(limit = 8) {
  return db
    .select()
    .from(platformAboutAuditLogs)
    .orderBy(desc(platformAboutAuditLogs.createdAt))
    .limit(limit);
}
