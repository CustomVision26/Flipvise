"use client";

import * as React from "react";
import {
  getAppearanceSnapshotAction,
  updateCurrentUserAppearancePreferencesAction,
} from "@/actions/appearance";
import {
  APPEARANCE_CACHE_PREFIX,
  APPEARANCE_POLL_MS,
  appearanceAfterReadFailure,
  appearanceCacheKey,
  resolveEffectiveIllustratedDesign,
  resolveEffectiveReducedMotion,
  shouldApplyAppearanceSnapshot,
  type PublicAppearanceSnapshot,
} from "@/lib/illustrated-appearance";

type AppearanceContextValue = {
  globalEnabled: boolean;
  userPreferred: boolean;
  planAllowsIllustrated: boolean;
  effectiveIllustratedDesign: boolean;
  userReduceAnimations: boolean;
  systemPrefersReducedMotion: boolean;
  effectiveReducedMotion: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  userId: string | null;
  refreshSettings: () => Promise<void>;
  updatePreferences: (patch: {
    illustratedDesignPreferred?: boolean;
    reduceAnimations?: boolean;
  }) => Promise<void>;
};

const AppearanceContext = React.createContext<AppearanceContextValue | null>(null);

function readCachedSnapshot(userId: string | null): PublicAppearanceSnapshot | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(appearanceCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PublicAppearanceSnapshot;
    if (!shouldApplyAppearanceSnapshot(userId, parsed.userId ?? null)) return null;
    return {
      userId,
      globalEnabled: parsed.globalEnabled === true,
      userPreferred: parsed.userPreferred === true,
      userReduceAnimations: parsed.userReduceAnimations === true,
      planAllowsIllustrated: parsed.planAllowsIllustrated === true,
    };
  } catch {
    return null;
  }
}

function writeCachedSnapshot(snapshot: PublicAppearanceSnapshot) {
  if (!snapshot.userId || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      appearanceCacheKey(snapshot.userId),
      JSON.stringify(snapshot),
    );
  } catch {
    // Storage can be unavailable in private modes. The server value remains authoritative online.
  }
}

function appearanceSaveError(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  if (
    message.includes("Failed query") ||
    message.includes("does not exist") ||
    message.includes("user_appearance_preferences")
  ) {
    return "Appearance settings could not be saved. The standard design stays on.";
  }
  return message || "Could not save appearance settings.";
}

function clearForeignAppearanceCaches(userId: string | null) {
  if (typeof window === "undefined") return;
  try {
    const keep = userId ? appearanceCacheKey(userId) : null;
    const remove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key?.startsWith(APPEARANCE_CACHE_PREFIX) && key !== keep) {
        remove.push(key);
      }
    }
    for (const key of remove) window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

