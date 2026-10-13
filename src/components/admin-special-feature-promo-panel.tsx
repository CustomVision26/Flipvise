"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Search } from "lucide-react";
import { PromoShareKit } from "@/components/promo-share-kit";
import {
  createSpecialFeaturePromoAction,
  listSpecialFeaturePromosAction,
  setSpecialFeaturePromoActiveAction,
  updateSpecialFeaturePromoAction,
  type SpecialFeaturePromoView,
} from "@/actions/special-feature-promos";
import { STRIPE_PAID_PLAN_IDS } from "@/lib/billing-plan-ids";
import {
  labelForAdminPlanAssignment,
  type AdminPlanAssignment,
} from "@/lib/admin-assignable-plans";

const CHANNELS = [
  { id: "expo", label: "Expo promo" },
  { id: "tv", label: "TV promo" },
  { id: "social", label: "Social media promo" },
] as const;

const CUSTOM_CHANNEL = "__custom__";

function planNamesFor(planIds: string[]): string[] {
  return planIds.map((id) => labelForAdminPlanAssignment(id as AdminPlanAssignment));
}

function shortPlanLabel(planIds: string[]): string {
  const names = planNamesFor(planIds);
  if (names.length === 0) return "—";
  if (names.length === 1) return names[0] ?? "—";
  if (planIds.length >= STRIPE_PAID_PLAN_IDS.length) return "All plans";
  return `${names.length} plans`;
}

function channelLabel(channel: string): string {
  return CHANNELS.find((item) => item.id === channel)?.label ?? channel;
}

function toDateInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatPromoDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function suggestCode(channel: string): string {
  const known =
    channel === "tv" ? "TV" : channel === "social" ? "SOCIAL" : channel === "expo" ? "EXPO" : "";
  const fromName = channel.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase();
  const prefix = known || fromName || "PROMO";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${suffix}`;
}

export function AdminSpecialFeaturePromoPanel() {
  const [promos, setPromos] = useState<SpecialFeaturePromoView[]>([]);
  const [channel, setChannel] = useState("expo");
  const [customChannel, setCustomChannel] = useState("");
  const [label, setLabel] = useState("");
  const [code, setCode] = useState(() => suggestCode("expo"));
  const [percentOff, setPercentOff] = useState("10");
  const [planIds, setPlanIds] = useState<string[]>(["pro"]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void listSpecialFeaturePromosAction()
      .then((rows) => {
        if (!cancelled) setPromos(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load promos.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const savedChannels = useMemo(() => {
    const known = new Set<string>(CHANNELS.map((item) => item.id));
    const extra: string[] = [];
    for (const promo of promos) {
      if (!known.has(promo.channel) && !extra.includes(promo.channel)) extra.push(promo.channel);
    }
    return extra;
  }, [promos]);

  function resolvedChannel(): string {
    if (channel !== CUSTOM_CHANNEL) return channel;
    return customChannel.trim().replace(/\s+/g, " ");
  }

  function togglePlan(id: string, checked: boolean) {
    setPlanIds((current) =>
      checked ? [...new Set([...current, id])] : current.filter((planId) => planId !== id),
    );
  }

  function createPromo() {
    setError(null);
    const channelName = resolvedChannel();
    if (!channelName) {
      setError("Enter a channel name.");
      return;
    }
    startTransition(async () => {
      try {
        const created = await createSpecialFeaturePromoAction({
          channel: channelName,
          label,
          code,
          percentOff: Number(percentOff),
          planIds,
          startsAt: startsAt || undefined,
          endsAt: endsAt || undefined,
        });
        setPromos((current) => [created, ...current]);
        setLabel("");
        setCustomChannel("");
        setChannel(created.channel);
        setCode(suggestCode(created.channel));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create the promo.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Create an expo, TV, social media, or other channel code. Flipvise creates the matching
        Stripe coupon so checkout applies the percent to the plans you select.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Channel</Label>
          <Select
            value={channel}
            onValueChange={(value) => {
              const next = value || "expo";
              setChannel(next);
              if (next !== CUSTOM_CHANNEL) setCode(suggestCode(next));
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
              {savedChannels.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM_CHANNEL}>Add a channel</SelectItem>
            </SelectContent>
          </Select>
          {channel === CUSTOM_CHANNEL ? (
            <Input
              value={customChannel}
              placeholder="e.g. Radio promo"
              maxLength={40}
              onChange={(event) => setCustomChannel(event.target.value)}
              onBlur={(event) => {
                const trimmed = event.target.value.trim();
                if (trimmed) setCode(suggestCode(trimmed));
              }}
            />
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label>Percent off</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={percentOff}
            onChange={(event) => setPercentOff(event.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Label</Label>
          <Input
            value={label}
            placeholder="e.g. Expo booth 2026"
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Promo code</Label>
          <Input
            value={code}
            className="font-mono"
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Start date</Label>
          <Input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>End date</Label>
          <Input type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Plans this code can be used with</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {STRIPE_PAID_PLAN_IDS.map((planId) => (
            <label key={planId} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={planIds.includes(planId)}
                onCheckedChange={(checked) => togglePlan(planId, checked === true)}
              />
              <span>{labelForAdminPlanAssignment(planId as AdminPlanAssignment)}</span>
            </label>
          ))}
        </div>
      </div>
      {error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}
      <Button type="button" onClick={createPromo} disabled={pending || planIds.length === 0}>
        {pending ? "Creating…" : "Create Stripe promo"}
      </Button>
      <div className="space-y-3">
        {promos.map((promo) => (
          <div key={promo.id} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {CHANNELS.find((item) => item.id === promo.channel)?.label ?? promo.channel}
              </Badge>
              <span className="text-sm font-medium">{promo.label}</span>
              <span className="text-sm text-muted-foreground">{promo.percentOff}% off</span>
              <Badge variant={promo.active ? "default" : "outline"}>
                {promo.active ? "Active" : "Inactive"}
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => {
                  startTransition(async () => {
                    await setSpecialFeaturePromoActiveAction({
                      id: promo.id,
                      active: !promo.active,
                    });
                    setPromos((current) =>
                      current.map((row) =>
                        row.id === promo.id ? { ...row, active: !promo.active } : row,
                      ),
                    );
                  });
                }}
              >
                {promo.active ? "Turn off" : "Turn on"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {promo.planIds
                .map((id) => labelForAdminPlanAssignment(id as AdminPlanAssignment))
                .join(", ")}
            </p>
            <PromoShareKit
              code={promo.code}
              caption="Open the link or scan the QR code. Pricing fills this code and highlights the plans it can be used with."
            />
          </div>
        ))}
      </div>
    </div>
  );
}

type PromoEditDraft = {
  id: number;
  code: string;
  channel: string;
  customChannel: string;
  label: string;
  percentOff: string;
  planIds: string[];
  startsAt: string;
  endsAt: string;
};

export function AdminSpecialFeaturePromoRecords() {
  const [promos, setPromos] = useState<SpecialFeaturePromoView[]>([]);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<PromoEditDraft | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void listSpecialFeaturePromosAction()
      .then((rows) => {
        if (!cancelled) setPromos(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load promos.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return promos;
    return promos.filter((promo) => {
      const plans = promo.planIds
        .map((id) => labelForAdminPlanAssignment(id as AdminPlanAssignment))
        .join(" ");
      return [channelLabel(promo.channel), promo.label, promo.code, plans]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [promos, search]);

  function openEdit(promo: SpecialFeaturePromoView) {
    const known = CHANNELS.some((item) => item.id === promo.channel);
    setEdit({
      id: promo.id,
      code: promo.code,
      channel: known ? promo.channel : CUSTOM_CHANNEL,
      customChannel: known ? "" : promo.channel,
      label: promo.label,
      percentOff: String(promo.percentOff),
      planIds: [...promo.planIds],
      startsAt: toDateInput(promo.startsAt),
      endsAt: toDateInput(promo.endsAt),
    });
  }

  function toggleActive(promo: SpecialFeaturePromoView, active: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        await setSpecialFeaturePromoActiveAction({ id: promo.id, active });
        setPromos((current) =>
          current.map((row) => (row.id === promo.id ? { ...row, active } : row)),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update the promo status.");
      }
    });
  }

  function saveEdit() {
    if (!edit) return;
    const channelName =
      edit.channel === CUSTOM_CHANNEL ? edit.customChannel.trim().replace(/\s+/g, " ") : edit.channel;
    if (!channelName) {
      setError("Enter a channel name.");
      return;
    }
    if (edit.planIds.length === 0) {
      setError("Choose at least one plan.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const updated = await updateSpecialFeaturePromoAction({
          id: edit.id,
          channel: channelName,
          label: edit.label,
          percentOff: Number(edit.percentOff),
          planIds: edit.planIds,
          startsAt: edit.startsAt || undefined,
          endsAt: edit.endsAt || undefined,
        });
        setPromos((current) => current.map((row) => (row.id === updated.id ? updated : row)));
        setEdit(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update the promo.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Double-click a row to open the code, link, and QR code.
      </p>
      <div className="relative w-full sm:max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          placeholder="Search by label, code, or plan…"
          className="pl-8"
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border-2 border-border/70">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Percent</TableHead>
              <TableHead>Plans</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  {promos.length === 0
                    ? "No special feature promos yet. Use Invite Affiliate → Special feature promo to create one."
                    : "No promos match the current search."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((promo) => {
                const isExpanded = expandedId === promo.id;
                const planNames = planNamesFor(promo.planIds).join(", ");
                return (
                  <Fragment key={promo.id}>
                    <TableRow
                      onDoubleClick={() =>
                        setExpandedId((current) => (current === promo.id ? null : promo.id))
                      }
                      className={[
                        "cursor-pointer select-none",
                        isExpanded ? "bg-accent/30" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {channelLabel(promo.channel)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{promo.label}</TableCell>
                      <TableCell>
                        <code className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-xs">
                          {promo.code}
                        </code>
                      </TableCell>
                      <TableCell className="tabular-nums">{promo.percentOff}%</TableCell>
                      <TableCell
                        className="max-w-[6.5rem] text-xs text-muted-foreground"
                        title={planNames}
                      >
                        {shortPlanLabel(promo.planIds)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {promo.startsAt || promo.endsAt
                          ? `${formatPromoDate(promo.startsAt)} – ${formatPromoDate(promo.endsAt)}`
                          : "—"}
                      </TableCell>
                      <TableCell onDoubleClick={(event) => event.stopPropagation()}>
                        <label className="flex items-center gap-2 text-xs">
                          <Switch
                            checked={promo.active}
                            disabled={pending}
                            onCheckedChange={(checked) => toggleActive(promo, checked === true)}
                            aria-label={`${promo.active ? "Turn off" : "Turn on"} ${promo.code}`}
                          />
                          {promo.active ? "Active" : "Inactive"}
                        </label>
                      </TableCell>
                    </TableRow>
                    {isExpanded ? (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={7} className="px-4 py-3">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">{planNames}</p>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(promo)}
                            >
                              <Pencil className="size-3.5" />
                              Edit
                            </Button>
                          </div>
                          <PromoShareKit
                            code={promo.code}
                            caption="Open the link or scan the QR code. Pricing fills this code and highlights the plans it can be used with."
                          />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <Dialog open={edit != null} onOpenChange={(open) => { if (!open) setEdit(null); }}>
        <DialogContent className="max-h-[min(90dvh,40rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit promo</DialogTitle>
          </DialogHeader>
          {edit ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Channel</Label>
                <Select
                  value={edit.channel}
                  onValueChange={(value) =>
                    setEdit((current) =>
                      current ? { ...current, channel: value || "expo" } : current,
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                    {edit.channel !== CUSTOM_CHANNEL &&
                    !CHANNELS.some((item) => item.id === edit.channel) ? (
                      <SelectItem value={edit.channel}>{edit.channel}</SelectItem>
                    ) : null}
                    <SelectItem value={CUSTOM_CHANNEL}>Add a channel</SelectItem>
                  </SelectContent>
                </Select>
                {edit.channel === CUSTOM_CHANNEL ? (
                  <Input
                    value={edit.customChannel}
                    placeholder="e.g. Radio promo"
                    maxLength={40}
                    onChange={(event) =>
                      setEdit((current) =>
                        current ? { ...current, customChannel: event.target.value } : current,
                      )
                    }
                  />
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label>Percent off</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={edit.percentOff}
                  onChange={(event) =>
                    setEdit((current) =>
                      current ? { ...current, percentOff: event.target.value } : current,
                    )
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Label</Label>
                <Input
                  value={edit.label}
                  onChange={(event) =>
                    setEdit((current) =>
                      current ? { ...current, label: event.target.value } : current,
                    )
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Promo code</Label>
                <Input value={edit.code} readOnly className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={edit.startsAt}
                  onChange={(event) =>
                    setEdit((current) =>
                      current ? { ...current, startsAt: event.target.value } : current,
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>End date</Label>
                <Input
                  type="date"
                  value={edit.endsAt}
                  onChange={(event) =>
                    setEdit((current) =>
                      current ? { ...current, endsAt: event.target.value } : current,
                    )
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Plans this code can be used with</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {STRIPE_PAID_PLAN_IDS.map((planId) => (
                    <label key={planId} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={edit.planIds.includes(planId)}
                        onCheckedChange={(checked) =>
                          setEdit((current) => {
                            if (!current) return current;
                            const planIds =
                              checked === true
                                ? [...new Set([...current.planIds, planId])]
                                : current.planIds.filter((id) => id !== planId);
                            return { ...current, planIds };
                          })
                        }
                      />
                      <span>{labelForAdminPlanAssignment(planId as AdminPlanAssignment)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEdit(null)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" onClick={saveEdit} disabled={pending || !edit?.planIds.length}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
