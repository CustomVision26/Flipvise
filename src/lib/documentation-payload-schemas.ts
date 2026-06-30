import { z } from "zod";

const docArticleSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  paragraphs: z.array(z.string()).optional(),
  bullets: z.array(z.string()).optional(),
  table: z
    .object({
      headers: z.array(z.string()),
      rows: z.array(z.array(z.string())),
    })
    .optional(),
});

export const docPagePayloadSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  route: z.string().optional(),
  clerkTab: z.string().optional(),
  purpose: z.string().min(1),
  howItWorks: z.array(z.string().min(1)).min(1),
  requirements: z.array(z.string().min(1)).min(1),
  doNots: z.array(z.string().min(1)).min(1),
});

export const docArticlePayloadSchema = z.object({
  pageId: z.string().min(1),
  title: z.string().min(1),
  intro: z.string().min(1),
  sections: z.array(docArticleSectionSchema).min(1),
});

export const pageAdditionPayloadSchema = z.object({
  sectionId: z.string().min(1),
  page: docPagePayloadSchema,
  insertAfterPageId: z.string().optional(),
});

export const sectionAdditionPayloadSchema = z.object({
  section: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    pages: z.array(docPagePayloadSchema).min(1),
  }),
});

export const sectionMetadataPayloadSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
});

export const pageRemovalPayloadSchema = z.object({
  reason: z.string().optional(),
});

export type DocPagePayload = z.infer<typeof docPagePayloadSchema>;
export type DocArticlePayload = z.infer<typeof docArticlePayloadSchema>;
export type PageAdditionPayload = z.infer<typeof pageAdditionPayloadSchema>;
export type SectionAdditionPayload = z.infer<typeof sectionAdditionPayloadSchema>;
export type SectionMetadataPayload = z.infer<typeof sectionMetadataPayloadSchema>;
