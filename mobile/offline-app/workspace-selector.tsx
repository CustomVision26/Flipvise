import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const outsideListenerArmedRef = useRef(false);

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
      const hay = `${w.name} ${w.planLabel} ${ownerLabel(w)}`.toLowerCase();
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

  const positionMenu = useCallback((): CSSProperties | null => {
    const trigger = triggerRef.current;
    if (!trigger) return null;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    const left = Math.max(
      12,
      Math.min(rect.right - width, window.innerWidth - width - 12),
    );
    return {
      position: "fixed",
      top: rect.bottom + 6,
      left,
      width,
      zIndex: 1001,
    };
  }, []);

  const closeMenu = useCallback(() => {
    outsideListenerArmedRef.current = false;
    setOpen(false);
    setQuery("");
    setMenuStyle(null);
  }, []);

  const openMenu = useCallback(() => {
    const style = positionMenu();
    if (!style) return;
    setMenuStyle(style);
    setOpen(true);
  }, [positionMenu]);

  useEffect(() => {
    return listenForOfflineOverlayOpen("workspace", closeMenu);
  }, [closeMenu]);

  useEffect(() => {
    if (!open) return;
    notifyOfflineOverlayOpen("workspace");
    outsideListenerArmedRef.current = false;
    const armTimer = window.setTimeout(() => {
      outsideListenerArmedRef.current = true;
    }, 0);

    const updateMenuPosition = () => {
      const style = positionMenu();
      if (style) setMenuStyle(style);
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    const onDocPointerDown = (e: PointerEvent) => {
      if (!outsideListenerArmedRef.current) return;
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };

    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(armTimer);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      outsideListenerArmedRef.current = false;
    };
  }, [open, closeMenu, positionMenu]);

  function selectPersonal() {
    if (scope !== "personal") {
      onChange("personal");
    }
    closeMenu();
  }

  function selectTeam(teamId: number) {
    if (scope !== teamId) {
      onChange(teamId);
    }
    closeMenu();
  }

  function handleTriggerActivate(e: React.SyntheticEvent) {
    e.stopPropagation();
    if (open) {
      closeMenu();
      return;
    }
    openMenu();
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
              closeMenu();
            }}
          >
            To Admin Dash
          </button>
        ) : null}
      </button>
    );
  }

  const menuContent = (
    <div
      ref={menuRef}
      className="workspace-scope__menu workspace-scope__menu--portaled"
      style={menuStyle ?? undefined}
      role="listbox"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="workspace-scope__search-wrap">
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
                  onClick={() => {
                    onTeacherDash();
                    closeMenu();
                  }}
                >
                  Teacher Dash
                </button>
              ) : null}
              {personalHasTeamTierPlan && ownerWorkspace && onTeamAdminDash ? (
                <button
                  type="button"
                  className="workspace-scope__admin-btn workspace-scope__admin-btn--wide"
                  onClick={() => {
                    onTeamAdminDash();
                    closeMenu();
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
    </div>
  );

  return (
    <div className="workspace-scope" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="workspace-scope__trigger"
        onClick={handleTriggerActivate}
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
        menuStyle &&
        createPortal(
          <>
            <button
              type="button"
              className="workspace-scope__backdrop"
              aria-label="Close workspace menu"
              onClick={closeMenu}
            />
            {menuContent}
          </>,
          document.body,
        )}
    </div>
  );
}
