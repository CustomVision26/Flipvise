import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  isOfflineDbAvailable,
  getLastOfflineDbError,
} from "../../src/lib/offline/db";
import {
  createCard,
  createDeck,
  listCards,
  listDecksForScope,
  OfflineLimitError,
  recordQuizResult,
} from "../../src/lib/offline/repository";
import type {
  OfflineAccessContext,
  OfflineWorkspaceContext,
} from "../../src/lib/offline/access-context";
import {
  defaultOfflineAccessContext,
  getOfflineAccessContext,
} from "../../src/lib/offline/access-context";
import type {
  OfflineCardRow,
  OfflineDeckRow,
} from "../../src/lib/offline/schema";
import { buildQuizQuestions, type QuizQuestion } from "./quiz";
import {
  getStoredApiBaseUrl,
  getStoredSyncToken,
  getStoredUserId,
  setNativeAppFlag,
} from "../../src/lib/offline/session";
import { runSync, consumePendingOfflinePull } from "../../src/lib/offline/sync";
import { buildTeamAdminMembersPath } from "../../src/lib/team-admin-url";
import { DeckLibrary } from "./deck-library";
import {
  loadWorkspaceScope,
  saveWorkspaceScope,
  type SavedWorkspaceScope,
} from "./workspace-prefs";

const LIVE_URL =
  (import.meta.env.VITE_LIVE_URL as string | undefined) ??
  "https://flipvise-sjgw.onrender.com";

function maxCardsForDeck(
  deck: OfflineDeckRow,
  access: OfflineAccessContext,
): number {
  if (deck.team_id != null) {
    const ws = access.workspaces.find((w) => w.teamId === deck.team_id);
    if (ws) return ws.maxCardsPerDeck;
  }
  return access.maxCardsPerDeck;
}

function canEditDeckContent(deck: OfflineDeckRow): boolean {
  return (deck.member_assigned ?? 0) === 0;
}