export function IllustratedAppearanceProvider({
  initial,
  children,
}: {
  initial: PublicAppearanceSnapshot;
  children: React.ReactNode;
}) {
  const [snapshot, setSnapshot] = React.useState<PublicAppearanceSnapshot>(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [systemPrefersReducedMotion, setSystemPrefersReducedMotion] =
    React.useState(false);
  const requestId = React.useRef(0);
  const userIdRef = React.useRef(initial.userId);
  const snapshotRef = React.useRef(snapshot);
  const inFlight = React.useRef(false);

  React.useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  React.useEffect(() => {
    userIdRef.current = initial.userId;
    setSnapshot(initial);
    clearForeignAppearanceCaches(initial.userId);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const cached = readCachedSnapshot(initial.userId);
      if (cached) setSnapshot(cached);
    } else if (initial.userId) {
      writeCachedSnapshot(initial);
    }
    // Reset only when the server-provided account or flags change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initial.userId,
    initial.globalEnabled,
    initial.userPreferred,
    initial.userReduceAnimations,
    initial.planAllowsIllustrated,
  ]);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setSystemPrefersReducedMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const refreshSettings = React.useCallback(async () => {
    if (inFlight.current) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const cached = readCachedSnapshot(userIdRef.current);
      if (cached) setSnapshot(cached);
      return;
    }
    inFlight.current = true;
    const id = ++requestId.current;
    const expectedUserId = userIdRef.current;
    try {
      const next = await getAppearanceSnapshotAction();
      if (id !== requestId.current) return;
      if (!shouldApplyAppearanceSnapshot(expectedUserId, next.userId)) return;
      setSnapshot(next);
      writeCachedSnapshot(next);
      setError(null);
    } catch {
      if (id !== requestId.current) return;
      setSnapshot(
        appearanceAfterReadFailure(snapshotRef.current, expectedUserId),
      );
    } finally {
      inFlight.current = false;
    }
  }, []);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshSettings();
    }, APPEARANCE_POLL_MS);

    const onWake = () => {
      if (document.visibilityState === "hidden") return;
      void refreshSettings();
    };

    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [refreshSettings]);

  const updatePreferences = React.useCallback(
    async (patch: {
      illustratedDesignPreferred?: boolean;
      reduceAnimations?: boolean;
    }) => {
      if (saving) return;
      const previous = snapshotRef.current;
      if (!previous.userId) {
        setError("Sign in to save appearance settings.");
        throw new Error("Unauthorized");
      }
      setSaving(true);
      setError(null);
      const optimistic: PublicAppearanceSnapshot = {
        ...previous,
        userPreferred:
          patch.illustratedDesignPreferred ?? previous.userPreferred,
        userReduceAnimations:
          patch.reduceAnimations ?? previous.userReduceAnimations,
      };
      setSnapshot(optimistic);
      try {
        const next = await updateCurrentUserAppearancePreferencesAction(patch);
        if (!shouldApplyAppearanceSnapshot(userIdRef.current, next.userId)) {
          setSnapshot(previous);
          return;
        }
        setSnapshot(next);
        writeCachedSnapshot(next);
      } catch (err) {
        setSnapshot(previous);
        setError(appearanceSaveError(err));
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [saving],
  );

  const effectiveIllustratedDesign = resolveEffectiveIllustratedDesign(
    snapshot.globalEnabled,
    snapshot.userPreferred,
    snapshot.planAllowsIllustrated,
  );
  const effectiveReducedMotion = resolveEffectiveReducedMotion(
    snapshot.userReduceAnimations,
    systemPrefersReducedMotion,
  );

  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.illustrated = effectiveIllustratedDesign ? "on" : "off";
    root.dataset.reduceIllustratedMotion = effectiveReducedMotion ? "true" : "false";
  }, [effectiveIllustratedDesign, effectiveReducedMotion]);

  const value = React.useMemo<AppearanceContextValue>(
    () => ({
      globalEnabled: snapshot.globalEnabled,
      userPreferred: snapshot.userPreferred,
      planAllowsIllustrated: snapshot.planAllowsIllustrated,
      effectiveIllustratedDesign,
      userReduceAnimations: snapshot.userReduceAnimations,
      systemPrefersReducedMotion,
      effectiveReducedMotion,
      loading: false,
      saving,
      error,
      userId: snapshot.userId,
      refreshSettings,
      updatePreferences,
    }),
    [
      snapshot,
      effectiveIllustratedDesign,
      systemPrefersReducedMotion,
      effectiveReducedMotion,
      saving,
      error,
      refreshSettings,
      updatePreferences,
    ],
  );

  return (
    <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
  );
}

export function useIllustratedAppearance(): AppearanceContextValue {
  const value = React.useContext(AppearanceContext);
  if (value) return value;
  return {
    globalEnabled: false,
    userPreferred: false,
    planAllowsIllustrated: false,
    effectiveIllustratedDesign: false,
    userReduceAnimations: false,
    systemPrefersReducedMotion: false,
    effectiveReducedMotion: false,
    loading: false,
    saving: false,
    error: null,
    userId: null,
    refreshSettings: async () => {},
    updatePreferences: async () => {
      throw new Error("Appearance settings are unavailable.");
    },
  };
}
