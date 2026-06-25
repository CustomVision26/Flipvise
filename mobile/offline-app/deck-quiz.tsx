import { useCallback, useEffect, useState } from "react";
import { listCards, recordQuizResult } from "../../src/lib/offline/repository";
import type { OfflineDeckRow } from "../../src/lib/offline/schema";
import { buildQuizQuestions, type QuizQuestion } from "./quiz";
import {
  StudySessionControls,
  StudySessionEmpty,
  StudySessionLayout,
  StudySessionLoading,
} from "./study-session-layout";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

type UploadState = "idle" | "uploading" | "synced" | "failed";

function quizResultNote({
  userId,
  online,
  saved,
  uploadState,
}: {
  userId: string | null;
  online: boolean;
  saved: boolean;
  uploadState: UploadState;
}): { text: string; className: string } {
  if (!userId) {
    return {
      text: "Sign in on the live app and sync to save this result to your account.",
      className: "quiz-results__note",
    };
  }
  if (!saved) {
    return {
      text: "Saving your result…",
      className: "quiz-results__note",
    };
  }
  if (uploadState === "uploading") {
    return {
      text: "Uploading your result to your account…",
      className: "quiz-results__note",
    };
  }
  if (uploadState === "synced") {
    return {
      text: "Your result was sent to your inbox. Open the online dashboard to view it.",
      className: "quiz-results__note quiz-results__note--success",
    };
  }
  if (uploadState === "failed") {
    return {
      text: "Saved on this device. Tap Sync on the deck list — the server may be waking up.",
      className: "quiz-results__note",
    };
  }
  if (online) {
    return {
      text: "Saved on this device. Tap Sync on the deck list to upload to your inbox.",
      className: "quiz-results__note",
    };
  }
  return {
    text: "Saved on this device. Sync when you're back online to send it to your inbox.",
    className: "quiz-results__note",
  };
}

export function DeckQuiz({
  deck,
  userId,
  online,
  onAutoSync,
  onBack,
}: {
  deck: OfflineDeckRow;
  userId: string | null;
  online: boolean;
  /** When online, uploads dirty rows (including this quiz) to the server. */
  onAutoSync?: () => Promise<boolean>;
  onBack: () => void;
}) {
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [saved, setSaved] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");

  useEffect(() => {
    let cancelled = false;
    listCards(deck.local_id)
      .then((cards) => {
        if (cancelled) return;
        const built = buildQuizQuestions(cards);
        setQuestions(built);
        setAnswers(new Array(built.length).fill(null));
      })
      .catch(() => {
        if (!cancelled) {
          setQuestions([]);
          setAnswers([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [deck.local_id]);

  const finishQuiz = useCallback(
    async (finalAnswers: (number | null)[], qs: QuizQuestion[]) => {
      setFinished(true);
      if (!userId || saved) return;
      let correct = 0;
      let incorrect = 0;
      let unanswered = 0;
      const perCard = qs.map((q, i) => {
        const choice = finalAnswers[i];
        const isCorrect = choice === q.correctIndex;
        if (choice == null) unanswered++;
        else if (isCorrect) correct++;
        else incorrect++;
        return {
          cardId: q.cardServerId ?? 0,
          question: q.question,
          correctAnswer: q.options[q.correctIndex],
          selectedAnswer: choice == null ? null : q.options[choice],
          correct: isCorrect,
        };
      });
      const total = qs.length;
      const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
      try {
        await recordQuizResult({
          userId,
          deckLocalId: deck.local_id,
          deckName: deck.name,
          correct,
          incorrect,
          unanswered,
          total,
          percent,
          elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
          perCard,
        });
        setSaved(true);

        if (online && onAutoSync) {
          setUploadState("uploading");
          const ok = await onAutoSync();
          setUploadState(ok ? "synced" : "failed");
        }
      } catch {
        // Result stays on device only if save fails.
      }
    },
    [userId, saved, deck.local_id, deck.name, startedAt, online, onAutoSync],
  );

  if (questions === null) {
    return (
      <StudySessionLayout
        modeLabel="Quiz"
        deckName={deck.name}
        backLabel="← Study"
        onBack={onBack}
        online={online}
      >
        <StudySessionLoading message="Preparing your quiz…" />
      </StudySessionLayout>
    );
  }

  if (questions.length === 0) {
    return (
      <StudySessionLayout
        modeLabel="Quiz"
        deckName={deck.name}
        backLabel="← Study"
        onBack={onBack}
        online={online}
      >
        <StudySessionEmpty
          title="Quiz unavailable"
          body="Add more cards with clear questions and answers on the deck page to generate a quiz."
        />
      </StudySessionLayout>
    );
  }

  if (finished) {
    const correctCount = questions.filter(
      (q, i) => answers[i] === q.correctIndex,
    ).length;
    const percent = Math.round((correctCount / questions.length) * 100);
    const incorrectCount = questions.length - correctCount;
    const note = quizResultNote({ userId, online, saved, uploadState });

    return (
      <StudySessionLayout
        modeLabel="Quiz Complete"
        deckName={deck.name}
        backLabel="← Study"
        onBack={onBack}
        online={online}
        footer={
          <StudySessionControls>
            <button type="button" className="btn" onClick={onBack}>
              Return to study
            </button>
          </StudySessionControls>
        }
      >
        <div className="quiz-results">
          <div className="quiz-results__score-card">
            <span className="quiz-results__label">Your score</span>
            <p className="quiz-results__percent">{percent}%</p>
            <p className="quiz-results__summary">
              {correctCount} correct · {incorrectCount} incorrect ·{" "}
              {questions.length} total
            </p>
          </div>
          <p className={note.className}>{note.text}</p>
        </div>
      </StudySessionLayout>
    );
  }

  const q = questions[index];
  const isLast = index === questions.length - 1;

  const advance = () => {
    if (selected == null) return;
    const nextAnswers = [...answers];
    nextAnswers[index] = selected;
    setAnswers(nextAnswers);
    setSelected(null);
    if (isLast) {
      void finishQuiz(nextAnswers, questions);
    } else {
      setIndex((n) => n + 1);
    }
  };

  return (
    <StudySessionLayout
      modeLabel="Quiz"
      deckName={deck.name}
      backLabel="← Study"
      onBack={onBack}
      online={online}
      progressCurrent={index + 1}
      progressTotal={questions.length}
      footer={
        <StudySessionControls>
          <button
            type="button"
            className="btn"
            onClick={advance}
            disabled={selected == null}
          >
            {isLast ? "Submit quiz" : "Next question"}
          </button>
        </StudySessionControls>
      }
    >
      <div className="quiz-stage">
        <article className="quiz-question-card">
          <header className="quiz-question-card__header">
            <span className="quiz-question-card__index">
              Question {index + 1}
            </span>
          </header>
          <p className="quiz-question-card__text">{q.question}</p>
        </article>

        <fieldset className="quiz-options">
          <legend className="quiz-options__legend">Select one answer</legend>
          {q.options.map((opt, i) => {
            const letter = OPTION_LETTERS[i] ?? String(i + 1);
            const isSelected = i === selected;
            return (
              <button
                key={i}
                type="button"
                className={`quiz-option${isSelected ? " quiz-option--selected" : ""}`}
                onClick={() => setSelected(i)}
                aria-pressed={isSelected}
              >
                <span className="quiz-option__letter" aria-hidden>
                  {letter}
                </span>
                <span className="quiz-option__text">{opt}</span>
                {isSelected ? (
                  <span className="quiz-option__check" aria-hidden>
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </fieldset>
      </div>
    </StudySessionLayout>
  );
}
