import { useCallback, useEffect, useState } from "react";
import {
  isOfflineDbAvailable,
} from "../../src/lib/offline/db";
import {
  listCards,
  listDecks,
  recordQuizResult,
} from "../../src/lib/offline/repository";
import type {
  OfflineCardRow,
  OfflineDeckRow,
} from "../../src/lib/offline/schema";
import { buildQuizQuestions, type QuizQuestion } from "./quiz";
import {
  getStoredApiBaseUrl,
  getStoredSyncToken,
  getStoredUserId,
} from "../../src/lib/offline/session";
import { runSync } from "../../src/lib/offline/sync";

const LIVE_URL =
  (import.meta.env.VITE_LIVE_URL as string | undefined) ??
  "https://flipvise-sjgw.onrender.com";

function useOnline(): boolean {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function App() {
  const online = useOnline();
  const [userId, setUserId] = useState<string | null>(null);
  const [dbReady, setDbReady] = useState<boolean | null>(null);
  const [decks, setDecks] = useState<OfflineDeckRow[]>([]);
  const [activeDeck, setActiveDeck] = useState<OfflineDeckRow | null>(null);
  const [deckView, setDeckView] = useState<"menu" | "flash" | "quiz">("menu");
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadDecks = useCallback(async (uid: string) => {
    const rows = await listDecks(uid);
    setDecks(rows);
  }, []);

  useEffect(() => {
    (async () => {
      const available = await isOfflineDbAvailable();
      setDbReady(available);
      if (!available) return;
      const uid = await getStoredUserId();
      setUserId(uid);
      if (uid) await loadDecks(uid);
    })().catch((err) => setMessage(String(err)));
  }, [loadDecks]);

  const handleSync = useCallback(async () => {
    if (!userId) {
      setMessage("Sign in on the live app first to download your decks.");
      return;
    }
    if (!online) {
      setMessage("You're offline — showing your downloaded decks.");
      return;
    }
    setSyncing(true);
    setMessage(null);
    try {
      const [token, storedBase] = await Promise.all([
        getStoredSyncToken(),
        getStoredApiBaseUrl(),
      ]);
      if (!token) {
        setMessage(
          "Open Flipvise, sign in, and tap “Make available offline” once to enable syncing.",
        );
        return;
      }
      const result = await runSync({
        userId,
        apiBaseUrl: storedBase ?? LIVE_URL,
        token,
      });
      await loadDecks(userId);
      setMessage(
        `Synced — ${result.pushed} change${result.pushed === 1 ? "" : "s"} uploaded, ${result.pulled} downloaded.`,
      );
    } catch {
      setMessage("Couldn't sync right now. Your changes are saved and will sync later.");
    } finally {
      setSyncing(false);
    }
  }, [userId, online, loadDecks]);

  const openLiveApp = useCallback(() => {
    const target = `${LIVE_URL}/dashboard?flipvise_native=1`;
    try {
      sessionStorage.setItem("flipvise.native", "1");
    } catch {
      // ignore
    }
    // replace() keeps navigation in the Capacitor WebView (allowNavigation) instead of spawning Chrome.
    window.location.replace(target);
  }, []);

  if (dbReady === false) {
    return (
      <div className="app">
        <Topbar online={online} onOpen={openLiveApp} onSync={handleSync} syncing={syncing} />
        <div className="content">
          <div className="empty">
            <h2>Offline storage unavailable</h2>
            <p>
              The on-device database runs inside the Flipvise mobile app. Build and
              install the app to use offline study.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (activeDeck) {
    if (deckView === "flash") {
      return <StudyView deck={activeDeck} onBack={() => setDeckView("menu")} />;
    }
    if (deckView === "quiz") {
      return (
        <QuizView
          deck={activeDeck}
          userId={userId}
          onBack={() => setDeckView("menu")}
        />
      );
    }
    return (
      <DeckMenu
        deck={activeDeck}
        onBack={() => setActiveDeck(null)}
        onFlashcards={() => setDeckView("flash")}
        onQuiz={() => setDeckView("quiz")}
      />
    );
  }

  return (
    <div className="app">
      <Topbar online={online} onOpen={openLiveApp} onSync={handleSync} syncing={syncing} />
      <div className="content">
        {message && (
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>{message}</p>
        )}
        {decks.length === 0 ? (
          <div className="empty">
            <h2>No downloaded decks yet</h2>
            <p>
              {online
                ? "Tap “Open Flipvise”, sign in, then tap “Make available offline” at the top of your dashboard. Return here with “Offline study” to practice without a connection."
                : "You're offline and have no downloaded decks. Reconnect and download decks to study offline."}
            </p>
          </div>
        ) : (
          decks.map((deck) => (
            <DeckCard
              key={deck.local_id}
              deck={deck}
              onOpen={() => {
                setActiveDeck(deck);
                setDeckView("menu");
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

function Topbar({
  online,
  onOpen,
  onSync,
  syncing,
}: {
  online: boolean;
  onOpen: () => void;
  onSync: () => void;
  syncing: boolean;
}) {
  return (
    <div className="topbar">
      <div className="brand">
        <span className="mark">F</span>
        <span>Flipvise</span>
      </div>
      <div className="spacer" />
      <span className="status">
        <span className={online ? "dot online" : "dot"} />
        {online ? "Online" : "Offline"}
      </span>
      <button className="btn secondary" onClick={onSync} disabled={syncing}>
        {syncing ? "Syncing…" : "Sync"}
      </button>
      {online && (
        <button className="btn" onClick={onOpen}>
          Open Flipvise
        </button>
      )}
    </div>
  );
}

function DeckCard({
  deck,
  onOpen,
}: {
  deck: OfflineDeckRow;
  onOpen: () => void;
}) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    listCards(deck.local_id)
      .then((cards) => setCount(cards.length))
      .catch(() => setCount(null));
  }, [deck.local_id]);

  return (
    <button className="deck-card" onClick={onOpen}>
      <h3>{deck.name}</h3>
      {deck.description && <p>{deck.description}</p>}
      <div className="count">
        {count == null ? "…" : `${count} card${count === 1 ? "" : "s"}`}
      </div>
    </button>
  );
}

function DeckMenu({
  deck,
  onBack,
  onFlashcards,
  onQuiz,
}: {
  deck: OfflineDeckRow;
  onBack: () => void;
  onFlashcards: () => void;
  onQuiz: () => void;
}) {
  return (
    <div className="app">
      <div className="topbar">
        <button className="btn secondary" onClick={onBack}>
          ← Decks
        </button>
        <div className="spacer" />
      </div>
      <div className="content">
        <div className="study-head">
          <h2>{deck.name}</h2>
        </div>
        {deck.description && (
          <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>
            {deck.description}
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
          <button className="btn" style={{ padding: 16 }} onClick={onFlashcards}>
            Study flashcards
          </button>
          <button className="btn secondary" style={{ padding: 16 }} onClick={onQuiz}>
            Take a quiz
          </button>
        </div>
      </div>
    </div>
  );
}

function QuizView({
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
    listCards(deck.local_id)
      .then((cards) => {
        const built = buildQuizQuestions(cards);
        setQuestions(built);
        setAnswers(new Array(built.length).fill(null));
      })
      .catch(() => setQuestions([]));
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
        // Result stays in memory; it just won't sync if saving failed.
      }
    },
    [userId, saved, deck.local_id, deck.name, startedAt],
  );

  if (questions == null) {
    return (
      <div className="app">
        <div className="topbar">
          <button className="btn secondary" onClick={onBack}>
            ← Back
          </button>
          <div className="spacer" />
        </div>
        <div className="content">
          <p style={{ color: "var(--muted)" }}>Building quiz…</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="app">
        <div className="topbar">
          <button className="btn secondary" onClick={onBack}>
            ← Back
          </button>
          <div className="spacer" />
        </div>
        <div className="content">
          <div className="empty">
            <h2>Not enough cards</h2>
            <p>Add a few more cards with answers to generate an offline quiz.</p>
          </div>
        </div>
      </div>
    );
  }

  if (finished) {
    const correctCount = questions.filter(
      (q, i) => answers[i] === q.correctIndex,
    ).length;
    const percent = Math.round((correctCount / questions.length) * 100);
    return (
      <div className="app">
        <div className="topbar">
          <button className="btn secondary" onClick={onBack}>
            ← Decks
          </button>
          <div className="spacer" />
          <span className="progress">{saved ? "Saved" : "Not saved"}</span>
        </div>
        <div className="content">
          <div className="study-head">
            <h2>Quiz complete</h2>
          </div>
          <div className="flashcard" style={{ cursor: "default", minHeight: 160 }}>
            <div>
              <div className="face-label">Score</div>
              <div style={{ fontSize: 40, fontWeight: 700 }}>{percent}%</div>
              <div style={{ color: "var(--muted)", marginTop: 8 }}>
                {correctCount} / {questions.length} correct
              </div>
            </div>
          </div>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 14 }}>
            {saved
              ? "Result saved on this device — it uploads on your next sync."
              : "Sign in and sync to save quiz results to your account."}
          </p>
          <div className="controls">
            <button className="btn" onClick={onBack}>
              Back to deck
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[index];
  const isLast = index === questions.length - 1;

  const choose = (i: number) => setSelected(i);

  const advance = () => {
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
    <div className="app">
      <div className="topbar">
        <button className="btn secondary" onClick={onBack}>
          ← Back
        </button>
        <div className="spacer" />
        <span className="progress">
          {index + 1} / {questions.length}
        </span>
      </div>
      <div className="content study">
        <div className="study-head">
          <h2>{deck.name} — Quiz</h2>
        </div>
        <div
          className="flashcard"
          style={{ cursor: "default", alignItems: "flex-start", minHeight: 120 }}
        >
          <div>
            <div className="face-label">Question {index + 1}</div>
            <div>{q.question}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          {q.options.map((opt, i) => (
            <button
              key={i}
              className={i === selected ? "btn" : "btn secondary"}
              style={{ padding: 14, textAlign: "left" }}
              onClick={() => choose(i)}
            >
              {opt}
            </button>
          ))}
        </div>
        <div className="controls">
          <button className="btn" onClick={advance} disabled={selected == null}>
            {isLast ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StudyView({
  deck,
  onBack,
}: {
  deck: OfflineDeckRow;
  onBack: () => void;
}) {
  const [cards, setCards] = useState<OfflineCardRow[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    listCards(deck.local_id).then(setCards).catch(() => setCards([]));
  }, [deck.local_id]);

  const card = cards[index];

  const next = () => {
    setFlipped(false);
    setIndex((i) => Math.min(i + 1, Math.max(cards.length - 1, 0)));
  };
  const prev = () => {
    setFlipped(false);
    setIndex((i) => Math.max(i - 1, 0));
  };

  return (
    <div className="app">
      <div className="topbar">
        <button className="btn secondary" onClick={onBack}>
          ← Decks
        </button>
        <div className="spacer" />
        <span className="progress">
          {cards.length === 0 ? "0 / 0" : `${index + 1} / ${cards.length}`}
        </span>
      </div>
      <div className="content study">
        <div className="study-head">
          <h2>{deck.name}</h2>
        </div>
        {cards.length === 0 ? (
          <div className="empty">
            <h2>No cards</h2>
            <p>This deck has no downloaded cards yet.</p>
          </div>
        ) : (
          <>
            <div className="flashcard-wrap">
              <div className="flashcard" onClick={() => setFlipped((f) => !f)}>
                <div>
                  <div className="face-label">{flipped ? "Answer" : "Question"}</div>
                  <div>
                    {flipped
                      ? card?.back || "(no answer)"
                      : card?.front || "(no question)"}
                  </div>
                </div>
                <span className="hint">Tap to flip</span>
              </div>
            </div>
            <div className="controls">
              <button className="btn secondary" onClick={prev} disabled={index === 0}>
                Previous
              </button>
              <button
                className="btn"
                onClick={next}
                disabled={index >= cards.length - 1}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
