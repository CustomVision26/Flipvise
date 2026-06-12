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
  AlertCircle,
  Target,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminAffiliateQuotaPanel } from "@/components/admin-affiliate-quota-panel";
import {
  inviteAffiliateAction,
  revokeAffiliateAction,
  updateAffiliateAction,
  cancelAffiliateInviteAction,
  lookupAffiliateEmailAction,
  type EmailLookupResult,
} from "@/actions/affiliates";
import type { SerializedAffiliate } from "@/lib/admin-dashboard-types";
import {
  ADMIN_PLAN_DROPDOWN_OPTIONS,
  type AffiliatePlanValue,
} from "@/lib/admin-assignable-plans";
import {
  DEFAULT_AFFILIATE_INVITE_EXPIRY_DAYS,
  isAffiliateInviteExpired,
} from "@/lib/affiliate-invite-expiry";
import { resolveAffiliateInviteEmailConflict } from "@/lib/affiliate-invite-email-conflict";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { adminSectionCardClass } from "@/components/admin-panel-styles";

interface AdminAffiliatesPanelProps {
  affiliates: SerializedAffiliate[];
  /** Initial “accept link” window (days); matches server `AFFILIATE_INVITE_EXPIRY_DAYS` default. */
  defaultInviteExpiresInDays: number;
}

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
  /** Stable “now” for period-ended banners (avoid Date.now during render purity lint). */
  const [panelsNowMs] = useState(() => Date.now());

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
  /** Tracks last Clerk-driven autofill so we can strip stale names when the email changes. */
  const inviteAutofillFingerprintRef = useRef<{ email: string; name: string } | null>(null);

  // Email lookup (inside invite dialog)
  const { result: emailLookup, loading: emailLookupLoading } = useEmailLookup(
    inviteOpen ? inviteEmail : "",
  );

  const normalizedInviteEmail = inviteEmail.trim().toLowerCase();
  const affiliateRowsMatchingInviteEmail = useMemo(() => {
    if (!normalizedInviteEmail) return [];
    return affiliates.filter(
      (a) => a.invitedEmail.trim().toLowerCase() === normalizedInviteEmail,
    );
  }, [affiliates, normalizedInviteEmail]);

  const inviteEmailConflict = useMemo(
    () => resolveAffiliateInviteEmailConflict(affiliateRowsMatchingInviteEmail),
    [affiliateRowsMatchingInviteEmail],
  );

  useEffect(() => {
    if (!inviteOpen || emailLookupLoading) return;
    const e = inviteEmail.trim().toLowerCase();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    if (!valid) return;

    if (emailLookup?.found) {
      const name = emailLookup.name.trim();
      const isUselessDisplayName =
        name.length === 0 ||
        name.toLowerCase() === e ||
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(name);

      if (isUselessDisplayName) {
        if (inviteAutofillFingerprintRef.current?.email === e) {
          inviteAutofillFingerprintRef.current = null;
        }
        return;
      }

      const fp = inviteAutofillFingerprintRef.current;
      if (!fp || fp.email !== e || fp.name !== name) {
        inviteAutofillFingerprintRef.current = { email: e, name };
        setInviteName(name);
      }
      return;
    }

    if (emailLookup && emailLookup.found === false) {
      const fp = inviteAutofillFingerprintRef.current;
      inviteAutofillFingerprintRef.current = null;
      if (fp && fp.email !== e) {
        setInviteName((prev) => (prev === fp.name ? "" : prev));
      }
    }
  }, [inviteOpen, inviteEmail, emailLookupLoading, emailLookup]);

  // Edit dialog
  const [editTarget, setEditTarget] = useState<SerializedAffiliate | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPlan, setEditPlan] = useState<AffiliatePlanValue>("pro");
  const [editEndsAt, setEditEndsAt] = useState("");
  const [editInviteExpiresInDaysStr, setEditInviteExpiresInDaysStr] = useState(() =>
    String(defaultInviteExpiresInDays),
  );
  const [editError, setEditError] = useState<string | null>(null);

  /** Pending edit: capture "accept link expires in (days)" at open → server rotates token only when this value (or plan/date/email) changed. */
  const pendingInviteExpiryDaysBaselineRef = useRef<number | null>(null);

  /** Edit dialog: Clerk autofill fingerprint (same semantics as invite). */
  const editAutofillFingerprintRef = useRef<{ email: string; name: string } | null>(null);
  const { result: editEmailLookup, loading: editEmailLookupLoading } = useEmailLookup(
    editOpen && editTarget?.status === "pending" ? editEmail : "",
  );

  useEffect(() => {
    if (!editOpen || editTarget?.status !== "pending" || editEmailLookupLoading) return;
    const e = editEmail.trim().toLowerCase();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    if (!valid) return;

    if (editEmailLookup?.found) {
      const name = editEmailLookup.name.trim();
      const isUselessDisplayName =
        name.length === 0 ||
        name.toLowerCase() === e ||
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(name);

      if (isUselessDisplayName) {
        if (editAutofillFingerprintRef.current?.email === e) {
          editAutofillFingerprintRef.current = null;
        }
        return;
      }

      const fp = editAutofillFingerprintRef.current;
      if (!fp || fp.email !== e || fp.name !== name) {
        editAutofillFingerprintRef.current = { email: e, name };
        setEditName(name);
      }
      return;
    }

    if (editEmailLookup && editEmailLookup.found === false) {
      const fp = editAutofillFingerprintRef.current;
      editAutofillFingerprintRef.current = null;
      if (fp && fp.email !== e) {
        setEditName((prev) => (prev === fp.name ? "" : prev));
      }
    }
  }, [editOpen, editTarget?.status, editEmail, editEmailLookupLoading, editEmailLookup]);

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
    inviteAutofillFingerprintRef.current = null;
  }

  function openEditDialog(a: SerializedAffiliate) {
    editAutofillFingerprintRef.current = null;
    setEditTarget(a);
    setEditName(a.affiliateName);
    setEditEmail(a.invitedEmail);
    const stagedPlan =
      a.status === "active" && a.pendingPlanAssigned
        ? (a.pendingPlanAssigned as AffiliatePlanValue)
        : (a.planAssigned as AffiliatePlanValue);
    const stagedEndsIso =
      a.status === "active" && a.pendingEndsAt ? a.pendingEndsAt : a.endsAt;
    setEditPlan(stagedPlan);
    setEditEndsAt(toDateInputValue(stagedEndsIso));
    if (a.status === "pending") {
      const createdMs = new Date(a.createdAt).getTime();
      const expiresMs = new Date(a.inviteExpiresAt).getTime();
      const spanDays = Math.round((expiresMs - createdMs) / (86400 * 1000));
      const clamped = Math.min(365, Math.max(1, Number.isFinite(spanDays) ? spanDays : defaultInviteExpiresInDays));
      setEditInviteExpiresInDaysStr(String(clamped));
      pendingInviteExpiryDaysBaselineRef.current = clamped;
    } else {
      setEditInviteExpiresInDaysStr(String(defaultInviteExpiresInDays));
      pendingInviteExpiryDaysBaselineRef.current = null;
    }
    setEditError(null);
    setEditOpen(true);
  }

  // ── Action handlers ────────────────────────────────────────────────────────

  function handleInviteSubmit() {
    setInviteError(null);
    if (inviteEmailConflict) {
      setInviteError(`${inviteEmailConflict.title} ${inviteEmailConflict.detail}`);
      return;
    }
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
        router.refresh();
      } catch (err) {
        setInviteError(err instanceof Error ? err.message : "Failed to add affiliate.");
      }
    });
  }

  function handleEditSubmit() {
    if (!editTarget) return;
    setEditError(null);
    const affiliateNameSubmit =
      editTarget.status === "active" ? editTarget.affiliateName.trim() : editName.trim();
    const invitedEmailSubmit =
      editTarget.status === "active" ? editTarget.invitedEmail.trim() : editEmail.trim();
    if (!affiliateNameSubmit) { setEditError("Name is required."); return; }
    if (!invitedEmailSubmit) { setEditError("Email is required."); return; }
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
          affiliateName: affiliateNameSubmit,
          invitedEmail: invitedEmailSubmit,
          planAssigned: editPlan,
          endsAt: new Date(editEndsAt).toISOString(),
          ...(editTarget.status === "pending"
            ? {
                inviteExpiresInDays: editDays,
                ...(pendingInviteExpiryDaysBaselineRef.current != null
                  ? { previousInviteExpiresInDays: pendingInviteExpiryDaysBaselineRef.current }
                  : {}),
              }
            : {}),
        });
        setEditOpen(false);
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

  const affiliateDialogContentClass =
    "flex max-h-[min(92dvh,44rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:w-full sm:max-w-md";
  const affiliateDialogHeaderClass =
    "shrink-0 min-w-0 space-y-2 px-3 pt-4 pr-10 sm:px-4 sm:pr-12";
  const affiliateDialogBodyClass =
    "min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 sm:px-4";
  const affiliateDialogFooterClass =
    "shrink-0 flex flex-col-reverse gap-2 border-t border-border px-3 py-3 sm:flex-row sm:justify-end sm:px-4 sm:py-4";
  const affiliateDialogFieldClass = "w-full min-w-0 max-w-full";

  const quotaEnabledCount = useMemo(
    () =>
      affiliates.filter((a) => a.status === "active" && a.referralQuotaEnabled)
        .length,
    [affiliates],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Card className={adminSectionCardClass}>
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
        </CardHeader>

        <CardContent className="p-4 pt-0">
          <Tabs defaultValue="directory" className="w-full gap-4">
            <TabsList
              variant="line"
              className="h-auto w-full flex-wrap justify-start gap-1 p-1 sm:w-fit"
            >
              <TabsTrigger value="directory" className="gap-1.5">
                <Megaphone className="h-4 w-4 shrink-0" />
                Affiliate directory
              </TabsTrigger>
              <TabsTrigger value="quotas" className="gap-1.5">
                <Target className="h-4 w-4 shrink-0" />
                Referral quotas
                {quotaEnabledCount > 0 ? (
                  <Badge className="text-[0.6875rem] tabular-nums" variant="secondary">
                    {quotaEnabledCount}
                  </Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="directory" className="mt-0 space-y-3">
              <p className="text-xs text-muted-foreground">
                Double-click a row to expand actions.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
                  onValueChange={(v) =>
                    setStatusFilter((v ?? "all") as StatusFilter)
                  }
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

              <div className="overflow-x-auto rounded-lg border-2 border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Affiliate</TableHead>
                <TableHead>Promo ID</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right tabular-nums">Referrals (mo)</TableHead>
                <TableHead className="text-right tabular-nums">Referrals (total)</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Ends</TableHead>
                <TableHead>Added By</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
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
                  const hasPendingArrangement =
                    a.status === "active" &&
                    Boolean(
                      a.pendingPlanAssigned &&
                        a.pendingEndsAt &&
                        a.arrangementChangeExpiresAt,
                    );

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
                          <code className="text-xs font-mono bg-muted/60 px-1.5 py-0.5 rounded">
                            {a.promotionalCode}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {planLabel(a.planAssigned)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {a.status === "active" ? a.paidReferralsMonth : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {a.paidReferralsTotal}
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
                                {hasPendingArrangement && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs ml-1 border-amber-500/50 text-amber-600"
                                  >
                                    Awaiting confirmation
                                  </Badge>
                                )}
                                {a.inviteAcceptedAt && !hasPendingArrangement && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Accepted {formatDate(a.inviteAcceptedAt)}
                                  </p>
                                )}
                                {hasPendingArrangement && a.arrangementChangeExpiresAt && (
                                  <p className="text-xs text-amber-600/90 mt-1">
                                    Proposed change — confirm by{" "}
                                    {formatDate(a.arrangementChangeExpiresAt)}
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
                          <TableCell colSpan={9} className="py-3 px-4">
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
              </div>
            </TabsContent>

            <TabsContent value="quotas" className="mt-0">
              <AdminAffiliateQuotaPanel affiliates={affiliates} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ── Invite Dialog ── */}
      <Dialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onOpenChangeComplete={(open) => {
          if (!open) resetInviteForm();
        }}
      >
        <DialogContent className={affiliateDialogContentClass}>
          <DialogHeader className={affiliateDialogHeaderClass}>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 shrink-0" />
              Invite Affiliate
            </DialogTitle>
            <DialogDescription className="text-pretty break-words">
              The affiliate plan activates only after the invitee accepts. If they already have a
              Flipvise account (email matches Clerk), only their app inbox receives the invite — no outgoing
              email. If no account exists yet, Loops sends an invitation email to their address (when configured).
              They accept from inbox or via the emailed link once they join.
            </DialogDescription>
          </DialogHeader>

          <div className={affiliateDialogBodyClass}>
          <div className="min-w-0 space-y-4 pb-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Full Name</label>
              <Input
                placeholder="e.g. Jane Smith"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                disabled={isPending}
                className={affiliateDialogFieldClass}
              />
              <p className="text-xs text-pretty break-words text-muted-foreground">
                If the email belongs to an existing Flipvise account, the name is filled from their profile automatically.
              </p>
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
                className={affiliateDialogFieldClass}
              />
              {/* Account lookup feedback */}
              {inviteEmail.includes("@") && (
                <div className="flex min-h-[2rem] min-w-0 items-start gap-2 rounded-md border px-3 py-2 text-xs break-words">
                  {emailLookupLoading ? (
                    <span className="text-muted-foreground">Looking up account…</span>
                  ) : emailLookup === null ? null : emailLookup.found ? (
                    <>
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span className="min-w-0 flex-1 text-pretty">
                        <span className="font-medium text-foreground">
                          {emailLookup.name.trim() || "Registered account"}
                        </span>
                        {" — "}
                        <span className="text-muted-foreground">
                          Current plan:{" "}
                          <span className="text-foreground font-medium">{emailLookup.currentPlan}</span>
                          .
                          Invitation is delivered in their{" "}
                          <span className="font-medium text-foreground">dashboard inbox only</span> —
                          affiliate plan activates when they accept there.
                        </span>
                      </span>
                    </>
                  ) : (
                    <>
                      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span className="min-w-0 flex-1 text-pretty text-muted-foreground">
                        No Flipvise account on this email — <span className="font-medium text-foreground">Send Invite</span>{" "}
                        triggers a Loops invitation email when configured; they choose the affiliate grant only after accepting.
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {inviteEmailConflict && (
              <Alert variant={inviteEmailConflict.variant} className="min-w-0">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                <AlertTitle>{inviteEmailConflict.title}</AlertTitle>
                <AlertDescription className="space-y-2 text-pretty break-words">
                  <p>{inviteEmailConflict.detail}</p>
                  {inviteEmailConflict.affiliateId != null && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-1"
                      disabled={isPending}
                      onClick={() => {
                        const id = inviteEmailConflict.affiliateId;
                        const q = inviteEmail.trim();
                        setInviteOpen(false);
                        setSearch(q);
                        setExpandedId(id);
                      }}
                    >
                      Show in table
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Plan to Assign</label>
              <Select
                modal={false}
                value={invitePlan}
                onValueChange={(v) => { if (v) setInvitePlan(v as AffiliatePlanValue); }}
              >
                <SelectTrigger className={affiliateDialogFieldClass} disabled={isPending}>
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
                className={cn(affiliateDialogFieldClass, "tabular-nums")}
              />
              <p className="text-xs text-pretty break-words text-muted-foreground">
                How long the invitee can use the email or inbox link to accept (1–365). Default when
                you open this form is {defaultInviteExpiresInDays} (from server settings).
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium">
                <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
                Affiliation End Date
              </label>
              <Input
                type="date"
                min={minDate}
                value={inviteEndsAt}
                onChange={(e) => setInviteEndsAt(e.target.value)}
                disabled={isPending}
                className={affiliateDialogFieldClass}
              />
              <p className="text-xs text-pretty break-words text-muted-foreground">
                Plan access expires on this date even if not revoked sooner.
              </p>
            </div>

            {inviteError && (
              <p className="text-pretty break-words rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {inviteError}
              </p>
            )}
          </div>
          </div>

          <div className={affiliateDialogFooterClass}>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setInviteOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={handleInviteSubmit}
              disabled={isPending || !!inviteEmailConflict}
            >
              {isPending ? "Sending…" : "Send Invite"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onOpenChangeComplete={(open) => {
          if (!open) {
            setEditTarget(null);
            setEditError(null);
            editAutofillFingerprintRef.current = null;
            pendingInviteExpiryDaysBaselineRef.current = null;
          }
        }}
      >
        <DialogContent className={affiliateDialogContentClass}>
          <DialogHeader className={affiliateDialogHeaderClass}>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 shrink-0" />
              Edit Affiliate
            </DialogTitle>
            <DialogDescription className="text-pretty break-words">
              Update details for{" "}
              <span className="font-semibold text-foreground">{editTarget?.affiliateName ?? ""}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className={affiliateDialogBodyClass}>
          {editTarget?.status === "pending" && (
              <Alert className="mb-4 border-border bg-muted/30">
                <Megaphone className="h-4 w-4 text-muted-foreground" aria-hidden />
                <AlertTitle>Pending invitation</AlertTitle>
                <AlertDescription>
                  You may assign a different plan, change affiliation end date, invite email, or accept-link duration.
                  <span className="font-medium text-foreground"> Saving </span>
                  rotates the acceptance token (prior links stop working). Invitees{" "}
                  <span className="font-medium text-foreground">without</span> a Flipvise (Clerk) account receive a Loops invitation
                  when configured; <span className="font-medium text-foreground">with</span> an account receive{" "}
                  <span className="font-medium text-foreground">dashboard inbox only</span>. Plan access still starts only after accept.
                  If they accept before your save completes, Save shows an error and does not send a duplicate email or overwrite active state.
                </AlertDescription>
              </Alert>
            )}

          {editTarget?.status === "pending" &&
            isAffiliateInviteExpired(new Date(editTarget.inviteExpiresAt)) && (
              <Alert className="mb-4 border-amber-500/40 bg-amber-500/5">
                <Clock className="h-4 w-4 text-amber-500" aria-hidden />
                <AlertTitle>Invite link expired</AlertTitle>
                <AlertDescription>
                  Saving issues a replacement accept link and a fresh deadline counted from now. Invitees without a Clerk
                  account get a renewed Loops message when configured; registered invitees are notified via inbox only.
                </AlertDescription>
              </Alert>
            )}

          {editTarget?.status === "active" &&
            new Date(editTarget.endsAt).getTime() < panelsNowMs && (
              <Alert className="mb-4 border-primary/30 bg-primary/5">
                <CalendarClock className="h-4 w-4 text-primary" aria-hidden />
                <AlertTitle>Affiliation period ended</AlertTitle>
                <AlertDescription>
                  Set a new affiliation end date in the future and save. The invitee gets an in-app inbox
                  confirmation request; their plan updates only after they accept.
                </AlertDescription>
              </Alert>
            )}

          {editTarget?.status === "active" &&
            editTarget.pendingPlanAssigned &&
            editTarget.pendingEndsAt &&
            editTarget.arrangementChangeExpiresAt && (
              <Alert className="mb-4 border-amber-500/40 bg-amber-500/5">
                <AlertCircle className="h-4 w-4 text-amber-500" aria-hidden />
                <AlertTitle>Confirmation pending</AlertTitle>
                <AlertDescription>
                  The affiliate has not yet confirmed the proposed plan/end date. Saving again replaces
                  that request and marks their inbox item unread. Clearing the proposal: set plan and end
                  date back to the current live values and save.
                </AlertDescription>
              </Alert>
            )}

          <div className="min-w-0 space-y-4 pb-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Full Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={isPending || editTarget?.status === "active"}
                readOnly={editTarget?.status === "active"}
                aria-readonly={editTarget?.status === "active" || undefined}
                className={affiliateDialogFieldClass}
              />
              {editTarget?.status === "active" && (
                <p className="text-xs text-muted-foreground">
                  Name and email are fixed for accepted affiliates. Invite a new contact to use a different email.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Email Address</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                disabled={isPending || editTarget?.status === "active"}
                readOnly={editTarget?.status === "active"}
                aria-readonly={editTarget?.status === "active" || undefined}
                className={affiliateDialogFieldClass}
              />
              {editTarget?.status === "pending" && editEmail.includes("@") && (
                <div className="flex min-h-[2rem] min-w-0 items-start gap-2 rounded-md border px-3 py-2 text-xs break-words">
                  {editEmailLookupLoading ? (
                    <span className="text-muted-foreground">Looking up account…</span>
                  ) : editEmailLookup === null ? null : editEmailLookup.found ? (
                    <>
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span className="min-w-0 flex-1 text-pretty">
                        <span className="font-medium text-foreground">
                          {editEmailLookup.name.trim() || "Registered account"}
                        </span>
                        {" — "}
                        <span className="text-muted-foreground">
                          Current plan:{" "}
                          <span className="text-foreground font-medium">{editEmailLookup.currentPlan}</span>
                        </span>
                      </span>
                    </>
                  ) : (
                    <>
                      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span className="min-w-0 flex-1 text-pretty text-muted-foreground">
                        No Clerk account on this email — name is manual only.
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Plan Assigned</label>
              <Select modal={false} value={editPlan} onValueChange={(v) => { if (v) setEditPlan(v as AffiliatePlanValue); }}>
                <SelectTrigger className={affiliateDialogFieldClass} disabled={isPending}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editTarget?.status === "active" && (
                <p className="text-xs text-pretty break-words text-muted-foreground">
                  Changing plan or end date adds an in-app inbox confirmation for the affiliate. Nothing changes
                  on their account until they accept.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                Affiliation End Date
              </label>
              <Input
                type="date"
                value={editEndsAt}
                onChange={(e) => setEditEndsAt(e.target.value)}
                disabled={isPending}
                className={affiliateDialogFieldClass}
              />
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
                  className={cn(affiliateDialogFieldClass, "tabular-nums")}
                />
                <p className="text-xs text-pretty break-words text-muted-foreground">
                  On save, the accept-by deadline is set from <span className="font-medium text-foreground">now</span>{" "}
                  using this many days (1–365). Current deadline:{" "}
                  {formatDate(editTarget.inviteExpiresAt)}.
                </p>
              </div>
            )}
            {editError && (
              <p className="text-pretty break-words rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {editError}
              </p>
            )}
          </div>
          </div>

          <div className={affiliateDialogFooterClass}>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setEditOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleEditSubmit} disabled={isPending}>
              {isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Cancel Invite Dialog ── */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) { setCancelTarget(null); setCancelError(null); } }}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto sm:w-full sm:max-w-sm">
          <DialogHeader className="min-w-0 pr-10">
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
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto sm:w-full sm:max-w-sm">
          <DialogHeader className="min-w-0 pr-10">
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
