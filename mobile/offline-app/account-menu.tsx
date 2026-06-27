import { useEffect, useRef, useState } from "react";
import {
  listenForOfflineOverlayOpen,
  notifyOfflineOverlayOpen,
} from "./overlay-coordination";

function initialsFrom(name?: string, email?: string | null): string {
  const source = (name && name.trim()) || (email && email.trim()) || "";
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function AccountMenu({
  displayName,
  email,
  planLabel,
  planAccessType,
}: {
  displayName?: string;
  email?: string | null;
  planLabel?: string;
  planAccessType?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return listenForOfflineOverlayOpen("account", () => setOpen(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const name = displayName?.trim() || "Your account";
  const initials = initialsFrom(displayName, email);

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className="account-menu__avatar"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) notifyOfflineOverlayOpen("account");
            return next;
          });
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Account"
        title="Account"
      >
        <span aria-hidden>{initials}</span>
      </button>

      {open && (
        <div
          className="account-menu__panel"
          role="dialog"
          aria-label="Account details"
        >
          <div className="account-menu__head">
            <span
              className="account-menu__avatar account-menu__avatar--lg"
              aria-hidden
            >
              {initials}
            </span>
            <div className="account-menu__id">
              <span className="account-menu__name">{name}</span>
              {email ? (
                <span className="account-menu__email">{email}</span>
              ) : null}
            </div>
          </div>

          <div className="account-menu__rows">
            <div className="account-menu__row">
              <span className="account-menu__row-label">Plan</span>
              <span className="account-menu__row-value">
                {planLabel ?? "Free"}
              </span>
            </div>
            <div className="account-menu__row">
              <span className="account-menu__row-label">Plan type</span>
              <span className="account-menu__badge">
                {planAccessType ?? "Free"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
