import Link from "next/link";
import { requireEssayAddonAccess } from "@/lib/essay-access";
import {
  listRecentEssayDocumentsForUser,
  listEssayDraftsForUser,
  listRecentEssayFeedbackForUser,
} from "@/db/queries/essays";
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

export default async function EssayOverviewPage() {
  const access = await requireEssayAddonAccess("page");
  const userId = access.userId;

  const [recent, drafts, feedback] = await Promise.all([
    listRecentEssayDocumentsForUser(userId, 5),
    listEssayDraftsForUser(userId),
    listRecentEssayFeedbackForUser(userId, 5),
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

      <Card>
        <CardHeader>
          <CardTitle>Recent Essays</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {recent.length === 0 ? (
            <p className="text-muted-foreground">No essays yet.</p>
          ) : (
            recent.map((doc) => (
              <Link
                key={doc.id}
                href={`/dashboard/ai-doc-studio/ai-essay/${doc.id}`}
                className="block rounded-md border border-border/60 px-3 py-2 hover:bg-muted/40"
              >
                <span className="font-medium">{doc.title}</span>
                <span className="ml-2 text-muted-foreground">{doc.subject}</span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent AI Feedback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {feedback.length === 0 ? (
            <p className="text-muted-foreground">No feedback yet.</p>
          ) : (
            feedback.map((fb) => (
              <Link
                key={fb.id}
                href={`/dashboard/ai-doc-studio/ai-essay/${fb.documentId}`}
                className="block rounded-md border border-border/60 px-3 py-2 hover:bg-muted/40"
              >
                Score {fb.result.overallScore}/100
                <span className="ml-2 text-muted-foreground">
                  {fb.result.strengths[0] ?? "View feedback"}
                </span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
