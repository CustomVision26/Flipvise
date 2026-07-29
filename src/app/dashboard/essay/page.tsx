import Link from "next/link";
import { getAccessContext, canAccessAddon } from "@/lib/access";
import { AI_ESSAY_ADDON_KEY } from "@/lib/addon-keys";
import {
  getAddonCatalogByKey,
  isPlanEligibleForAddon,
} from "@/db/queries/addons";
import {
  listEssayAssignmentsForUser,
  listRecentEssayDocumentsForUser,
  listEssayDraftsForUser,
  listRecentEssayFeedbackForUser,
} from "@/db/queries/essays";
import { resolveStripeAddonPriceIdFromEnvKey } from "@/lib/stripe-addon-price-env";
import { DashboardAiEssayCard } from "@/components/dashboard-ai-essay-card";
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
  const access = await getAccessContext();
  const unlocked = canAccessAddon(access, AI_ESSAY_ADDON_KEY);
  const catalog = await getAddonCatalogByKey(AI_ESSAY_ADDON_KEY);
  const canPurchase =
    !!access.userId &&
    !!catalog?.active &&
    isPlanEligibleForAddon(catalog.eligiblePlanIds, access.effectivePlanSlug) &&
    !!resolveStripeAddonPriceIdFromEnvKey(catalog.stripePriceEnvKey);

  if (!unlocked) {
    return (
      <div className="max-w-lg">
        <DashboardAiEssayCard
          unlocked={false}
          canPurchase={canPurchase}
          signedIn={!!access.userId}
        />
      </div>
    );
  }

  const userId = access.userId!;
  const [recent, drafts, assignments, feedback] = await Promise.all([
    listRecentEssayDocumentsForUser(userId, 5),
    listEssayDraftsForUser(userId),
    listEssayAssignmentsForUser(userId),
    listRecentEssayFeedbackForUser(userId, 5),
  ]);

  const continueDraft = drafts[0] ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>AI Essay</CardTitle>
          <CardDescription>Generate activities, write, and get AI feedback.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/essay/generate"
            className={cn(buttonVariants())}
          >
            Generate Essay
          </Link>
          {continueDraft ? (
            <Link
              href={`/dashboard/essay/${continueDraft.documentId}`}
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
                href={`/dashboard/essay/${doc.id}`}
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
                href={`/dashboard/essay/${fb.documentId}`}
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

      <Card>
        <CardHeader>
          <CardTitle>My Assigned Essays</CardTitle>
          <CardDescription>
            {assignments.length} assignment{assignments.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/dashboard/essay/assignments"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            View assignments
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
