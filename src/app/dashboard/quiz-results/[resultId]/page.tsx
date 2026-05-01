import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { QuizResultDetailView } from "@/components/quiz-result-detail-view";
import { getQuizResultSummaryForViewer } from "@/lib/quiz-result-summary-server";
import { buttonVariants } from "@/components/ui/button-variants";

export default async function QuizResultViewPage({
  params,
}: {
  params: Promise<{ resultId: string }>;
}) {
  const { resultId: raw } = await params;
  const resultId = Number.parseInt(raw, 10);
  if (!Number.isFinite(resultId) || resultId < 1) notFound();

  const { userId } = await auth();
  if (!userId) redirect("/");

  const summary = await getQuizResultSummaryForViewer(resultId, userId);
  if (!summary) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/inbox"
          className={buttonVariants({ variant: "ghost", size: "sm", className: "gap-2" })}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Inbox
        </Link>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Dashboard
        </Link>
      </div>

      <QuizResultDetailView variant="page" result={summary} />
    </div>
  );
}
