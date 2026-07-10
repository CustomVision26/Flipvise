import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getAccessContext } from "@/lib/access";
import { canUseAdvancedSourceImport } from "@/lib/source-import-access";
import { canUseDeckAiFeatures } from "@/lib/deck-ai-access";
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
import { isDeckLinkedToWorkspace } from "@/db/queries/teams";
import { canEditDeckContent, getDeckWithViewerAccess } from "@/lib/team-deck-access";
import {
  buildResolvedTeamWorkspaceQueryString,
  resolveTeamWorkspaceCanonicalRedirectQueryString,
  resolveTeamWorkspaceFromSearchParams,
} from "@/lib/resolve-team-workspace-url";
import { withTeamWorkspaceQuery } from "@/lib/team-workspace-url";
import { AddCardDialog } from "./add-card-dialog";
import { EditDeckDialog } from "./edit-deck-dialog";
import { DeleteAllCardsDialogLoader } from "./delete-all-cards-dialog-loader";
import { StudyLink } from "./study-link";
import { GenerateCardsButtonLoader } from "./generate-cards-button-loader";
import { CardGrid } from "./card-grid";
import {
  CARDS_PER_DECK_LIMIT_FREE,
  CARDS_PER_DECK_LIMIT_PRO_PLUS,
  resolveDeckCardCap,
} from "@/lib/deck-limits";
import { getTeamDeckContext } from "@/lib/deck-team-heading";
import { CARDS_VIEW_COOKIE, resolveViewMode } from "@/lib/view-mode";
import { getGradientBySlug } from "@/lib/deck-gradients";
import { cn } from "@/lib/utils";

interface DeckPageProps {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DeckPage({ params, searchParams }: DeckPageProps) {
  const access = await getAccessContext();
  if (!access.userId) redirect("/");
  const { userId, hasAiReading, maxCardsPerDeck } = access;

  const { deckId } = await params;
  const id = Number(deckId);
  if (isNaN(id)) notFound();

  const sp = await searchParams;
  const teamWorkspaceUrl = await resolveTeamWorkspaceFromSearchParams(userId, sp);
  if (teamWorkspaceUrl != null) {
    const canonicalQs = await resolveTeamWorkspaceCanonicalRedirectQueryString(
      userId,
      sp,
      teamWorkspaceUrl,
    );
    if (canonicalQs != null) {
      redirect(withTeamWorkspaceQuery(`/decks/${id}`, canonicalQs));
    }
  }
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
  const inWorkspaceContext =
    teamWorkspaceUrl != null &&
    ((deck.teamId != null && deck.teamId === teamWorkspaceUrl.teamId) ||
      (await isDeckLinkedToWorkspace(teamWorkspaceUrl.teamId, deck.id)));
  const fromTeamWorkspaceUrl = inWorkspaceContext;
  const dashboardHref =
    fromTeamWorkspaceUrl && workspaceQs
      ? `/dashboard?${workspaceQs}`
      : "/dashboard";
  const cards = await getCardsByDeckUnscoped(id);
  const cookieStore = await cookies();
  const initialView = resolveViewMode(cookieStore.get(CARDS_VIEW_COOKIE)?.value);

  const aiGeneratedCount = cards.filter((c) => c.aiGenerated).length;
  const deckCardLimit = resolveDeckCardCap({
    teamTierProWorkspace: teamTierPro,
    personalMaxCardsPerDeck: maxCardsPerDeck,
  });
  const paidDeckCards = deckCardLimit > CARDS_PER_DECK_LIMIT_FREE;
  const effectiveAI = canUseDeckAiFeatures(access, teamTierPro);
  const effectiveAdvancedSourceImport = canUseAdvancedSourceImport({
    hasAiReading,
    teamTierProWorkspace: teamTierPro,
  });
  const isFreePlan = !paidDeckCards;
  const isAtCardLimit = cards.length >= deckCardLimit;

  const deckGradient = getGradientBySlug(deck.gradient);
  const hasGradient = deckGradient.slug !== "none";

