import { useEffect, useMemo, useRef, useState } from "react";
import type { OfflineWorkspaceContext } from "../../src/lib/offline/access-context";
import { formatOfflineWorkspaceOwnerLabel } from "../../src/lib/offline/access-context";
import type { SavedWorkspaceScope } from "./workspace-prefs";
import {
  listenForOfflineOverlayOpen,
  notifyOfflineOverlayOpen,
} from "./overlay-coordination";

const PERSONAL_PRIMARY_LABEL = "Personal Dash";

export function WorkspaceSelector({
  scope,
  workspaces,
  personalPlanLabel = "Free",
  personalHasTeamTierPlan = false,
  viewerDisplayName,
  viewerEmail,
  online = false,
  onChange,
  onTeamAdminDash,
  onToAdminDash,
}: {
  scope: SavedWorkspaceScope;
  workspaces: OfflineWorkspaceContext[];
  personalPlanLabel?: string;
  personalHasTeamTierPlan?: boolean;
  viewerDisplayName?: string;
  viewerEmail?: string | null;
  online?: boolean;
  onChange: (scope: SavedWorkspaceScope) => void;
  onTeamAdminDash?: () => void;
  onToAdminDash?: (workspace: OfflineWorkspaceContext) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const subscriberOwnsTeamTierWorkspace =
    personalHasTeamTierPlan &&
    workspaces.some((w) => w.isSubscriberOwned ?? w.role === "owner");
  const ownerWorkspace = personalHasTeamTierPlan
    ? workspaces.find((w) => w.isSubscriberOwned ?? w.role === "owner") ?? null
    : null;

  const selectedTeam =
    scope !== "personal"
      ? workspaces.find((w) => w.teamId === scope)
      : undefined;

  const triggerLabel =
    scope === "personal" || selectedTeam == null
      ? `${PERSONAL_PRIMARY_LABEL} · ${personalPlanLabel}`
      : `${selectedTeam.name} · ${selectedTeam.planLabel}`;

  const q = query.trim().toLowerCase();
  const personalMatches =
    q === "" ||
    "personal".includes(q) ||
    PERSONAL_PRIMARY_LABEL.toLowerCase().includes(q) ||
    personalPlanLabel.toLowerCase().includes(q);

  const viewerCtx = useMemo(
  () => ({ viewerDisplayName, viewerEmail }),
  [viewerDisplayName, viewerEmail],
);

  function ownerLabel(w: OfflineWorkspaceContext): string {
    return formatOfflineWorkspaceOwnerLabel(w, viewerCtx);
  }

  const filteredWorkspaces = useMemo(() => {
    if (q === "") return workspaces;
    return workspaces.filter((w) => {
      const hay =
        `${w.name} ${w.planLabel} ${ownerLabel(w)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [workspaces, q, viewerCtx]);

  const invitedTeams = useMemo(() => {
    if (subscriberOwnsTeamTierWorkspace) {
      return filteredWorkspaces.filter((w) => !(w.isSubscriberOwned ?? w.role === "owner"));
    }
    return filteredWorkspaces;
  }, [filteredWorkspaces, subscriberOwnsTeamTierWorkspace]);

  const showInvitedDivider =
    subscriberOwnsTeamTierWorkspace &&
    invitedTeams.length > 0 &&
    (personalMatches || ownerWorkspace != null);

  useEffect(() => {
    return listenForOfflineOverlayOpen("workspace", () => {
      setOpen(false);
      setQuery("");
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (workspaces.length === 0) {
    return (
      <div className="workspace-scope">
        <span className="workspace-scope__trigger workspace-scope__trigger--static">
          <span className="workspace-scope__trigger-text">
            {PERSONAL_PRIMARY_LABEL} · {personalPlanLabel}
          </span>
        </span>
      </div>
    );
  }

  function selectPersonal() {
    onChange("personal");
    setOpen(false);
    setQuery("");
  }

  function selectTeam(teamId: number) {
    onChange(teamId);
    setOpen(false);
    setQuery("");
  }

  function teamRow(w: OfflineWorkspaceContext) {
    const isActive = scope === w.teamId;
    const showToAdminDash =
      online &&
      w.canAccessTeamAdmin &&
      onToAdminDash &&
      !(w.isSubscriberOwned ?? w.role === "owner");

    return (
      <button
        key={w.teamId}
        type="button"
        role="option"
        aria-selected={isActive}
        className="workspace-scope__item workspace-scope__item--team"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-team-admin-dash-link]")) return;
          selectTeam(w.teamId);
        }}
      >
        <span
          className={`workspace-scope__check${isActive ? " visible" : ""}`}
          aria-hidden
        >
          ✓
        </span>
        <span className="workspace-scope__item-body">
          <span className="workspace-scope__item-title">Team: {w.name}</span>
          <span className="workspace-scope__item-meta">
            <span>{w.planLabel}</span>
            <span className="workspace-scope__dot" aria-hidden>
              ·
            </span>
            <span>{ownerLabel(w)}</span>
          </span>
        </span>
        {showToAdminDash ? (
          <button
            data-team-admin-dash-link
            type="button"
            className="workspace-scope__admin-btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToAdminDash(w);
              setOpen(false);
              setQuery("");
            }}
          >
            To Admin Dash
          </button>
        ) : null}
      </button>
    );
  }

  return (
    <div className="workspace-scope" ref={rootRef}>
      <button
        type="button"
        className="workspace-scope__trigger"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) notifyOfflineOverlayOpen("workspace");
            return next;
          });
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Switch workspace — personal dashboard or a team workspace"
      >
        <span className="workspace-scope__trigger-text">{triggerLabel}</span>
        <span className="workspace-scope__chev" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className="workspace-scope__menu" role="listbox">
          <div
            className="workspace-scope__search-wrap"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="workspace-scope__search-icon" aria-hidden>
              ⌕
            </span>
            <input
              type="search"
              className="workspace-scope__search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workspaces…"
              autoComplete="off"
              aria-label="Search workspaces"
            />
          </div>

          <div className="workspace-scope__scroll">
            <div className="workspace-scope__section-label">Workspace</div>

            {personalMatches && (
              <button
                type="button"
                role="option"
                aria-selected={scope === "personal"}
                className="workspace-scope__item"
                onClick={selectPersonal}
              >
                <span
                  className={`workspace-scope__check${scope === "personal" ? " visible" : ""}`}
                  aria-hidden
                >
                  ✓
                </span>
                <span className="workspace-scope__item-line">
                  <span className="workspace-scope__item-title">{PERSONAL_PRIMARY_LABEL}</span>
                  <span className="workspace-scope__dot" aria-hidden>
                    ·
                  </span>
                  <span className="workspace-scope__item-muted">{personalPlanLabel}</span>
                </span>
              </button>
            )}

            {online && personalHasTeamTierPlan && ownerWorkspace && onTeamAdminDash && (
              <div className="workspace-scope__admin-row">
                <button
                  type="button"
                  className="workspace-scope__admin-btn workspace-scope__admin-btn--wide"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    onTeamAdminDash();
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  Team Admin Dash
                </button>
              </div>
            )}

            {showInvitedDivider && (
              <>
                <div className="workspace-scope__divider" role="separator" />
                <div className="workspace-scope__section-label">Invited workspaces</div>
              </>
            )}

            {!subscriberOwnsTeamTierWorkspace &&
              personalMatches &&
              invitedTeams.length > 0 && (
                <>
                  <div className="workspace-scope__divider" role="separator" />
                  <div className="workspace-scope__section-label">Invited workspaces</div>
                </>
              )}

            {invitedTeams.map((w) => teamRow(w))}

            {!personalMatches && filteredWorkspaces.length === 0 && (
              <p className="workspace-scope__empty">No matching workspaces.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
