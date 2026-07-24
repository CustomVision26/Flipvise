import { useCallback, useEffect, useRef, useState } from "react";
import { listCards } from "../../src/lib/offline/repository";
import type { OfflineCardRow, OfflineDeckRow } from "../../src/lib/offline/schema";
import { OfflineImage } from "./offline-image";
import {
  OfflineSpeakButton,
  OfflineVoiceSelector,
  type OfflineTtsVoice,
} from "./offline-speak";

function cardText(value: string | null, fallback: string): string {
  const t = value?.trim();
  return t || fallback;
}

function formatAnswer(card: OfflineCardRow): string {
  if (card.card_type === "multiple_choice" && card.choices_json) {
    try {
      const choices = JSON.parse(card.choices_json) as string[];
      if (Array.isArray(choices) && choices.length > 0) {
        const idx = card.correct_choice_index ?? 0;
        const correct = choices[idx]?.trim();
        if (correct) return correct;
      }
    } catch {
      // fall through
    }
  }
  return cardText(card.back, "No answer provided");
}

export function DeckPreview({
  deck,
  online,
  canSpeak,
  hasAiReading,
  apiBaseUrl,
  onClose,
}: {
  deck: OfflineDeckRow;
  online: boolean;
  canSpeak: boolean;
  hasAiReading: boolean;
  apiBaseUrl: string;
  onClose: () => void;
}) {
  const [cards, setCards] = useState<OfflineCardRow[] | null>(null);
  const [index, setIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [voice, setVoice] = useState<OfflineTtsVoice>("nova");
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const indexRef = useRef(0);
  const totalRef = useRef(0);

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

  const total = cards?.length ?? 0;
  indexRef.current = index;
  totalRef.current = total;

  const goNext = useCallback(() => {
    if (indexRef.current >= totalRef.current - 1) return;
    setIndex((i) => i + 1);
    setAnimKey((k) => k + 1);
  }, []);

  const goBack = useCallback(() => {
    if (indexRef.current <= 0) return;
    setIndex((i) => i - 1);
    setAnimKey((k) => k + 1);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goBack();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goBack, goNext, onClose]);

  if (cards === null) {
    return (
      <div className="deck-preview" role="dialog" aria-modal="true" aria-label={`Preview: ${deck.name}`}>
        <div className="deck-preview__header">
          <div className="deck-preview__heading">
            <h2>{deck.name}</h2>
            <p>Loading cards…</p>
          </div>
          <button type="button" className="deck-preview__close-icon" onClick={onClose} aria-label="Close preview">
            ✕
          </button>
        </div>
        <div className="deck-preview__empty">Loading…</div>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="deck-preview" role="dialog" aria-modal="true" aria-label={`Preview: ${deck.name}`}>
        <div className="deck-preview__header">
          <div className="deck-preview__heading">
            <h2>{deck.name}</h2>
            <p>No cards</p>
          </div>
          <button type="button" className="deck-preview__close-icon" onClick={onClose} aria-label="Close preview">
            ✕
          </button>
        </div>
        <div className="deck-preview__empty">
          <h3>No cards available</h3>
          <p>Add cards on this device, then return to preview.</p>
        </div>
        <div className="deck-preview__footer">
          <button type="button" className="btn secondary" onClick={onClose}>
            ✕ Close Preview
          </button>
        </div>
      </div>
    );
  }

  const card = cards[index]!;
  const question = cardText(card.front, "No question provided");
  const answer = formatAnswer(card);
  const progress = ((index + 1) / total) * 100;
  const showAiControls = canSpeak && hasAiReading && online;

  return (
    <div
      className="deck-preview"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${deck.name}`}
    >
      <div className="deck-preview__header">
        <div className="deck-preview__heading">
          <h2>{deck.name}</h2>
          <p>
            Card {index + 1} of {total}
          </p>
        </div>
        <div className="deck-preview__header-actions">
          {showAiControls ? (
            <OfflineVoiceSelector voice={voice} onChange={setVoice} />
          ) : null}
          <button
            type="button"
            className="deck-preview__close-icon"
            onClick={onClose}
            aria-label="Close preview"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="deck-preview__progress" aria-hidden>
        <div className="deck-preview__progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="deck-preview__body">
        <button
          type="button"
          className="deck-preview__nav"
          onClick={goBack}
          disabled={index === 0}
          aria-label="Previous card"
        >
          ‹
        </button>

        <div
          className="deck-preview__slide"
          key={animKey}
          onTouchStart={(e) => setTouchStartX(e.touches[0]?.clientX ?? null)}
          onTouchEnd={(e) => {
            if (touchStartX === null) return;
            const delta = touchStartX - (e.changedTouches[0]?.clientX ?? touchStartX);
            if (delta > 50) goNext();
            if (delta < -50) goBack();
            setTouchStartX(null);
          }}
        >
          <div className="deck-preview__panel deck-preview__panel--question">
            <div className="deck-preview__panel-head">
              <span className="deck-preview__bar deck-preview__bar--question" aria-hidden />
              <span className="deck-preview__label">Question</span>
              {canSpeak ? (
                <OfflineSpeakButton
                  text={question}
                  voice={voice}
                  stopKey={animKey}
                  online={online}
                  useAiVoice={hasAiReading}
                  apiBaseUrl={apiBaseUrl}
                  className="deck-preview__speak"
                />
              ) : null}
            </div>
            <p className="deck-preview__text">{question}</p>
            {card.front_image_url ? (
              <OfflineImage
                src={card.front_image_url}
                alt="Question"
                className="deck-preview__image"
                online={online}
              />
            ) : null}
          </div>

          <div className="deck-preview__divider">
            <span>Answer</span>
          </div>

          <div className="deck-preview__panel deck-preview__panel--answer">
            <div className="deck-preview__panel-head">
              <span className="deck-preview__bar deck-preview__bar--answer" aria-hidden />
              <span className="deck-preview__label deck-preview__label--muted">Answer</span>
              {canSpeak ? (
                <OfflineSpeakButton
                  text={answer}
                  voice={voice}
                  stopKey={animKey}
                  online={online}
                  useAiVoice={hasAiReading}
                  apiBaseUrl={apiBaseUrl}
                  className="deck-preview__speak"
                />
              ) : null}
            </div>
            <p className="deck-preview__text">{answer}</p>
            {card.back_image_url ? (
              <OfflineImage
                src={card.back_image_url}
                alt="Answer"
                className="deck-preview__image"
                online={online}
              />
            ) : null}
          </div>
        </div>

        <button
          type="button"
          className="deck-preview__nav"
          onClick={goNext}
          disabled={index >= total - 1}
          aria-label="Next card"
        >
          ›
        </button>
      </div>

      <div className="deck-preview__footer">
        <button type="button" className="btn secondary" onClick={onClose}>
          ✕ Close Preview
        </button>
      </div>
    </div>
  );
}
