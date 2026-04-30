import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getAccessContext } from "@/lib/access";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getCardsByDeckUnscoped } from "@/db/queries/cards";
import { canEditDeckContent, getDeckWithViewerAccess } from "@/lib/team-deck-access";
import {
  buildResolvedTeamWorkspaceQueryString,
  resolveTeamWorkspaceFromSearchParams,
} from "@/lib/resolve-team-workspace-url";
import { withTeamWorkspaceQuery } from "@/lib/team-workspace-url";
import { AddCardDialog } from "./add-card-dialog";
import { EditDeckDialog } from "./edit-deck-dialog";
import { DeleteAllCardsDialog } from "./delete-all-cards-dialog";
import { StudyLink } from "./study-link";
import { GenerateCardsButton } from "./generate-cards-button";
import { CardGrid } from "./card-grid";
import { getCardsPerDeckLimit } from "@/lib/deck-limits";
import { getTeamDeckContext } from "@/lib/deck-team-heading";
import { CARDS_VIEW_COOKIE, resolveViewMode } from "@/lib/view-mode";
import { getGradientBySlug } from "@/lib/deck-gradients";
import { cn } from "@/lib/utils";

interface DeckPageProps {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DeckPage({ params, searchParams }: DeckPageProps) {
  const { userId, hasAI, has75CardsPerDeck } = await getAccessContext();
  if (!userId) redirect("/");

  const { deckId } = await params;
  const id = Number(deckId);
  if (isNaN(id)) notFound();

  const sp = await searchParams;
  const teamWorkspaceUrl = await resolveTeamWorkspaceFromSearchParams(userId, sp);
  const workspaceQs =
    teamWorkspaceUrl != null
      ? await buildResolvedTeamWorkspaceQueryString(userId, teamWorkspaceUrl)
      : "";

  const bundle = await getDeckWithViewerAccess(id, userId);
  if (!bundle) notFound();
  if (!canEditDeckContent(bundle.access)) {
    const studyPath = `/decks/${id}/study`;
    redirect(
      workspaceQs ? withTeamWorkspaceQuery(studyPath, workspaceQs) : studyPath,
    );
  }

  const deck = bundle.deck;
  const { heading: teamDeckHeading, teamTierPro } = await getTeamDeckContext(deck);
  const fromTeamWorkspaceUrl =
    teamWorkspaceUrl != null &&
    deck.teamId != null &&
    deck.teamId === teamWorkspaceUrl.teamId;
  const dashboardHref =
    fromTeamWorkspaceUrl && workspaceQs
      ? `/dashboard?${workspaceQs}`
      : "/dashboard";
  const cards = await getCardsByDeckUnscoped(id);
  const cookieStore = await cookies();
  const initialView = resolveViewMode(cookieStore.get(CARDS_VIEW_COOKIE)?.value);

  const aiGeneratedCount = cards.filter((c) => c.aiGenerated).length;
  const effective75 = has75CardsPerDeck || teamTierPro;
  const effectiveAI = hasAI || teamTierPro;
  const isFreePlan = !effective75;
  const deckCardLimit = getCardsPerDeckLimit(effective75);
  const isAtCardLimit = cards.length >= deckCardLimit;

  const deckGradient = getGradientBySlug(deck.gradient);
  const hasGradient = deckGradient.slug !== "none";

