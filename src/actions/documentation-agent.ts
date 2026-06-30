"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/clerk-auth";
import { createClerkClient } from "@clerk/backend";
import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  upsertDocumentationOverride,
  type DocumentationAudience,
} from "@/db/queries/documentation-overrides";
import {
  getEffectiveAdminDocumentationContent,
  getEffectiveUserDocumentationContent,
} from "@/lib/documentation-effective-content";
import {
  buildDocumentationAgentContext,
  serializeDocumentationForAgent,
} from "@/lib/documentation-agent-context";
import {
  documentationAgentOperationSchema,
  documentationAgentResultSchema,
  type DocumentationAgentOperation,
  type DocumentationAgentResult,
} from "@/lib/documentation-agent-schemas";
import { uploadDocumentationAgentImageToS3 } from "@/lib/s3";
import { isClerkPlatformAdminRole } from "@/lib/clerk-platform-admin-role";
import { isPlatformSuperadminAllowListed } from "@/lib/platform-superadmin";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

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

function revalidateDocumentationPaths() {
  revalidatePath("/docs");
  revalidatePath("/admin/documentation");
}

const runAgentSchema = z.object({
  instruction: z.string().min(1).max(8000),
  updateAdmin: z.boolean(),
  updateUser: z.boolean(),
  imageUrls: z.array(z.string().url()).max(6),
});

const applyOperationsSchema = z.object({
  operations: z.array(documentationAgentOperationSchema).min(1),
});

const AGENT_SYSTEM_PROMPT = `You are Flipvise's documentation agent for platform administrators.

You update Flipvise product documentation by returning a structured plan of operations.

Audiences:
- "user" = customer-facing guide at /docs
- "admin" = platform administrator guide at /admin/documentation

Allowed operations:
- update_page: revise an existing quick-reference page (purpose, howItWorks, requirements, doNots)
- update_article: revise an existing in-depth guide (intro, sections with step-by-step detail)
- add_page: add a new topic under an existing section (use kebab-case page id, unique across that audience)
- add_section: add a new section with one or more new topics
- remove_page: hide an outdated topic from the guide
- update_section: change section title/description only

Rules:
- Follow the administrator's instruction precisely (add, remove, update, or expand explanations).
- When UI screenshots are attached, use visible labels, buttons, fields, and layout to write accurate step-by-step instructions.
- Do not invent features, routes, plan limits, or admin capabilities that are not supported by the instruction, screenshots, or current documentation.
- Prefer updating existing topics over creating duplicates.
- For new page ids use lowercase kebab-case (e.g. "from-source-distractors").
- Keep quick-reference lists practical; put detailed walkthroughs in in-depth article sections.
- For add_page / add_section, include an in-depth article when the instruction asks for step-by-step help.
- howItWorks, requirements, and doNots must each contain at least one non-empty string.
- Article sections need stable kebab-case ids. Use paragraphs and/or bullets; tables only when helpful.
- Return an empty operations array only if the instruction cannot be applied without inventing facts — explain why in summary.`;

export async function uploadDocumentationAgentImageAction(
  formData: FormData,
): Promise<{ url: string }> {
  const { userId } = await requireAdmin();
  const file = formData.get("image");
  if (!(file instanceof File)) throw new Error("No image file provided");
  if (!IMAGE_TYPES.includes(file.type as (typeof IMAGE_TYPES)[number])) {
    throw new Error("Only JPEG, PNG, WebP, and GIF images are allowed");
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new Error("Image must be smaller than 10 MB");
  }
  const url = await uploadDocumentationAgentImageToS3({ userId, file });
  return { url };
}

