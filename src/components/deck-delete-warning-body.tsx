"use client";

import { Loader2 } from "lucide-react";
import {
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import type { DeckDeleteImpact } from "@/db/queries/deck-delete-impact";
import {
  buildDeckDeleteBrokenLinkItems,
  buildDeckDeletePermanentLossItems,
} from "@/lib/deck-delete-warning-copy";

type DeckDeleteWarningBodyProps = {
  deckName: string;
  /** Education / teacher-tools surfaces always use the detailed list. */
  forceDetailed: boolean;
  impact: DeckDeleteImpact | null;
  impactLoading: boolean;
};

export function DeckDeleteWarningBody({
  deckName,
  forceDetailed,
  impact,
  impactLoading,
}: DeckDeleteWarningBodyProps) {
  const showDetailed =
    forceDetailed ||
    (impact != null &&
      (impact.teamAssignmentCount > 0 ||
        impact.workspaceLinkCount > 0 ||
        impact.linkedLessonPlanCount > 0 ||
        impact.linkedHomeworkCount > 0 ||
        impact.linkedWorksheetCount > 0 ||
        impact.teacherClassCount > 0 ||
        impact.cardMasteryCount > 0 ||
        impact.quizCardOrderCount > 0 ||
        impact.quizResultCount > 0 ||
        impact.aiRecallSessionCount > 0 ||
        impact.hasCoverImage ||
        impact.hasCardImages));

  if (!showDetailed && !impactLoading) {
    return (
      <AlertDialogDescription className="text-xs sm:text-sm">
        This will permanently delete the deck and all of its cards. This action
        cannot be undone.
      </AlertDialogDescription>
    );
  }

  const permanentItems = impact
    ? buildDeckDeletePermanentLossItems(impact)
    : [`The deck “${deckName}” and all of its flashcards`];
  const brokenLinkItems = impact ? buildDeckDeleteBrokenLinkItems(impact) : [];

  return (
    <div className="space-y-3 text-xs sm:text-sm text-muted-foreground">
      <AlertDialogDescription>
        This will permanently delete &ldquo;{deckName}&rdquo;. This action cannot
        be undone. Everything listed below will be lost or become unusable:
      </AlertDialogDescription>
      {impactLoading ? (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin shrink-0" aria-hidden />
          Checking linked resources…
        </p>
      ) : (
        <>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            {permanentItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {brokenLinkItems.length > 0 ? (
            <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
              {brokenLinkItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}
