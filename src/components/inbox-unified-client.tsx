"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BookCheck,
  Users,
  Receipt,
  Megaphone,
  CircleAlert,
  Shield,
  MailOpen,
  CheckCheck,
  History,
  Inbox,
  ArrowDownUp,
  ExternalLink,
} from "lucide-react";
import { markInboxItemReadAction, markAllInboxItemsReadAction } from "@/actions/inbox";
import {
  acceptTeamInvitationByIdAction,
  rejectTeamInvitationByIdAction,
} from "@/actions/teams";
import { acceptAffiliateInviteAction } from "@/actions/affiliates";
import {
  acceptAdminPlanInviteAction,
  declineAdminPlanInviteAction,
} from "@/actions/admin-plan-invite";
import { ViewQuizResultDialog } from "@/components/view-quiz-result-dialog";
import type { UnifiedInboxItem, InboxItemType } from "@/lib/inbox-item-types";
import { INBOX_TYPE_LABELS } from "@/lib/inbox-item-types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatAmount(cents: number | null, currency: string | null): string {
  if (cents == null) return "";
  const amt = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency ?? "USD").toUpperCase(),
    }).format(amt);
  } catch {
    return `${amt.toFixed(2)} ${(currency ?? "USD").toUpperCase()}`;
  }
}

const TYPE_ICONS: Record<InboxItemType, React.ReactNode> = {
  quiz_result: <BookCheck className="size-4 text-purple-400" aria-hidden />,
  team_invite: <Users className="size-4 text-blue-400" aria-hidden />,
  billing: <Receipt className="size-4 text-emerald-400" aria-hidden />,
  affiliate: <Megaphone className="size-4 text-amber-400" aria-hidden />,
  affiliate_notice: <CircleAlert className="size-4 text-orange-400" aria-hidden />,
  admin_plan_invite: <Shield className="size-4 text-violet-400" aria-hidden />,
  admin_plan_log: <Shield className="size-4 text-sky-400" aria-hidden />,
};

type SortKey = "newest" | "oldest" | "type";

function sortItems(items: UnifiedInboxItem[], sort: SortKey): UnifiedInboxItem[] {
  return [...items].sort((a, b) => {
    if (sort === "type") {
      const typeOrder: Record<InboxItemType, number> = {
        team_invite: 0,
        admin_plan_invite: 1,
        quiz_result: 2,
        billing: 3,
        affiliate: 4,
        affiliate_notice: 5,
        admin_plan_log: 6,
      };
      const td = typeOrder[a.type] - typeOrder[b.type];
      if (td !== 0) return td;
    }
    const da = new Date(a.dateIso).getTime();
    const db2 = new Date(b.dateIso).getTime();
    return sort === "oldest" ? da - db2 : db2 - da;
  });
}

// ── Row sub-components ────────────────────────────────────────────────────────

function TeamInviteActions({
  item,
  onMutate,
}: {
  item: UnifiedInboxItem & { type: "team_invite" };
  onMutate: () => void;
}) {
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setPending("accept");
    setError(null);
    try {
      await acceptTeamInvitationByIdAction({ invitationId: item.payload.invitationId });
      onMutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to accept");
    } finally {
      setPending(null);
    }
  }

  async function handleDecline() {
    setPending("decline");
    setError(null);
    try {
      await rejectTeamInvitationByIdAction({ invitationId: item.payload.invitationId });
      onMutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to decline");
    } finally {
      setPending(null);
    }
  }

  if (item.payload.outcome !== "needs_response") return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending !== null}
          onClick={handleAccept}
        >
          {pending === "accept" ? "Accepting…" : "Accept"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending !== null}
          onClick={handleDecline}
        >
          Decline
        </Button>
      </div>
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}

