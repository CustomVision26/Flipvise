"use client";

import { useState, useTransition, useMemo, useEffect, useRef, Fragment } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  UserPlus,
  ShieldOff,
  Megaphone,
  CalendarClock,
  Pencil,
  UserX,
  Clock,
  CheckCircle2,
  Copy,
  Check,
} from "lucide-react";
import {
  inviteAffiliateAction,
  revokeAffiliateAction,
  updateAffiliateAction,
  cancelAffiliateInviteAction,
  lookupAffiliateEmailAction,
  type EmailLookupResult,
} from "@/actions/affiliates";
import type { SerializedAffiliate } from "@/lib/admin-dashboard-types";
import { ADMIN_PLAN_DROPDOWN_OPTIONS } from "@/lib/admin-assignable-plans";
import {
  DEFAULT_AFFILIATE_INVITE_EXPIRY_DAYS,
  isAffiliateInviteExpired,
} from "@/lib/affiliate-invite-expiry";
import type { TeamPlanId } from "@/lib/team-plans";
import { useRouter } from "next/navigation";

interface AdminAffiliatesPanelProps {
  affiliates: SerializedAffiliate[];
  /** Initial “accept link” window (days); matches server `AFFILIATE_INVITE_EXPIRY_DAYS` default. */
  defaultInviteExpiresInDays: number;
}

type AffiliatePlanValue = "pro" | TeamPlanId;
type StatusFilter = "all" | "pending" | "active" | "revoked";

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toDateInputValue(isoStr: string) {
  return isoStr.split("T")[0];
}

function planLabel(slug: string): string {
  const allOptions = [
    ...ADMIN_PLAN_DROPDOWN_OPTIONS.base,
    ...ADMIN_PLAN_DROPDOWN_OPTIONS.team,
  ];
  return allOptions.find((o) => o.id === slug)?.label ?? slug;
}

const PLAN_OPTIONS = [
  ...ADMIN_PLAN_DROPDOWN_OPTIONS.base.filter((o) => o.id !== "free"),
  ...ADMIN_PLAN_DROPDOWN_OPTIONS.team,
] as const;

// ── Email lookup hook ─────────────────────────────────────────────────────────

function useEmailLookup(email: string) {
  const [result, setResult] = useState<EmailLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setResult(null);
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;

    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await lookupAffiliateEmailAction({ email: trimmed });
        setResult(res);
      } catch {
        setResult(null);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [email]);

  return { result, loading };
}

// ── Accept link copy button ───────────────────────────────────────────────────

