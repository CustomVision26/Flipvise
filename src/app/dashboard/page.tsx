import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/access";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getDecksByUserWithCardCount } from "@/db/queries/decks";
import { AddDeckDialog } from "@/components/add-deck-dialog";
import { DeleteDeckButton } from "@/components/delete-deck-button";

const DECK_LIMIT = 3;
const CARDS_PER_DECK_LIMIT = 8;

export default async function DashboardPage() {
  const { userId, hasUnlimitedDecks, has75CardsPerDeck, isPro } = await getAccessContext();
  if (!userId) redirect("/");

  const decks = await getDecksByUserWithCardCount(userId);
  const isFreePlan = !hasUnlimitedDecks;
  const isAtLimit = isFreePlan && decks.length >= DECK_LIMIT;
  const deckUsagePercent = isFreePlan
    ? Math.min((decks.length / DECK_LIMIT) * 100, 100)
    : 0;
  const cardsPerDeckLimit = has75CardsPerDeck ? 75 : CARDS_PER_DECK_LIMIT;

  return (
    <div className="flex flex-1 flex-col gap-4 sm:gap-6 p-4 sm:p-8">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage your flashcard decks</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <AddDeckDialog isAtLimit={isAtLimit} />
        </div>
      </div>

      {/* Free plan usage banner */}
      {isFreePlan && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Usage card */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Free Plan Usage
                </CardTitle>
                <Badge variant="secondary" className="text-xs">Free</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Decks</span>
                  <span className="text-muted-foreground tabular-nums">
                    {decks.length} / {DECK_LIMIT}
                  </span>
                </div>
                <Progress value={deckUsagePercent} />
              </div>
              <p className="text-xs text-muted-foreground">
                Each deck is limited to{" "}
                <span className="text-foreground font-semibold">
                  {cardsPerDeckLimit} cards
                </span>{" "}
                on the Free plan.
              </p>
              {isAtLimit && (
                <p className="text-xs text-destructive font-medium">
                  You&apos;ve reached the 3-deck limit. Upgrade to add more.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Pro upgrade card */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Upgrade to Pro
                </CardTitle>
                <Badge className="text-xs">Pro</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-center gap-2 text-foreground">
                  <span className="text-primary">✓</span>
                  <span>Unlimited decks</span>
                </li>
                <li className="flex items-center gap-2 text-foreground">
                  <span className="text-primary">✓</span>
                  <span>75 cards per deck</span>
                </li>
                <li className="flex items-center gap-2 text-foreground">
                  <span className="text-primary">✓</span>
                  <span>AI flashcard generation</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Link
                href="/pricing"
                className={buttonVariants({ size: "sm" }) + " w-full justify-center"}
              >
                View Pro Plans
              </Link>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* At limit alert */}
      {isAtLimit && (
          <Alert>
          <AlertTitle>Deck limit reached</AlertTitle>
          <AlertDescription>
            Free plan allows up to{" "}
            <strong>{DECK_LIMIT} decks</strong> with{" "}
            <strong>{cardsPerDeckLimit} cards</strong> per deck.{" "}
            <Link href="/pricing" className="underline underline-offset-3 hover:text-foreground">
              Upgrade to Pro
            </Link>{" "}
            for unlimited decks and 75 cards per deck.
          </AlertDescription>
        </Alert>
      )}

      {/* Deck grid */}
      {decks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-12 sm:py-20 text-center px-4">
          <p className="text-muted-foreground text-sm">You have no decks yet.</p>
          <AddDeckDialog triggerLabel="Create your first deck" isAtLimit={isAtLimit} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <div key={deck.id} className="relative min-h-[140px] sm:h-40">
              <Link href={`/decks/${deck.id}`} className="block h-full">
                <Card className="h-full flex flex-col transition-colors hover:bg-muted/50 cursor-pointer">
                  <CardHeader className="pr-10 sm:pr-12 flex-none pb-2 sm:pb-3">
                    <CardTitle className="line-clamp-1 text-base sm:text-lg">{deck.name}</CardTitle>
                    <CardDescription className="line-clamp-2 text-xs sm:text-sm">
                      {deck.description ?? "No description provided."}
                    </CardDescription>
                  </CardHeader>
                  <div className="flex-1" />
                  <CardFooter className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-0 sm:justify-between pt-2">
                    <span className="text-muted-foreground text-xs">
                      {deck.cardCount} {deck.cardCount === 1 ? "card" : "cards"}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      Updated{" "}
                      {deck.updatedAt.toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </CardFooter>
                </Card>
              </Link>
              <div className="absolute top-2 sm:top-3 right-2 sm:right-3">
                <DeleteDeckButton deckId={deck.id} deckName={deck.name} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pro plan — already subscribed */}
      {isPro && (
        <p className="text-xs text-muted-foreground text-center">
          You&apos;re on the <span className="text-foreground font-medium">Pro plan</span> — enjoy unlimited decks and 75 cards per deck.
        </p>
      )}
    </div>
  );
}
