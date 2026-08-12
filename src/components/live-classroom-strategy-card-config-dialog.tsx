"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { getCardsForDeckViewerPreviewAction } from "@/actions/cards";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  LIVE_CLASSROOM_EXTRA_TIME_MAX_SEC,
  LIVE_CLASSROOM_EXTRA_TIME_MIN_SEC,
  LIVE_CLASSROOM_STRATEGY_CARD_SCOPES,
  strategyCardAppliesToDeckCard,
  strategyCardHasScoreValue,
  strategyCardLabel,
  strategyCardScopeLabel,
  type LiveClassroomStrategyCardKind,
  type LiveClassroomStrategyCardScope,
  type LiveClassroomStrategyCardSetting,
  type LiveClassroomStrategyCardSettings,
} from "@/lib/live-classroom-types";

type DeckCardPreview = {
  id: number;
  front: string | null;
  back: string | null;
  cardType: string;
  choices: string[] | null;
  correctChoiceIndex: number | null;
};

type LiveClassroomStrategyCardConfigDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: LiveClassroomStrategyCardKind | null;
  deckId: number | null;
  /**
   * Deck card ids that will actually be used as battle questions. When set,
   * the individual-question picker only lists these cards. `null`/`undefined`
   * means every card in the deck is in play (no restriction).
   */
  allowedCardIds?: number[] | null;
  setting: LiveClassroomStrategyCardSetting;
  /**
   * Every card kind's current setting (including this one), used to show
   * which other strategy cards are already assigned to each question below.
   */
  otherCardSettings?: LiveClassroomStrategyCardSettings;
  onSave: (setting: LiveClassroomStrategyCardSetting) => void;
};

