import { useEffect, useState } from "react";
import { listCards } from "../../src/lib/offline/repository";
import type { OfflineDeckRow } from "../../src/lib/offline/schema";

import { ConnectionStatusPill } from "./connection-status";
import {
  DeckWorkspaceContext,
  resolveDeckWorkspaceInfo,
  type DeckWorkspaceContextInput,
} from "./deck-workspace-context";
import { IllustratedArt } from "./illustrated-library";

function ChevronIcon({ direction = "right" }: { direction?: "left" | "right" }) {
  return (
    <svg className="study-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        d={direction === "left" ? "M15 6 L9 12 L15 18" : "M9 6 L15 12 L9 18"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CardsIcon() {
  return (
    <svg className="study-icon" viewBox="0 0 24 24" aria-hidden>
      <rect x="7" y="3" width="12" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="4" y="6" width="12" height="15" rx="2" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 11h6M7 14.5h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function QuizIcon() {
  return (
    <svg className="study-icon" viewBox="0 0 24 24" aria-hidden>
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 9.2h7M8.5 13h7M8.5 16.5h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function DeckStudyHub({
  deck,
  online,
  workspaceContext,
  onBack,
  onStandardReview,
  onQuiz,
}: {
  deck: OfflineDeckRow;
  online: boolean;
  workspaceContext: DeckWorkspaceContextInput;
  onBack: () => void;
  onStandardReview: () => void;
  onQuiz: () => void;
}) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    listCards(deck.local_id)
      .then((cards) => setCount(cards.length))
      .catch(() => setCount(null));
  }, [deck.local_id]);

  const hasCards = count != null && count > 0;
  const workspaceInfo = resolveDeckWorkspaceInfo(deck, workspaceContext);

  return (
    <div className="app study-hub">
      <header className="study-hub__header">
        <div className="study-hub__bar">
          <button type="button" className="study-nav-btn" onClick={onBack} aria-label="Back to deck">
            <ChevronIcon direction="left" />
          </button>
          <h1 className="study-hub__screen-title">Study session</h1>
          <ConnectionStatusPill online={online} compact />
        </div>
      </header>
      <div className="study-hub__body">
        <section className="study-hub__summary">
          <IllustratedArt
            name={deck.name}
            description={deck.description}
            coverImageUrl={deck.cover_image_url}
            topicText={`${deck.name} ${deck.description ?? ""}`}
            role="hero"
            displayWidth={160}
            displayHeight={160}
            online={online}
            className="study-hub__summary-art"
          />
          <div className="study-hub__summary-copy">
            <p className="study-hub__deck-name">{deck.name}</p>
            <DeckWorkspaceContext info={workspaceInfo} compact />
            <p className="study-hub__meta">
              {count == null
                ? "Loading cards…"
                : `${count} ${count === 1 ? "card" : "cards"} available`}
            </p>
          </div>
        </section>
        <div className="study-hub__choose">
          <h2>Choose how to study</h2>
          <p>Pick a mode to get started.</p>
        </div>
        <div className="study-hub__actions">
          <button
            type="button"
            className="study-mode study-mode--review"
            onClick={onStandardReview}
            disabled={!hasCards}
          >
            <span className="study-mode__icon" aria-hidden>
              <CardsIcon />
            </span>
            <span className="study-mode__copy">
              <span className="study-mode__title">Standard review</span>
              <span className="study-mode__desc">Flip through each card at your own pace.</span>
            </span>
            <ChevronIcon />
          </button>
          <button
            type="button"
            className="study-mode study-mode--quiz"
            onClick={onQuiz}
            disabled={!hasCards}
          >
            <span className="study-mode__icon" aria-hidden>
              <QuizIcon />
            </span>
            <span className="study-mode__copy">
              <span className="study-mode__title">Take a quiz</span>
              <span className="study-mode__desc">
                Answer multiple-choice questions and see your score.
              </span>
            </span>
            <ChevronIcon />
          </button>
        </div>
        {!hasCards && count === 0 ? (
          <p className="study-hub__hint">
            Add cards on the deck page before studying or taking a quiz.
          </p>
        ) : null}
      </div>
    </div>
  );
}
