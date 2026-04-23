"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TeamWorkspaceEventRow } from "@/db/queries/team-workspace-events";

function formatEventTimestamp(d: Date) {
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function actionLabel(action: TeamWorkspaceEventRow["action"]) {
  switch (action) {
    case "created":
      return "Created";
    case "updated":
      return "Updated";
    case "deleted":
      return "Deleted";
    default:
      return action;
  }
}

function detailsForRow(row: TeamWorkspaceEventRow) {
  if (row.action === "created") {
    return `Workspace created: ${row.teamName}`;
  }
  if (row.action === "updated" && row.previousTeamName) {
    return `Renamed: ${row.previousTeamName} → ${row.teamName}`;
  }
  if (row.action === "updated") {
    return `Updated: ${row.teamName}`;
  }
  if (row.action === "deleted") {
    return `Workspace removed: ${row.teamName}`;
  }
  return row.teamName;
}

export function TeamWorkspaceHistoryTable({
  rows = [],
}: {
  rows?: TeamWorkspaceEventRow[] | null;
}) {
  const list = rows ?? [];
  if (list.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No recorded changes yet. Creating, renaming, or removing this workspace will appear here.
      </p>
    );
  }

  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Event time</TableHead>
            <TableHead className="w-[120px]">Action</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatEventTimestamp(row.createdAt)}
              </TableCell>
              <TableCell>{actionLabel(row.action)}</TableCell>
              <TableCell className="min-w-0 break-words">{detailsForRow(row)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
