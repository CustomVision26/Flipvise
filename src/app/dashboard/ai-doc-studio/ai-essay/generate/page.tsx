import { requireEssayAddonAccess } from "@/lib/essay-access";
import { EssayGeneratorForm } from "@/components/essay-generator-form";
import { getEssayDocumentByIdForUser } from "@/db/queries/essays";
import { essayGeneratorPrefillFromInput } from "@/lib/essay-topic-match";
import type { EssayGenerateInput } from "@/lib/essay-ai-schema";

export default async function EssayGeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ fromEssay?: string }>;
}) {
  const access = await requireEssayAddonAccess("page");
  const { fromEssay } = await searchParams;
  const fromId = Number(fromEssay);

  let initialPrefill: Partial<EssayGenerateInput> | null = null;
  let prefillSourceTitle: string | null = null;

  if (Number.isFinite(fromId) && fromId > 0) {
    const doc = await getEssayDocumentByIdForUser(fromId, access.userId);
    if (doc) {
      prefillSourceTitle = doc.title;
      initialPrefill = essayGeneratorPrefillFromInput(
        doc.input as EssayGenerateInput,
        { title: doc.title },
      );
    }
  }

  return (
    <EssayGeneratorForm
      initialPrefill={initialPrefill}
      prefillSourceTitle={prefillSourceTitle}
    />
  );
}
