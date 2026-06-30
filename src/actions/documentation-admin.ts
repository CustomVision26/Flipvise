"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/clerk-auth";
import { createClerkClient } from "@clerk/backend";
import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  deleteDocumentationOverride,
  upsertDocumentationOverride,
  type DocumentationAudience,
  type DocumentationContentKind,
} from "@/db/queries/documentation-overrides";
import {
  getEffectiveAdminDocumentationContent,
  getEffectiveUserDocumentationContent,
  type EffectiveDocumentationContent,
} from "@/lib/documentation-effective-content";
import {
  docArticlePayloadSchema,
  docPagePayloadSchema,
} from "@/lib/documentation-payload-schemas";
import { isClerkPlatformAdminRole } from "@/lib/clerk-platform-admin-role";
import { isPlatformSuperadminAllowListed } from "@/lib/platform-superadmin";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const caller = await clerkClient.users.getUser(userId);
  const role = (caller.publicMetadata as { role?: string })?.role;
  if (!isClerkPlatformAdminRole(role) && !isPlatformSuperadminAllowListed(userId)) {
    throw new Error("Forbidden");
  }
  return { userId };
}

const audienceSchema = z.enum(["user", "admin"]);
const contentKindSchema = z.enum([
  "quick_reference_page",
  "in_depth_article",
  "page_addition",
  "page_removal",
  "section_addition",
  "section_metadata",
]);

const getContentSchema = z.object({
  audience: audienceSchema,
});

const saveOverrideSchema = z.object({
  audience: audienceSchema,
  contentKind: contentKindSchema,
  pageId: z.string().min(1),
  payload: z.unknown(),
});

const clearOverrideSchema = z.object({
  audience: audienceSchema,
  contentKind: contentKindSchema,
  pageId: z.string().min(1),
});

const aiImproveSchema = z.object({
  audience: audienceSchema,
  contentKind: contentKindSchema,
  instruction: z.string().min(1).max(2000),
  payload: z.union([docPagePayloadSchema, docArticlePayloadSchema]),
});

function revalidateDocumentationPaths() {
  revalidatePath("/docs");
  revalidatePath("/admin/documentation");
}

async function loadEffectiveContent(
  audience: DocumentationAudience,
): Promise<EffectiveDocumentationContent> {
  return audience === "user"
    ? getEffectiveUserDocumentationContent()
    : getEffectiveAdminDocumentationContent();
}

export async function getDocumentationContentAction(
  data: z.infer<typeof getContentSchema>,
): Promise<EffectiveDocumentationContent> {
  await requireAdmin();
  const parsed = getContentSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");
  return loadEffectiveContent(parsed.data.audience);
}

export async function saveDocumentationOverrideAction(
  data: z.infer<typeof saveOverrideSchema>,
): Promise<void> {
  const { userId } = await requireAdmin();
  const parsed = saveOverrideSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { audience, contentKind, pageId, payload } = parsed.data;
  if (contentKind === "quick_reference_page") {
    const pagePayload = docPagePayloadSchema.parse(payload);
    if (pagePayload.id !== pageId) throw new Error("Page id mismatch");
  } else if (contentKind === "in_depth_article") {
    const articlePayload = docArticlePayloadSchema.parse(payload);
    if (articlePayload.pageId !== pageId) throw new Error("Article page id mismatch");
  }

  await upsertDocumentationOverride({
    audience,
    contentKind,
    pageId,
    payload,
    updatedByUserId: userId,
  });
  revalidateDocumentationPaths();
}

export async function clearDocumentationOverrideAction(
  data: z.infer<typeof clearOverrideSchema>,
): Promise<void> {
  await requireAdmin();
  const parsed = clearOverrideSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");
  await deleteDocumentationOverride(parsed.data);
  revalidateDocumentationPaths();
}

export async function aiImproveDocumentationAction(
  data: z.infer<typeof aiImproveSchema>,
): Promise<z.infer<typeof docPagePayloadSchema> | z.infer<typeof docArticlePayloadSchema>> {
  await requireAdmin();
  const parsed = aiImproveSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { audience, contentKind, instruction, payload } = parsed.data;
  const audienceLabel = audience === "user" ? "end-user" : "platform administrator";

  if (contentKind === "quick_reference_page") {
    const pagePayload = docPagePayloadSchema.parse(payload);
    const { output } = await generateText({
      model: openai("gpt-4o"),
      output: Output.object({ schema: docPagePayloadSchema }),
      system: `You improve Flipvise product documentation for ${audienceLabel}s.

Rules:
- Preserve factual accuracy — do not invent features, routes, or plan limits.
- Keep the same JSON shape and required fields.
- Match the tone of existing Flipvise docs: clear, practical, scannable.
- For quick-reference pages, keep purpose / how it works / requirements / do not sections distinct.
- Do not use markdown in string fields unless the source already used it sparingly.`,
      prompt: `Instruction from the editor:
${instruction}

Current documentation JSON:
${JSON.stringify(pagePayload, null, 2)}

Return the improved documentation JSON only.`,
    });
    if (!output) throw new Error("AI improvement failed. Please try again.");
    return output;
  }

  const articlePayload = docArticlePayloadSchema.parse(payload);
  const { output } = await generateText({
    model: openai("gpt-4o"),
    output: Output.object({ schema: docArticlePayloadSchema }),
    system: `You improve Flipvise product documentation for ${audienceLabel}s.

Rules:
- Preserve factual accuracy — do not invent features, routes, or plan limits.
- Keep the same JSON shape and required fields.
- Match the tone of existing Flipvise docs: clear, practical, scannable.
- For in-depth articles, preserve section ids when possible; improve clarity and structure.
- Do not use markdown in string fields unless the source already used it sparingly.`,
    prompt: `Instruction from the editor:
${instruction}

Current documentation JSON:
${JSON.stringify(articlePayload, null, 2)}

Return the improved documentation JSON only.`,
  });

  if (!output) {
    throw new Error("AI improvement failed. Please try again.");
  }

  return output;
}
