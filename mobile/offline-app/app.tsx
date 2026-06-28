import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  isOfflineDbAvailable,
  getLastOfflineDbError,
} from "../../src/lib/offline/db";
import {
  createCard,
  createDeck,
  listDecksForScope,
  OfflineLimitError,
  purgeAllInvitedWorkspaceStudyCopies,
  purgeLocallyCreatedTeamDecks,
  purgeStaleInvitedWorkspaceStudyDecks,
  repairPersonalDeckRows,
  repairTeamWorkspaceDeckRows,
} from "../../src/lib/offline/repository";
import type {
  OfflineAccessContext,
  OfflineWorkspaceContext,
} from "../../src/lib/offline/access-context";
import {
  consumeOfflineLibraryMigrationPendingSync,
  defaultOfflineAccessContext,
  getOfflineAccessContext,
  resolveOfflineAccountPlanDisplay,
  resolveOfflinePersonalPlanLabel,
} from "../../src/lib/offline/access-context";
import type { OfflineDeckRow } from "../../src/lib/offline/schema";
import {
  getStoredApiBaseUrl,
  getStoredSyncToken,
  getStoredUserId,
  setNativeAppFlag,
  setStoredApiBaseUrl,
} from "../../src/lib/offline/session";
import { runSync, consumePendingOfflinePull, resetSyncPullCursor } from "../../src/lib/offline/sync";
import { buildTeamAdminMembersPath } from "../../src/lib/team-admin-url";
import { applyOfflineTheme } from "./apply-offline-theme";
import { AccountMenu } from "./account-menu";
import { SettingsSheet } from "./settings-sheet";
import { DeckLibrary } from "./deck-library";
import { ImagePickerField } from "./image-picker-field";
import { DeckDetail } from "./deck-detail";
import { DeckStudyHub } from "./deck-study-hub";
import { StandardReview } from "./standard-review";
import { DeckQuiz } from "./deck-quiz";
import { ConnectionStatusPill } from "./connection-status";
import type { DeckWorkspaceContextInput } from "./deck-workspace-context";
import {
  loadWorkspaceScope,
  saveWorkspaceScope,
  type SavedWorkspaceScope,
} from "./workspace-prefs";

const LIVE_URL =
  (import.meta.env.VITE_LIVE_URL as string | undefined) ??
  "https://flipvise-sjgw.onrender.com";

/** Live origin from this native build — not a stale value from Preferences. */
function bundledLiveUrl(): string {
  return LIVE_URL.replace(/\/$/, "");
}

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

function resolveCanCreateDeck(scope: SavedWorkspaceScope): boolean {
  // Team workspace decks are created on the live dashboard (personal dash), not offline.
  return scope === "personal";
}

