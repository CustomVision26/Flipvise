import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getAccessContext } from "@/lib/access";
import Link from "next/link";
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

  return (
    <div className="flex flex-1 flex-col gap-4 sm:gap-8 p-4 sm:p-8">
      {/* Deck section */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-1">
            <Link
              href={dashboardHref}
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              ← Dashboard
            </Link>
            {teamDeckHeading && (
              <div className="mt-1 space-y-0.5">
                <p className="text-muted-foreground text-sm">
                  Team:{" "}
                  <span className="font-medium text-foreground">{teamDeckHeading.teamName}</span>
                </p>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  Owner:{" "}
                  <span className="text-foreground/90">{teamDeckHeading.ownerDisplayName}</span>
                </p>
              </div>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight break-words">
              {deck.name}
            </h1>
            {deck.description && (
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">{deck.description}</p>
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
                    <TooltipTrigger>
                      <div className="inline-flex h-9 sm:h-10 shrink-0 cursor-not-allowed items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-primary-foreground opacity-50">
                        🧠 Brain Challenge
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Lets go! and test my memory bank</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="text-foreground font-medium tabular-nums">
            {cards.length} / {deckCardLimit} cards
            <span className="text-muted-foreground font-normal">
              {" "}
              ({isFreePlan ? "Free plan" : "Pro plan"})
            </span>
          </span>
          <span aria-hidden className="select-none">
            ·
          </span>
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
          <p className="text-destructive text-xs">
            {isFreePlan ? (
              <>
                Card limit reached for this deck ({deckCardLimit} max on Free).{" "}
                <Link href="/pricing" className="underline underline-offset-3">
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
          <h2 className="text-base sm:text-lg font-semibold">Cards</h2>
          <AddCardDialog
            deckId={id}
            isAtLimit={isAtCardLimit}
            hasAI={effectiveAI}
            allowsMultipleChoiceFormat={effective75}
          />
        </div>

        {cards.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-12 sm:py-20 text-center px-4">
            <p className="text-muted-foreground text-sm">
              This deck has no cards yet.
            </p>
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
