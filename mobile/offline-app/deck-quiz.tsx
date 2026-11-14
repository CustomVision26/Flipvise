import { useCallback, useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { listCards, recordQuizResult } from "../../src/lib/offline/repository";
import type { OfflineDeckRow } from "../../src/lib/offline/schema";
import { buildQuizQuestions, type QuizQuestion } from "./quiz";
import {
  StudySessionControls,
  StudySessionEmpty,
  StudySessionLayout,
  StudySessionLoading,
} from "./study-session-layout";
import {
  resolveDeckWorkspaceInfo,
  type DeckWorkspaceContextInput,
} from "./deck-workspace-context";
import { OfflineImage } from "./offline-image";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;
const SCORE_CONFETTI_COLORS = ["#a786ff", "#fd8bbc", "#eca184", "#f8deb1"];

function ScoreConfetti({ percent }: { percent: number }) {
  useEffect(() => {
    if (percent < 90) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let frame = 0;
    const end = Date.now() + 3000;
    const tick = () => {
      if (cancelled || Date.now() > end) return;
      void confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        startVelocity: 60,
        origin: { x: 0, y: 0.5 },
        colors: SCORE_CONFETTI_COLORS,
        zIndex: 9999,
      });
      void confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        startVelocity: 60,
        origin: { x: 1, y: 0.5 },
        colors: SCORE_CONFETTI_COLORS,
        zIndex: 9999,
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      confetti.reset();
    };
  }, [percent]);

  return null;
}

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
  workspaceContext,
  onAutoSync,
  onBack,
}: {
  deck: OfflineDeckRow;
  userId: string | null;
  online: boolean;
  workspaceContext: DeckWorkspaceContextInput;
  /** When online, uploads dirty rows (including this quiz) to the server. */
  onAutoSync?: () => Promise<boolean>;
  onBack: () => void;
}) {
  const workspaceInfo = resolveDeckWorkspaceInfo(deck, workspaceContext);
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
        workspaceInfo={workspaceInfo}
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
        workspaceInfo={workspaceInfo}
      >
        <StudySessionEmpty
          title="Quiz unavailable"
          body="Add more cards with clear questions and answers on the deck page to generate a quiz."
        />
      </StudySessionLayout>
    );
  }

  if (finished) {
    const preview = questions.map((q, i) => {
      const choice = answers[i];
      const status =
        choice == null ? "unanswered" : choice === q.correctIndex ? "correct" : "incorrect";
      return {
        status,
        question: q.question,
        selected: choice == null ? null : q.options[choice],
        correctAnswer: q.options[q.correctIndex],
      } as const;
    });
    const correctCount = preview.filter((row) => row.status === "correct").length;
    const incorrectCount = preview.filter((row) => row.status === "incorrect").length;
    const unansweredCount = preview.filter((row) => row.status === "unanswered").length;
    const percent = Math.round((correctCount / questions.length) * 100);
    const note = quizResultNote({ userId, online, saved, uploadState });

    return (
      <StudySessionLayout
        modeLabel="Quiz Complete"
        deckName={deck.name}
        backLabel="Back to study"
        onBack={onBack}
        online={online}
        workspaceInfo={workspaceInfo}
        variant="results"
        footer={
          <StudySessionControls>
            <button type="button" className="btn" onClick={onBack}>
              Return to study
            </button>
          </StudySessionControls>
        }
      >
        <div className="quiz-results">
          <ScoreConfetti percent={percent} />
          <p className="quiz-results__brand">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M13 2 L4 14 h7 l-1 8 10-14 h-7 z" fill="currentColor" />
            </svg>
            Flipvise
          </p>
          <img
            className="quiz-results__mascot"
            src={`${import.meta.env.BASE_URL || "./"}artwork/score-owl.png`}
            alt=""
          />
          <div className="quiz-results__score-card">
            <span className="quiz-results__label">Your score</span>
            <p className="quiz-results__percent">{percent}%</p>
            <p className="quiz-results__summary">
              {correctCount} correct · {incorrectCount} incorrect · {unansweredCount} unanswered
            </p>
          </div>
          <section className="quiz-results__preview" aria-label="Inbox result preview">
            <p className="quiz-results__preview-title">Inbox preview</p>
            <div className="quiz-results__counts">
              <p className="quiz-results__count quiz-results__count--correct">
                <strong>{correctCount}</strong>
                <span>Correct</span>
              </p>
              <p className="quiz-results__count quiz-results__count--incorrect">
                <strong>{incorrectCount}</strong>
                <span>Incorrect</span>
              </p>
              <p className="quiz-results__count quiz-results__count--unanswered">
                <strong>{unansweredCount}</strong>
                <span>Unanswered</span>
              </p>
            </div>
            <ol className="quiz-results__items">
              {preview.map((row, i) => (
                <li key={i} className={`quiz-results__item quiz-results__item--${row.status}`}>
                  <p className="quiz-results__item-head">
                    <span className="quiz-results__item-num">{i + 1}</span>
                    <span className="quiz-results__status">
                      {row.status === "correct"
                        ? "Correct"
                        : row.status === "incorrect"
                          ? "Incorrect"
                          : "Unanswered"}
                    </span>
                  </p>
                  <p className="quiz-results__item-question">{row.question}</p>
                  {row.status === "correct" ? (
                    <p className="quiz-results__item-line">Answer: {row.selected}</p>
                  ) : null}
                  {row.status === "incorrect" ? (
                    <>
                      <p className="quiz-results__item-line quiz-results__item-line--wrong">
                        Selected: {row.selected}
                      </p>
                      <p className="quiz-results__item-line quiz-results__item-line--right">
                        Correct answer: {row.correctAnswer}
                      </p>
                    </>
                  ) : null}
                  {row.status === "unanswered" ? (
                    <p className="quiz-results__item-line quiz-results__item-line--right">
                      Correct answer: {row.correctAnswer}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
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
      workspaceInfo={workspaceInfo}
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
          {q.questionImageUrl ? (
            <OfflineImage
              src={q.questionImageUrl}
              alt="Question image"
              className="quiz-question-card__image"
              online={online}
            />
          ) : null}
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