function canEditDeckContent(
  deck: OfflineDeckRow,
  scope: SavedWorkspaceScope,
): boolean {
  // Decks on the Personal Dashboard are owned by the user (member_assigned == 0),
  // so they're editable offline even when linked to a workspace (team_id set).
  // Team-workspace decks are managed on the online dashboard and stay read-only here.
  if (scope !== "personal") return false;
  return (deck.member_assigned ?? 0) === 0;
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

function invitedWorkspaceTeamIds(ctx: OfflineAccessContext): Set<number> {
  const ids = new Set<number>();
  for (const w of ctx.workspaces) {
    if (w.isSubscriberOwned ?? w.role === "owner") continue;
    ids.add(w.teamId);
  }
  return ids;
}

export function App() {
  const online = useOnline();
  const [userId, setUserId] = useState<string | null>(null);
  const [dbReady, setDbReady] = useState<boolean | null>(null);
  const [decks, setDecks] = useState<OfflineDeckRow[]>([]);
  const [accessContext, setAccessContext] = useState<OfflineAccessContext>(
    defaultOfflineAccessContext(),
  );
  const [workspaceScope, setWorkspaceScope] = useState<SavedWorkspaceScope>("personal");
  const [activeDeck, setActiveDeck] = useState<OfflineDeckRow | null>(null);
  const [deckView, setDeckView] = useState<
    "menu" | "study-hub" | "flash" | "quiz"
  >("menu");
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showNewDeck, setShowNewDeck] = useState(false);
  const [addCardsDeck, setAddCardsDeck] = useState<OfflineDeckRow | null>(null);
  const [libraryReady, setLibraryReady] = useState(false);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Match the live dashboard's light/dark mode + interface colors (saved offline).
  useEffect(() => {
    void applyOfflineTheme();
  }, []);

  const loadDecks = useCallback(
    async (
      uid: string,
      scope: SavedWorkspaceScope,
      ctx: OfflineAccessContext = defaultOfflineAccessContext(),
    ) => {
      const workspace =
        scope === "personal"
          ? null
          : ctx.workspaces.find((w) => w.teamId === scope) ?? null;
      const workspaceRole = workspace?.role ?? "team_member";
      const rows = await listDecksForScope(
        uid,
        scope === "personal" ? { kind: "personal" } : { kind: "team", teamId: scope },
        workspaceRole,
        scope === "personal"
          ? { invitedWorkspaceTeamIds: invitedWorkspaceTeamIds(ctx) }
          : {
              workspaceDeckServerIds: workspace?.workspaceDeckServerIds ?? [],
            },
      );
      setDecks(rows);
      return rows;
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
    // Keep Preferences in sync with the URL baked into this APK/IPA (dev vs prod).
    void setStoredApiBaseUrl(bundledLiveUrl()).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const DB_BOOT_TIMEOUT_MS = 15_000;
        const available = await Promise.race([
          isOfflineDbAvailable(),
          new Promise<boolean>((resolve) => {
            window.setTimeout(() => resolve(false), DB_BOOT_TIMEOUT_MS);
          }),
        ]);
        if (cancelled) return;
        if (!available && !getLastOfflineDbError()) {
          setMessage(
            "Offline storage is taking too long to start. Force-quit and reopen the app, or reinstall from TestFlight.",
          );
        }
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

        const ctx = await refreshAccessContext();
        if (cancelled) return;

        if (uid && (await consumeOfflineLibraryMigrationPendingSync())) {
          await resetSyncPullCursor().catch(() => {});
          await purgeAllInvitedWorkspaceStudyCopies(uid).catch(() => {});
        }

        let scope = await loadWorkspaceScope();
        setWorkspaceScope(scope);
        if (uid) {
          await purgeLocallyCreatedTeamDecks(uid);
          await repairPersonalDeckRows(uid).catch(() => {});
          await purgeStaleInvitedWorkspaceStudyDecks(uid, ctx.workspaces).catch(() => {});
          await repairTeamWorkspaceDeckRows(uid, ctx.workspaces).catch(() => {});
          if (cancelled) return;
          let rows = await loadDecks(uid, scope, ctx);
          if (
            !cancelled &&
            scope !== "personal" &&
            rows.length === 0
          ) {
            const personalRows = await loadDecks(uid, "personal", ctx);
            if (personalRows.length > 0) {
              scope = "personal";
              setWorkspaceScope("personal");
              await saveWorkspaceScope("personal");
              rows = personalRows;
              setMessage(
                "Switched to Personal Dash — your downloaded decks are here. Use the workspace menu for team workspaces.",
              );
            }
          }
        }
      } catch (err) {
        if (!cancelled) setMessage(String(err));
      } finally {
        if (!cancelled) setLibraryReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Mount-only bootstrap — must not re-run when access context / loadDecks identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload the library when returning from the live dashboard in the same WebView.
  useEffect(() => {
    if (!libraryReady || !userId) return;

    const refreshFromStorage = async () => {
      const ctx = await refreshAccessContext();
      const scope = await loadWorkspaceScope();
      setWorkspaceScope(scope);
      await repairPersonalDeckRows(userId).catch(() => {});
      await purgeStaleInvitedWorkspaceStudyDecks(userId, ctx.workspaces).catch(() => {});
      await repairTeamWorkspaceDeckRows(userId, ctx.workspaces).catch(() => {});
      await loadDecks(userId, scope, ctx);
    };

    const onPageShow = () => {
      void refreshFromStorage();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [libraryReady, userId, loadDecks, refreshAccessContext]);

  const runSyncNow = useCallback(
    async (options?: { showSuccess?: boolean }): Promise<boolean> => {
      if (!userId) return false;
      if (!online) return false;
      setSyncing(true);
      try {
        const [token] = await Promise.all([
          getStoredSyncToken(),
        ]);
        if (!token) {
          if (options?.showSuccess !== false) {
            setMessage(
              "Open Flipvise, sign in, and tap “Make available offline” once to enable syncing.",
            );
          }
          return false;
        }
        const result = await runSync({
          userId,
          apiBaseUrl: bundledLiveUrl(),
          token,
          fullPull: true,
        });
        const ctx = await refreshAccessContext();
        await purgeStaleInvitedWorkspaceStudyDecks(userId, ctx.workspaces).catch(() => {});
        await repairTeamWorkspaceDeckRows(userId, ctx.workspaces).catch(() => {});
        await loadDecks(userId, workspaceScope, ctx);
        if (options?.showSuccess !== false) {
          const downloadParts: string[] = [];
          if (result.deckCount > 0) {
            downloadParts.push(
              `${result.deckCount} deck${result.deckCount === 1 ? "" : "s"}`,
            );
          }
          if (result.cardCount > 0) {
            downloadParts.push(
              `${result.cardCount} card${result.cardCount === 1 ? "" : "s"}`,
            );
          }
          const downloaded =
            downloadParts.length > 0 ? downloadParts.join(" and ") : "nothing new";
          setMessage(
            `Synced — ${result.pushed} change${result.pushed === 1 ? "" : "s"} uploaded, ${downloaded} downloaded.`,
          );
        }
        return true;
      } catch (err) {
        const detail = err instanceof Error ? err.message : "";
        if (options?.showSuccess !== false) {
          setMessage(
            detail.startsWith("Sync failed:")
              ? `${detail}. Your changes are saved on this device — try Sync again in a moment.`
              : "Couldn't sync right now. Your changes are saved and will sync later.",
          );
        }
        return false;
      } finally {
        setSyncing(false);
      }
    },
    [userId, online, loadDecks, workspaceScope, refreshAccessContext],
  );

  // Reconcile ghost decks (deleted on server) when the library opens online.
  const didAutoSyncRef = useRef(false);
  useEffect(() => {
    if (!libraryReady || !userId || !online || didAutoSyncRef.current) return;
    didAutoSyncRef.current = true;
    void runSyncNow({ showSuccess: false });
  }, [libraryReady, userId, online, runSyncNow]);

  const handleSync = useCallback(async () => {
    if (!userId) {
      setMessage("Sign in on the live app first to download your decks.");
      return;
    }
    if (!online) {
      setMessage("You're offline — showing your downloaded decks.");
      return;
    }
    setMessage(null);
    await runSyncNow({ showSuccess: true });
  }, [userId, online, runSyncNow]);

  const handleWorkspaceChange = useCallback(
    async (scope: SavedWorkspaceScope) => {
      setWorkspaceScope(scope);
      await saveWorkspaceScope(scope);
      if (!userId) return;
      setScopeLoading(true);
      try {
        const ctx = await refreshAccessContext();
        await loadDecks(userId, scope, ctx);
      } finally {
        setScopeLoading(false);
      }
    },
    [userId, loadDecks, refreshAccessContext],
  );

  const canCreateDeck = useMemo(
    () => resolveCanCreateDeck(workspaceScope),
    [workspaceScope],
  );

  const activeWorkspace: OfflineWorkspaceContext | null = useMemo(() => {
    if (workspaceScope === "personal") return null;
    return accessContext.workspaces.find((w) => w.teamId === workspaceScope) ?? null;
  }, [workspaceScope, accessContext.workspaces]);

  const ownerWorkspace = useMemo(
    () =>
      accessContext.personalHasTeamTierPlan
        ? accessContext.workspaces.find((w) => w.role === "owner") ?? null
        : null,
    [accessContext.personalHasTeamTierPlan, accessContext.workspaces],
  );

  const showTeamAdminDash =
    Boolean(accessContext.personalHasTeamTierPlan) && ownerWorkspace != null;

  const openLivePath = useCallback(async (path: string) => {
    if (!navigator.onLine) {
      window.location.href = "./error.html?offline=1";
      return;
    }

    const storedBase = await getStoredApiBaseUrl().catch(() => null);
    const base = bundledLiveUrl();
    if (storedBase !== base) {
      await setStoredApiBaseUrl(base).catch(() => {});
    }

    // Navigate the in-app WebView to the live site (keeps the shared native
    // SQLite/Preferences bridge, so "Make available offline", theme carry-forward,
    // etc. keep working). We always route through /native-signin so the heavy Clerk
    // sign-in MODAL — which crashed the WebView renderer (OOM / SIGTRAP) — is never
    // shown. /native-signin signs the user in without a modal:
    //   • returning users (device token) → exchange a short-lived Clerk sign-in
    //     ticket for a session, then redirect to `path`.
    //   • first-time users → a lightweight in-app email/password (or email code)
    //     form, then redirect to `path`.
    //   • already-signed-in WebView sessions → redirect straight to `path`.
    const enc = (s: string) => encodeURIComponent(s);
    let target = `${base}/native-signin?redirect=${enc(path)}`;
    try {
      const syncToken = await getStoredSyncToken().catch(() => null);
      if (syncToken) {
        const res = await fetch(`${base}/api/native/clerk-handoff`, {
          method: "POST",
          headers: { Authorization: `Bearer ${syncToken}` },
        });
        if (res.ok) {
          const data = (await res.json()) as { ticket?: string };
          if (data.ticket) {
            target = `${base}/native-signin?ticket=${enc(data.ticket)}&redirect=${enc(path)}`;
          }
        }
      }
    } catch {
      // Fall back to the form-based /native-signin (manual sign-in).
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
    if (!libraryReady) return;
    if (workspaceScope === "personal") return;
    const ws = accessContext.workspaces.find((w) => w.teamId === workspaceScope);
    if (!ws) {
      void handleWorkspaceChange("personal");
      return;
    }
    // Team-tier owners study and manage from Personal Dash — not subscriber-owned team rows.
    if (ws.isSubscriberOwned ?? ws.role === "owner") {
      void handleWorkspaceChange("personal");
    }
  }, [libraryReady, accessContext.workspaces, workspaceScope, handleWorkspaceChange]);

  const personalPlanLabel = useMemo(
    () => resolveOfflinePersonalPlanLabel(accessContext),
    [accessContext],
  );

  const accountPlanDisplay = useMemo(
    () => resolveOfflineAccountPlanDisplay(accessContext),
    [accessContext],
  );

  const deckWorkspaceInput = useMemo(
    (): DeckWorkspaceContextInput => ({
      workspaces: accessContext.workspaces,
      personalPlanLabel,
      viewerDisplayName: accessContext.viewerDisplayName,
      viewerEmail: accessContext.viewerEmail,
    }),
    [accessContext, personalPlanLabel],
  );

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
        online={online}
        maxCardsPerDeck={maxCardsForDeck(addCardsDeck, accessContext)}
        onBack={() => setAddCardsDeck(null)}
        onSaved={async () => {
          if (userId) await loadDecks(userId, workspaceScope, accessContext);
          setAddCardsDeck(null);
          setActiveDeck(addCardsDeck);
          setDeckView("menu");
        }}
      />
    );
  }

  if (activeDeck) {
    if (deckView === "flash") {
      return (
        <StandardReview
          deck={activeDeck}
          online={online}
          workspaceContext={deckWorkspaceInput}
          onBack={() => setDeckView("study-hub")}
        />
      );
    }
    if (deckView === "quiz") {
      return (
        <DeckQuiz
          deck={activeDeck}
          userId={userId}
          online={online}
          workspaceContext={deckWorkspaceInput}
          onAutoSync={() => runSyncNow({ showSuccess: false })}
          onBack={() => setDeckView("study-hub")}
        />
      );
    }
    if (deckView === "study-hub") {
      return (
        <DeckStudyHub
          deck={activeDeck}
          online={online}
          workspaceContext={deckWorkspaceInput}
          onBack={() => setDeckView("menu")}
          onStandardReview={() => setDeckView("flash")}
          onQuiz={() => setDeckView("quiz")}
        />
      );
    }
    return (
      <DeckDetail
        deck={activeDeck}
        canEdit={canEditDeckContent(activeDeck, workspaceScope)}
        online={online}
        workspaceContext={deckWorkspaceInput}
        onBack={() => setActiveDeck(null)}
        onStudy={() => setDeckView("study-hub")}
        onAddCards={() => setAddCardsDeck(activeDeck)}
      />
    );
  }

  return (
    <div className="app">
      <Topbar
        online={online}
        onOpen={openLiveApp}
        onSync={handleSync}
        syncing={syncing}
        onSettings={() => setShowSettings(true)}
        viewerDisplayName={accessContext.viewerDisplayName}
        viewerEmail={accessContext.viewerEmail}
        accountPlanLabel={accountPlanDisplay.plan}
        accountPlanAccessType={accountPlanDisplay.planType}
      />
      <div className="content content--library">
        <DeckLibrary
          decks={decks}
          loading={libraryLoading}
          message={message}
          online={online}
          workspaceScope={workspaceScope}
          workspaces={accessContext.workspaces}
          personalPlanLabel={personalPlanLabel}
          personalHasTeamTierPlan={accessContext.personalHasTeamTierPlan ?? false}
          viewerDisplayName={accessContext.viewerDisplayName}
          viewerEmail={accessContext.viewerEmail}
          canCreateDeck={canCreateDeck}
          onWorkspaceChange={handleWorkspaceChange}
          onTeamAdminDash={showTeamAdminDash ? openTeamAdminDash : undefined}
          onToAdminDash={openToAdminDash}
          onNewDeck={() => setShowNewDeck(true)}
          onOpenDeck={(deck) => {
            setActiveDeck(deck);
            setDeckView("menu");
          }}
          onDecksChanged={async () => {
            if (userId) await loadDecks(userId, workspaceScope, accessContext);
          }}
        />
      </div>
      {showNewDeck && (
        <NewDeckSheet
          userId={userId}
          online={online}
          workspaceScope={workspaceScope}
          accessContext={accessContext}
          activeWorkspace={activeWorkspace}
          onClose={() => setShowNewDeck(false)}
          onCreated={async () => {
            if (userId) await loadDecks(userId, workspaceScope, accessContext);
            setShowNewDeck(false);
            setMessage("Deck saved on this device — add cards, then sync when online.");
          }}
        />
      )}
      {showSettings && <SettingsSheet onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function Topbar({
  online,
  onOpen,
  onSync,
  syncing,
  onSettings,
  viewerDisplayName,
  viewerEmail,
  accountPlanLabel,
  accountPlanAccessType,
}: {
  online: boolean;
  onOpen: () => void;
  onSync: () => void;
  syncing: boolean;
  onSettings?: () => void;
  viewerDisplayName?: string;
  viewerEmail?: string | null;
  accountPlanLabel?: string;
  accountPlanAccessType?: string;
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
      <div className="topbar-actions">
        <ConnectionStatusPill online={online} compact />
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
          className="btn secondary btn--sm topbar-actions__online-dash"
          onClick={onOpen}
          disabled={!online}
          title={online ? "Open the live dashboard" : "Requires an internet connection"}
        >
          Online Dashboard
        </button>
        {onSettings ? (
          <button
            type="button"
            className="icon-btn"
            onClick={onSettings}
            aria-label="Settings"
            title="Settings"
          >
            ⚙
          </button>
        ) : null}
        <AccountMenu
          displayName={viewerDisplayName}
          email={viewerEmail}
          planLabel={accountPlanLabel}
          planAccessType={accountPlanAccessType}
        />
      </div>
    </header>
  );
}

function NewDeckSheet({
  userId,
  online,
  workspaceScope,
  accessContext,
  activeWorkspace,
  onClose,
  onCreated,
}: {
  userId: string | null;
  online: boolean;
  workspaceScope: SavedWorkspaceScope;
  accessContext: OfflineAccessContext;
  activeWorkspace: OfflineWorkspaceContext | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
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
        coverImageUrl,
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
          <ImagePickerField
            label="Cover image (optional)"
            value={coverImageUrl}
            online={online}
            onChange={setCoverImageUrl}
          />
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
  online,
  maxCardsPerDeck,
  onBack,
  onSaved,
}: {
  deck: OfflineDeckRow;
  online: boolean;
  maxCardsPerDeck: number;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [frontImageUrl, setFrontImageUrl] = useState<string | null>(null);
  const [backImageUrl, setBackImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(0);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const f = front.trim();
    const b = back.trim();
    if ((!f && !frontImageUrl) || (!b && !backImageUrl)) {
      setError("Each side needs text or an image.");
      return;
    }
    setBusy(true);
    try {
      await createCard({
        deckLocalId: deck.local_id,
        front: f || null,
        back: b || null,
        frontImageUrl,
        backImageUrl,
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
          <ImagePickerField
            label="Front image (optional)"
            value={frontImageUrl}
            online={online}
            onChange={setFrontImageUrl}
          />
          <label className="field">
            <span>Back (answer)</span>
            <input
              value={back}
              onChange={(e) => setBack(e.target.value)}
              placeholder="e.g. An animal"
            />
          </label>
          <ImagePickerField
            label="Back image (optional)"
            value={backImageUrl}
            online={online}
            onChange={setBackImageUrl}
          />
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
