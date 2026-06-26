import { useEffect, useState } from "react";

/**
 * In-app confirmation dialog that matches the offline app's sheet styling.
 * Replaces the browser's native `window.confirm()` (which shows an unbranded
 * "<origin> says…" alert) for destructive actions like deleting a deck or card.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);

  // Dismiss with the hardware/Escape key while not mid-action.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="sheet-backdrop"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="sheet sheet--confirm"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2>{title}</h2>
        <p className="sheet-hint">{message}</p>
        <div className="row">
          <button
            type="button"
            className="btn secondary"
            style={{ flex: 1 }}
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn${destructive ? " danger" : ""}`}
            style={{ flex: 1 }}
            onClick={() => void handleConfirm()}
            disabled={busy}
            autoFocus
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
