import { useEffect, useRef, useState } from "react";
import type { OfflineWorkspaceContext } from "../../src/lib/offline/access-context";
import type { SavedWorkspaceScope } from "./workspace-prefs";

export type WorkspaceOption =
  | { kind: "personal"; label: string }
  | { kind: "team"; teamId: number; label: string; planLabel: string };

function buildOptions(workspaces: OfflineWorkspaceContext[]): WorkspaceOption[] {
  return [
    { kind: "personal", label: "Personal Dashboard" },
    ...workspaces.map((w) => ({
      kind: "team" as const,
      teamId: w.teamId,
      label: w.name,
      planLabel: w.planLabel,
    })),
  ];
}

export function WorkspaceSelector({
  scope,
  workspaces,
  onChange,
}: {
  scope: SavedWorkspaceScope;
  workspaces: OfflineWorkspaceContext[];
  onChange: (scope: SavedWorkspaceScope) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const options = buildOptions(workspaces);

  const active =
    scope === "personal"
      ? options[0]
      : options.find((o) => o.kind === "team" && o.teamId === scope) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (options.length <= 1) {
    return (
      <div className="workspace-scope">
        <span className="workspace-scope__label">Personal Dashboard</span>
      </div>
    );
  }

  return (
    <div className="workspace-scope" ref={rootRef}>
      <button
        type="button"
        className="workspace-scope__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="workspace-scope__label">
          {active.kind === "personal" ? active.label : active.label}
        </span>
        {active.kind === "team" && (
          <span className="workspace-scope__plan">{active.planLabel}</span>
        )}
        <span className="workspace-scope__chev" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className="workspace-scope__menu" role="listbox">
          {options.map((opt) => {
            const selected =
              opt.kind === "personal"
                ? scope === "personal"
                : scope === opt.teamId;
            return (
              <button
                key={opt.kind === "personal" ? "personal" : opt.teamId}
                type="button"
                role="option"
                aria-selected={selected}
                className={`workspace-scope__item${selected ? " active" : ""}`}
                onClick={() => {
                  onChange(
                    opt.kind === "personal" ? "personal" : opt.teamId,
                  );
                  setOpen(false);
                }}
              >
                <span className="workspace-scope__item-main">
                  <strong>
                    {opt.kind === "personal" ? opt.label : opt.label}
                  </strong>
                  {opt.kind === "team" && (
                    <small>Team workspace · {opt.planLabel}</small>
                  )}
                  {opt.kind === "personal" && (
                    <small>Your personal decks on this device</small>
                  )}
                </span>
                {selected && <span className="check">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
