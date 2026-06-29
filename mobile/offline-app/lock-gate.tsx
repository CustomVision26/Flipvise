import { useEffect, useRef, useState, type ReactNode } from "react";
import { App as CapacitorApp, type PluginListenerHandle } from "@capacitor/app";
import { getAppLockEnabled } from "../../src/lib/offline/session";
import { markBootSplashReady } from "./boot-splash";
import {
  authenticateDeviceCredential,
  getLockAvailability,
} from "./biometric-lock";

const logoUrl = `${import.meta.env.BASE_URL}logo.png`;

/**
 * Gates the offline shell behind the device security credential when the user has
 * enabled the app lock. Locks on launch and re-locks after the app returns from the
 * background. Renders nothing protected until unlocked.
 */
export function LockGate({ children }: { children: ReactNode }) {
  // null = still resolving whether a lock applies (avoids flashing content or the lock UI).
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(false);
  const [authing, setAuthing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("device credential");
  const authingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        setEnabled(false);
        setLocked(false);
        markBootSplashReady();
      }
    }, 4000);

    (async () => {
      try {
        const [on, availability] = await Promise.all([
          getAppLockEnabled().catch(() => false),
          getLockAvailability().catch(() => ({ canLock: false, label: "" })),
        ]);
        if (cancelled) return;
        const active = on && availability.canLock;
        if (availability.label) setLabel(availability.label);
        setEnabled(active);
        setLocked(active);
        markBootSplashReady();
      } catch {
        if (!cancelled) {
          setEnabled(false);
          setLocked(false);
          markBootSplashReady();
        }
      } finally {
        window.clearTimeout(timeout);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  async function tryUnlock() {
    if (authingRef.current) return;
    authingRef.current = true;
    setAuthing(true);
    setError(null);
    const ok = await authenticateDeviceCredential();
    authingRef.current = false;
    setAuthing(false);
    if (ok) {
      setLocked(false);
    } else {
      setError("Couldn't verify it's you. Try again.");
    }
  }

  // Auto-prompt as soon as we enter the locked state.
  useEffect(() => {
    if (locked) void tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  // Re-lock after a genuine background → foreground cycle. Transitions caused by the
  // auth prompt itself (which can briefly background the app) are ignored.
  useEffect(() => {
    if (!enabled) return;
    let handle: PluginListenerHandle | undefined;
    let backgrounded = false;
    void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (authingRef.current) return;
      if (!isActive) {
        backgrounded = true;
        return;
      }
      if (backgrounded) {
        backgrounded = false;
        setLocked(true);
      }
    }).then((h) => {
      handle = h;
    });
    return () => {
      void handle?.remove();
    };
  }, [enabled]);

  // Boot splash (#boot-splash in index.html) covers this phase — avoid a duplicate loader.
  if (enabled === null) {
    return null;
  }

  if (locked) {
    return (
      <div className="app lock-screen">
        <div className="lock-screen__inner">
          <div className="lock-screen__logo-wrap">
            <img className="lock-screen__logo" src={logoUrl} alt="" />
          </div>
          <p className="lock-screen__brand">Flipvise</p>
          <p className="lock-screen__caption">By Flipvise Studio</p>
          <h1 className="lock-screen__title">Flipvise is locked</h1>
          <p className="lock-screen__hint">
            Unlock with your {label} to study your decks.
          </p>
          {error ? <p className="form-error">{error}</p> : null}
          <button
            type="button"
            className="btn lock-screen__btn"
            onClick={() => void tryUnlock()}
            disabled={authing}
          >
            {authing ? "Verifying…" : "Unlock"}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