function AdminPlanInviteActions({
  item,
  onMutate,
}: {
  item: UnifiedInboxItem & { type: "admin_plan_invite" };
  onMutate: () => void;
}) {
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (item.payload.status !== "pending") return null;

  async function handleAccept() {
    setPending("accept");
    setError(null);
    try {
      await acceptAdminPlanInviteAction({ inviteId: item.payload.inviteId });
      onMutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to accept");
    } finally {
      setPending(null);
    }
  }

  async function handleDecline() {
    setPending("decline");
    setError(null);
    try {
      await declineAdminPlanInviteAction({ inviteId: item.payload.inviteId });
      onMutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to decline");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Button size="sm" disabled={pending !== null} onClick={handleAccept}>
          {pending === "accept" ? "Accepting…" : "Accept"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending !== null}
          onClick={handleDecline}
        >
          {pending === "decline" ? "Declining…" : "Decline"}
        </Button>
      </div>
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}

function AffiliateActions({
  item,
  onMutate,
}: {
  item: UnifiedInboxItem & { type: "affiliate" };
  onMutate: () => void;
}) {
  const [pending, startPending] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (item.payload.status !== "pending" || !item.payload.token) return null;

  const inviteExpired =
    new Date(item.payload.inviteExpiresAtIso).getTime() < Date.now();

  if (inviteExpired) {
    return (
      <p className="text-xs text-muted-foreground max-w-[220px] text-right sm:text-left">
        This invite link expired on{" "}
        {formatDate(item.payload.inviteExpiresAtIso)}. Ask for a new invite.
      </p>
    );
  }

  function handleAccept() {
    startPending(async () => {
      try {
        await acceptAffiliateInviteAction({ token: item.payload.token! });
        onMutate();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to accept");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button size="sm" disabled={pending} onClick={handleAccept}>
        {pending ? "Accepting…" : "Accept invite"}
      </Button>
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}

// ── Main item row ─────────────────────────────────────────────────────────────

function InboxItemRow({
  item,
  showMarkRead,
  onMarkRead,
  onMutate,
}: {
  item: UnifiedInboxItem;
  showMarkRead: boolean;
  onMarkRead: (item: UnifiedInboxItem) => void;
  onMutate: () => void;
}) {
  const inviteOutcomeBadge = (outcome: string) => {
    switch (outcome) {
      case "needs_response": return <Badge variant="secondary" className="text-xs">Pending</Badge>;
      case "pending_expired": return <Badge variant="outline" className="text-xs">Expired</Badge>;
      case "accepted": return <Badge className="text-xs bg-emerald-600 text-white hover:bg-emerald-600/90">Accepted</Badge>;
      case "rejected": return <Badge variant="destructive" className="text-xs">Declined</Badge>;
      case "revoked": return <Badge variant="outline" className="text-xs">Withdrawn</Badge>;
      default: return <Badge variant="outline" className="text-xs capitalize">{outcome}</Badge>;
    }
  };

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 transition-colors sm:flex-row sm:items-start sm:justify-between ${
        !item.isRead
          ? "border-primary/25 bg-primary/5"
          : "border-border bg-card/40"
      }`}
    >
      {/* ── Left: icon + content ── */}
      <div className="flex min-w-0 gap-3">
        <div
          className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border ${
            !item.isRead ? "border-primary/20 bg-primary/10" : "border-border bg-muted/30"
          }`}
        >
          {TYPE_ICONS[item.type]}
        </div>

        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm text-foreground leading-tight">
              {item.title}
            </span>
            {!item.isRead && (
              <Badge variant="outline" className="shrink-0 text-[10px] border-primary/40 text-primary px-1.5 py-0">
                NEW
              </Badge>
            )}
            {item.type === "team_invite" && inviteOutcomeBadge(item.payload.outcome)}
            {item.type === "affiliate" && item.payload.status === "pending" && (
              new Date(item.payload.inviteExpiresAtIso).getTime() < Date.now() ? (
                <Badge variant="outline" className="shrink-0 text-xs text-muted-foreground">
                  Link expired
                </Badge>
              ) : (
                <Badge variant="secondary" className="shrink-0 text-xs">
                  Action needed
                </Badge>
              )
            )}
            {item.type === "affiliate" && item.payload.status !== "pending" && (() => {
              const periodEnded =
                item.payload.status === "active" &&
                new Date(item.payload.endsAtIso).getTime() < Date.now();
              return (
                <Badge
                  variant={item.payload.status === "active" && !periodEnded ? "default" : "outline"}
                  className="shrink-0 text-xs capitalize"
                >
                  {periodEnded ? "Period ended" : item.payload.status}
                </Badge>
              );
            })()}
            {item.type === "affiliate_notice" && (
              <Badge
                variant="outline"
                className="shrink-0 text-xs border-orange-500/40 text-orange-400"
              >
                {item.payload.kind === "expired"
                  ? "Period ended"
                  : item.payload.kind === "revoked_access"
                    ? "Access removed"
                    : "Invite withdrawn"}
              </Badge>
            )}
            {item.type === "admin_plan_invite" && item.payload.status === "pending" && (
              <Badge variant="secondary" className="shrink-0 text-xs">
                Action needed
              </Badge>
            )}
            {item.type === "admin_plan_invite" && item.payload.status === "declined" && (
              <Badge variant="destructive" className="shrink-0 text-xs">
                Declined
              </Badge>
            )}
            {item.type === "admin_plan_invite" && item.payload.status === "superseded" && (
              <Badge variant="outline" className="shrink-0 text-xs text-muted-foreground">
                Replaced
              </Badge>
            )}
            {item.type === "admin_plan_log" && (
              <Badge
                variant="outline"
                className="shrink-0 text-xs border-sky-500/40 text-sky-400"
              >
                {item.payload.planApplicationPath === "stripe_proration"
                  ? "Proration"
                  : item.payload.action === "plan_removed"
                    ? "Plan cleared"
                    : "Direct update"}
              </Badge>
            )}
            {item.type === "billing" && (
              <Badge variant="outline" className="shrink-0 text-xs capitalize">
                {item.payload.status}
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground">{item.description}</p>
          <p className="text-xs text-muted-foreground/70" suppressHydrationWarning>
            {formatDate(item.dateIso)}
          </p>

          {/* Type-specific inline content */}
          {item.type === "team_invite" && item.payload.outcome === "needs_response" && (
            <p className="text-xs text-muted-foreground">
              From <span className="text-foreground">{item.payload.inviterName}</span> ·{" "}
              Role: <span className="text-foreground capitalize">{item.payload.role === "team_admin" ? "Team Admin" : "Member"}</span>
            </p>
          )}
        </div>
      </div>

      {/* ── Right: actions ── */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
        {/* Type-specific primary actions */}
        {item.type === "quiz_result" && (
          <ViewQuizResultDialog result={item.payload} triggerLabel="View" />
        )}

        {item.type === "team_invite" && (
          <TeamInviteActions item={item} onMutate={onMutate} />
        )}

        {item.type === "billing" && (
          <div className="flex gap-2">
            {item.payload.hostedInvoiceUrl && (
              <a
                href={item.payload.hostedInvoiceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
              >
                <ExternalLink className="size-3" aria-hidden />
                Open
              </a>
            )}
            {item.payload.invoicePdfUrl && (
              <a
                href={item.payload.invoicePdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
              >
                PDF
              </a>
            )}
          </div>
        )}

        {item.type === "admin_plan_invite" && (
          <AdminPlanInviteActions item={item} onMutate={onMutate} />
        )}

        {item.type === "affiliate" && (
          <AffiliateActions item={item} onMutate={onMutate} />
        )}

        {/* Mark as read */}
        {showMarkRead && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onMarkRead(item)}
          >
            <MailOpen className="size-3.5" aria-hidden />
            Mark as read
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Tab content ───────────────────────────────────────────────────────────────

function ItemList({
  items,
  emptyMessage,
  showMarkRead,
  onMarkRead,
  onMutate,
  sortKey,
  onSortChange,
  rightAction,
}: {
  items: UnifiedInboxItem[];
  emptyMessage: string;
  showMarkRead: boolean;
  onMarkRead: (item: UnifiedInboxItem) => void;
  onMutate: () => void;
  sortKey: SortKey;
  onSortChange: (v: SortKey) => void;
  rightAction?: React.ReactNode;
}) {
  const sorted = useMemo(() => sortItems(items, sortKey), [items, sortKey]);

  return (
    <div className="space-y-3">
      {/* Sort bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ArrowDownUp className="size-3.5" aria-hidden />
          <span>Sort</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Button-group sort — no portals, no hydration mismatch */}
          <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
            {(
              [
                { value: "newest", label: "Newest" },
                { value: "oldest", label: "Oldest" },
                { value: "type", label: "By type" },
              ] as { value: SortKey; label: string }[]
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSortChange(opt.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  sortKey === opt.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {rightAction}
        </div>
      </div>

      {/* Items */}
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <ol className="space-y-2.5">
          {sorted.map((item) => (
            <li key={item.key}>
              <InboxItemRow
                item={item}
                showMarkRead={showMarkRead}
                onMarkRead={onMarkRead}
                onMutate={onMutate}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function InboxUnifiedClient({ items }: { items: UnifiedInboxItem[] }) {
  // Prevent SSR — @base-ui/react Tabs + Dialog combination produces DOM structure
  // mismatches during hydration that cause `removeChild on null` crashes.
  // The inbox is fully interactive and gains nothing from server rendering.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const router = useRouter();
  const [markingAll, startMarkingAll] = useTransition();
  // Optimistic: keys marked read in this session
  const [sessionRead, setSessionRead] = useState<Set<string>>(new Set());

  const [inboxSort, setInboxSort] = useState<SortKey>("newest");
  const [historySort, setHistorySort] = useState<SortKey>("newest");

  function resolveRead(item: UnifiedInboxItem): boolean {
    if (sessionRead.has(item.key)) return true;
    return item.isRead;
  }

  const unreadItems = useMemo(
    () => items.filter((i) => !resolveRead(i)),
    [items, sessionRead], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const historyItems = useMemo(
    () => items.filter((i) => resolveRead(i)),
    [items, sessionRead], // eslint-disable-line react-hooks/exhaustive-deps
  );

  function handleMarkRead(item: UnifiedInboxItem) {
    const [type, id] = item.key.split(":");
    setSessionRead((prev) => new Set([...prev, item.key]));
    markInboxItemReadAction({ itemType: type, itemId: id }).catch(() => {});
  }

  function handleMarkAllRead() {
    const unread = items.filter((i) => !resolveRead(i));
    if (unread.length === 0) return;
    const keys = unread.map((i) => i.key);
    setSessionRead((prev) => new Set([...prev, ...keys]));
    startMarkingAll(async () => {
      await markAllInboxItemsReadAction({
        items: unread.map((i) => {
          const [itemType, itemId] = i.key.split(":");
          return { itemType, itemId };
        }),
      });
    });
  }

  function handleMutate() {
    router.refresh();
  }

  if (!mounted) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-10 w-full rounded-lg bg-muted/50 animate-pulse" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 w-full rounded-xl border border-border bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <Tabs defaultValue="inbox" className="w-full gap-0">
      <TabsList
        variant="line"
        className="h-auto w-full min-w-0 flex-wrap justify-start gap-0 border-b border-border bg-transparent p-0"
      >
        <TabsTrigger
          value="inbox"
          className="shrink-0 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-active:border-primary data-active:bg-transparent"
        >
          <Inbox className="mr-1.5 size-4" aria-hidden />
          Inbox
          {unreadItems.length > 0 && (
            <span className="ml-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground tabular-nums">
              {unreadItems.length > 99 ? "99+" : unreadItems.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="history"
          className="shrink-0 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-active:border-primary data-active:bg-transparent"
        >
          <History className="mr-1.5 size-4" aria-hidden />
          History
          {historyItems.length > 0 && (
            <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
              ({historyItems.length})
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      {/* ── Inbox (unread) ── */}
      <TabsContent value="inbox" className="mt-4" keepMounted>
        <ItemList
          items={unreadItems}
          emptyMessage="Your inbox is empty — nothing new to read."
          showMarkRead
          onMarkRead={handleMarkRead}
          onMutate={handleMutate}
          sortKey={inboxSort}
          onSortChange={setInboxSort}
          rightAction={
            unreadItems.length > 1 ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={handleMarkAllRead}
                disabled={markingAll}
              >
                <CheckCheck className="size-3.5" aria-hidden />
                Mark all read
              </Button>
            ) : undefined
          }
        />
      </TabsContent>

      {/* ── History (read) ── */}
      <TabsContent value="history" className="mt-4" keepMounted>
        <ItemList
          items={historyItems}
          emptyMessage="No history yet. Items you've read will appear here."
          showMarkRead={false}
          onMarkRead={() => {}}
          onMutate={handleMutate}
          sortKey={historySort}
          onSortChange={setHistorySort}
        />
      </TabsContent>
    </Tabs>
  );
}