  return (
    <div className={cn("flex flex-1 flex-col gap-4 sm:gap-8 p-4 sm:p-8", deckGradient.classes)}>
      {/* Deck section */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-1">
            <Link
              href={dashboardHref}
              className={cn(
                "inline-flex items-center gap-1.5 text-sm transition-colors",
                hasGradient
                  ? "text-white/70 hover:text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            {teamDeckHeading && (
              <div className="mt-1 space-y-0.5">
                <p className={cn("text-sm", hasGradient ? "text-white/70" : "text-muted-foreground")}>
                  Team:{" "}
                  <span className={cn("font-medium", hasGradient ? "text-white" : "text-foreground")}>
                    {teamDeckHeading.teamName}
                  </span>
                </p>
                <p className={cn("text-xs sm:text-sm", hasGradient ? "text-white/70" : "text-muted-foreground")}>
                  Owner:{" "}
                  <span className={hasGradient ? "text-white/90" : "text-foreground/90"}>
                    {teamDeckHeading.ownerDisplayName}
                  </span>
                </p>
              </div>
            )}
            <h1 className={cn("text-2xl sm:text-3xl font-bold tracking-tight break-words", hasGradient && "text-white")}>
              {deck.name}
            </h1>
            {deck.description && (
              <p className={cn("mt-1 text-sm sm:text-base", hasGradient ? "text-white/80" : "text-muted-foreground")}>
                {deck.description}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:gap-3 lg:items-end">
            <GenerateCardsButton
              deckId={id}
              hasDescription={!!deck.description}
              totalCardCount={cards.length}
              aiGeneratedCount={aiGeneratedCount}
              hasAI={effectiveAI}
              has75CardsPerDeck={effective75}
            />
            <div className="flex flex-wrap gap-2">
              <EditDeckDialog deck={deck} />
              {cards.length > 0 && (
                <DeleteAllCardsDialog deckId={id} cardCount={cards.length} />
              )}
              {cards.length > 0 ? (
                <StudyLink
                  deckId={id}
                  workspaceQueryString={
                    fromTeamWorkspaceUrl ? workspaceQs : undefined
                  }
                />
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger render={<span tabIndex={0} className="cursor-not-allowed" />}>
                      <Button
                        size="default"
                        className="gap-2 pointer-events-none"
                        disabled
                        aria-disabled
                      >
                        <BookOpen className="h-4 w-4" />
                        Start Studying
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Add at least one card to start a study session.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </div>
        <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs", hasGradient ? "text-white/70" : "text-muted-foreground")}>
          <span className={cn("font-medium tabular-nums", hasGradient ? "text-white" : "text-foreground")}>
            {cards.length} / {deckCardLimit} cards
            <span className={cn("font-normal", hasGradient ? "text-white/70" : "text-muted-foreground")}>
              {" "}
              ({isFreePlan ? "Free plan" : "Pro plan"})
            </span>
          </span>
          <span aria-hidden className="select-none">·</span>
          <span>
            Last updated{" "}
            {deck.updatedAt.toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
        {isAtCardLimit && (
          <p className={cn("text-xs", hasGradient ? "text-rose-200 font-medium" : "text-destructive")}>
            {isFreePlan ? (
              <>
                Card limit reached for this deck ({deckCardLimit} max on Free).{" "}
                <Link href="/pricing" className={cn("underline underline-offset-3", hasGradient && "text-white")}>
                  Upgrade to Pro
                </Link>{" "}
                for up to {getCardsPerDeckLimit(true)} cards per deck.
              </>
            ) : (
              <>
                Card limit reached for this deck ({deckCardLimit} max on Pro). Delete cards to add
                more.
              </>
            )}
          </p>
        )}
      </div>

      {/* Cards section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className={cn("text-base sm:text-lg font-semibold", hasGradient && "text-white")}>Cards</h2>
          <AddCardDialog
            deckId={id}
            isAtLimit={isAtCardLimit}
            hasAI={effectiveAI}
            allowsMultipleChoiceFormat={effective75}
          />
        </div>

        {cards.length === 0 ? (
          <div className={cn(
            "flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-14 sm:py-24 text-center px-4",
            hasGradient && "border-white/30",
          )}>
            <div className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full",
              hasGradient ? "bg-white/20" : "bg-muted/60",
            )}>
              <BookOpen className={cn("h-7 w-7", hasGradient ? "text-white/80" : "text-muted-foreground")} />
            </div>
            <div className="space-y-1">
              <p className={cn("font-medium text-sm", hasGradient ? "text-white" : "text-foreground")}>No cards yet</p>
              <p className={cn("text-xs max-w-xs", hasGradient ? "text-white/70" : "text-muted-foreground")}>
                Add your first card to start building this deck.
              </p>
            </div>
            <AddCardDialog
              deckId={id}
              isAtLimit={isAtCardLimit}
              hasAI={effectiveAI}
              allowsMultipleChoiceFormat={effective75}
              trigger={<Button>Add your first card</Button>}
            />
          </div>
        ) : (
          <CardGrid cards={cards} deckId={id} hasAI={effectiveAI} initialView={initialView} />
        )}
      </div>
    </div>
  );
}