  return (
    <div className={cn("flex flex-1 flex-col gap-6 sm:gap-8 p-4 sm:p-8", deckGradient.classes)}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <Link
              href={dashboardHref}
              className={cn(
                "inline-flex w-fit items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] transition-colors",
                hasGradient
                  ? "text-white/60 hover:text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ArrowLeft className="size-3.5" />
              Dashboard
            </Link>

            {teamDeckHeading ? (
              <div className="space-y-1">
                <p className={cn("text-sm", hasGradient ? "text-white/70" : "text-muted-foreground")}>
                  Team workspace:{" "}
                  <span className={cn("font-medium", hasGradient ? "text-white" : "text-foreground")}>
                    {teamDeckHeading.teamName}
                  </span>
                </p>
                <p className={cn("text-xs sm:text-sm", hasGradient ? "text-white/60" : "text-muted-foreground")}>
                  Owner:{" "}
                  <span className={hasGradient ? "text-white/85" : "text-foreground/85"}>
                    {teamDeckHeading.ownerDisplayName}
                  </span>
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <h1
                className={cn(
                  "text-2xl font-semibold tracking-tight break-words sm:text-3xl",
                  hasGradient && "text-white",
                )}
              >
                {deck.name}
              </h1>
              {deck.description ? (
                <p
                  className={cn(
                    "max-w-2xl text-sm leading-relaxed sm:text-[0.9375rem]",
                    hasGradient ? "text-white/75" : "text-muted-foreground",
                  )}
                >
                  {deck.description}
                </p>
              ) : null}
            </div>

            <div
              className={cn(
                "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm",
                hasGradient ? "text-white/65" : "text-muted-foreground",
              )}
            >
              <span className={cn("font-medium tabular-nums", hasGradient ? "text-white/90" : "text-foreground")}>
                {cards.length} / {deckCardLimit} cards
              </span>
              <span aria-hidden className="select-none">
                ·
              </span>
              <span>{isFreePlan ? "Free plan" : "Paid plan"}</span>
              <span aria-hidden className="select-none">
                ·
              </span>
              <span>
                Updated{" "}
                {deck.updatedAt.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>

          <div
            className={cn(
              "w-full shrink-0 space-y-3 rounded-xl border p-4 sm:p-5 lg:max-w-md",
              hasGradient
                ? "border-white/15 bg-black/20 backdrop-blur-sm"
                : "border-border/80 bg-card/50",
            )}
          >
            <GenerateCardsButtonLoader
              deckId={id}
              hasDescription={!!deck.description}
              totalCardCount={cards.length}
              aiGeneratedCount={aiGeneratedCount}
              hasAI={effectiveAI}
              deckCardLimit={deckCardLimit}
            />

            <div
              className={cn(
                "flex flex-wrap gap-2 border-t pt-3",
                hasGradient ? "border-white/10" : "border-border/60",
              )}
            >
              <EditDeckDialog deck={deck} allowCoverUpload={teamTierPro} />
              {cards.length > 0 ? (
                <DeleteAllCardsDialogLoader deckId={id} cardCount={cards.length} />
              ) : null}
              {cards.length > 0 ? (
                <StudyLink
                  deckId={id}
                  workspaceQueryString={fromTeamWorkspaceUrl ? workspaceQs : undefined}
                />
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger render={<span tabIndex={0} className="cursor-not-allowed" />}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="pointer-events-none gap-2"
                        disabled
                        aria-disabled
                      >
                        <BookOpen className="size-4" />
                        Study deck
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
        {isAtCardLimit && (
          <p className={cn("text-xs", hasGradient ? "text-rose-200 font-medium" : "text-destructive")}>
            {isFreePlan ? (
              <>
                Card limit reached for this deck ({deckCardLimit} max on Free).{" "}
                <Link href="/pricing" className={cn("underline underline-offset-3", hasGradient && "text-white")}>
                  Upgrade on Pricing
                </Link>{" "}
                for up to {CARDS_PER_DECK_LIMIT_PRO_PLUS} cards per deck.
              </>
            ) : (
              <>
                Card limit reached for this deck ({deckCardLimit} max on your plan). Delete cards to add
                more.
              </>
            )}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 border-b pb-3 sm:pb-4">
          <div className="space-y-0.5">
            <h2 className={cn("text-base font-medium tracking-tight sm:text-lg", hasGradient && "text-white")}>
              Cards
            </h2>
            {cards.length > 0 ? (
              <p className={cn("text-xs sm:text-sm", hasGradient ? "text-white/60" : "text-muted-foreground")}>
                {cards.length} card{cards.length === 1 ? "" : "s"} in this deck
              </p>
            ) : null}
          </div>
          <AddCardDialog
            deckId={id}
            deckName={deck.name}
            isAtLimit={isAtCardLimit}
            hasAI={effectiveAI}
            hasAdvancedSourceImport={effectiveAdvancedSourceImport}
            aiGeneratedCount={aiGeneratedCount}
            totalCardCount={cards.length}
            deckCardLimit={deckCardLimit}
            allowsMultipleChoiceFormat={paidDeckCards}
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
              deckName={deck.name}
              isAtLimit={isAtCardLimit}
              hasAI={effectiveAI}
              hasAdvancedSourceImport={effectiveAdvancedSourceImport}
              aiGeneratedCount={aiGeneratedCount}
              totalCardCount={cards.length}
              deckCardLimit={deckCardLimit}
              allowsMultipleChoiceFormat={paidDeckCards}
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
