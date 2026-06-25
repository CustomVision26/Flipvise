import { useEffect, useState } from "react";
import { listCards } from "../../src/lib/offline/repository";
import type { OfflineDeckRow } from "../../src/lib/offline/schema";

import { ConnectionStatusPill } from "./connection-status";
import {
  DeckWorkspaceContext,
  resolveDeckWorkspaceInfo,
  type DeckWorkspaceContextInput,
} from "./deck-workspace-context";

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
        <div className="study-hub__header-row">
          <button type="button" className="btn secondary btn--sm" onClick={onBack}>
            ← Deck
          </button>
          <ConnectionStatusPill online={online} compact />
        </div>
      </header>
      <div className="study-hub__body">
        <div className="study-hub__intro">
          <span className="study-hub__badge">Study session</span>
          <h1 className="study-hub__title">Choose a mode</h1>
          <p className="study-hub__deck-name">{deck.name}</p>
          <DeckWorkspaceContext info={workspaceInfo} compact />
        </div>
        <p className="study-hub__meta">
          {count == null
            ? "Loading cards…"
            : `${count} card${count === 1 ? "" : "s"} available`}
        </p>
        <div className="study-hub__actions">
          <button
            type="button"
            className="btn study-hub__action"
            onClick={onStandardReview}
            disabled={!hasCards}
          >
            <span className="study-hub__action-title">Standard review</span>
            <span className="study-hub__action-desc">
              Flip through each card at your own pace.
            </span>
          </button>
          <button
            type="button"
            className="btn secondary study-hub__action"
            onClick={onQuiz}
            disabled={!hasCards}
          >
            <span className="study-hub__action-title">Take a quiz</span>
            <span className="study-hub__action-desc">
              Answer multiple-choice questions and see your score.
            </span>
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
