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

export function DeckQuiz({
  deck,
  userId,
  onBack,
}: {
  deck: OfflineDeckRow;
  userId: string | null;
  onBack: () => void;
}) {
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [saved, setSaved] = useState(false);

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
      } catch {
        // Result stays on device only if save fails.
      }
    },
    [userId, saved, deck.local_id, deck.name, startedAt],
  );

  if (questions === null) {
    return (
      <StudySessionLayout
        modeLabel="Quiz"
        deckName={deck.name}
        backLabel="← Study"
        onBack={onBack}
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

    return (
      <StudySessionLayout
        modeLabel="Quiz Complete"
        deckName={deck.name}
        backLabel="← Study"
        onBack={onBack}
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
          <p className="quiz-results__note">
            {saved
              ? "Your result is saved on this device and will upload on your next sync."
              : "Sign in on the live app and sync to save this result to your account."}
          </p>
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
