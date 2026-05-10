"use client";

import { useState, useTransition, useMemo, useCallback } from "react";
import { Mail, Megaphone, Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SerializedAffiliate } from "@/lib/admin-dashboard-types";
import {
  broadcastAffiliateCodesAction,
  broadcastAffiliateGeneralPromoAction,
} from "@/actions/affiliate-broadcast";

type Props = {
  affiliates: SerializedAffiliate[];
};

export function AdminAffiliatePromoBroadcast({ affiliates }: Props) {
  const activeAffiliates = useMemo(() => {
    const act = affiliates.filter((a) => a.status === "active");
    return [...act].sort((a, b) =>
      a.affiliateName.localeCompare(b.affiliateName, undefined, { sensitivity: "base" }),
    );
  }, [affiliates]);

  const activeAffiliateCount = activeAffiliates.length;

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [codesRecipientMode, setCodesRecipientMode] = useState<"all_active" | "selected">(
    "all_active",
  );
  const [codesSelectedAffiliateIds, setCodesSelectedAffiliateIds] = useState<number[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [codesError, setCodesError] = useState<string | null>(null);
  const [generalOk, setGeneralOk] = useState<string | null>(null);
  const [codesOk, setCodesOk] = useState<string | null>(null);
  const [isPendingGeneral, runGeneral] = useTransition();
  const [isPendingCodes, runCodes] = useTransition();

  const codesSelectedSet = useMemo(() => new Set(codesSelectedAffiliateIds), [codesSelectedAffiliateIds]);

  const toggleCodesAffiliateId = useCallback((id: number, checked: boolean) => {
    setCodesSelectedAffiliateIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }, []);

  const selectAllCodesRecipients = useCallback(() => {
    setCodesSelectedAffiliateIds(activeAffiliates.map((a) => a.id));
  }, [activeAffiliates]);

  const clearCodesRecipients = useCallback(() => {
    setCodesSelectedAffiliateIds([]);
  }, []);

  function onSendGeneral() {
    setGeneralError(null);
    setGeneralOk(null);
    runGeneral(async () => {
      try {
        const res = await broadcastAffiliateGeneralPromoAction({
          subject: subject.trim(),
          message: message.trim(),
        });
        const skipped = res.sent - res.inboxDelivered;
        const skipNote =
          skipped > 0
            ? ` (${skipped} recipient(s) could not be written — see server logs.)`
            : "";
        setGeneralOk(`Posted to ${res.inboxDelivered} inbox(es).${skipNote}`);
      } catch (e) {
        setGeneralError(e instanceof Error ? e.message : "Send failed.");
      }
    });
  }

  function onSendCodes() {
    setCodesError(null);
    setCodesOk(null);
    runCodes(async () => {
      try {
        const res = await broadcastAffiliateCodesAction({
          subject: subject.trim(),
          message: message.trim(),
          recipientMode: codesRecipientMode,
          selectedAffiliateIds:
            codesRecipientMode === "selected" ? codesSelectedAffiliateIds : undefined,
        });
        const skipped = res.sent - res.inboxDelivered;
        const skipNote =
          skipped > 0
            ? ` (${skipped} affiliate(s) have no linked Flipvise account and were skipped.)`
            : "";
        setCodesOk(`Posted to ${res.inboxDelivered} affiliate inbox(es).${skipNote}`);
      } catch (e) {
        setCodesError(e instanceof Error ? e.message : "Send failed.");
      }
    });
  }

  const formOk = subject.trim().length >= 3 && message.trim().length > 0;
  const canSubmitGeneral = formOk;
  const codesRecipientCount =
    codesRecipientMode === "all_active"
      ? activeAffiliateCount
      : codesSelectedAffiliateIds.length;
  const canSubmitCodes =
    formOk &&
    activeAffiliateCount > 0 &&
    (codesRecipientMode === "all_active" || codesSelectedAffiliateIds.length > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-border/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            General promotion broadcast
          </CardTitle>
          <CardDescription>
            Posts to every registered user&apos;s{" "}
            <span className="font-medium text-foreground">dashboard inbox</span> (all Clerk users; no
            email). Includes the current public Stripe coupon summary from your plans config.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bc-subject-gen">Subject</Label>
            <Input
              id="bc-subject-gen"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Summer launch — share the public promo codes"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bc-msg-gen">Message</Label>
            <Textarea
              id="bc-msg-gen"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Your note — shown as the message body in their inbox."
              className="resize-y min-h-[120px]"
            />
          </div>
          {generalError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {generalError}
            </p>
          )}
          {generalOk && (
            <p className="text-sm text-emerald-500 bg-emerald-500/10 rounded-md px-3 py-2 border border-emerald-500/20">
              {generalOk}
            </p>
          )}
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={!canSubmitGeneral || isPendingGeneral}
            onClick={onSendGeneral}
          >
            <Send className="h-4 w-4 mr-2" />
            {isPendingGeneral ? "Posting…" : "Post to user inboxes"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-violet-400" />
            Affiliate combined-code broadcast
          </CardTitle>
          <CardDescription>
            Sends combined-code details to{' '}
            <span className="font-medium text-foreground">active affiliates</span> you choose (
            {activeAffiliateCount} active row{activeAffiliateCount === 1 ? "" : "s"}). Inbox only — no
            email. Skips recipients with no linked Clerk account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bc-recipients-code">Recipients</Label>
            <Select
              value={codesRecipientMode}
              onValueChange={(v) => setCodesRecipientMode(v as "all_active" | "selected")}
            >
              <SelectTrigger id="bc-recipients-code" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_active">
                  All active affiliates ({activeAffiliateCount})
                </SelectItem>
                <SelectItem value="selected">Selected affiliates only</SelectItem>
              </SelectContent>
            </Select>
            {codesRecipientMode === "selected" ? (
              <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={selectAllCodesRecipients}
                    disabled={activeAffiliateCount === 0}
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={clearCodesRecipients}
                    disabled={codesSelectedAffiliateIds.length === 0}
                  >
                    Clear
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {codesSelectedAffiliateIds.length} selected
                  </span>
                </div>
                {activeAffiliateCount === 0 ? (
                  <p className="text-sm text-muted-foreground">No active affiliates to choose from.</p>
                ) : (
                  <ul
                    className="max-h-48 space-y-2 overflow-y-auto pr-1 text-sm"
                    aria-label="Choose affiliates for this broadcast"
                  >
                    {activeAffiliates.map((a) => {
                      const id = `bc-aff-${a.id}`;
                      return (
                        <li key={a.id} className="flex items-start gap-2">
                          <Checkbox
                            id={id}
                            checked={codesSelectedSet.has(a.id)}
                            onCheckedChange={(c) => toggleCodesAffiliateId(a.id, c === true)}
                            className="mt-0.5"
                          />
                          <Label htmlFor={id} className="cursor-pointer font-normal leading-snug">
                            <span className="font-medium text-foreground">{a.affiliateName}</span>
                            <span className="block text-xs text-muted-foreground">{a.invitedEmail}</span>
                          </Label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                This send targets all {activeAffiliateCount} active affiliate
                {activeAffiliateCount === 1 ? "" : "s"}.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="bc-subject-code">Subject</Label>
            <Input
              id="bc-subject-code"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Your affiliate checkout codes for this month"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bc-msg-code">Message</Label>
            <Textarea
              id="bc-msg-code"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Explain how to share codes — details list per-plan combined examples in their inbox."
              className="resize-y min-h-[120px]"
            />
          </div>
          {codesError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {codesError}
            </p>
          )}
          {codesOk && (
            <p className="text-sm text-emerald-500 bg-emerald-500/10 rounded-md px-3 py-2 border border-emerald-500/20">
              {codesOk}
            </p>
          )}
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto border-violet-500/30"
            disabled={!canSubmitCodes || isPendingCodes}
            onClick={onSendCodes}
          >
            <Send className="h-4 w-4 mr-2" />
            {isPendingCodes
              ? "Posting…"
              : `Post to ${codesRecipientCount} affiliate inbox${codesRecipientCount === 1 ? "" : "es"}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