function resolveCanCreateDeck(
  scope: SavedWorkspaceScope,
  access: OfflineAccessContext,
): boolean {
  if (scope === "personal") return true;
  const ws = access.workspaces.find((w) => w.teamId === scope);
  return ws?.canCreateDeck ?? false;
}

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
  const [accessContext, setAccessContext] = useState<OfflineAccessContext>(
    defaultOfflineAccessContext(),
  );
  const [workspaceScope, setWorkspaceScope] = useState<SavedWorkspaceScope>(() =>
    loadWorkspaceScope(),
  );
  const [activeDeck, setActiveDeck] = useState<OfflineDeckRow | null>(null);
  const [deckView, setDeckView] = useState<"menu" | "flash" | "quiz">("menu");
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showNewDeck, setShowNewDeck] = useState(false);
  const [addCardsDeck, setAddCardsDeck] = useState<OfflineDeckRow | null>(null);
  const [libraryReady, setLibraryReady] = useState(false);
  const [scopeLoading, setScopeLoading] = useState(false);

  const loadDecks = useCallback(
    async (uid: string, scope: SavedWorkspaceScope) => {
      const rows = await listDecksForScope(
        uid,
        scope === "personal" ? { kind: "personal" } : { kind: "team", teamId: scope },
      );
      setDecks(rows);
    },
    [],
  );

  const refreshAccessContext = useCallback(async () => {
    const ctx = (await getOfflineAccessContext()) ?? defaultOfflineAccessContext();
    setAccessContext(ctx);
    return ctx;
  }, []);

  useEffect(() => {
    void setNativeAppFlag().catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const available = await isOfflineDbAvailable();
        if (cancelled) return;
        setDbReady(available);
        if (!available) return;

        const uid = await getStoredUserId();
        if (cancelled) return;
        setUserId(uid);

        const imported = await consumePendingOfflinePull();
        if (cancelled) return;
        if (imported && (imported.deckCount > 0 || imported.cardCount > 0)) {
          setMessage(
            `Loaded ${imported.deckCount} deck${imported.deckCount === 1 ? "" : "s"} and ${imported.cardCount} card${imported.cardCount === 1 ? "" : "s"} from your last download.`,
          );
        }

        await refreshAccessContext();
        if (cancelled) return;

        const scope = loadWorkspaceScope();
        setWorkspaceScope(scope);
        if (uid) await loadDecks(uid, scope);
      } catch (err) {
        if (!cancelled) setMessage(String(err));
      } finally {
        if (!cancelled) setLibraryReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadDecks, refreshAccessContext]);

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
        fullPull: true,
      });
      await refreshAccessContext();
      await loadDecks(userId, workspaceScope);
      const downloadParts: string[] = [];
      if (result.deckCount > 0) {
        downloadParts.push(`${result.deckCount} deck${result.deckCount === 1 ? "" : "s"}`);
      }
      if (result.cardCount > 0) {
        downloadParts.push(`${result.cardCount} card${result.cardCount === 1 ? "" : "s"}`);
      }
      const downloaded =
        downloadParts.length > 0 ? downloadParts.join(" and ") : "nothing new";
      setMessage(
        `Synced — ${result.pushed} change${result.pushed === 1 ? "" : "s"} uploaded, ${downloaded} downloaded.`,
      );
    } catch {
      setMessage("Couldn't sync right now. Your changes are saved and will sync later.");
    } finally {
      setSyncing(false);
    }
  }, [userId, online, loadDecks, workspaceScope, refreshAccessContext]);

  const handleWorkspaceChange = useCallback(
    async (scope: SavedWorkspaceScope) => {
      setWorkspaceScope(scope);
      saveWorkspaceScope(scope);
      if (!userId) return;
      setScopeLoading(true);
      try {
        await loadDecks(userId, scope);
      } finally {
        setScopeLoading(false);
      }
    },
    [userId, loadDecks],
  );

  const canCreateDeck = useMemo(
    () => resolveCanCreateDeck(workspaceScope, accessContext),
    [workspaceScope, accessContext],
  );

  const activeWorkspace: OfflineWorkspaceContext | null = useMemo(() => {
    if (workspaceScope === "personal") return null;
    return accessContext.workspaces.find((w) => w.teamId === workspaceScope) ?? null;
  }, [workspaceScope, accessContext.workspaces]);

  const ownerWorkspace = useMemo(
    () => accessContext.workspaces.find((w) => w.role === "owner") ?? null,
    [accessContext.workspaces],
  );

  const showTeamAdminDash = ownerWorkspace != null;

  const openLivePath = useCallback(async (path: string) => {
    const storedBase = await getStoredApiBaseUrl().catch(() => null);
    const base = storedBase ?? LIVE_URL;
    const target = `${base}${path}${path.includes("?") ? "&" : "?"}flipvise_native=1`;
    try {
      sessionStorage.setItem("flipvise.native", "1");
      sessionStorage.setItem("flipvise.lastNavigationUrl", target);
    } catch {
      // ignore
    }
    void setNativeAppFlag().catch(() => {});

    if (!navigator.onLine) {
      window.location.href = "./error.html?offline=1";
      return;
    }

    window.location.replace(target);
  }, []);

  const openTeamAdminDash = useCallback(() => {
    if (!online || !ownerWorkspace) return;
    const path = buildTeamAdminMembersPath(
      ownerWorkspace.teamId,
      ownerWorkspace.teamMemberId ?? 0,
    );
    void openLivePath(path);
  }, [online, ownerWorkspace, openLivePath]);

  const openToAdminDash = useCallback(
    (workspace: OfflineWorkspaceContext) => {
      if (!online || !workspace.canAccessTeamAdmin) return;
      const path = buildTeamAdminMembersPath(
        workspace.teamId,
        workspace.teamMemberId ?? 0,
      );
      void openLivePath(path);
    },
    [online, openLivePath],
  );

  useEffect(() => {
    if (workspaceScope === "personal") return;
    if (!accessContext.workspaces.some((w) => w.teamId === workspaceScope)) {
      handleWorkspaceChange("personal");
    }
  }, [accessContext.workspaces, workspaceScope, handleWorkspaceChange]);

  const openLiveApp = useCallback(() => {
    void openLivePath("/dashboard");
  }, [openLivePath]);

  const libraryLoading = dbReady === null || !libraryReady || scopeLoading;

  if (dbReady === false) {
    const dbHint = getLastOfflineDbError();
    return (
      <div className="app">
        <Topbar online={online} onOpen={openLiveApp} onSync={handleSync} syncing={syncing} />
        <div className="content">
          <div className="empty">
            <h2>Offline storage unavailable</h2>
            <p>
              {dbHint ??
                "The on-device database could not be opened. Rebuild and reinstall the app with `npm run mobile:sync:prod`, then try again."}
            </p>
            {online && (
              <p style={{ marginTop: 12, fontSize: 13, color: "var(--muted)" }}>
                You can still use the Dashboard online. Tap <strong>Make available offline</strong>{" "}
                there, then return here — your decks will import automatically.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (addCardsDeck) {
    return (
      <AddCardView
        deck={addCardsDeck}
        maxCardsPerDeck={maxCardsForDeck(addCardsDeck, accessContext)}
        onBack={() => setAddCardsDeck(null)}
        onSaved={async () => {
          if (userId) await loadDecks(userId, workspaceScope);
          setAddCardsDeck(null);
          setActiveDeck(addCardsDeck);
          setDeckView("menu");
        }}
      />
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
        canEdit={canEditDeckContent(activeDeck)}
        onBack={() => setActiveDeck(null)}
        onFlashcards={() => setDeckView("flash")}
        onQuiz={() => setDeckView("quiz")}
        onAddCards={() => setAddCardsDeck(activeDeck)}
      />
    );
  }

  return (
    <div className="app">
      <Topbar online={online} onOpen={openLiveApp} onSync={handleSync} syncing={syncing} />
      <div className="content content--library">
        <DeckLibrary
          decks={decks}
          loading={libraryLoading}
          message={message}
          online={online}
          workspaceScope={workspaceScope}
          workspaces={accessContext.workspaces}
          personalPlanLabel={accessContext.personalPlanLabel ?? "Free"}
          canCreateDeck={canCreateDeck}
          onWorkspaceChange={handleWorkspaceChange}
          onTeamAdminDash={showTeamAdminDash ? openTeamAdminDash : undefined}
          onToAdminDash={openToAdminDash}
          onNewDeck={() => setShowNewDeck(true)}
          onOpenDeck={(deck) => {
            setActiveDeck(deck);
            setDeckView("menu");
          }}
        />
      </div>
      {showNewDeck && (
        <NewDeckSheet
          userId={userId}
          workspaceScope={workspaceScope}
          accessContext={accessContext}
          activeWorkspace={activeWorkspace}
          onClose={() => setShowNewDeck(false)}
          onCreated={async () => {
            if (userId) await loadDecks(userId, workspaceScope);
            setShowNewDeck(false);
            setMessage("Deck saved on this device — add cards, then sync when online.");
          }}
        />
      )}
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
    <header className="topbar">
      <div className="brand">
        <span className="mark" aria-hidden>F</span>
        <div className="brand-text">
          <span className="brand-name">Flipvise</span>
          <span className="brand-tag">Offline study</span>
        </div>
      </div>
      <div className="spacer" />
      <span className={`status-pill${online ? " online" : ""}`}>
        <span className={`dot${online ? " online" : ""}`} aria-hidden />
        {online ? "Online" : "Offline"}
      </span>
      <button
        type="button"
        className="btn secondary btn--sm"
        onClick={onSync}
        disabled={syncing}
      >
        {syncing ? "Syncing…" : "Sync"}
      </button>
      <button
        type="button"
        className="btn secondary btn--sm"
        onClick={onOpen}
        disabled={!online}
        title={online ? "Open the live dashboard" : "Requires an internet connection"}
      >
        Online Dashboard
      </button>
    </header>
  );
}

function DeckMenu({
  deck,
  canEdit,
  onBack,
  onFlashcards,
  onQuiz,
  onAddCards,
}: {
  deck: OfflineDeckRow;
  canEdit: boolean;
  onBack: () => void;
  onFlashcards: () => void;
  onQuiz: () => void;
  onAddCards: () => void;
}) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    listCards(deck.local_id)
      .then((cards) => setCount(cards.length))
      .catch(() => setCount(null));
  }, [deck.local_id]);

  const hasCards = count != null && count > 0;

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
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          {count == null ? "…" : `${count} card${count === 1 ? "" : "s"}`}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
          {canEdit && (
            <button className="btn secondary" style={{ padding: 16 }} onClick={onAddCards}>
              Add cards
            </button>
          )}
          <button
            className="btn"
            style={{ padding: 16 }}
            onClick={onFlashcards}
            disabled={!hasCards}
          >
            Study flashcards
          </button>
          <button
            className="btn secondary"
            style={{ padding: 16 }}
            onClick={onQuiz}
            disabled={!hasCards}
          >
            Take a quiz
          </button>
          {!hasCards && count === 0 && (
            <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
              {canEdit
                ? "Add at least one card to study or quiz."
                : "This assigned deck has no downloaded cards yet."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function NewDeckSheet({
  userId,
  workspaceScope,
  accessContext,
  activeWorkspace,
  onClose,
  onCreated,
}: {
  userId: string | null;
  workspaceScope: SavedWorkspaceScope;
  accessContext: OfflineAccessContext;
  activeWorkspace: OfflineWorkspaceContext | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Deck name is required.");
      return;
    }
    if (!userId) {
      setError("Sign in on the Dashboard while online once, then you can create decks offline.");
      return;
    }
    setBusy(true);
    try {
      const teamId =
        workspaceScope === "personal" ? null : workspaceScope;
      await createDeck({
        userId,
        name: trimmed,
        description: description.trim() || null,
        teamId,
        maxPersonalDecks:
          teamId == null ? accessContext.maxPersonalDecks : undefined,
        maxDecksPerWorkspace:
          teamId != null ? activeWorkspace?.maxDecksPerWorkspace : undefined,
      });
      onCreated();
    } catch (err) {
      if (err instanceof OfflineLimitError) {
        setError(err.message);
      } else {
        setError("Couldn't save the deck. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>New deck</h2>
        <p className="sheet-hint">
          {workspaceScope === "personal"
            ? "Saved to your personal dashboard on this device. Sync uploads it when you're online."
            : `Saved to ${activeWorkspace?.name ?? "team workspace"} on this device.`}
        </p>
        <form onSubmit={handleSubmit} className="form-stack">
          <label className="field">
            <span>Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Animal names"
              autoFocus
            />
          </label>
          <label className="field">
            <span>Description (optional)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this deck about?"
              rows={3}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="row">
            <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn" style={{ flex: 1 }} disabled={busy}>
              {busy ? "Saving…" : "Create deck"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddCardView({
  deck,
  maxCardsPerDeck,
  onBack,
  onSaved,
}: {
  deck: OfflineDeckRow;
  maxCardsPerDeck: number;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(0);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const f = front.trim();
    const b = back.trim();
    if (!f || !b) {
      setError("Front and back are required.");
      return;
    }
    setBusy(true);
    try {
      await createCard({
        deckLocalId: deck.local_id,
        front: f,
        back: b,
        maxCardsPerDeck,
      });
      setFront("");
      setBack("");
      setAdded((n) => n + 1);
    } catch (err) {
      if (err instanceof OfflineLimitError) {
        setError(err.message);
      } else {
        setError("Couldn't save the card.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <button className="btn secondary" onClick={onBack}>
          ← {deck.name}
        </button>
        <div className="spacer" />
        {added > 0 && (
          <button className="btn" onClick={onSaved}>
            Done ({added})
          </button>
        )}
      </div>
      <div className="content">
        <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Add cards</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
          Cards save on this device and sync when you're online. Up to{" "}
          {maxCardsPerDeck} cards per deck on your plan.
        </p>
        <form onSubmit={handleAdd} className="form-stack" style={{ marginTop: 16 }}>
          <label className="field">
            <span>Front (question)</span>
            <input
              value={front}
              onChange={(e) => setFront(e.target.value)}
              placeholder="e.g. Dog"
            />
          </label>
          <label className="field">
            <span>Back (answer)</span>
            <input
              value={back}
              onChange={(e) => setBack(e.target.value)}
              placeholder="e.g. An animal"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "Saving…" : "Add card"}
          </button>
        </form>
        {added > 0 && (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            {added} card{added === 1 ? "" : "s"} added this session.
          </p>
        )}
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
