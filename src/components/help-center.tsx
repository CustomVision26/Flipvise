"use client";

import { useMemo, useState, useTransition, useRef, useCallback } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  HelpCircle,
  MessageSquare,
  Bug,
  Lightbulb,
  Star,
  CreditCard,
  UserCircle,
  CheckCircle2,
  Loader2,
  ChevronRight,
  ImagePlus,
  X,
  Zap,
} from "lucide-react";
import { isClerkPlatformAdminRole } from "@/lib/clerk-platform-admin-role";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  submitGeneralSupportAction,
  submitBugReportAction,
  submitFeatureRequestAction,
  submitFeedbackAction,
  submitBillingIssueAction,
  submitAccountIssueAction,
  uploadSupportAttachmentAction,
} from "@/actions/support";

// ── Shared types ───────────────────────────────────────────────────────────

type SubmitState = "idle" | "loading" | "success" | "error";

interface FormState {
  status: SubmitState;
  error?: string;
}

// ── Image Uploader ─────────────────────────────────────────────────────────

type UploadState = "idle" | "uploading" | "done" | "error";

interface ImageUploaderProps {
  value: string | null;
  onChange: (url: string | null) => void;
}

function ImageUploader({ value, onChange }: ImageUploaderProps) {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setUploadError(null);
    setUploadState("uploading");

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    try {
      const formData = new FormData();
      formData.append("image", file);
      const url = await uploadSupportAttachmentAction(formData);
      onChange(url);
      setUploadState("done");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setUploadState("error");
      setPreview(null);
      onChange(null);
    }
  }, [onChange]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleRemove() {
    setPreview(null);
    onChange(null);
    setUploadState("idle");
    setUploadError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (preview && (uploadState === "uploading" || uploadState === "done")) {
    return (
      <div className="relative rounded-lg overflow-hidden border border-border bg-muted/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="Attachment preview" className="w-full max-h-48 object-cover" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity opacity-0 hover:opacity-100">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleRemove}
            className="gap-1"
          >
            <X className="h-3.5 w-3.5" />
            Remove
          </Button>
        </div>
        {uploadState === "uploading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        )}
        {uploadState === "done" && value && (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80 transition-colors"
            aria-label="Remove attachment"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-5 text-center cursor-pointer hover:bg-muted/40 transition-colors"
      >
        <ImagePlus className="h-6 w-6 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Attach a screenshot</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            JPEG, PNG, WebP or GIF · max 10 MB
          </p>
        </div>
      </div>
      {uploadState === "error" && uploadError && (
        <p className="text-xs text-destructive">{uploadError}</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleInputChange}
        tabIndex={-1}
      />
    </div>
  );
}

// ── Success card ───────────────────────────────────────────────────────────

function SuccessMessage({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
      <CheckCircle2 className="h-14 w-14 text-green-500" />
      <div>
        <p className="text-lg font-semibold">Message received!</p>
        <p className="text-sm text-muted-foreground mt-1">
          We&apos;ll get back to you as soon as possible.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onReset}>
        Submit another
      </Button>
    </div>
  );
}

// ── General Support form ───────────────────────────────────────────────────

function GeneralSupportForm() {
  const [state, setState] = useState<FormState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "loading" });
    startTransition(async () => {
      try {
        await submitGeneralSupportAction({ subject, message, attachmentUrl: attachmentUrl ?? undefined });
        setState({ status: "success" });
      } catch (err) {
        setState({ status: "error", error: err instanceof Error ? err.message : "Something went wrong" });
      }
    });
  }

  if (state.status === "success") {
    return <SuccessMessage onReset={() => { setState({ status: "idle" }); setSubject(""); setMessage(""); setAttachmentUrl(null); }} />;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="support-subject">Subject</Label>
        <Input
          id="support-subject"
          placeholder="What do you need help with?"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="support-message">Message</Label>
        <Textarea
          id="support-message"
          placeholder="Describe your issue in detail..."
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Screenshot (optional)</Label>
        <ImageUploader value={attachmentUrl} onChange={setAttachmentUrl} />
      </div>
      {state.status === "error" && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Send Request
      </Button>
    </form>
  );
}

// ── Bug Report form ────────────────────────────────────────────────────────

function BugReportForm() {
  const [state, setState] = useState<FormState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "loading" });
    startTransition(async () => {
      try {
        await submitBugReportAction({ subject, message, priority, attachmentUrl: attachmentUrl ?? undefined });
        setState({ status: "success" });
      } catch (err) {
        setState({ status: "error", error: err instanceof Error ? err.message : "Something went wrong" });
      }
    });
  }

  if (state.status === "success") {
    return <SuccessMessage onReset={() => { setState({ status: "idle" }); setSubject(""); setMessage(""); setAttachmentUrl(null); }} />;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bug-subject">Bug Summary</Label>
        <Input
          id="bug-subject"
          placeholder="Brief description of the bug"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bug-priority">Severity</Label>
        <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
          <SelectTrigger id="bug-priority">
            <SelectValue placeholder="Select severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low — cosmetic / minor inconvenience</SelectItem>
            <SelectItem value="normal">Normal — affects some functionality</SelectItem>
            <SelectItem value="high">High — blocks a feature</SelectItem>
            <SelectItem value="urgent">Urgent — app is broken / data loss</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bug-message">Steps to Reproduce</Label>
        <Textarea
          id="bug-message"
          placeholder="1. Go to...\n2. Click on...\n3. See error..."
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Screenshot (optional)</Label>
        <ImageUploader value={attachmentUrl} onChange={setAttachmentUrl} />
      </div>
      {state.status === "error" && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" disabled={isPending} variant="destructive">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Report Bug
      </Button>
    </form>
  );
}

