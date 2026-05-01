import { getAccessContext } from "@/lib/access";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCardsForDeckViewer } from "@/db/queries/cards";
import { getDeckWithViewerAccess } from "@/lib/team-deck-access";
import {
  buildResolvedTeamWorkspaceQueryString,
  resolveTeamWorkspaceFromSearchParams,
} from "@/lib/resolve-team-workspace-url";
import { StudySessionLoader } from "./study-session-loader";
import { getTeamDeckContext } from "@/lib/deck-team-heading";

interface StudyPageProps {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StudyPage({ params, searchParams }: StudyPageProps) {
  const { userId, has75CardsPerDeck } = await getAccessContext();
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

  const { deck, access } = bundle;
  const { heading: teamDeckHeading, teamTierPro } = await getTeamDeckContext(deck);
  const effective75 = has75CardsPerDeck || teamTierPro;
  const cards = await getCardsForDeckViewer(id, userId);
  if (cards.length === 0) {
    if (access.kind === "team_member") {
      redirect(
        workspaceQs ? `/dashboard?${workspaceQs}` : "/dashboard",
      );
    }
    redirect(`/decks/${id}`);
  }

  const fromTeamWorkspaceUrl =
    teamWorkspaceUrl != null &&
    deck.teamId != null &&
    deck.teamId === teamWorkspaceUrl.teamId;

  let studyBackHref: string;
  let studyBackLabel: string;
  if (fromTeamWorkspaceUrl && workspaceQs) {
    studyBackHref = `/dashboard?${workspaceQs}`;
    studyBackLabel = "← Dashboard";
  } else if (access.kind === "team_member") {
    studyBackHref = "/dashboard";
    studyBackLabel = "← Dashboard";
  } else {
    studyBackHref = `/decks/${id}`;
    studyBackLabel = "← Back to Deck";
  }

  return (
    <div className="flex flex-1 flex-col gap-4 sm:gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <Link
            href={studyBackHref}
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {studyBackLabel.replace("← ", "")}
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
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">Study Session</span>
            <span className="text-muted-foreground text-xs" aria-hidden>·</span>
            <Badge variant="secondary" className="text-xs">
              {cards.length} card{cards.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>
      </div>

      <StudySessionLoader
        cards={cards}
        deckId={id}
        deckName={deck.name}
        teamId={deck.teamId ?? null}
        allowsQuizStudy={effective75}
        deckGradient={deck.gradient ?? null}
        autoSaveQuizResult={fromTeamWorkspaceUrl}
      />
    </div>
  );
}
