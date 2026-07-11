import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { OfflineWorkspaceContext } from "../../src/lib/offline/access-context";
import { formatOfflineWorkspaceOwnerLabel } from "../../src/lib/offline/access-context";
import { formatOfflineWorkspaceContextAge } from "../../src/lib/offline/access-context-freshness";
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
  showTeacherDashboard = false,
  workspaceContextUpdatedAtMs = 0,
  workspaceContextStale = false,
  onChange,
  onTeamAdminDash,
  onTeacherDash,
  onToAdminDash,
}: {
  scope: SavedWorkspaceScope;
  workspaces: OfflineWorkspaceContext[];
  personalPlanLabel?: string;
  personalHasTeamTierPlan?: boolean;
  viewerDisplayName?: string;
  viewerEmail?: string | null;
  online?: boolean;
  showTeacherDashboard?: boolean;
  workspaceContextUpdatedAtMs?: number;
  workspaceContextStale?: boolean;
  onChange: (scope: SavedWorkspaceScope) => void;
  onTeamAdminDash?: () => void;
  onTeacherDash?: () => void;
  onToAdminDash?: (workspace: OfflineWorkspaceContext) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const workspaceAgeLabel = formatOfflineWorkspaceContextAge(workspaceContextUpdatedAtMs);

  useEffect(() => {
    return listenForOfflineOverlayOpen("workspace", () => {
      setOpen(false);
      setQuery("");
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
      setQuery("");
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const updateMenuPosition = () => {
      positionMenu();
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  function positionMenu() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    const left = Math.max(
      12,
      Math.min(rect.right - width, window.innerWidth - width - 12),
    );
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 6,
      left,
      width,
      zIndex: 1000,
    });
  }

  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      if (next) {
        notifyOfflineOverlayOpen("workspace");
        positionMenu();
      }
      return next;
    });
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
        ref={triggerRef}
        type="button"
        className="workspace-scope__trigger"
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          e.preventDefault();
          toggleOpen();
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

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="workspace-scope__menu workspace-scope__menu--portaled"
            style={menuStyle}
            role="listbox"
          >
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
              {workspaceContextStale && !online ? (
                <p className="workspace-scope__stale-hint">
                  Workspaces may be out of date
                  {workspaceAgeLabel ? ` (${workspaceAgeLabel})` : ""}. Connect to refresh.
                </p>
              ) : workspaceAgeLabel && online ? (
                <p className="workspace-scope__stale-hint workspace-scope__stale-hint--muted">
                  Workspaces updated {workspaceAgeLabel}
                </p>
              ) : null}

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

              {online &&
                personalMatches &&
                (showTeacherDashboard ||
                  (personalHasTeamTierPlan && ownerWorkspace && onTeamAdminDash)) && (
                  <div className="workspace-scope__admin-row">
                    {showTeacherDashboard && onTeacherDash ? (
                      <button
                        type="button"
                        className="workspace-scope__admin-btn workspace-scope__admin-btn--wide"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => {
                          onTeacherDash();
                          setOpen(false);
                          setQuery("");
                        }}
                      >
                        Teacher Dash
                      </button>
                    ) : null}
                    {personalHasTeamTierPlan && ownerWorkspace && onTeamAdminDash ? (
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
                    ) : null}
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

              {workspaces.length === 0 && invitedTeams.length === 0 && (
                <p className="workspace-scope__empty">
                  Team workspaces appear here after you sync from the online dashboard.
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