// ── Feature Request form ───────────────────────────────────────────────────

function FeatureRequestForm() {
  const [state, setState] = useState<FormState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "loading" });
    startTransition(async () => {
      try {
        await submitFeatureRequestAction({ subject, message, attachmentUrl: attachmentUrl ?? undefined });
        setState({ status: "success" });
      } catch (err) {
        setState({ status: "error", error: err instanceof Error ? err.message : "Something went wrong" });
      }
    });
  }

  if (state.status === "success") {
    return <SuccessMessage onReset={() => { setState({ status: "idle" }); setSubject(""); setMessage(""); setAttachmentUrl(null); }} />;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fr-subject">Feature Title</Label>
        <Input
          id="fr-subject"
          placeholder="Name your feature idea"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fr-message">Description &amp; Use-case</Label>
        <Textarea
          id="fr-message"
          placeholder="Describe the feature and how it would help you..."
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Mockup / Reference Image (optional)</Label>
        <ImageUploader value={attachmentUrl} onChange={setAttachmentUrl} />
      </div>
      {state.status === "error" && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Submit Request
      </Button>
    </form>
  );
}

// ── Feedback form ──────────────────────────────────────────────────────────

function FeedbackForm() {
  const [state, setState] = useState<FormState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();
  const [subject, setSubject] = useState("App Feedback");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "loading" });
    const fullMessage = rating != null
      ? `Rating: ${rating}/5\n\n${message}`
      : message;
    startTransition(async () => {
      try {
        await submitFeedbackAction({ subject, message: fullMessage, attachmentUrl: attachmentUrl ?? undefined });
        setState({ status: "success" });
      } catch (err) {
        setState({ status: "error", error: err instanceof Error ? err.message : "Something went wrong" });
      }
    });
  }

  if (state.status === "success") {
    return <SuccessMessage onReset={() => { setState({ status: "idle" }); setMessage(""); setRating(null); setAttachmentUrl(null); }} />;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>Overall Rating</Label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="focus:outline-none"
              aria-label={`Rate ${star} out of 5`}
            >
              <Star
                className={`h-7 w-7 transition-colors ${
                  rating != null && star <= rating
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground hover:text-yellow-400"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fb-subject">Subject</Label>
        <Input
          id="fb-subject"
          placeholder="What are you sharing feedback about?"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fb-message">Your Feedback</Label>
        <Textarea
          id="fb-message"
          placeholder="Share your thoughts, suggestions, or experiences..."
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={5}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Attachment (optional)</Label>
        <ImageUploader value={attachmentUrl} onChange={setAttachmentUrl} />
      </div>
      {state.status === "error" && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Send Feedback
      </Button>
    </form>
  );
}

// ── Billing form ───────────────────────────────────────────────────────────

function BillingForm() {
  const [state, setState] = useState<FormState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "loading" });
    startTransition(async () => {
      try {
        await submitBillingIssueAction({ subject, message, attachmentUrl: attachmentUrl ?? undefined });
        setState({ status: "success" });
      } catch (err) {
        setState({ status: "error", error: err instanceof Error ? err.message : "Something went wrong" });
      }
    });
  }

  if (state.status === "success") {
    return <SuccessMessage onReset={() => { setState({ status: "idle" }); setSubject(""); setMessage(""); setAttachmentUrl(null); }} />;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="billing-subject">Issue Summary</Label>
        <Input
          id="billing-subject"
          placeholder="e.g. Incorrect charge, refund request..."
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="billing-message">Details</Label>
        <Textarea
          id="billing-message"
          placeholder="Include any relevant order numbers, dates, or amounts..."
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Attachment (optional)</Label>
        <ImageUploader value={attachmentUrl} onChange={setAttachmentUrl} />
      </div>
      {state.status === "error" && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Submit Billing Request
      </Button>
    </form>
  );
}

// ── Account form ───────────────────────────────────────────────────────────

function AccountForm() {
  const [state, setState] = useState<FormState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "loading" });
    startTransition(async () => {
      try {
        await submitAccountIssueAction({ subject, message, attachmentUrl: attachmentUrl ?? undefined });
        setState({ status: "success" });
      } catch (err) {
        setState({ status: "error", error: err instanceof Error ? err.message : "Something went wrong" });
      }
    });
  }

  if (state.status === "success") {
    return <SuccessMessage onReset={() => { setState({ status: "idle" }); setSubject(""); setMessage(""); setAttachmentUrl(null); }} />;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-subject">Issue Summary</Label>
        <Input
          id="account-subject"
          placeholder="e.g. Cannot access account, data export..."
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-message">Details</Label>
        <Textarea
          id="account-message"
          placeholder="Describe your account issue in detail..."
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Screenshot (optional)</Label>
        <ImageUploader value={attachmentUrl} onChange={setAttachmentUrl} />
      </div>
      {state.status === "error" && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Submit Account Request
      </Button>
    </form>
  );
}

// ── Priority Support content ───────────────────────────────────────────────

function PrioritySupportContent() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Badge className="text-xs">Pro</Badge>
        <p className="text-sm text-muted-foreground">
          Fast, personalized help from our support team.
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold">What you get</h4>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">✓</span>
            <span>Priority email response within 4 business hours</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">✓</span>
            <span>Direct access to senior support engineers</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">✓</span>
            <span>Screen-sharing sessions for complex issues</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">✓</span>
            <span>Custom feature guidance and best practices</span>
          </li>
        </ul>
      </div>

      <div className="border-t border-border" />

      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Contact Support</h4>
        <div className="space-y-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Email
            </span>
            <a
              href="mailto:customvision26@gmail.com?subject=Priority%20Support%20Request"
              className="text-sm text-primary hover:underline break-all"
            >
              customvision26@gmail.com
            </a>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Response Time
            </span>
            <span className="text-sm">
              Within 4 business hours (Mon-Fri, 9am-5pm EST)
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-border" />

      <p className="text-xs text-muted-foreground">
        Please include your account email and a detailed description of your issue.
        Our priority support team will respond as quickly as possible.
      </p>

      <a
        href="mailto:customvision26@gmail.com?subject=Priority%20Support%20Request"
        className={buttonVariants() + " w-full"}
      >
        Send Email
      </a>
    </div>
  );
}

// ── Tab definitions ────────────────────────────────────────────────────────

const BASE_TABS = [
  {
    id: "support",
    label: "Support",
    icon: MessageSquare,
    description: "Get help with anything in the app",
    form: <GeneralSupportForm />,
  },
  {
    id: "bug",
    label: "Bug Report",
    icon: Bug,
    description: "Found something broken? Let us know",
    form: <BugReportForm />,
  },
  {
    id: "feature",
    label: "Feature Request",
    icon: Lightbulb,
    description: "Suggest a new feature or improvement",
    form: <FeatureRequestForm />,
  },
  {
    id: "feedback",
    label: "Feedback",
    icon: Star,
    description: "Share your experience with us",
    form: <FeedbackForm />,
  },
  {
    id: "billing",
    label: "Billing",
    icon: CreditCard,
    description: "Questions about charges or subscription",
    form: <BillingForm />,
  },
  {
    id: "account",
    label: "Account",
    icon: UserCircle,
    description: "Issues with your account or settings",
    form: <AccountForm />,
  },
] as const;

const PRIORITY_TAB = {
  id: "priority",
  label: "Priority Support",
  icon: Zap,
  description: "Fast-tracked Pro support",
  form: <PrioritySupportContent />,
} as const;

type HelpTab = {
  id: string;
  label: string;
  icon: typeof MessageSquare;
  description: string;
  form: React.ReactNode;
};

// ── Landing view ───────────────────────────────────────────────────────────

function HelpLanding({
  tabs,
  onSelect,
}: {
  tabs: readonly HelpTab[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 py-2">
      <p className="text-sm text-muted-foreground mb-1">
        How can we help you today?
      </p>
      {tabs.map(({ id, label, icon: Icon, description }) => {
        const isPriority = id === "priority";
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-left hover:bg-accent transition-colors w-full group"
          >
            <Icon className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium leading-none">{label}</p>
                {isPriority && <Badge className="text-[10px] px-1.5 py-0">Pro</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        );
      })}
    </div>
  );
}

// ── Root component ─────────────────────────────────────────────────────────

export function HelpCenter() {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const { has } = useAuth();
  const { user } = useUser();

  const hasPrioritySupport = has?.({ feature: "priority_support" }) ?? false;
  const meta = user?.publicMetadata as
    | { adminGranted?: boolean; role?: string }
    | undefined;
  const isAdmin = isClerkPlatformAdminRole(meta?.role);
  const showPrioritySupport = hasPrioritySupport || isAdmin;

  const tabs = useMemo<readonly HelpTab[]>(
    () => (showPrioritySupport ? [PRIORITY_TAB, ...BASE_TABS] : [...BASE_TABS]),
    [showPrioritySupport],
  );

  const activeTabData = activeTab ? tabs.find((t) => t.id === activeTab) : null;

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) setActiveTab(null);
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              aria-label="Open Help Center"
              onClick={() => setOpen(true)}
            />
          }
        >
          <HelpCircle className="h-[18px] w-[18px]" />
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Help Center
        </TooltipContent>
      </Tooltip>
      <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 py-5 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {activeTab && (
              <button
                type="button"
                onClick={() => setActiveTab(null)}
                className="text-muted-foreground hover:text-foreground transition-colors text-sm mr-1"
                aria-label="Back"
              >
                ← Back
              </button>
            )}
            <SheetTitle className="text-base">
              {activeTabData ? activeTabData.label : "Help Center"}
            </SheetTitle>
            {activeTabData?.id === "priority" && (
              <Badge className="text-[10px] px-1.5 py-0">Pro</Badge>
            )}
          </div>
          {activeTabData && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeTabData.description}
            </p>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === null ? (
            <HelpLanding tabs={tabs} onSelect={setActiveTab} />
          ) : (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)}>
              {tabs.map(({ id, form }) => (
                <TabsContent key={id} value={id} className="mt-0">
                  {form}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
}
