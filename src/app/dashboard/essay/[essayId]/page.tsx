import { notFound } from "next/navigation";
import { requireEssayAddonAccess } from "@/lib/essay-access";
import {
  getEssayDocumentByIdForUser,
  getEssayDraftForUser,
  getLatestEssayFeedbackForDraft,
  reopenEssayDraftForEdit,
} from "@/db/queries/essays";
import {
  joinSectionsContent,
  normalizeEssayGenerationResult,
  resolveEssaySectionsContent,
} from "@/lib/essay-result-normalize";
import { normalizeDocumentStudioMeta } from "@/lib/document-generation-studio";
import { EssayWritingWorkspace } from "@/components/essay-writing-workspace";
import { toClientJson } from "@/lib/to-client-json";

export default async function EssayDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ essayId: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const access = await requireEssayAddonAccess("page");
  const { essayId: raw } = await params;
  const { edit } = await searchParams;
  const editMode = edit === "1" || edit === "true";
  const essayId = Number(raw);
  if (!Number.isFinite(essayId) || essayId <= 0) notFound();

  const doc = await getEssayDocumentByIdForUser(essayId, access.userId);
  if (!doc) notFound();

  let draft = await getEssayDraftForUser(essayId, access.userId);
  const wasSubmitted = draft?.status === "submitted";
  if (editMode) {
    // Reopen for editing without re-seeding from the model essay.
    draft = await reopenEssayDraftForEdit({
      documentId: doc.id,
      userId: access.userId,
    });
  }

  const feedback = draft
    ? await getLatestEssayFeedbackForDraft(draft.id, access.userId)
    : null;

  const isOwner = doc.userId === access.userId;
  const result = normalizeEssayGenerationResult(doc.result);
  const documentStudio = normalizeDocumentStudioMeta(
    (doc.input as { documentStudio?: unknown } | null)?.documentStudio,
    (doc.input as {
      citationStyle?: "none" | "apa" | "mla" | "chicago" | "harvard";
    } | null)?.citationStyle ?? "none",
  );
  const sectionsContent = resolveEssaySectionsContent(
    result.sections,
    (draft?.sectionsContent as Record<string, string> | null | undefined) ?? {},
    draft?.body ?? "",
    {
      redistributeCollapsed: true,
      // Never seed the writing workspace from the model essay.
      fallbackText: null,
    },
  );

  return (
    <EssayWritingWorkspace
      documentId={doc.id}
      userId={access.userId}
      title={doc.title}
      prompt={result.prompt}
      result={toClientJson(result)}
      documentStudio={toClientJson(documentStudio)}
      wordCountTarget={doc.wordCountTarget}
      timeLimitMinutes={doc.timeLimitMinutes}
      initialBody={draft?.body ?? joinSectionsContent(result.sections, sectionsContent)}
      initialSectionsContent={toClientJson(sectionsContent)}
      initialStatus={editMode ? "draft" : wasSubmitted ? "submitted" : "draft"}
      hasBeenSubmittedOnce={wasSubmitted}
      forceSectionsTab={editMode}
      isOwner={isOwner}
      modelEssayRevealed={doc.modelEssayRevealed}
      initialFeedback={feedback?.result ?? null}
    />
  );
}
