import { useEffect, useState } from "react";
import { listCards } from "../../src/lib/offline/repository";
import type { OfflineCardRow, OfflineDeckRow } from "../../src/lib/offline/schema";
import {
  StudySessionControls,
  StudySessionEmpty,
  StudySessionLayout,
  StudySessionLoading,
} from "./study-session-layout";

function cardText(value: string | null, fallback: string): string {
  const t = value?.trim();
  return t || fallback;
}

export function StandardReview({
  deck,
  online,
  onBack,
}: {
  deck: OfflineDeckRow;
  online: boolean;
  onBack: () => void;
}) {
  const [cards, setCards] = useState<OfflineCardRow[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listCards(deck.local_id)
      .then((rows) => {
        if (!cancelled) setCards(rows);
      })
      .catch(() => {
        if (!cancelled) setCards([]);
      });
    return () => {
      cancelled = true;
    };
  }, [deck.local_id]);

  const card = cards?.[index];
  const total = cards?.length ?? 0;

  const flip = () => setFlipped((f) => !f);
  const prev = () => {
    setFlipped(false);
    setIndex((i) => Math.max(i - 1, 0));
  };
  const next = () => {
    setFlipped(false);
    setIndex((i) => Math.min(i + 1, Math.max(total - 1, 0)));
  };

  if (cards === null) {
    return (
      <StudySessionLayout
        modeLabel="Standard Review"
        deckName={deck.name}
        backLabel="← Study"
        onBack={onBack}
        online={online}
      >
        <StudySessionLoading message="Loading cards…" />
      </StudySessionLayout>
    );
  }

  if (total === 0) {
    return (
      <StudySessionLayout
        modeLabel="Standard Review"
        deckName={deck.name}
        backLabel="← Study"
        onBack={onBack}
        online={online}
      >
        <StudySessionEmpty
          title="No cards available"
          body="This deck has no downloaded cards yet. Add cards on the deck page, then return to study."
        />
      </StudySessionLayout>
    );
  }

  const faceLabel = flipped ? "Answer" : "Question";
  const faceText = flipped
    ? cardText(card?.back ?? null, "No answer provided")
    : cardText(card?.front ?? null, "No question provided");

  return (
    <StudySessionLayout
      modeLabel="Standard Review"
      deckName={deck.name}
      backLabel="← Study"
      onBack={onBack}
      online={online}
      progressCurrent={index + 1}
      progressTotal={total}
      footer={
        <StudySessionControls>
          <button
            type="button"
            className="btn secondary"
            onClick={prev}
            disabled={index === 0}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn"
            onClick={next}
            disabled={index >= total - 1}
          >
            Next card
          </button>
        </StudySessionControls>
      }
    >
      <div className="review-stage">
        <p className="review-stage__instruction">
          Review each card at your own pace. Tap the card to reveal the answer.
        </p>
        <button
          type="button"
          className={`review-card${flipped ? " review-card--flipped" : ""}`}
          onClick={flip}
          aria-pressed={flipped}
          aria-label={`${faceLabel}: ${faceText}. Tap to flip.`}
        >
          <div className="review-card__frame">
            <span className="review-card__face-tag">{faceLabel}</span>
            <p className="review-card__text">{faceText}</p>
            <span className="review-card__hint">
              {flipped ? "Tap to show question" : "Tap to reveal answer"}
            </span>
          </div>
        </button>
        <div className="review-dots" aria-hidden>
          {cards.map((c, i) => (
            <span
              key={c.local_id}
              className={`review-dots__dot${i === index ? " active" : ""}${
                i < index ? " visited" : ""
              }`}
            />
          ))}
        </div>
      </div>
    </StudySessionLayout>
  );
}
