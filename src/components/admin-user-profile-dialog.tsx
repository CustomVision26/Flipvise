"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getAdminUserRecordsAction,
  type AdminUserRecordsResult,
} from "@/actions/admin-user-records";
import type { SerializedUser } from "@/lib/admin-dashboard-types";
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_VALUES,
  type AccountType,
} from "@/lib/account-recovery-profile";
import type { AdminUserPlanAccessType } from "@/lib/admin-user-plan-label";

function formatWhen(value: string | null | undefined, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return "—";
  return withTime
    ? date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function planAccessVariant(accessType: AdminUserPlanAccessType) {
  if (accessType === "Paid") return "default" as const;
  if (accessType === "Assigned" || accessType === "Affiliate") return "secondary" as const;
  return "outline" as const;
}

function personLabel(
  names: AdminUserRecordsResult["names"],
  userId: string,
) {
  const person = names[userId];
  if (!person) return userId;
  return person.email ? `${person.name} · ${person.email}` : person.name;
}

type RecordTone = "sky" | "emerald" | "gold" | "violet" | "rose" | "amber";

function RecordTable({
  columns,
  rows,
  empty,
  tone = "violet",
}: {
  columns: string[];
  rows: ReactNode[][];
  empty: string;
  tone?: RecordTone;
}) {
  if (rows.length === 0) {
    return <p className="admin-profile-empty">{empty}</p>;
  }
  return (
    <div className="admin-profile-table" data-tone={tone}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={`${index}-${columns[0] ?? "row"}`}>
              {row.map((cell, cellIndex) => (
                <TableCell key={`${columnKey(columns, cellIndex)}-${index}`} className="align-top">
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SubTable({
  title,
  tone,
  children,
}: {
  title: string;
  tone: RecordTone;
  children: ReactNode;
}) {
  return (
    <div className="admin-profile-subtable" data-tone={tone}>
      <p className="admin-profile-subtable-title">{title}</p>
      {children}
    </div>
  );
}

function CountChip({ value }: { value: number }) {
  return <span className="admin-profile-count">{value}</span>;
}

function columnKey(columns: string[], index: number) {
  return columns[index] ?? String(index);
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="admin-profile-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function AdminUserProfileDialog({
  user,
  detailsLoading,
}: {
  user: SerializedUser;
  detailsLoading: boolean;
}) {
  const [tab, setTab] = useState("profile");
  const [records, setRecords] = useState<AdminUserRecordsResult | null>(null);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [loadingRecords, setLoadingRecords] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRecords(null);
    setRecordsError(null);
    setLoadingRecords(true);
    getAdminUserRecordsAction({ targetUserId: user.id })
      .then((result) => {
        if (!cancelled) setRecords(result);
      })
      .catch(() => {
        if (!cancelled) setRecordsError("These records could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoadingRecords(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const accountType =
    user.accountType && ACCOUNT_TYPE_VALUES.includes(user.accountType as AccountType)
      ? ACCOUNT_TYPE_LABELS[user.accountType as AccountType]
      : (user.accountType ?? "—");

  return (
    <DialogContent className="admin-user-profile-dialog">
      <DialogHeader className="admin-profile-header">
        <div className="min-w-0 space-y-2">
          <p className="admin-profile-kicker">Platform record</p>
          <DialogTitle className="text-left text-2xl leading-snug">{user.fullName}</DialogTitle>
          <DialogDescription className="text-left">
            User profile, decks, workspaces, and plan history.
          </DialogDescription>
          <div className="flex flex-wrap gap-2 pt-1">
            {user.isSuperadmin ? <Badge>Owner / Superadmin</Badge> : null}
            {user.isAdmin && !user.isSuperadmin ? <Badge variant="destructive">Admin</Badge> : null}
            {user.isBanned ? (
              <Badge variant="outline" className="border-destructive text-destructive">
                Banned
              </Badge>
            ) : null}
            <Badge variant={user.isOnline ? "default" : "outline"}>
              {user.isOnline ? "Online" : "Offline"}
            </Badge>
            <Badge variant={user.planDisplayName === "Free" ? "secondary" : "default"}>
              {user.planDisplayName}
            </Badge>
            <Badge variant={planAccessVariant(user.planAccessType)}>{user.planAccessType}</Badge>
          </div>
        </div>
      </DialogHeader>

      <Tabs value={tab} onValueChange={setTab} className="admin-profile-tabs">
        <TabsList className="admin-profile-tab-list">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="admin-profile-panel">
          <section className="admin-profile-card" data-tone="violet">
            <h3>Profile</h3>
            <dl>
              <Detail label="Email" value={user.email ?? "—"} />
              <Detail label="User ID" value={<span className="font-mono text-xs">{user.id}</span>} />
              <Detail label="Joined" value={formatWhen(user.createdAt, true)} />
              <Detail
                label="Last sign-in"
                value={user.lastSignInAt ? formatWhen(user.lastSignInAt, true) : "Never"}
              />
              <Detail
                label="Phone"
                value={
                  detailsLoading && !user.phoneNumber ? "Loading…" : (user.phoneNumber ?? "—")
                }
              />
              <Detail label="Mailing address" value={user.mailingAddress ?? "—"} />
              <Detail label="Type / status" value={accountType} />
              {user.organizationName ? (
                <Detail label="Organization" value={user.organizationName} />
              ) : null}
              <Detail
                label="Security Q&A"
                value={
                  detailsLoading && !user.securityQuestions?.length ? (
                    "Loading…"
                  ) : user.securityQuestions?.length ? (
                    <ul className="space-y-2">
                      {user.securityQuestions.map((item) => (
                        <li key={item.question}>
                          <p className="font-medium">{item.question}</p>
                          <p>{item.answer}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  )
                }
              />
              <Detail label="Admin accessed" value={formatWhen(user.lastAdminProfileAccessAt, true)} />
              {user.associatePlan ? <Detail label="Associate plan" value={user.associatePlan} /> : null}
            </dl>
          </section>

          <section className="admin-profile-card" data-tone="gold">
            <h3>Current plan</h3>
            <dl>
              <Detail label="Personal plan" value={user.currentPersonalPlan} />
              <Detail label="Plan type" value={user.planAccessType} />
              <Detail label="Plan updated" value={formatWhen(user.planSetAt, true)} />
              <Detail label="Active since" value={formatWhen(user.currentPersonalPlanDateTime, true)} />
              <Detail label="Clerk plan" value={user.clerkPlan} />
              <Detail label="Admin assigned" value={user.adminAssignedPlan} />
            </dl>
          </section>
        </TabsContent>

        <TabsContent value="records" className="admin-profile-panel">
          {loadingRecords ? (
            <p className="admin-profile-empty">
              <Loader2 className="mr-2 inline size-4 animate-spin" aria-hidden />
              Loading records…
            </p>
          ) : recordsError ? (
            <p className="admin-profile-empty">{recordsError}</p>
          ) : records ? (
            <>
              <section className="admin-profile-card" data-tone="sky">
                <h3>Personal dashboard</h3>
                <p className="admin-profile-note">
                  Decks on this member’s personal dashboard, with the card count and the date the deck was created.
                </p>
                <SubTable title="Personal decks" tone="sky">
                  <RecordTable
                    tone="sky"
                    columns={["Deck", "Cards", "Created"]}
                    empty="No personal decks."
                    rows={records.personalDecks.map((deck) => [
                      deck.name,
                      <CountChip key={deck.id} value={deck.cardCount} />,
                      formatWhen(deck.createdAt, true),
                    ])}
                  />
                </SubTable>
              </section>

              <section className="admin-profile-card" data-tone="emerald">
                <h3>Invited workspaces</h3>
                <p className="admin-profile-note">
                  Workspaces this member was invited to, and the decks assigned to them.
                </p>
                {records.invitedWorkspaces.length === 0 ? (
                  <p className="admin-profile-empty">No workspace invitations.</p>
                ) : (
                  records.invitedWorkspaces.map((workspace) => (
                    <article key={workspace.teamId} className="admin-profile-record" data-tone="emerald">
                      <header>
                        <p className="font-semibold">{workspace.name}</p>
                        <Badge variant="outline">{workspace.role}</Badge>
                        <span>Joined {formatWhen(workspace.joinedAt, true)}</span>
                      </header>
                      <SubTable title="Assigned decks" tone="sky">
                        <RecordTable
                          tone="sky"
                          columns={["Assigned deck", "Cards", "Record created"]}
                          empty="No decks assigned in this workspace."
                          rows={workspace.assignedDecks.map((deck) => [
                            deck.name,
                            <CountChip key={deck.id} value={deck.cardCount} />,
                            formatWhen(deck.createdAt, true),
                          ])}
                        />
                      </SubTable>
                    </article>
                  ))
                )}
              </section>

              {records.ownedWorkspaces.length > 0 ? (
                <section className="admin-profile-card" data-tone="rose">
                  <h3>Workspaces owned</h3>
                  <p className="admin-profile-note">
                    Team plan owner workspaces, invited members and roles, linked decks, and who each deck is assigned to.
                  </p>
                  {records.ownedWorkspaces.map((workspace) => (
                    <article key={workspace.teamId} className="admin-profile-record" data-tone="rose">
                      <header>
                        <p className="font-semibold">{workspace.name}</p>
                        <Badge variant="secondary">Deck limit {workspace.deckLimit}</Badge>
                        <span>Created {formatWhen(workspace.createdAt, true)}</span>
                      </header>
                      <SubTable title="Invited members" tone="amber">
                        <RecordTable
                          tone="amber"
                          columns={["Member", "Role", "Deck limit", "Joined"]}
                          empty="No invited members."
                          rows={workspace.members.map((member) => [
                            personLabel(records.names, member.userId),
                            member.role,
                            member.deckLimit == null ? "—" : <CountChip key={member.userId} value={member.deckLimit} />,
                            formatWhen(member.joinedAt, true),
                          ])}
                        />
                      </SubTable>
                      <SubTable title="Linked decks" tone="sky">
                        <RecordTable
                          tone="sky"
                          columns={["Deck", "Cards", "Linked"]}
                          empty="No linked decks."
                          rows={workspace.linkedDecks.map((deck) => [
                            deck.name,
                            <CountChip key={deck.id} value={deck.cardCount} />,
                            formatWhen(deck.createdAt, true),
                          ])}
                        />
                      </SubTable>
                      <SubTable title="Deck assignments" tone="violet">
                        <RecordTable
                          tone="violet"
                          columns={["Deck", "Cards", "Assigned to", "Assigned"]}
                          empty="No deck assignments."
                          rows={workspace.assignments.map((deck) => [
                            deck.name,
                            <CountChip key={`${deck.id}-${deck.memberUserId}`} value={deck.cardCount} />,
                            personLabel(records.names, deck.memberUserId),
                            formatWhen(deck.assignedAt, true),
                          ])}
                        />
                      </SubTable>
                    </article>
                  ))}
                </section>
              ) : null}
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="history" className="admin-profile-panel">
          <section className="admin-profile-card" data-tone="gold">
            <h3>Current plan</h3>
            <dl>
              <Detail label="Plan" value={user.planDisplayName} />
              <Detail label="Type" value={user.planAccessType} />
              <Detail label="Active since" value={formatWhen(user.currentPersonalPlanDateTime, true)} />
              <Detail label="Updated" value={formatWhen(user.planSetAt, true)} />
            </dl>
          </section>
          <section className="admin-profile-card" data-tone="violet">
            <h3>Previous plans</h3>
            {loadingRecords ? (
              <p className="admin-profile-empty">Loading plan history…</p>
            ) : recordsError ? (
              <p className="admin-profile-empty">{recordsError}</p>
            ) : (
              <SubTable title="Plan changes" tone="violet">
                <RecordTable
                  tone="violet"
                  columns={["Plan", "Previous", "Status", "Recorded"]}
                  empty="No earlier plan changes are on record."
                  rows={(records?.planHistory ?? []).map((row) => [
                    row.planName,
                    row.previousPlanName ?? row.detail ?? "—",
                    <span key={row.id} className="admin-profile-status" data-status={row.status}>
                      {row.status}
                    </span>,
                    formatWhen(row.recordedAt, true),
                  ])}
                />
              </SubTable>
            )}
          </section>
          <section className="admin-profile-card" data-tone="rose">
            <h3>Deleted decks and cards</h3>
            <p className="admin-profile-note">
              Each removal is kept with the date and time. Earlier removals, from before this record began, are not listed.
            </p>
            {loadingRecords ? (
              <p className="admin-profile-empty">Loading deletion history…</p>
            ) : (
              <>
              <SubTable title="Deleted decks" tone="rose">
                <RecordTable
                  tone="rose"
                  columns={["Deck", "Cards removed", "Cards", "Deleted"]}
                  empty="No deleted decks are on record."
                  rows={(records?.deletions ?? [])
                    .filter((row) => row.kind === "deck")
                    .map((row) => [
                      row.deckName,
                      row.cardCount == null ? "—" : <CountChip key={row.id} value={row.cardCount} />,
                      row.cardLabel ?? "—",
                      formatWhen(row.deletedAt, true),
                    ])}
                />
              </SubTable>
              <SubTable title="Deleted cards" tone="amber">
                <RecordTable
                  tone="amber"
                  columns={["Deck", "Card", "Deleted"]}
                  empty="No deleted cards are on record."
                  rows={(records?.deletions ?? [])
                    .filter((row) => row.kind === "card")
                    .map((row) => [
                      row.deckName,
                      row.cardLabel ?? "—",
                      formatWhen(row.deletedAt, true),
                    ])}
                />
              </SubTable>
              </>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </DialogContent>
  );
}
