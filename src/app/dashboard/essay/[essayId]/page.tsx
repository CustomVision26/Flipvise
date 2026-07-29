import { notFound } from "next/navigation";
import { requireEssayAddonAccess } from "@/lib/essay-access";
import {
  getEssayDocumentByIdForUser,
  getEssayDraftForUser,
  getLatestEssayFeedbackForDraft,
} from "@/db/queries/essays";
import { getTeamsForTeamDashboard, listTeamMembers } from "@/db/queries/teams";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";
import { EssayWritingWorkspace } from "@/components/essay-writing-workspace";

export default async function EssayDetailPage({
  params,
}: {
  params: Promise<{ essayId: string }>;
}) {
  const access = await requireEssayAddonAccess("page");
  const { essayId: raw } = await params;
  const essayId = Number(raw);
  if (!Number.isFinite(essayId) || essayId <= 0) notFound();

  const doc = await getEssayDocumentByIdForUser(essayId, access.userId);
  if (!doc) notFound();

  const draft = await getEssayDraftForUser(essayId, access.userId);
  const feedback = draft
    ? await getLatestEssayFeedbackForDraft(draft.id, access.userId)
    : null;

  const isOwner = doc.userId === access.userId;
  let assignTeamId: number | null = null;
  let assignMembers: { userId: string; label: string }[] = [];

  if (isOwner) {
    const teams = await getTeamsForTeamDashboard(access.userId);
    const team = teams[0] ?? null;
    if (team) {
      assignTeamId = team.id;
      const members = await listTeamMembers(team.id);
      const userIds = members.map((m) => m.userId);
      const displays = await getClerkUserFieldDisplaysByIds(userIds);
      assignMembers = members.map((m) => ({
        userId: m.userId,
        label: displays[m.userId]?.primaryLine ?? m.userId,
      }));
    }
  }

  return (
    <EssayWritingWorkspace
      documentId={doc.id}
      userId={access.userId}
      title={doc.title}
      prompt={doc.result.prompt}
      result={doc.result}
      wordCountTarget={doc.wordCountTarget}
      timeLimitMinutes={doc.timeLimitMinutes}
      initialBody={draft?.body ?? ""}
      initialStatus={draft?.status === "submitted" ? "submitted" : "draft"}
      isOwner={isOwner}
      modelEssayRevealed={doc.modelEssayRevealed}
      initialFeedback={feedback?.result ?? null}
      assignTeamId={assignTeamId}
      assignMembers={assignMembers}
    />
  );
}
