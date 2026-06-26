import type { OfflineWorkspaceContext } from "../../src/lib/offline/access-context";
import { formatOfflineWorkspaceOwnerLabel } from "../../src/lib/offline/access-context";
import type { OfflineDeckRow } from "../../src/lib/offline/schema";

export type DeckWorkspaceInfo = {
  kind: "personal" | "team";
  dashboardLabel: string;
  /** Workspace name + owner for team decks; plan label for personal. */
  detail: string;
};

export type DeckWorkspaceContextInput = {
  workspaces: OfflineWorkspaceContext[];
  personalPlanLabel: string;
  viewerDisplayName?: string;
  viewerEmail?: string | null;
};

export function resolveDeckWorkspaceInfo(
  deck: Pick<OfflineDeckRow, "team_id">,
  input: DeckWorkspaceContextInput,
): DeckWorkspaceInfo {
  const viewerCtx = {
    viewerDisplayName: input.viewerDisplayName,
    viewerEmail: input.viewerEmail,
  };

  if (deck.team_id == null) {
    return {
      kind: "personal",
      dashboardLabel: "Personal Dash",
      detail: input.personalPlanLabel,
    };
  }

  const team = input.workspaces.find((w) => w.teamId === deck.team_id);

  // Subscriber-owned team workspaces are studied and managed from Personal Dash
  // (see `app.tsx` workspace switcher), so their decks present as Personal Dash —
  // not Team Dashboard — to match where the owner actually sees them.
  if (team && (team.isSubscriberOwned ?? team.role === "owner")) {
    return {
      kind: "personal",
      dashboardLabel: "Personal Dash",
      detail: input.personalPlanLabel,
    };
  }

  if (!team) {
    return {
      kind: "team",
      dashboardLabel: "Team Dashboard",
      detail: "Team workspace",
    };
  }

  const owner = formatOfflineWorkspaceOwnerLabel(team, viewerCtx);
  return {
    kind: "team",
    dashboardLabel: "Team Dashboard",
    detail: `${team.name} · OWNER · ${owner}`,
  };
}

export function DeckWorkspaceContext({
  info,
  compact = false,
}: {
  info: DeckWorkspaceInfo;
  compact?: boolean;
}) {
  return (
    <p
      className={`deck-workspace-context${compact ? " deck-workspace-context--compact" : ""}`}
    >
      <span
        className={`deck-workspace-context__badge deck-workspace-context__badge--${info.kind}`}
      >
        {info.dashboardLabel}
      </span>
      <span className="deck-workspace-context__detail">{info.detail}</span>
    </p>
  );
}
