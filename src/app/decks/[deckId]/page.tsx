import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getAccessContext } from "@/lib/access";
import { canUseAdvancedSourceImport } from "@/lib/source-import-access";
import { canUseDeckAiFeatures } from "@/lib/deck-ai-access";
import Link from "next/link";
import { ArrowLeft, BookOpen, CalendarDays, Layers3, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { DeleteAllCardsDialogLoader } from "./delete-all-cards-dialog-loader";
import { StudyLink } from "@/components/study-link";
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
  // Viewers with access see the cards page read-only (do not redirect to study).
  const canEdit = canEditDeckContent(bundle.access);

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
  const fillPercent =
    deckCardLimit > 0
      ? Math.min(100, Math.round((cards.length / deckCardLimit) * 100))
      : 0;

  const deckGradient = getGradientBySlug(deck.gradient);
  const hasGradient = deckGradient.slug !== "none";
  const updatedLabel = deck.updatedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden",
        deckGradient.classes,
      )}
    >
      {hasGradient ? (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden
        >
          <div className="absolute -right-24 -top-28 size-[22rem] rounded-full bg-white/12 blur-3xl animate-float-gentle" />
          <div className="absolute -left-20 top-1/3 size-[18rem] rounded-full bg-black/25 blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-[-6rem] right-1/4 size-[16rem] rounded-full bg-white/8 blur-3xl animate-drift" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.35) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
        </div>
      ) : null}

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:gap-8 sm:p-8">
        <section
          className={cn(
            "animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-both",
            "rounded-2xl border p-5 sm:p-7",
            hasGradient
              ? "border-white/15 bg-black/25 shadow-2xl shadow-black/25 backdrop-blur-md"
              : "border-border/80 bg-card/60 shadow-lg shadow-black/10",
          )}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:justify-between lg:gap-8">
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-5">
              <div className="space-y-4">
                <Link
                  href={dashboardHref}
                  className={cn(
                    "group inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors",
                    hasGradient
                      ? "text-white/60 hover:text-white"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
                  Dashboard
                </Link>

                {teamDeckHeading ? (
                  <div
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-xs sm:text-sm",
                      hasGradient
                        ? "border-white/12 bg-white/5 text-white/70"
                        : "border-border/70 bg-muted/40 text-muted-foreground",
                    )}
                  >
                    <p>
                      Team workspace:{" "}
                      <span
                        className={cn(
                          "font-medium",
                          hasGradient ? "text-white" : "text-foreground",
                        )}
                      >
                        {teamDeckHeading.teamName}
                      </span>
                    </p>
                    <p className="mt-0.5 opacity-90">
                      Owner:{" "}
                      <span className={hasGradient ? "text-white/90" : "text-foreground/85"}>
                        {teamDeckHeading.ownerDisplayName}
                      </span>
                    </p>
                  </div>
                ) : null}

                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1 border-transparent text-[10px] uppercase tracking-[0.14em]",
                        hasGradient
                          ? "bg-white/15 text-white"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Layers3 className="size-3" />
                      {canEdit ? "Deck editor" : "Deck cards"}
                    </Badge>
                    {canEdit && effectiveAI ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-1 text-[10px]",
                          hasGradient
                            ? "border-white/20 bg-white/10 text-white/90"
                            : "border-primary/30 bg-primary/10 text-primary",
                        )}
                      >
                        <Sparkles className="size-3" />
                        AI ready
                      </Badge>
                    ) : null}
                  </div>
                  <h1
                    className={cn(
                      "text-balance text-3xl font-semibold tracking-tight sm:text-4xl",
                      hasGradient && "text-white",
                    )}
                  >
                    {deck.name}
                  </h1>
                  {deck.description ? (
                    <p
                      className={cn(
                        "max-w-2xl text-sm leading-relaxed sm:text-[0.95rem]",
                        hasGradient ? "text-white/75" : "text-muted-foreground",
                      )}
                    >
                      {deck.description}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "gap-1.5 tabular-nums",
                      hasGradient &&
                        "border border-white/15 bg-white/10 text-white hover:bg-white/15",
                    )}
                  >
                    <Layers3 className="size-3 opacity-80" />
                    {cards.length} / {deckCardLimit} cards
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={cn(
                      hasGradient &&
                        "border border-white/15 bg-white/10 text-white hover:bg-white/15",
                    )}
                  >
                    {isFreePlan ? "Free plan" : "Paid plan"}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "gap-1.5",
                      hasGradient &&
                        "border border-white/15 bg-white/10 text-white hover:bg-white/15",
                    )}
                  >
                    <CalendarDays className="size-3 opacity-80" />
                    Updated {updatedLabel}
                  </Badge>
                </div>
                <div className="max-w-md space-y-1.5">
                  <div
                    className={cn(
                      "flex items-center justify-between text-[11px] font-medium uppercase tracking-wide",
                      hasGradient ? "text-white/55" : "text-muted-foreground",
                    )}
                  >
                    <span>Deck capacity</span>
                    <span className="tabular-nums">{fillPercent}%</span>
                  </div>
                  <div
                    className={cn(
                      "h-1.5 overflow-hidden rounded-full",
                      hasGradient ? "bg-white/15" : "bg-muted",
                    )}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-700 ease-out",
                        hasGradient ? "bg-white" : "bg-primary",
                        isAtCardLimit && (hasGradient ? "bg-rose-200" : "bg-destructive"),
                      )}
                      style={{ width: `${fillPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <aside
              className={cn(
                "flex w-full shrink-0 flex-col justify-between gap-4 rounded-xl border p-4 sm:p-5 lg:max-w-sm",
                "animate-in fade-in-0 slide-in-from-right-2 duration-700 fill-mode-both",
                hasGradient
                  ? "border-white/20 bg-black/30 shadow-xl shadow-black/20 backdrop-blur-md"
                  : "border-border/80 bg-background/70 shadow-md",
              )}
            >
              {canEdit ? (
                <GenerateCardsButtonLoader
                  deckId={id}
                  hasDescription={!!deck.description}
                  totalCardCount={cards.length}
                  aiGeneratedCount={aiGeneratedCount}
                  hasAI={effectiveAI}
                  deckCardLimit={deckCardLimit}
                  onGradient={hasGradient}
                />
              ) : (
                <p
                  className={cn(
                    "text-sm leading-relaxed",
                    hasGradient ? "text-white/75" : "text-muted-foreground",
                  )}
                >
                  You can view the cards in this deck. Editing is limited to the deck
                  owner or creator.
                </p>
              )}

              <div
                className={cn(
                  "flex flex-wrap gap-2 border-t pt-4",
                  hasGradient ? "border-white/10" : "border-border/60",
                )}
              >
                {cards.length > 0 ? (
                  <StudyLink
                    deckId={id}
                    workspaceQueryString={fromTeamWorkspaceUrl ? workspaceQs : undefined}
                  />
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger
                        render={<span tabIndex={0} className="cursor-not-allowed" />}
                      >
                        <Button
                          size="sm"
                          variant="default"
                          className="pointer-events-none h-9 gap-2 font-semibold"
                          disabled
                          aria-disabled
                        >
                          <BookOpen className="size-4" />
                          Study deck
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {canEdit
                            ? "Add at least one card to start a study session."
                            : "This deck has no cards yet."}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </aside>
          </div>

          {canEdit && isAtCardLimit ? (
            <p
              className={cn(
                "mt-5 border-t pt-4 text-xs",
                hasGradient
                  ? "border-white/10 text-rose-100 font-medium"
                  : "border-border/60 text-destructive",
              )}
            >
              {isFreePlan ? (
                <>
                  Card limit reached for this deck ({deckCardLimit} max on Free).{" "}
                  <Link
                    href="/pricing"
                    className={cn(
                      "underline underline-offset-3",
                      hasGradient && "text-white",
                    )}
                  >
                    Upgrade on Pricing
                  </Link>{" "}
                  for up to {CARDS_PER_DECK_LIMIT_PRO_PLUS} cards per deck.
                </>
              ) : (
                <>
                  Card limit reached for this deck ({deckCardLimit} max on your plan).
                  Delete cards to add more.
                </>
              )}
            </p>
          ) : null}
        </section>

        <section
          className={cn(
            "animate-in fade-in-0 slide-in-from-bottom-3 duration-700 fill-mode-both",
            "flex flex-1 flex-col gap-5 rounded-2xl border p-4 sm:p-6",
            hasGradient
              ? "border-white/12 bg-background/90 shadow-2xl shadow-black/30 backdrop-blur-xl"
              : "border-border/80 bg-card/80 shadow-lg",
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-4">
            <div className="space-y-0.5">
              <h2 className="text-base font-semibold tracking-tight sm:text-lg">
                Cards
              </h2>
              {cards.length > 0 ? (
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {cards.length} card{cards.length === 1 ? "" : "s"} in this deck
                </p>
              ) : (
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Build your deck with manual or AI-generated cards
                </p>
              )}
            </div>
            {canEdit ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {cards.length > 0 ? (
                  <DeleteAllCardsDialogLoader deckId={id} cardCount={cards.length} />
                ) : null}
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
            ) : null}
          </div>

          {cards.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-14 text-center sm:py-20">
              <div className="relative flex h-16 w-16 items-center justify-center">
                <div
                  className="absolute inset-0 rounded-full bg-primary/15 blur-md animate-pulse-slow"
                  aria-hidden
                />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-card shadow-sm">
                  <BookOpen className="h-7 w-7 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">No cards yet</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  {canEdit
                    ? "Add your first card to start building this deck."
                    : "This deck does not have any cards yet."}
                </p>
              </div>
              {canEdit ? (
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
                  trigger={<Button className="gap-2">Add your first card</Button>}
                />
              ) : null}
            </div>
          ) : (
            <CardGrid
              cards={cards}
              deckId={id}
              hasAI={effectiveAI}
              initialView={initialView}
              canEditContent={canEdit}
            />
          )}
        </section>
      </div>
    </div>
  );
}
