import { useCallback, useEffect, useState } from "react";
import {
  isOfflineDbAvailable,
} from "../../src/lib/offline/db";
import { listCards, listDecks } from "../../src/lib/offline/repository";
import type {
  OfflineCardRow,
  OfflineDeckRow,
} from "../../src/lib/offline/schema";
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
    window.location.href = LIVE_URL;
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
    return (
      <StudyView
        deck={activeDeck}
        onBack={() => setActiveDeck(null)}
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
                ? "Tap “Open Flipvise”, sign in, then choose “Make available offline” on a deck to study it here without a connection."
                : "You're offline and have no downloaded decks. Reconnect and download decks to study offline."}
            </p>
          </div>
        ) : (
          decks.map((deck) => (
            <DeckCard key={deck.local_id} deck={deck} onOpen={() => setActiveDeck(deck)} />
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
