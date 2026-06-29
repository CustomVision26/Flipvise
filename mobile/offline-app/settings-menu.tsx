import { useEffect, useRef, useState } from "react";
import {
  offlineInterfaceOptions,
  offlineInterfaceSwatchColor,
  normalizeOfflineInterfaceId,
  type OfflineInterfaceId,
} from "../../src/lib/offline/offline-appearance-palettes";
import { getOfflineThemePrefs } from "../../src/lib/offline/session";
import { persistOfflineAppearance } from "./apply-offline-theme";
import {
  listenForOfflineOverlayOpen,
  notifyOfflineOverlayOpen,
} from "./overlay-coordination";
import { SettingsSecurityPanel } from "./settings-sheet";

type SettingsTab = "appearance" | "security";

export function SettingsMenu({
  isPro = false,
  hasProPlusInterfacePalette = false,
}: {
  isPro?: boolean;
  hasProPlusInterfacePalette?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("appearance");
  const [mode, setMode] = useState<"light" | "dark">("dark");
  const [interfaceId, setInterfaceId] = useState<OfflineInterfaceId>("neutral");
  const [appearanceBusy, setAppearanceBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const interfaceOptions = offlineInterfaceOptions(isPro, hasProPlusInterfacePalette);

  useEffect(() => {
    return listenForOfflineOverlayOpen("settings", () => setOpen(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getOfflineThemePrefs()
      .then((prefs) => {
        if (cancelled || !prefs) return;
        setMode(prefs.mode);
        setInterfaceId(normalizeOfflineInterfaceId(prefs.interfaceId));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

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

  async function applyAppearance(
    nextMode: "light" | "dark",
    nextInterfaceId: OfflineInterfaceId,
  ) {
    setAppearanceBusy(true);
    try {
      await persistOfflineAppearance(nextMode, nextInterfaceId);
      setMode(nextMode);
      setInterfaceId(nextInterfaceId);
    } finally {
      setAppearanceBusy(false);
    }
  }

  return (
    <div className="settings-menu" ref={rootRef}>
      <button
        type="button"
        className="icon-btn"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) notifyOfflineOverlayOpen("settings");
            return next;
          });
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Settings"
        title="Settings"
      >
        ⚙
      </button>

      {open ? (
        <div
          className="settings-menu__panel"
          role="dialog"
          aria-label="Settings"
        >
          <div className="settings-menu__head">
            <span className="settings-menu__title">Settings</span>
          </div>

          <div className="settings-menu__tabs" role="tablist" aria-label="Settings sections">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "appearance"}
              className={`settings-menu__tab${tab === "appearance" ? " settings-menu__tab--active" : ""}`}
              onClick={() => setTab("appearance")}
            >
              Appearance
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "security"}
              className={`settings-menu__tab${tab === "security" ? " settings-menu__tab--active" : ""}`}
              onClick={() => setTab("security")}
            >
              Security
            </button>
          </div>

          {tab === "appearance" ? (
            <div className="settings-menu__body" role="tabpanel">
              <p className="settings-menu__section-label">Theme mode</p>
              <div className="settings-menu__mode-row">
                <button
                  type="button"
                  className={`settings-menu__mode-btn${mode === "light" ? " active" : ""}`}
                  onClick={() => void applyAppearance("light", interfaceId)}
                  disabled={appearanceBusy}
                  aria-pressed={mode === "light"}
                >
                  Light
                </button>
                <button
                  type="button"
                  className={`settings-menu__mode-btn${mode === "dark" ? " active" : ""}`}
                  onClick={() => void applyAppearance("dark", interfaceId)}
                  disabled={appearanceBusy}
                  aria-pressed={mode === "dark"}
                >
                  Dark
                </button>
              </div>

              <p className="settings-menu__section-label">Interface color</p>
              <p className="settings-menu__hint">
                Accent and background tint for the offline study UI.
              </p>
              <div className="appearance-swatches">
                {interfaceOptions.map((option) => {
                  const selected = interfaceId === option.id;
                  const swatch = offlineInterfaceSwatchColor(mode, option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`appearance-swatch${selected ? " appearance-swatch--active" : ""}`}
                      onClick={() => void applyAppearance(mode, option.id)}
                      disabled={appearanceBusy}
                      aria-pressed={selected}
                      title={option.label}
                    >
                      <span
                        className="appearance-swatch__dot"
                        style={{ background: swatch }}
                        aria-hidden
                      />
                      <span className="appearance-swatch__label">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="settings-menu__body" role="tabpanel">
              <p className="settings-menu__section-label">Security</p>
              <SettingsSecurityPanel />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
