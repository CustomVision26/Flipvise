import { z } from "zod";
import {
  docArticlePayloadSchema,
  docPagePayloadSchema,
  pageAdditionPayloadSchema,
  sectionAdditionPayloadSchema,
  sectionMetadataPayloadSchema,
} from "@/lib/documentation-payload-schemas";

const audienceSchema = z.enum(["user", "admin"]);

export const documentationAgentOperationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("update_page"),
    audience: audienceSchema,
    pageId: z.string().min(1),
    page: docPagePayloadSchema,
  }),
  z.object({
    op: z.literal("update_article"),
    audience: audienceSchema,
    pageId: z.string().min(1),
    article: docArticlePayloadSchema,
  }),
  z.object({
    op: z.literal("add_page"),
    audience: audienceSchema,
    addition: pageAdditionPayloadSchema,
    article: docArticlePayloadSchema.optional(),
  }),
  z.object({
    op: z.literal("remove_page"),
    audience: audienceSchema,
    pageId: z.string().min(1),
    reason: z.string().optional(),
  }),
  z.object({
    op: z.literal("update_section"),
    audience: audienceSchema,
    section: sectionMetadataPayloadSchema,
  }),
  z.object({
    op: z.literal("add_section"),
    audience: audienceSchema,
    addition: sectionAdditionPayloadSchema,
    articles: z.array(docArticlePayloadSchema).optional(),
  }),
]);

export const documentationAgentResultSchema = z.object({
  summary: z.string().min(1),
  operations: z.array(documentationAgentOperationSchema),
});

export type DocumentationAgentOperation = z.infer<typeof documentationAgentOperationSchema>;
export type DocumentationAgentResult = z.infer<typeof documentationAgentResultSchema>;

export function describeAgentOperation(operation: DocumentationAgentOperation): string {
  switch (operation.op) {
    case "update_page":
      return `${operation.audience}: Update quick reference "${operation.page.title}" (${operation.pageId})`;
    case "update_article":
      return `${operation.audience}: Update in-depth guide "${operation.article.title}" (${operation.pageId})`;
    case "add_page":
      return `${operation.audience}: Add topic "${operation.addition.page.title}" to section ${operation.addition.sectionId}`;
    case "remove_page":
      return `${operation.audience}: Remove topic ${operation.pageId}`;
    case "update_section":
      return `${operation.audience}: Update section "${operation.section.title}" (${operation.section.id})`;
    case "add_section":
      return `${operation.audience}: Add section "${operation.addition.section.title}" with ${operation.addition.section.pages.length} topic(s)`;
    default:
      return "Unknown operation";
  }
}
