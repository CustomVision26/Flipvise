import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documentationOverrides } from "@/db/schema";

export type DocumentationAudience = "user" | "admin";
export type DocumentationContentKind =
  | "quick_reference_page"
  | "in_depth_article"
  | "page_addition"
  | "page_removal"
  | "section_addition"
  | "section_metadata";

function isMissingDocumentationOverridesTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("documentation_overrides") &&
    (message.includes("does not exist") ||
      message.includes("relation") ||
      message.includes("failed query"))
  );
}

export async function listDocumentationOverrides(audience: DocumentationAudience) {
  try {
    return await db
      .select()
      .from(documentationOverrides)
      .where(eq(documentationOverrides.audience, audience));
  } catch (error) {
    if (isMissingDocumentationOverridesTableError(error)) return [];
    throw error;
  }
}

export async function upsertDocumentationOverride(input: {
  audience: DocumentationAudience;
  contentKind: DocumentationContentKind;
  pageId: string;
  payload: unknown;
  updatedByUserId: string;
}) {
  const now = new Date();
  try {
    await db
      .insert(documentationOverrides)
      .values({
        audience: input.audience,
        contentKind: input.contentKind,
        pageId: input.pageId,
        payload: input.payload,
        updatedByUserId: input.updatedByUserId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          documentationOverrides.audience,
          documentationOverrides.contentKind,
          documentationOverrides.pageId,
        ],
        set: {
          payload: input.payload,
          updatedByUserId: input.updatedByUserId,
          updatedAt: now,
        },
      });
  } catch (error) {
    if (isMissingDocumentationOverridesTableError(error)) {
      throw new Error(
        "Documentation overrides table is missing. Run: npm run db:ensure-documentation-overrides",
      );
    }
    throw error;
  }
}

export async function deleteDocumentationOverride(input: {
  audience: DocumentationAudience;
  contentKind: DocumentationContentKind;
  pageId: string;
}) {
  try {
    await db
      .delete(documentationOverrides)
      .where(
        and(
          eq(documentationOverrides.audience, input.audience),
          eq(documentationOverrides.contentKind, input.contentKind),
          eq(documentationOverrides.pageId, input.pageId),
        ),
      );
  } catch (error) {
    if (isMissingDocumentationOverridesTableError(error)) {
      throw new Error(
        "Documentation overrides table is missing. Run: npm run db:ensure-documentation-overrides",
      );
    }
    throw error;
  }
}