export function LiveClassroomStrategyCardConfigDialog({
  open,
  onOpenChange,
  kind,
  deckId,
  allowedCardIds,
  setting,
  otherCardSettings,
  onSave,
}: LiveClassroomStrategyCardConfigDialogProps) {
  const [scope, setScope] = useState<LiveClassroomStrategyCardScope>(
    setting.scope,
  );
  const [cardIds, setCardIds] = useState<number[]>(setting.cardIds);
  const [value, setValue] = useState(setting.value);
  const [seconds, setSeconds] = useState(setting.seconds || LIVE_CLASSROOM_EXTRA_TIME_MIN_SEC);
  const [maxActivationsPerTeam, setMaxActivationsPerTeam] = useState(
    setting.maxActivationsPerTeam,
  );
  const [deckCards, setDeckCards] = useState<DeckCardPreview[]>([]);
  const [loadingDeck, setLoadingDeck] = useState(false);

  useEffect(() => {
    if (!open || !kind) return;
    setScope(setting.scope);
    setCardIds(
      allowedCardIds
        ? setting.cardIds.filter((id) => allowedCardIds.includes(id))
        : setting.cardIds,
    );
    setValue(setting.value);
    setSeconds(setting.seconds || LIVE_CLASSROOM_EXTRA_TIME_MIN_SEC);
    setMaxActivationsPerTeam(setting.maxActivationsPerTeam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind]);

  useEffect(() => {
    if (!open || scope !== "individual" || !deckId) return;
    let cancelled = false;
    setLoadingDeck(true);
    getCardsForDeckViewerPreviewAction({ deckId })
      .then((rows) => {
        if (cancelled) return;
        setDeckCards(
          rows.map((r) => ({
            id: r.id,
            front: r.front,
            back: r.back,
            cardType: r.cardType,
            choices: r.choices ?? null,
            correctChoiceIndex: r.correctChoiceIndex ?? null,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load deck cards");
      })
      .finally(() => {
        if (!cancelled) setLoadingDeck(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, scope, deckId]);

  if (!kind) return null;

  const hasScoreValue = strategyCardHasScoreValue(kind);
  const isExtraTime = kind === "extra_time";
  const visibleDeckCards = allowedCardIds
    ? deckCards.filter((c) => allowedCardIds.includes(c.id))
    : deckCards;
  const noBattleCardsChosen = allowedCardIds != null && allowedCardIds.length === 0;

  function otherKindsAssignedTo(cardId: number): LiveClassroomStrategyCardKind[] {
    if (!otherCardSettings) return [];
    return (Object.entries(otherCardSettings) as Array<
      [LiveClassroomStrategyCardKind, LiveClassroomStrategyCardSetting]
    >)
      .filter(([k, s]) => k !== kind && strategyCardAppliesToDeckCard(s, cardId))
      .map(([k]) => k);
  }

  function toggleCardId(id: number, checked: boolean) {
    setCardIds((prev) => {
      const already = prev.includes(id);
      if (checked) return already ? prev : [...prev, id];
      return already ? prev.filter((existing) => existing !== id) : prev;
    });
  }

  function handleSave() {
    if (scope === "individual" && cardIds.length === 0) {
      toast.error("Select at least one question, or choose a different scope.");
      return;
    }
    onSave({
      scope,
      cardIds: scope === "individual" ? cardIds : [],
      value,
      seconds: isExtraTime ? seconds : 0,
      maxActivationsPerTeam,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,44rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{strategyCardLabel(kind)} settings</DialogTitle>
          <DialogDescription>
            Choose which questions this card can be used on, then set its
            effect for this battle.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Apply to</Label>
            <RadioGroup
              value={scope}
              onValueChange={(v) => {
                if (v != null) setScope(v as LiveClassroomStrategyCardScope);
              }}
              className="gap-2"
            >
              {LIVE_CLASSROOM_STRATEGY_CARD_SCOPES.map((s) => {
                const id = `sc-scope-${kind}-${s}`;
                return (
                  <div
                    key={s}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5"
                  >
                    <RadioGroupItem value={s} id={id} />
                    <Label
                      htmlFor={id}
                      className="cursor-pointer text-sm font-normal text-foreground"
                    >
                      {strategyCardScopeLabel(s)}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              All cards: every team sees this card on every question.
              Individual: pick specific questions from the linked deck.
              Disabled: no team receives this card.
            </p>
          </div>

          {scope === "individual" ? (
            <div className="space-y-2">
              <Label>Questions this card applies to</Label>
              {!deckId ? (
                <p className="text-xs text-muted-foreground">
                  Select a deck for this session to choose individual
                  questions.
                </p>
              ) : noBattleCardsChosen ? (
                <p className="text-xs text-muted-foreground">
                  Choose which cards belong to this battle above (under
                  Questions) before targeting individual questions.
                </p>
              ) : loadingDeck ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Loading deck questions…
                </div>
              ) : visibleDeckCards.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  This deck has no cards yet.
                </p>
              ) : (
                <ScrollArea className="h-64 rounded-lg border border-border/60">
                  <div className="space-y-2 p-2">
                    {visibleDeckCards.map((card) => {
                      const checked = cardIds.includes(card.id);
                      const isMc =
                        card.cardType === "multiple_choice" &&
                        Array.isArray(card.choices) &&
                        card.choices.length > 0;
                      const assignedKinds = otherKindsAssignedTo(card.id);
                      return (
                        <div
                          key={card.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleCardId(card.id, !checked)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleCardId(card.id, !checked);
                            }
                          }}
                          className="flex items-start gap-2 rounded-md border border-border/50 bg-card/40 p-2 cursor-pointer"
                        >
                          <Checkbox
                            checked={checked}
                            tabIndex={-1}
                            className="mt-0.5 pointer-events-none"
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-sm font-medium text-foreground">
                              {card.front?.trim() || "Untitled question"}
                            </p>
                            {isMc ? (
                              <ul className="space-y-0.5">
                                {card.choices!.map((choice, i) => (
                                  <li
                                    key={i}
                                    className={cn(
                                      "flex items-center gap-1 text-xs",
                                      i === card.correctChoiceIndex
                                        ? "text-emerald-400"
                                        : "text-muted-foreground",
                                    )}
                                  >
                                    {i === card.correctChoiceIndex ? (
                                      <Check className="size-3 shrink-0" aria-hidden />
                                    ) : (
                                      <X className="size-3 shrink-0" aria-hidden />
                                    )}
                                    <span className="truncate">{choice}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Correct answer:{" "}
                                {card.back?.trim() || "—"}
                              </p>
                            )}
                            {assignedKinds.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                {assignedKinds.map((k) => (
                                  <Badge
                                    key={k}
                                    variant="outline"
                                    className="px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
                                  >
                                    {strategyCardLabel(k)}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
              {cardIds.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {cardIds.length} question{cardIds.length === 1 ? "" : "s"}{" "}
                  selected.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {hasScoreValue ? (
              <div className="space-y-2">
                <Label htmlFor={`sc-value-${kind}`}>Score to award</Label>
                <Input
                  id={`sc-value-${kind}`}
                  type="number"
                  min={0}
                  max={100000}
                  value={value}
                  onChange={(e) => setValue(Number(e.target.value))}
                />
                {kind === "double_points" ? (
                  <p className="text-xs text-muted-foreground">
                    Defaults to twice the battle&apos;s Score per question.
                  </p>
                ) : null}
              </div>
            ) : null}
            {isExtraTime ? (
              <div className="space-y-2">
                <Label htmlFor={`sc-seconds-${kind}`}>
                  Extra time granted (seconds)
                </Label>
                <Input
                  id={`sc-seconds-${kind}`}
                  type="number"
                  min={LIVE_CLASSROOM_EXTRA_TIME_MIN_SEC}
                  max={LIVE_CLASSROOM_EXTRA_TIME_MAX_SEC}
                  step={5}
                  value={seconds}
                  onChange={(e) => setSeconds(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  30 seconds to 5 minutes.
                </p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor={`sc-max-${kind}`}>Max activations per team</Label>
              <Input
                id={`sc-max-${kind}`}
                type="number"
                min={1}
                max={20}
                value={maxActivationsPerTeam}
                onChange={(e) =>
                  setMaxActivationsPerTeam(Number(e.target.value))
                }
              />
              <p className="text-xs text-muted-foreground">
                How many times a team can activate this card in the battle.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
