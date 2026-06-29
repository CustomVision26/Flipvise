import { useEffect, useState } from "react";
import {
  getAppLockEnabled,
  setAppLockEnabled,
} from "../../src/lib/offline/session";
import {
  authenticateDeviceCredential,
  getLockAvailability,
} from "./biometric-lock";

export function SettingsSecurityPanel() {
  const [enabled, setEnabled] = useState(false);
  const [canLock, setCanLock] = useState<boolean | null>(null);
  const [label, setLabel] = useState("device credential");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [on, availability] = await Promise.all([
        getAppLockEnabled().catch(() => false),
        getLockAvailability().catch(() => ({ canLock: false, label: "" })),
      ]);
      if (cancelled) return;
      setEnabled(on);
      setCanLock(availability.canLock);
      if (availability.label) setLabel(availability.label);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleLock() {
    if (busy || canLock === false) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await authenticateDeviceCredential(
        enabled
          ? "Confirm it's you to turn off the lock"
          : "Confirm it's you to turn on the lock",
      );
      if (!ok) {
        setError("Couldn't verify it's you. Nothing changed.");
        return;
      }
      const next = !enabled;
      await setAppLockEnabled(next);
      setEnabled(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-security">
      <button
        type="button"
        className={`settings-security__row${enabled ? " active" : ""}`}
        onClick={() => void toggleLock()}
        disabled={busy || canLock === false || canLock === null}
        aria-pressed={enabled}
      >
        <span>
          <strong>Require unlock to open</strong>
          <small>
            {canLock === false
              ? "Set up biometrics or a screen lock on your device to use this."
              : `Protect your offline decks with your ${label}.`}
          </small>
        </span>
        <span className="settings-toggle" aria-hidden>
          {busy ? "…" : enabled ? "On" : "Off"}
        </span>
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
