"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  adminArchiveContactUsMessageAction,
  adminMarkContactUsMessageReadAction,
  updatePlatformContactSettingsAction,
} from "@/actions/contact-us";
import { AdminContactUsThreadPanel } from "@/components/admin-contact-us-thread-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  adminFilterInputClass,
  adminSectionTitleClass,
  adminSupportEmptyStateClass,
  adminSupportFilterBarClass,
  adminSupportKpiCardClass,
  adminSupportKpiGridClass,
  adminSupportSectionLabelClass,
  adminSupportShellClass,
  adminSupportTableCardClass,
} from "@/components/admin-panel-styles";
import type {
  ContactUsStats,
  SerializedContactMessage,
  SerializedContactSettings,
} from "@/lib/contact-us-admin-dto";
import type { ContactSocialLink } from "@/db/queries/contact-us";
import { cn } from "@/lib/utils";

const SOCIAL_PLATFORMS = [
  "Twitter / X",
  "Facebook",
  "LinkedIn",
  "Instagram",
  "YouTube",
  "TikTok",
  "GitHub",
  "Discord",
  "Other",
] as const;

const STATUS_LABELS: Record<SerializedContactMessage["status"], string> = {
  open: "Open",
  read: "Read",
  archived: "Archived",
};

interface AdminContactUsPanelProps {
  settings: SerializedContactSettings;
  messages: SerializedContactMessage[];
  stats: ContactUsStats;
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function emptySocialLink(): ContactSocialLink {
  return { platform: "Other", label: "", url: "" };
}

export function AdminContactUsPanel({
  settings,
  messages,
  stats,
}: AdminContactUsPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SerializedContactMessage["status"]>("all");
  const [selectedMessage, setSelectedMessage] = useState<SerializedContactMessage | null>(null);

  const [email, setEmail] = useState(settings.email);
  const [phone, setPhone] = useState(settings.phone ?? "");
  const [socialLinks, setSocialLinks] = useState<ContactSocialLink[]>(
    settings.socialLinks.length > 0 ? settings.socialLinks : [],
  );
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    const messageId = Number(searchParams.get("message"));
    if (!Number.isFinite(messageId) || messageId <= 0) return;
    const match = messages.find((m) => m.id === messageId);
    if (match) setSelectedMessage(match);
  }, [searchParams, messages]);

  const filteredMessages = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.subject.toLowerCase().includes(q) ||
        m.message.toLowerCase().includes(q)
      );
    });
  }, [messages, search, statusFilter]);

  const handleSelectMessage = useCallback(
    (message: SerializedContactMessage) => {
      setSelectedMessage(message);
      router.replace(`/admin/support-center/contact-us?message=${message.id}`);
      if (message.status === "open") {
        startTransition(async () => {
          await adminMarkContactUsMessageReadAction({ messageId: message.id });
          router.refresh();
        });
      }
    },
    [router],
  );

  const handleCloseSheet = useCallback(
    (open: boolean) => {
      if (!open) {
        setSelectedMessage(null);
        router.replace("/admin/support-center/contact-us");
      }
    },
    [router],
  );

  function handleSaveSettings() {
    startTransition(async () => {
      setSettingsSaved(false);
      await updatePlatformContactSettingsAction({
        email: email.trim(),
        phone: phone.trim() || null,
        socialLinks: socialLinks.filter((l) => l.label.trim() && l.url.trim()),
      });
      setSettingsSaved(true);
      router.refresh();
    });
  }

  function handleArchive(messageId: number) {
    startTransition(async () => {
      await adminArchiveContactUsMessageAction({ messageId });
      setSelectedMessage(null);
      router.replace("/admin/support-center/contact-us");
      router.refresh();
    });
  }

  return (
    <div className={adminSupportShellClass}>
      <div className="space-y-1">
        <h2 className={adminSectionTitleClass}>Contact Us</h2>
        <p className="text-sm text-muted-foreground">
          Manage public contact details and review messages sent from the Contact Us page.
        </p>
      </div>

      <div className="space-y-2">
        <p className={adminSupportSectionLabelClass}>Message metrics</p>
        <div className={adminSupportKpiGridClass}>
          <Card className={adminSupportKpiCardClass}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-xs text-muted-foreground">Total messages</p>
                <p className="text-2xl font-semibold tabular-nums">{stats.total}</p>
              </div>
              <MessageSquare className="size-5 text-muted-foreground" aria-hidden />
            </CardContent>
          </Card>
          <Card className={adminSupportKpiCardClass}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-xs text-muted-foreground">Open</p>
                <p className="text-2xl font-semibold tabular-nums text-sky-400">{stats.openCount}</p>
              </div>
              <Clock className="size-5 text-sky-400" aria-hidden />
            </CardContent>
          </Card>
          <Card className={adminSupportKpiCardClass}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-xs text-muted-foreground">Read</p>
                <p className="text-2xl font-semibold tabular-nums text-emerald-400">{stats.readCount}</p>
              </div>
              <CheckCircle2 className="size-5 text-emerald-400" aria-hidden />
            </CardContent>
          </Card>
          <Card className={adminSupportKpiCardClass}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-xs text-muted-foreground">This week</p>
                <p className="text-2xl font-semibold tabular-nums">{stats.thisWeekCount}</p>
              </div>
              <Mail className="size-5 text-muted-foreground" aria-hidden />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className={adminSupportTableCardClass}>
        <CardHeader className="gap-1 border-b border-border/40 pb-4">
          <CardTitle className="text-base">Public contact details</CardTitle>
          <CardDescription>
            Email, phone, and social links shown on the user Contact Us page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact-email">Support email</Label>
              <Input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={adminFilterInputClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Phone number</Label>
              <Input
                id="contact-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className={adminFilterInputClass}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Social media links</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setSocialLinks((prev) => [...prev, emptySocialLink()])}
              >
                <Plus className="size-3.5" aria-hidden />
                Add link
              </Button>
            </div>
            {socialLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No social links yet. Add links to display them on the Contact Us page.
              </p>
            ) : (
              <div className="space-y-3">
                {socialLinks.map((link, index) => (
                  <div
                    key={`social-${index}`}
                    className="grid gap-3 rounded-xl border border-border/50 bg-muted/10 p-3 sm:grid-cols-[160px_1fr_1fr_auto]"
                  >
                    <Select
                      value={link.platform}
                      onValueChange={(v) => {
                        const platform = v ?? "Other";
                        setSocialLinks((prev) =>
                          prev.map((row, i) =>
                            i === index ? { ...row, platform } : row,
                          ),
                        );
                      }}
                    >
                      <SelectTrigger className={adminFilterInputClass}>
                        <SelectValue placeholder="Platform" />
                      </SelectTrigger>
                      <SelectContent>
                        {SOCIAL_PLATFORMS.map((platform) => (
                          <SelectItem key={platform} value={platform}>
                            {platform}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={link.label}
                      onChange={(e) =>
                        setSocialLinks((prev) =>
                          prev.map((row, i) =>
                            i === index ? { ...row, label: e.target.value } : row,
                          ),
                        )
                      }
                      placeholder="Display label"
                      className={adminFilterInputClass}
                    />
                    <Input
                      value={link.url}
                      onChange={(e) =>
                        setSocialLinks((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, url: e.target.value } : row)),
                        )
                      }
                      placeholder="https://"
                      className={adminFilterInputClass}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove link"
                      onClick={() =>
                        setSocialLinks((prev) => prev.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={handleSaveSettings} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Save contact details
            </Button>
            {settingsSaved ? (
              <span className="text-sm text-emerald-400">Contact details saved.</span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <p className={adminSupportSectionLabelClass}>Inbox</p>
        <Card className={adminSupportTableCardClass}>
          <CardContent className="space-y-4 pt-5">
            <div className={adminSupportFilterBarClass}>
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search messages…"
                  className={cn(adminFilterInputClass, "pl-9")}
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) =>
                  setStatusFilter(v as "all" | SerializedContactMessage["status"])
                }
              >
                <SelectTrigger className={cn(adminFilterInputClass, "w-full sm:w-40")}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredMessages.length === 0 ? (
              <div className={adminSupportEmptyStateClass}>
                <MessageSquare className="mb-2 size-8 opacity-40" aria-hidden />
                <p>No contact messages match your filters.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>From</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMessages.map((message) => (
                    <TableRow
                      key={message.id}
                      className="cursor-pointer"
                      onClick={() => handleSelectMessage(message)}
                    >
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-medium">{message.name}</p>
                          <p className="text-xs text-muted-foreground">{message.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate">{message.subject}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs capitalize",
                            message.status === "open" && "border-sky-500/40 text-sky-400",
                            message.status === "read" && "border-emerald-500/40 text-emerald-400",
                          )}
                        >
                          {STATUS_LABELS[message.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(message.createdAt)}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={selectedMessage != null} onOpenChange={handleCloseSheet}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-xl">
          {selectedMessage ? (
            <>
              <SheetHeader className="shrink-0 border-b border-border/40 pb-4">
                <SheetTitle>{selectedMessage.subject}</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  Conversation with {selectedMessage.name} · {selectedMessage.email}
                </p>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden py-4">
                <AdminContactUsThreadPanel messageId={selectedMessage.id} />
                {selectedMessage.status !== "archived" ? (
                  <div className="mt-4 shrink-0 border-t border-border/40 pt-4">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-1.5"
                      disabled={isPending}
                      onClick={() => handleArchive(selectedMessage.id)}
                    >
                      <Archive className="size-3.5" aria-hidden />
                      Archive conversation
                    </Button>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
