"use client";

import * as React from "react";
import { ChevronDown, Layers, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import type {
  TeamAiRecallDashboardStats,
  TeamAiRecallDeckRollup,
  TeamAiRecallMemberRollup,
  TeamAiRecallSessionSummary,
} from "@/lib/ai-recall-team-stats";
import { cn } from "@/lib/utils";

function formatMs(ms: number | null): string {
  if (ms == null || ms <= 0) return "—";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem ? `${min}m ${rem}s` : `${min}m`;
}

function formatPercent(value: number | null): string {
  return value != null ? `${value}%` : "—";
}

function formatSavedAt(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AiRecallTeamMonitor({
  stats,
  audience = "members",
  embedded = false,
}: {
  stats: TeamAiRecallDashboardStats;
  /** Teacher Student Progress uses student wording for the same session rows. */
  audience?: "members" | "students";
  /** Render inside an existing card instead of a second panel. */
  embedded?: boolean;
}) {
  const [tab, setTab] = React.useState("members");
  const [query, setQuery] = React.useState("");
  const [activeKey, setActiveKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    setActiveKey(null);
    setQuery("");
  }, [tab]);

  const personNoun = audience === "students" ? "student" : "member";
  const personNounPlural = audience === "students" ? "Students" : "Members";
  const q = query.trim().toLowerCase();
  const members = stats.members.filter((member) => {
    if (!q) return true;
    const label = member.memberLabel.toLowerCase().includes(q);
    if (audience === "students") return label;
    return label || member.userId.toLowerCase().includes(q);
  });
  const decks = stats.decks.filter((deck) => {
    if (!q) return true;
    return deck.deckName.toLowerCase().includes(q);
  });

  const monitor = (
    <section
      className={cn("space-y-3", embedded && "space-y-2")}
      aria-labelledby="active-recall-monitor"
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {audience === "students" ? "Individual results" : "Session results"}
        </p>
        <h2
          id="active-recall-monitor"
          className="text-base font-semibold tracking-tight text-foreground"
        >
          {audience === "students"
            ? "Track each student"
            : "Track members and decks"}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {audience === "students"
            ? "Open a student to see every saved AI Recall™ session for that person. Open a deck to see how students performed on that material."
            : "Open a member to see every saved AI Recall™ session for that person. Open a deck to see how the workspace performed on that material."}
        </p>
      </div>

      <Card className={cn(teamAdminCardClass, embedded && "border-border/60 bg-background/30 shadow-none")}>
        <CardHeader className="space-y-1.5 border-b border-border/40 pb-4">
          <CardTitle className="text-sm font-semibold tracking-tight">
            Saved session monitor
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            {audience === "students"
              ? "Click a student to expand that person’s saved AI Recall™ sessions. Results appear after the student saves a completed session."
              : "Click a row to expand session details. Metrics come from completed sessions members saved — on-screen results that were not saved are not included."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs
            value={tab}
            onValueChange={(value) => {
              if (typeof value === "string") setTab(value);
            }}
            className="gap-0"
          >
            <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <TabsList className="h-9">
                <TabsTrigger value="members">
                  <Users className="size-3.5" aria-hidden />
                  {personNounPlural}
                  <Badge variant="secondary" className="ml-1 tabular-nums">
                    {stats.members.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="decks">
                  <Layers className="size-3.5" aria-hidden />
                  Decks
                  <Badge variant="secondary" className="ml-1 tabular-nums">
                    {stats.decks.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
              <div className="relative w-full sm:max-w-xs">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    tab === "members"
                      ? `Search ${personNounPlural.toLowerCase()}`
                      : "Search decks"
                  }
                  className="h-9 bg-background pl-8"
                  aria-label={
                    tab === "members"
                      ? `Search ${personNounPlural.toLowerCase()}`
                      : "Search decks"
                  }
                />
              </div>
            </div>

            <TabsContent value="members" className="mt-0 rounded-none border-0 p-0 shadow-none ring-0">
              <MonitorTable
                empty={`No saved ${personNoun} sessions match this search.`}
                columns={[
                  audience === "students" ? "Student" : "Member",
                  "Sessions",
                  "Accuracy",
                  "Avg. AI score",
                  "Avg. time",
                  "Last session",
                ]}
                rows={members.map((member) => {
                  const key = `member:${member.userId}`;
                  return {
                    key,
                    cells: [
                      member.memberLabel,
                      String(member.sessions),
                      formatPercent(member.accuracy),
                      formatPercent(member.averageAiScore),
                      formatMs(member.averageSessionTimeMs),
                      formatSavedAt(member.lastSavedAt),
                    ],
                    detail: (
                      <SessionDetailTable
                        sessions={stats.sessions.filter(
                          (session) => session.userId === member.userId,
                        )}
                        variant="member"
                      />
                    ),
                    summary: memberSummary(member),
                  };
                })}
                activeKey={activeKey}
                onToggle={setActiveKey}
              />
            </TabsContent>
            <TabsContent value="decks" className="mt-0 rounded-none border-0 p-0 shadow-none ring-0">
              <MonitorTable
                empty="No saved deck sessions match this search."
                columns={[
                  "Deck",
                  "Sessions",
                  personNounPlural,
                  "Accuracy",
                  "Avg. AI score",
                  "Misses",
                  "Last session",
                ]}
                rows={decks.map((deck) => {
                  const key = `deck:${deck.key}`;
                  return {
                    key,
                    cells: [
                      deck.deckName,
                      String(deck.sessions),
                      String(deck.memberCount),
                      formatPercent(deck.accuracy),
                      formatPercent(deck.averageAiScore),
                      String(deck.misses),
                      formatSavedAt(deck.lastSavedAt),
                    ],
                    detail: (
                      <SessionDetailTable
                        sessions={stats.sessions.filter((session) =>
                          deck.deckId != null
                            ? session.deckId === deck.deckId
                            : session.deckName === deck.deckName &&
                              session.deckId == null,
                        )}
                        variant="deck"
                        personLabel={audience === "students" ? "Student" : "Member"}
                      />
                    ),
                    summary: deckSummary(deck, personNoun),
                  };
                })}
                activeKey={activeKey}
                onToggle={setActiveKey}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </section>
  );

  return monitor;
}

function memberSummary(member: TeamAiRecallMemberRollup): string {
  return `${member.sessions} saved session${member.sessions === 1 ? "" : "s"} · ${member.cardsReviewed} cards reviewed · ${member.misses} misses`;
}

function deckSummary(deck: TeamAiRecallDeckRollup, personNoun: string): string {
  return `${deck.sessions} saved session${deck.sessions === 1 ? "" : "s"} · ${deck.memberCount} ${personNoun}${deck.memberCount === 1 ? "" : "s"} · ${deck.cardsReviewed} cards reviewed`;
}

function MonitorTable({
  columns,
  rows,
  empty,
  activeKey,
  onToggle,
}: {
  columns: string[];
  rows: {
    key: string;
    cells: string[];
    detail: React.ReactNode;
    summary: string;
  }[];
  empty: string;
  activeKey: string | null;
  onToggle: (key: string | null) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column, index) => (
              <TableHead
                key={column}
                className={cn(
                  "h-9 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                  index === 0 ? "pl-5" : null,
                  index === columns.length - 1 ? "pr-5 text-right" : null,
                )}
              >
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isActive = activeKey === row.key;
            return (
              <React.Fragment key={row.key}>
                <TableRow
                  className={cn("cursor-pointer", isActive && "bg-muted/40")}
                  onClick={() => onToggle(isActive ? null : row.key)}
                  aria-selected={isActive}
                >
                  {row.cells.map((cell, cellIndex) => (
                    <TableCell
                      key={`${row.key}-${cellIndex}`}
                      className={cn(
                        "py-2.5 text-sm",
                        cellIndex === 0
                          ? "max-w-[14rem] pl-5 font-medium text-foreground sm:max-w-xs"
                          : "text-muted-foreground tabular-nums",
                        cellIndex === row.cells.length - 1
                          ? "pr-5 text-right"
                          : null,
                      )}
                      title={cellIndex === 0 ? cell : undefined}
                    >
                      {cellIndex === 0 ? (
                        <span className="flex items-center gap-2">
                          <ChevronDown
                            className={cn(
                              "size-3.5 shrink-0 text-muted-foreground transition-transform",
                              isActive && "rotate-180",
                            )}
                            aria-hidden
                          />
                          <span className="truncate">{cell}</span>
                        </span>
                      ) : (
                        cell
                      )}
                    </TableCell>
                  ))}
                </TableRow>
                {isActive ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={columns.length} className="bg-muted/15 p-0">
                      <div className="space-y-2 px-5 py-4">
                        <p className="text-xs text-muted-foreground">
                          {row.summary}
                        </p>
                        {row.detail}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function SessionDetailTable({
  sessions,
  variant,
  personLabel = "Member",
}: {
  sessions: TeamAiRecallSessionSummary[];
  variant: "member" | "deck";
  personLabel?: string;
}) {
  if (sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No saved sessions for this row.
      </p>
    );
  }

  const subjectHeader = variant === "member" ? "Deck" : personLabel;

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60 bg-background/40">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {[
              "Saved",
              subjectHeader,
              "Accuracy",
              "AI score",
              "Time",
              "Cards",
              "Correct",
              "Misses",
            ].map((column, index) => (
              <TableHead
                key={column}
                className={cn(
                  "h-8 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                  index === 0 ? "pl-3" : null,
                  index === 7 ? "pr-3 text-right" : null,
                )}
              >
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => (
            <TableRow key={session.id}>
              <TableCell className="py-2 pl-3 text-xs text-foreground">
                {formatSavedAt(session.savedAt)}
              </TableCell>
              <TableCell
                className="max-w-[12rem] truncate py-2 text-xs font-medium"
                title={
                  variant === "member" ? session.deckName : session.memberLabel
                }
              >
                {variant === "member" ? session.deckName : session.memberLabel}
              </TableCell>
              <TableCell className="py-2 text-xs tabular-nums text-muted-foreground">
                {formatPercent(session.accuracy)}
              </TableCell>
              <TableCell className="py-2 text-xs tabular-nums text-muted-foreground">
                {formatPercent(session.averageAiScore)}
              </TableCell>
              <TableCell className="py-2 text-xs tabular-nums text-muted-foreground">
                {formatMs(session.sessionDurationMs)}
              </TableCell>
              <TableCell className="py-2 text-xs tabular-nums text-muted-foreground">
                {session.cardsReviewed}
              </TableCell>
              <TableCell className="py-2 text-xs tabular-nums text-muted-foreground">
                {session.correct}
              </TableCell>
              <TableCell className="py-2 pr-3 text-right text-xs tabular-nums text-muted-foreground">
                {session.incorrect + session.forcedUnlocks}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
