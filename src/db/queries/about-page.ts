import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { platformAboutAuditLogs, platformAboutSettings } from "@/db/schema";
import {
  defaultAboutPageContent,
  parseAboutPageContent,
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