function AcceptLinkButton({ token, disabled }: { token: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/affiliate/accept?token=${token}`;

  return (
    <Button
      size="sm"
      variant="outline"
      className="text-xs h-7 px-2"
      disabled={disabled || !token}
      onClick={() => {
        navigator.clipboard.writeText(link).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
      {copied ? "Copied!" : "Copy invite link"}
    </Button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function AdminAffiliatesPanel({
  affiliates,
  defaultInviteExpiresInDays,
}: AdminAffiliatesPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePlan, setInvitePlan] = useState<AffiliatePlanValue>("pro");
  const [inviteEndsAt, setInviteEndsAt] = useState("");
  const [inviteExpiresInDaysStr, setInviteExpiresInDaysStr] = useState(() =>
    String(defaultInviteExpiresInDays),
  );
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Email lookup (inside invite dialog)
  const { result: emailLookup, loading: emailLookupLoading } = useEmailLookup(
    inviteOpen ? inviteEmail : "",
  );

  // Edit dialog
  const [editTarget, setEditTarget] = useState<SerializedAffiliate | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPlan, setEditPlan] = useState<AffiliatePlanValue>("pro");
  const [editEndsAt, setEditEndsAt] = useState("");
  const [editInviteExpiresInDaysStr, setEditInviteExpiresInDaysStr] = useState(() =>
    String(defaultInviteExpiresInDays),
  );
  const [editError, setEditError] = useState<string | null>(null);

  // Revoke confirm dialog
  const [revokeTarget, setRevokeTarget] = useState<SerializedAffiliate | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // Cancel invite confirm dialog
  const [cancelTarget, setCancelTarget] = useState<SerializedAffiliate | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return affiliates.filter((a) => {
      if (q) {
        const nameMatch = a.affiliateName.toLowerCase().includes(q);
        const emailMatch = a.invitedEmail.toLowerCase().includes(q);
        const addedByMatch = a.addedByName.toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !addedByMatch) return false;
      }
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      return true;
    });
  }, [affiliates, search, statusFilter]);

  const activeCount = affiliates.filter((a) => a.status === "active").length;
  const pendingCount = affiliates.filter((a) => a.status === "pending").length;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  // ── Helpers ────────────────────────────────────────────────────────────────

  function resetInviteForm() {
    setInviteName("");
    setInviteEmail("");
    setInvitePlan("pro");
    setInviteEndsAt("");
    setInviteExpiresInDaysStr(String(defaultInviteExpiresInDays));
    setInviteError(null);
  }

  function openEditDialog(a: SerializedAffiliate) {
    setEditTarget(a);
    setEditName(a.affiliateName);
    setEditEmail(a.invitedEmail);
    setEditPlan(a.planAssigned as AffiliatePlanValue);
    setEditEndsAt(toDateInputValue(a.endsAt));
    if (a.status === "pending") {
      const createdMs = new Date(a.createdAt).getTime();
      const expiresMs = new Date(a.inviteExpiresAt).getTime();
      const spanDays = Math.round((expiresMs - createdMs) / (86400 * 1000));
      const clamped = Math.min(365, Math.max(1, Number.isFinite(spanDays) ? spanDays : defaultInviteExpiresInDays));
      setEditInviteExpiresInDaysStr(String(clamped));
    } else {
      setEditInviteExpiresInDaysStr(String(defaultInviteExpiresInDays));
    }
    setEditError(null);
  }

  // ── Action handlers ────────────────────────────────────────────────────────

  function handleInviteSubmit() {
    setInviteError(null);
    if (!inviteName.trim()) { setInviteError("Name is required."); return; }
    if (!inviteEmail.trim()) { setInviteError("Email is required."); return; }
    if (!inviteEndsAt) { setInviteError("End date is required."); return; }
    const days = Math.round(parseInt(inviteExpiresInDaysStr.trim(), 10));
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      setInviteError("Accept link expiry must be between 1 and 365 days.");
      return;
    }
    if (new Date(inviteEndsAt) <= new Date()) {
      setInviteError("End date must be in the future.");
      return;
    }
    startTransition(async () => {
      try {
        await inviteAffiliateAction({
          affiliateName: inviteName.trim(),
          invitedEmail: inviteEmail.trim(),
          planAssigned: invitePlan,
          endsAt: new Date(inviteEndsAt).toISOString(),
          inviteExpiresInDays: days,
        });
        setInviteOpen(false);
        resetInviteForm();
        router.refresh();
      } catch (err) {
        setInviteError(err instanceof Error ? err.message : "Failed to add affiliate.");
      }
    });
  }

  function handleEditSubmit() {
    if (!editTarget) return;
    setEditError(null);
    if (!editName.trim()) { setEditError("Name is required."); return; }
    if (!editEmail.trim()) { setEditError("Email is required."); return; }
    if (!editEndsAt) { setEditError("End date is required."); return; }
    const editDays = Math.round(parseInt(editInviteExpiresInDaysStr.trim(), 10));
    if (
      editTarget.status === "pending" &&
      (!Number.isFinite(editDays) || editDays < 1 || editDays > 365)
    ) {
      setEditError("Accept link expiry must be between 1 and 365 days.");
      return;
    }
    startTransition(async () => {
      try {
        await updateAffiliateAction({
          affiliateId: editTarget.id,
          affiliateName: editName.trim(),
          invitedEmail: editEmail.trim(),
          planAssigned: editPlan,
          endsAt: new Date(editEndsAt).toISOString(),
          ...(editTarget.status === "pending"
            ? { inviteExpiresInDays: editDays }
            : {}),
        });
        setEditTarget(null);
        setExpandedId(null);
        router.refresh();
      } catch (err) {
        setEditError(err instanceof Error ? err.message : "Failed to update affiliate.");
      }
    });
  }

  function handleRevoke() {
    if (!revokeTarget) return;
    setRevokeError(null);
    startTransition(async () => {
      try {
        await revokeAffiliateAction({ affiliateId: revokeTarget.id });
        setRevokeTarget(null);
        setExpandedId(null);
        router.refresh();
      } catch (err) {
        setRevokeError(err instanceof Error ? err.message : "Failed to revoke.");
      }
    });
  }

  function handleCancelInvite() {
    if (!cancelTarget) return;
    setCancelError(null);
    startTransition(async () => {
      try {
        await cancelAffiliateInviteAction({ affiliateId: cancelTarget.id });
        setCancelTarget(null);
        setExpandedId(null);
        router.refresh();
      } catch (err) {
        setCancelError(err instanceof Error ? err.message : "Failed to cancel invite.");
      }
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Card className="rounded-tl-none border-t-0">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                Marketing Affiliates
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {filtered.length} of {affiliates.length} affiliates
                {activeCount > 0 && (
                  <span className="ml-2 text-emerald-500 font-medium">
                    · {activeCount} active
                  </span>
                )}
                {pendingCount > 0 && (
                  <span className="ml-2 text-amber-500 font-medium">
                    · {pendingCount} pending
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Double-click a row to expand actions.
              </p>
            </div>
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => { resetInviteForm(); setInviteOpen(true); }}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Affiliate
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap mt-3">
            <div className="relative w-full sm:w-auto sm:min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by name, email, or admin…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-full"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter((v ?? "all") as StatusFilter)}
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Affiliate</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Ends</TableHead>
                <TableHead>Added By</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    {affiliates.length === 0
                      ? "No affiliates yet. Click \"Invite Affiliate\" to add the first one."
                      : "No affiliates match the current filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((a) => {
                  const isExpired =
                    a.status === "active" && new Date(a.endsAt) < new Date();
                  const inviteLinkExpired =
                    a.status === "pending" && isAffiliateInviteExpired(new Date(a.inviteExpiresAt));
                  const isExpanded = expandedId === a.id;

                  return (
                    <Fragment key={a.id}>
                      {/* ── Main row ── */}
                      <TableRow
                        onDoubleClick={() =>
                          setExpandedId((cur) => (cur === a.id ? null : a.id))
                        }
                        className={[
                          "cursor-pointer select-none",
                          a.status === "revoked" ? "opacity-60" : "",
                          isExpanded ? "bg-accent/30" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <TableCell>
                          <div className="font-medium">{a.affiliateName}</div>
                          <div className="text-xs text-muted-foreground">{a.invitedEmail}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {planLabel(a.planAssigned)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatDate(a.startedAt)}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          <span className={isExpired ? "text-destructive font-medium" : ""}>
                            {formatDate(a.endsAt)}
                          </span>
                          {isExpired && (
                            <span className="ml-1 text-xs text-destructive">(expired)</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {a.addedByName}
                        </TableCell>
                        <TableCell>
                          {a.status === "pending" && (
                            <div>
                              {inviteLinkExpired ? (
                                <Badge variant="outline" className="text-xs border-destructive text-destructive">
                                  Link expired
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs border-amber-500 text-amber-500">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Pending
                                </Badge>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {inviteLinkExpired
                                  ? `Accept link ended ${formatDate(a.inviteExpiresAt)}`
                                  : `Accept by ${formatDate(a.inviteExpiresAt)}`}
                              </p>
                            </div>
                          )}
                          {a.status === "active" && (
                            isExpired ? (
                              <Badge variant="outline" className="text-xs border-destructive text-destructive">
                                Expired
                              </Badge>
                            ) : (
                              <div>
                                <Badge variant="default" className="text-xs bg-emerald-600 hover:bg-emerald-600">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Active
                                </Badge>
                                {a.inviteAcceptedAt && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Accepted {formatDate(a.inviteAcceptedAt)}
                                  </p>
                                )}
                              </div>
                            )
                          )}
                          {a.status === "revoked" && (
                            <div>
                              <Badge variant="destructive" className="text-xs">
                                Revoked
                              </Badge>
                              {(a.revokedAt || a.revokedByName) && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {a.revokedAt ? formatDate(a.revokedAt) : ""}
                                  {a.revokedByName ? ` · ${a.revokedByName}` : ""}
                                </p>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* ── Expanded action row ── */}
                      {isExpanded && (
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={6} className="py-3 px-4">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-xs text-muted-foreground mr-1">
                                Actions for{" "}
                                <span className="font-medium text-foreground">
                                  {a.affiliateName}
                                </span>
                                :
                              </span>

                              {/* Pending: Edit details + copy link + cancel */}
                              {a.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditDialog(a);
                                    }}
                                    disabled={isPending}
                                  >
                                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                    Edit
                                  </Button>
                                  <AcceptLinkButton token={a.token ?? ""} disabled={inviteLinkExpired} />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-destructive border-destructive/40 hover:bg-destructive/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCancelError(null);
                                      setCancelTarget(a);
                                    }}
                                    disabled={isPending}
                                  >
                                    <UserX className="h-3.5 w-3.5 mr-1.5" />
                                    Cancel Invite
                                  </Button>
                                </>
                              )}

                              {/* Active: Edit + Revoke */}
                              {a.status === "active" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditDialog(a);
                                    }}
                                    disabled={isPending}
                                  >
                                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                    Edit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRevokeError(null);
                                      setRevokeTarget(a);
                                    }}
                                    disabled={isPending}
                                  >
                                    <ShieldOff className="h-3.5 w-3.5 mr-1.5" />
                                    Revoke
                                  </Button>
                                </>
                              )}

                              {a.status === "revoked" && (
                                <span className="text-xs text-muted-foreground italic">
                                  No actions available for revoked affiliates.
                                </span>
                              )}

                              <Button
                                size="sm"
                                variant="ghost"
                                className="ml-auto text-xs text-muted-foreground"
                                onClick={() => setExpandedId(null)}
                              >
                                Collapse
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Invite Dialog ── */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(o) => { setInviteOpen(o); if (!o) resetInviteForm(); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite Affiliate
            </DialogTitle>
            <DialogDescription>
              The invitee will receive a link in their app inbox to accept the
              invitation. Their plan activates only after they accept.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Full Name</label>
              <Input
                placeholder="e.g. Jane Smith"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                disabled={isPending}
              />
            </div>

            {/* Email with account preview */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email Address</label>
              <Input
                type="email"
                placeholder="affiliate@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={isPending}
              />
              {/* Account lookup feedback */}
              {inviteEmail.includes("@") && (
                <div className="text-xs rounded-md border px-3 py-2 min-h-[2rem] flex items-center gap-2">
                  {emailLookupLoading ? (
                    <span className="text-muted-foreground">Looking up account…</span>
                  ) : emailLookup === null ? null : emailLookup.found ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>
                        <span className="font-medium text-foreground">{emailLookup.name}</span>
                        {" — "}
                        <span className="text-muted-foreground">
                          Current plan:{" "}
                          <span className="text-foreground font-medium">
                            {emailLookup.currentPlan}
                          </span>
                        </span>
                      </span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span className="text-muted-foreground">
                        No account found — invite will be held until they sign up.
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Plan to Assign</label>
              <Select
                value={invitePlan}
                onValueChange={(v) => { if (v) setInvitePlan(v as AffiliatePlanValue); }}
              >
                <SelectTrigger className="w-full" disabled={isPending}>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-link-expires-days" className="text-sm font-medium">
                Accept link expires in (days)
              </Label>
              <Input
                id="invite-link-expires-days"
                type="number"
                min={1}
                max={365}
                inputMode="numeric"
                value={inviteExpiresInDaysStr}
                onChange={(e) => setInviteExpiresInDaysStr(e.target.value)}
                disabled={isPending}
                className="tabular-nums"
              />
              <p className="text-xs text-muted-foreground">
                How long the invitee can use the email or inbox link to accept (1–365). Default when
                you open this form is {defaultInviteExpiresInDays} (from server settings).
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                Affiliation End Date
              </label>
              <Input
                type="date"
                min={minDate}
                value={inviteEndsAt}
                onChange={(e) => setInviteEndsAt(e.target.value)}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                Plan access expires on this date even if not revoked sooner.
              </p>
            </div>

            {inviteError && (
              <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
                {inviteError}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => { setInviteOpen(false); resetInviteForm(); }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleInviteSubmit} disabled={isPending}>
              {isPending ? "Sending…" : "Send Invite"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) { setEditTarget(null); setEditError(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Affiliate
            </DialogTitle>
            <DialogDescription>
              Update details for{" "}
              <span className="font-semibold text-foreground">{editTarget?.affiliateName ?? ""}</span>.
            </DialogDescription>
          </DialogHeader>

          {editTarget?.status === "pending" &&
            isAffiliateInviteExpired(new Date(editTarget.inviteExpiresAt)) && (
              <Alert className="border-amber-500/40 bg-amber-500/5">
                <Clock className="h-4 w-4 text-amber-500" aria-hidden />
                <AlertTitle>Invite link expired</AlertTitle>
                <AlertDescription>
                  Saving generates a new accept link, emails the invitee via Loops (when configured),
                  and marks the inbox item unread for them so they see the renewed invite.
                </AlertDescription>
              </Alert>
            )}

          {editTarget?.status === "active" &&
            new Date(editTarget.endsAt).getTime() < Date.now() && (
              <Alert className="border-primary/30 bg-primary/5">
                <CalendarClock className="h-4 w-4 text-primary" aria-hidden />
                <AlertTitle>Affiliation period ended</AlertTitle>
                <AlertDescription>
                  Set a new affiliation end date in the future and save. The invitee receives a Loops
                  update (when configured) and their inbox entry is surfaced again as unread.
                </AlertDescription>
              </Alert>
            )}

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Full Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} disabled={isPending} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email Address</label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} disabled={isPending} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Plan Assigned</label>
              <Select value={editPlan} onValueChange={(v) => { if (v) setEditPlan(v as AffiliatePlanValue); }}>
                <SelectTrigger className="w-full" disabled={isPending}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                Affiliation End Date
              </label>
              <Input type="date" value={editEndsAt} onChange={(e) => setEditEndsAt(e.target.value)} disabled={isPending} />
            </div>
            {editTarget?.status === "pending" && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-invite-link-expires-days" className="text-sm font-medium">
                  Accept link expires in (days)
                </Label>
                <Input
                  id="edit-invite-link-expires-days"
                  type="number"
                  min={1}
                  max={365}
                  inputMode="numeric"
                  value={editInviteExpiresInDaysStr}
                  onChange={(e) => setEditInviteExpiresInDaysStr(e.target.value)}
                  disabled={isPending}
                  className="tabular-nums"
                />
                <p className="text-xs text-muted-foreground">
                  On save, the accept-by deadline is set from <span className="font-medium text-foreground">now</span>{" "}
                  using this many days (1–365). Current deadline:{" "}
                  {formatDate(editTarget.inviteExpiresAt)}.
                </p>
              </div>
            )}
            {editError && (
              <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{editError}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setEditTarget(null); setEditError(null); }} disabled={isPending}>Cancel</Button>
            <Button onClick={handleEditSubmit} disabled={isPending}>
              {isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Cancel Invite Dialog ── */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) { setCancelTarget(null); setCancelError(null); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <UserX className="h-5 w-5" />
              Cancel Invite
            </DialogTitle>
            <DialogDescription>
              Cancel the pending invite for{" "}
              <span className="font-semibold text-foreground">{cancelTarget?.affiliateName ?? ""}</span>.
              The invite link will stop working immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1 my-1">
            <div><span className="text-muted-foreground">Email:</span> {cancelTarget?.invitedEmail ?? ""}</div>
            <div><span className="text-muted-foreground">Plan:</span> {cancelTarget ? planLabel(cancelTarget.planAssigned) : ""}</div>
          </div>
          {cancelError && (
            <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{cancelError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setCancelTarget(null); setCancelError(null); }} disabled={isPending}>Keep Invite</Button>
            <Button variant="destructive" onClick={handleCancelInvite} disabled={isPending}>
              {isPending ? "Cancelling…" : "Cancel Invite"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Revoke Dialog ── */}
      <Dialog open={!!revokeTarget} onOpenChange={(o) => { if (!o) { setRevokeTarget(null); setRevokeError(null); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldOff className="h-5 w-5" />
              Revoke Affiliation
            </DialogTitle>
            <DialogDescription>
              This will immediately terminate{" "}
              <span className="font-semibold text-foreground">{revokeTarget?.affiliateName ?? ""}</span>
              &apos;s affiliate status and remove their plan access. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1 my-1">
            <div><span className="text-muted-foreground">Email:</span> {revokeTarget?.invitedEmail ?? ""}</div>
            <div><span className="text-muted-foreground">Plan:</span> {revokeTarget ? planLabel(revokeTarget.planAssigned) : ""}</div>
            <div><span className="text-muted-foreground">Ends:</span> {formatDate(revokeTarget?.endsAt)}</div>
          </div>
          {revokeError && (
            <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{revokeError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setRevokeTarget(null); setRevokeError(null); }} disabled={isPending}>Cancel</Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={isPending}>
              {isPending ? "Revoking…" : "Revoke Affiliation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
