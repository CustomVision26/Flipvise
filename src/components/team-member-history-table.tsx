"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TeamMemberHistoryRow } from "@/lib/team-member-history-types";
import type { ClerkUserFieldDisplay } from "@/lib/clerk-user-display";
import { cn } from "@/lib/utils";

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

function ActionBadge({ action }: { action: TeamMemberHistoryRow["action"] }) {
  const added = action === "added";
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 rounded-full border-transparent px-2.5 text-xs font-medium",
        added
          ? "team-admin-added-badge bg-emerald-100 text-emerald-700"
          : "team-admin-removed-badge bg-rose-100 text-rose-700",
      )}
    >
      {actionLabel(action)}
    </Badge>
  );
}

function RoleBadge({ role }: { role: TeamMemberHistoryRow["memberRole"] }) {
  if (role === "team_admin") {
    return (
      <Badge
        variant="outline"
        className="team-admin-role-badge h-6 rounded-full border-transparent bg-violet-100 px-2.5 text-xs font-medium text-violet-700"
      >
        Team admin
      </Badge>
    );
  }
  return <span className="text-sm text-slate-700">{roleLabel(role)}</span>;
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
      <div className="hidden overflow-hidden rounded-2xl border border-violet-100 bg-white sm:block">
        <Table className="min-w-[48rem] text-sm">
          <TableHeader className="bg-violet-50 [&_tr]:border-violet-100">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[11rem] text-violet-400">Event time</TableHead>
              <TableHead className="w-[6rem] text-violet-400">Action</TableHead>
              <TableHead className="text-violet-400">Member</TableHead>
              <TableHead className="w-[8rem] text-violet-400">Role</TableHead>
              <TableHead className="text-violet-400">By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((row) => (
              <TableRow key={row.id} className="border-violet-50 hover:bg-violet-50/40">
                <TableCell className="whitespace-nowrap text-slate-500">
                  {formatEventTimestamp(row.createdAt)}
                </TableCell>
                <TableCell>
                  <ActionBadge action={row.action} />
                </TableCell>
                <TableCell className="min-w-0 break-words font-medium text-slate-800">
                  {displayForUserId(row.memberUserId, userFieldDisplayById)}
                </TableCell>
                <TableCell>
                  <RoleBadge role={row.memberRole} />
                </TableCell>
                <TableCell className="min-w-0 break-words text-slate-700">
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
              <ActionBadge action={row.action} />
              <span className="shrink-0 text-xs text-slate-500">
                {formatEventTimestamp(row.createdAt)}
              </span>
            </div>
            <p className="text-sm leading-relaxed">
              <span className="text-muted-foreground">Member: </span>
              {displayForUserId(row.memberUserId, userFieldDisplayById)}
            </p>
            <p className="flex items-center gap-2 text-sm leading-relaxed">
              <span className="text-muted-foreground">Role: </span>
              <RoleBadge role={row.memberRole} />
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
