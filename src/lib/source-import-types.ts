import { z } from "zod";

export const importedCardPreviewSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
  distractors: z.array(z.string().min(1)).length(3),
});

export type ImportedCardPreview = z.infer<typeof importedCardPreviewSchema>;

export type GenerateCardsFromSourceResult =
  | { status: "ok"; cards: ImportedCardPreview[] }
  | { status: "relevance_warning"; warning: string };
