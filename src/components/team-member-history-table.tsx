"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TeamMemberHistoryRow } from "@/lib/team-member-history-types";
import { teamAdminTableWrapClass } from "@/components/team-admin-panel-styles";
import type { ClerkUserFieldDisplay } from "@/lib/clerk-user-display";

function formatEventTimestamp(d: Date | string) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function actionLabel(action: TeamMemberHistoryRow["action"]) {
  switch (action) {
    case "added":
      return "Added";
    case "removed":
      return "Removed";
    default:
      return action;
  }
}

function roleLabel(role: TeamMemberHistoryRow["memberRole"]) {
  switch (role) {
    case "team_admin":
      return "Team admin";
    case "team_member":
      return "Member";
    default:
      return role;
  }
}

function displayForUserId(
  userId: string,
  userFieldDisplayById: Record<string, ClerkUserFieldDisplay>,
) {
  return userFieldDisplayById[userId]?.primaryLine ?? userId;
}

export function TeamMemberHistoryTable({
  rows = [],
  userFieldDisplayById,
}: {
  rows?: TeamMemberHistoryRow[] | null;
  userFieldDisplayById: Record<string, ClerkUserFieldDisplay>;
}) {
  const list = rows ?? [];
  if (list.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No membership changes recorded yet. When someone joins or is removed from this workspace,
        the event will appear here.
      </p>
    );
  }

  return (
    <>
      <div className={`${teamAdminTableWrapClass} hidden sm:block`}>
        <Table className="min-w-[48rem] text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[11rem]">Event time</TableHead>
              <TableHead className="w-[6rem]">Action</TableHead>
              <TableHead>Member</TableHead>
              <TableHead className="w-[7rem]">Role</TableHead>
              <TableHead>By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatEventTimestamp(row.createdAt)}
                </TableCell>
                <TableCell>{actionLabel(row.action)}</TableCell>
                <TableCell className="min-w-0 break-words">
                  {displayForUserId(row.memberUserId, userFieldDisplayById)}
                </TableCell>
                <TableCell>{roleLabel(row.memberRole)}</TableCell>
                <TableCell className="min-w-0 break-words">
                  {row.actorUserId
                    ? displayForUserId(row.actorUserId, userFieldDisplayById)
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 sm:hidden">
        {list.map((row) => (
          <li
            key={row.id}
            className="space-y-2 rounded-lg border border-border/80 bg-background/40 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{actionLabel(row.action)}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatEventTimestamp(row.createdAt)}
              </span>
            </div>
            <p className="text-sm leading-relaxed">
              <span className="text-muted-foreground">Member: </span>
              {displayForUserId(row.memberUserId, userFieldDisplayById)}
            </p>
            <p className="text-sm leading-relaxed">
              <span className="text-muted-foreground">Role: </span>
              {roleLabel(row.memberRole)}
            </p>
            <p className="text-sm leading-relaxed">
              <span className="text-muted-foreground">By: </span>
              {row.actorUserId
                ? displayForUserId(row.actorUserId, userFieldDisplayById)
                : "—"}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
