import Link from "next/link";
import { requireEssayAddonAccess } from "@/lib/essay-access";
import {
  countEssayDocumentsForUser,
  countEssayFeedbackForUser,
  listRecentEssayDocumentsForUser,
  listEssayDraftsForUser,
  listRecentEssayFeedbackForUser,
} from "@/db/queries/essays";
import { EssayOverviewRecentPanels } from "@/components/essay-overview-recent-panels";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { toClientJson } from "@/lib/to-client-json";

export default async function EssayOverviewPage() {
  const access = await requireEssayAddonAccess("page");
  const userId = access.userId;

  const [recent, drafts, feedback, essayCount, feedbackCount] =
    await Promise.all([
      listRecentEssayDocumentsForUser(userId, 5),
      listEssayDraftsForUser(userId),
      listRecentEssayFeedbackForUser(userId, 5),
      countEssayDocumentsForUser(userId),
      countEssayFeedbackForUser(userId),
    ]);

  const continueDraft = drafts[0] ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Essay Generator</CardTitle>
          <CardDescription>
            AI Document Studio — generate activities, write, and get AI
            feedback.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/ai-doc-studio/ai-essay/generate"
            className={cn(buttonVariants())}
          >
            Open Essay Generator
          </Link>
          {continueDraft ? (
            <Link
              href={`/dashboard/ai-doc-studio/ai-essay/${continueDraft.documentId}`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Continue Draft
            </Link>
          ) : (
            <Button variant="outline" disabled>
              Continue Draft
            </Button>
          )}
        </CardContent>
      </Card>

      <EssayOverviewRecentPanels
        recentEssays={toClientJson(
          recent.map((doc) => ({
            id: doc.id,
            title: doc.title,
            subject: doc.subject,
            updatedAt: doc.updatedAt,
          })),
        )}
        essayCount={essayCount}
        recentFeedback={toClientJson(
          feedback.map((fb) => ({
            id: fb.id,
            documentId: fb.documentId,
            createdAt: fb.createdAt,
            result: {
              overallScore: fb.result.overallScore,
              strengths: fb.result.strengths ?? [],
            },
          })),
        )}
        feedbackCount={feedbackCount}
      />
    </div>
  );
}