export async function runDocumentationAgentAction(
  data: z.infer<typeof runAgentSchema>,
): Promise<DocumentationAgentResult> {
  await requireAdmin();
  const parsed = runAgentSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");
  if (!parsed.data.updateAdmin && !parsed.data.updateUser) {
    throw new Error("Select at least one documentation audience.");
  }

  const { instruction, updateAdmin, updateUser, imageUrls } = parsed.data;
  const contextBlocks: string[] = [];

  if (updateUser) {
    const userContent = await getEffectiveUserDocumentationContent();
    const context = buildDocumentationAgentContext("user", userContent);
    contextBlocks.push(
      `USER DOCUMENTATION (audience "user"):\n${serializeDocumentationForAgent(context)}`,
    );
  }

  if (updateAdmin) {
    const adminContent = await getEffectiveAdminDocumentationContent();
    const context = buildDocumentationAgentContext("admin", adminContent);
    contextBlocks.push(
      `ADMIN DOCUMENTATION (audience "admin"):\n${serializeDocumentationForAgent(context)}`,
    );
  }

  const textPrompt = `${AGENT_SYSTEM_PROMPT}

Administrator instruction:
${instruction}

Current documentation JSON:
${contextBlocks.join("\n\n")}

Return a summary of what you will change and the list of operations to apply.`;

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: string }
  > = [{ type: "text", text: textPrompt }];

  for (const url of imageUrls) {
    userContent.push({ type: "image", image: url });
  }

  const { output } = await generateText({
    model: openai("gpt-4o"),
    output: Output.object({ schema: documentationAgentResultSchema }),
    messages: [
      {
        role: "user",
        content: userContent,
      },
    ],
  });

  if (!output) {
    throw new Error("Documentation agent failed. Please try again.");
  }

  return output;
}

async function applyOperation(
  operation: DocumentationAgentOperation,
  updatedByUserId: string,
) {
  switch (operation.op) {
    case "update_page":
      await upsertDocumentationOverride({
        audience: operation.audience,
        contentKind: "quick_reference_page",
        pageId: operation.pageId,
        payload: operation.page,
        updatedByUserId,
      });
      return;
    case "update_article":
      await upsertDocumentationOverride({
        audience: operation.audience,
        contentKind: "in_depth_article",
        pageId: operation.pageId,
        payload: operation.article,
        updatedByUserId,
      });
      return;
    case "add_page":
      await upsertDocumentationOverride({
        audience: operation.audience,
        contentKind: "page_addition",
        pageId: operation.addition.page.id,
        payload: operation.addition,
        updatedByUserId,
      });
      if (operation.article) {
        await upsertDocumentationOverride({
          audience: operation.audience,
          contentKind: "in_depth_article",
          pageId: operation.addition.page.id,
          payload: operation.article,
          updatedByUserId,
        });
      }
      return;
    case "remove_page":
      await upsertDocumentationOverride({
        audience: operation.audience,
        contentKind: "page_removal",
        pageId: operation.pageId,
        payload: { reason: operation.reason },
        updatedByUserId,
      });
      return;
    case "update_section":
      await upsertDocumentationOverride({
        audience: operation.audience,
        contentKind: "section_metadata",
        pageId: operation.section.id,
        payload: operation.section,
        updatedByUserId,
      });
      return;
    case "add_section": {
      await upsertDocumentationOverride({
        audience: operation.audience,
        contentKind: "section_addition",
        pageId: operation.addition.section.id,
        payload: operation.addition,
        updatedByUserId,
      });
      for (const page of operation.addition.section.pages) {
        await upsertDocumentationOverride({
          audience: operation.audience,
          contentKind: "page_addition",
          pageId: page.id,
          payload: {
            sectionId: operation.addition.section.id,
            page,
          },
          updatedByUserId,
        });
      }
      if (operation.articles) {
        for (const article of operation.articles) {
          await upsertDocumentationOverride({
            audience: operation.audience,
            contentKind: "in_depth_article",
            pageId: article.pageId,
            payload: article,
            updatedByUserId,
          });
        }
      }
      return;
    }
    default:
      return;
  }
}

export async function applyDocumentationAgentOperationsAction(
  data: z.infer<typeof applyOperationsSchema>,
): Promise<{ appliedCount: number }> {
  const { userId } = await requireAdmin();
  const parsed = applyOperationsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const operations = parsed.data.operations;

  for (const operation of operations) {
    await applyOperation(operation, userId);
  }

  revalidateDocumentationPaths();
  return { appliedCount: operations.length };
}
