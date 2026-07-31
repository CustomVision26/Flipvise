"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Timer } from "lucide-react";
import {
  checkEssayTopicMatchAction,
  generateEssayFeedbackAction,
  reopenEssayForEditAction,
  revealModelEssayAction,
  saveEssayDraftAction,
  splitEssayIntoSectionsAction,
  submitEssayAction,
} from "@/actions/essay";
import type {
  EssayFeedbackResult,
  EssayGenerationResult,
  EssaySectionsContent,
} from "@/lib/essay-ai-schema";
import type { EssayTopicMatchResult } from "@/lib/essay-topic-match";
import { heuristicEssayTopicMatch } from "@/lib/essay-topic-match";
import type { DocumentStudioMeta } from "@/lib/document-generation-studio";
import {
  clearLocalEssayDraft,
  readLocalEssayDraft,
  writeLocalEssayDraft,
} from "@/lib/essay-offline-drafts";
import {
  countWordsInSectionsContent,
  distributeEssayTextAcrossSections,
  hasMeaningfulSectionsContent,
  joinSectionsContent,
  normalizeEssayGenerationResult,
  resolveEssaySectionsContent,
} from "@/lib/essay-result-normalize";
import { EssayPromptInstructionsPanel } from "@/components/essay-prompt-instructions-panel";
import { EssaySectionCard } from "@/components/essay-section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
type EssayWritingWorkspaceProps = {
  documentId: number;
  userId: string;
  title: string;
  prompt: string;
  result: EssayGenerationResult;
  /** Document Studio formatting metadata (defaults applied for legacy essays). */
  documentStudio?: DocumentStudioMeta | null;
  wordCountTarget: number;
  timeLimitMinutes: number;
  initialBody: string;
  initialSectionsContent?: EssaySectionsContent;
  initialStatus: "draft" | "submitted";
  /** True once the essay has been submitted at least once (hides Save Draft). */
  hasBeenSubmittedOnce?: boolean;
  /** When true, open on the Writing workspace (sections) tab. */
  forceSectionsTab?: boolean;
  isOwner: boolean;
  modelEssayRevealed: boolean;
  initialFeedback: EssayFeedbackResult | null;
};

const EMPTY_SECTIONS: EssaySectionsContent = Object.freeze({});

function sectionsContentEqual(
  a: EssaySectionsContent,
  b: EssaySectionsContent,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export function EssayWritingWorkspace({
  documentId,
  userId,
  title,
  prompt: _prompt,
  result: rawResult,
  documentStudio = null,
  wordCountTarget,
  timeLimitMinutes,
  initialBody,
  initialSectionsContent,
  initialStatus,
  hasBeenSubmittedOnce = false,
  forceSectionsTab = false,
  isOwner,
  modelEssayRevealed: initialRevealed,
  initialFeedback,
}: EssayWritingWorkspaceProps) {
  const router = useRouter();
  const initialSections = initialSectionsContent ?? EMPTY_SECTIONS;
  const navigatingAwayRef = React.useRef(false);
  const [docTitle, setDocTitle] = React.useState(title);
  const [result, setResult] = React.useState(() =>
    normalizeEssayGenerationResult(rawResult),
  );
  const sectionIds = React.useMemo(
    () => result.sections.map((s) => s.id),
    [result],
  );
  const sectionIdsKey = sectionIds.join("|");

  const [sectionsContent, setSectionsContent] =
    React.useState<EssaySectionsContent>(() =>
      resolveEssaySectionsContent(
        normalizeEssayGenerationResult(rawResult).sections,
        initialSections,
        initialBody,
        { redistributeCollapsed: true },
      ),
    );
  const [status, setStatus] = React.useState(initialStatus);
  const [hasBeenSubmitted, setHasBeenSubmitted] = React.useState(
    hasBeenSubmittedOnce || initialStatus === "submitted",
  );
  const [feedback, setFeedback] = React.useState(initialFeedback);
  const [revealed, setRevealed] = React.useState(initialRevealed);
  const [saving, setSaving] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [feedbackPending, setFeedbackPending] = React.useState(false);
  const [topicMatchPending, setTopicMatchPending] = React.useState(false);
  const [topicMismatch, setTopicMismatch] =
    React.useState<EssayTopicMatchResult | null>(null);
  const [secondsLeft, setSecondsLeft] = React.useState(
    timeLimitMinutes > 0 ? timeLimitMinutes * 60 : null,
  );
  // Always start as online so SSR + first client paint match; sync in useEffect.
  const [online, setOnline] = React.useState(true);
  const [largeText, setLargeText] = React.useState(false);
  const [workspaceTab, setWorkspaceTab] = React.useState("sections");
  /** Plain essay draft for the Writing area tab (null = derive from sections). */
  const [freeformDraft, setFreeformDraft] = React.useState<string | null>(null);
  const [splittingSections, setSplittingSections] = React.useState(false);
  const hydratedKeyRef = React.useRef<string>("");
  const initialBodyRef = React.useRef(initialBody);
  const initialSectionsRef = React.useRef(initialSections);
  initialBodyRef.current = initialBody;
  initialSectionsRef.current = initialSections;

  React.useEffect(() => {
    if (forceSectionsTab) setWorkspaceTab("sections");
  }, [forceSectionsTab]);

  React.useEffect(() => {
    setDocTitle(title);
    setResult(normalizeEssayGenerationResult(rawResult));
  }, [title, rawResult]);

  const bodyFromSections = joinSectionsContent(result.sections, sectionsContent);
  const plainFromSections = result.sections
    .map((s) => (sectionsContent[s.id] ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
  const freeformValue = freeformDraft ?? plainFromSections;

  function resolveDraftPayload() {
    if (freeformDraft != null) {
      const content = distributeEssayTextAcrossSections(
        result.sections,
        freeformDraft,
      );
      const plainWords = freeformDraft.trim()
        ? freeformDraft.trim().split(/\s+/).length
        : 0;
      return {
        sectionsContent: content,
        body: joinSectionsContent(result.sections, content) || freeformDraft,
        wordCount: Math.max(countWordsInSectionsContent(content), plainWords),
      };
    }
    return {
      sectionsContent,
      body: bodyFromSections,
      wordCount: countWordsInSectionsContent(sectionsContent),
    };
  }

  const draftPayload = resolveDraftPayload();
  const body = draftPayload.body;
  const wordCount = draftPayload.wordCount;
  const readOnly = status === "submitted";
  /** Draft workflow (Save Draft + leave-guard) only before the first submit. */
  const useDraftWorkflow = !hasBeenSubmitted && status === "draft";

  const liveTopicMatch = React.useMemo(() => {
    const draftBody = body.trim();
    if (draftBody.split(/\s+/).filter(Boolean).length < 12) return null;
    return heuristicEssayTopicMatch({
      topic: docTitle,
      prompt: result.prompt || docTitle,
      body: draftBody,
    });
  }, [body, docTitle, result.prompt]);
  const showTopicWarning =
    !readOnly && liveTopicMatch != null && liveTopicMatch.matches === false;

  React.useEffect(() => {
    if (hasBeenSubmittedOnce || initialStatus === "submitted") {
      setHasBeenSubmitted(true);
    }
    setStatus(initialStatus);
  }, [hasBeenSubmittedOnce, initialStatus]);

  // Hydrate from localStorage once per document/structure — never loop on setState.
  React.useEffect(() => {
    const hydrateKey = `${documentId}:${userId}:${sectionIdsKey}`;
    if (hydratedKeyRef.current === hydrateKey) return;
    hydratedKeyRef.current = hydrateKey;

    const seedBody = initialBodyRef.current;
    const seedSections = initialSectionsRef.current;
    const local = readLocalEssayDraft(documentId, userId);

    const serverMapped = resolveEssaySectionsContent(
      result.sections,
      seedSections,
      seedBody,
      { redistributeCollapsed: true },
    );
    let next: EssaySectionsContent = serverMapped;

    if (hasMeaningfulSectionsContent(local?.sectionsContent)) {
      // Prefer server-mapped sections when edit mode already redistributed;
      // only overlay local when it is already spread across multiple sections.
      const localMapped = resolveEssaySectionsContent(
        result.sections,
        local!.sectionsContent,
        local?.body ?? seedBody,
        { redistributeCollapsed: true },
      );
      const localFilled = result.sections.filter((s) =>
        localMapped[s.id]?.trim(),
      ).length;
      const serverFilled = result.sections.filter((s) =>
        serverMapped[s.id]?.trim(),
      ).length;
      next = localFilled >= serverFilled ? localMapped : serverMapped;
    } else if (
      local?.body &&
      local.body.trim() &&
      (!seedBody || local.body.length >= seedBody.length)
    ) {
      next = resolveEssaySectionsContent(result.sections, null, local.body, {
        redistributeCollapsed: true,
      });
    }

    setSectionsContent((prev) =>
      sectionsContentEqual(prev, next) ? prev : next,
    );
  }, [documentId, userId, sectionIdsKey, result.sections]);

  React.useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  React.useEffect(() => {
    const payload = resolveDraftPayload();
    writeLocalEssayDraft(userId, {
      documentId,
      body: payload.body,
      wordCount: payload.wordCount,
      sectionsContent: payload.sectionsContent,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persist latest draft snapshot
  }, [body, documentId, userId, wordCount, sectionsContent, freeformDraft]);

  // Autosave to server every 10 seconds while drafting (before first submit).
  React.useEffect(() => {
    if (!useDraftWorkflow || !online) return;
    const id = window.setInterval(() => {
      const payload = resolveDraftPayload();
      void saveEssayDraftAction({
        documentId,
        body: payload.body,
        wordCount: payload.wordCount,
        sectionsContent: payload.sectionsContent,
      }).catch(() => {
        // local draft already persisted
      });
    }, 10_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    useDraftWorkflow,
    online,
    documentId,
    body,
    wordCount,
    sectionsContent,
    freeformDraft,
  ]);

  const saveDraftForLeave = React.useCallback(async () => {
    const payload = resolveDraftPayload();
    writeLocalEssayDraft(userId, {
      documentId,
      body: payload.body,
      wordCount: payload.wordCount,
      sectionsContent: payload.sectionsContent,
    });
    if (!navigator.onLine) return;
    await saveEssayDraftAction({
      documentId,
      body: payload.body,
      wordCount: payload.wordCount,
      sectionsContent: payload.sectionsContent,
    });
    clearLocalEssayDraft(documentId, userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- latest draft snapshot via closure
  }, [
    documentId,
    userId,
    body,
    wordCount,
    sectionsContent,
    freeformDraft,
    result.sections,
  ]);

  // Flush draft before leaving Document Studio tabs / other in-app links.
  React.useEffect(() => {
    if (!useDraftWorkflow) return;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const hrefAttr = anchor.getAttribute("href");
      if (
        !hrefAttr ||
        hrefAttr.startsWith("#") ||
        hrefAttr.startsWith("mailto:")
      ) {
        return;
      }

      let url: URL;
      try {
        url = new URL(hrefAttr, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      const payload = resolveDraftPayload();
      if (!payload.body.trim()) return;
      if (navigatingAwayRef.current) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      navigatingAwayRef.current = true;
      const next = `${url.pathname}${url.search}${url.hash}`;
      void (async () => {
        try {
          await saveDraftForLeave();
        } catch {
          // local draft already persisted
        } finally {
          navigatingAwayRef.current = false;
        }
        router.push(next);
      })();
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useDraftWorkflow, saveDraftForLeave, router]);

  // Warn on browser close/refresh when a pre-submit draft has content.
  React.useEffect(() => {
    if (!useDraftWorkflow) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      const payload = resolveDraftPayload();
      if (!payload.body.trim()) return;
      writeLocalEssayDraft(userId, {
        documentId,
        body: payload.body,
        wordCount: payload.wordCount,
        sectionsContent: payload.sectionsContent,
      });
      event.preventDefault();
      event.returnValue = "";
    };
    const onPageHide = () => {
      const payload = resolveDraftPayload();
      if (!payload.body.trim()) return;
      writeLocalEssayDraft(userId, {
        documentId,
        body: payload.body,
        wordCount: payload.wordCount,
        sectionsContent: payload.sectionsContent,
      });
      if (navigator.onLine) {
        void saveEssayDraftAction({
          documentId,
          body: payload.body,
          wordCount: payload.wordCount,
          sectionsContent: payload.sectionsContent,
        }).catch(() => {
          // local draft already persisted
        });
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useDraftWorkflow, documentId, userId, body, wordCount, sectionsContent, freeformDraft]);

  React.useEffect(() => {
    if (secondsLeft == null || status === "submitted") return;
    if (secondsLeft <= 0) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s == null ? s : Math.max(0, s - 1)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [secondsLeft, status]);

  function updateSection(sectionId: string, value: string) {
    if (freeformDraft != null) {
      const merged = distributeEssayTextAcrossSections(
        result.sections,
        freeformDraft,
      );
      merged[sectionId] = value;
      setSectionsContent(merged);
      setFreeformDraft(null);
      return;
    }
    setSectionsContent((prev) => ({ ...prev, [sectionId]: value }));
  }

  function updateFreeformBody(value: string) {
    setFreeformDraft(value);
  }

  async function organizeFreeformIntoSections(essayText: string) {
    const trimmed = essayText.trim();
    if (!trimmed) {
      setFreeformDraft(null);
      return;
    }

    setSplittingSections(true);
    try {
      const mapped = await splitEssayIntoSectionsAction({
        documentId,
        essayText: trimmed,
        sections: result.sections.map((section) => ({
          id: section.id,
          title: section.title,
          type: section.type,
          instructions: section.instructions,
        })),
      });
      setSectionsContent(mapped);
      setFreeformDraft(null);
      toast.success("Essay organized into writing sections");
    } catch (e) {
      setSectionsContent(
        distributeEssayTextAcrossSections(result.sections, trimmed),
      );
      setFreeformDraft(null);
      toast.error(
        e instanceof Error
          ? e.message
          : "Could not AI-organize sections; used local split instead.",
      );
    } finally {
      setSplittingSections(false);
    }
  }

  function onWorkspaceTabChange(next: string | number | null) {
    const value = String(next ?? "sections");
    if (value === "sections" && workspaceTab === "freeform") {
      const essayText = freeformDraft ?? plainFromSections;
      setWorkspaceTab("sections");
      void organizeFreeformIntoSections(essayText);
      return;
    }
    if (value === "freeform" && workspaceTab === "sections") {
      setFreeformDraft(plainFromSections);
    }
    setWorkspaceTab(value);
  }

  function renderWorkspaceFooter() {
    return (
      <CardFooter className="flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {useDraftWorkflow ? (
            <Button
              type="button"
              variant="outline"
              disabled={saving || readOnly}
              onClick={() => void handleSave()}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Draft"
              )}
            </Button>
          ) : null}
          {readOnly ? (
            <Button
              type="button"
              variant="outline"
              disabled={editing || submitting}
              onClick={() => void handleEdit()}
            >
              {editing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Opening…
                </>
              ) : (
                "Edit"
              )}
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={
              submitting || topicMatchPending || readOnly || !body.trim()
            }
            onClick={() => void handleSubmit()}
          >
            {submitting || topicMatchPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {topicMatchPending ? "Checking topic…" : "Submitting…"}
              </>
            ) : hasBeenSubmitted ? (
              "Submit Update"
            ) : (
              "Submit Essay"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={submitting || topicMatchPending || editing}
            onClick={() => void openEssayGeneratorWithPrefill()}
          >
            Change topic in Essay Generator
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={feedbackPending || !body.trim()}
            onClick={() => void handleFeedback()}
          >
            {feedbackPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating…
              </>
            ) : (
              "Receive AI Feedback"
            )}
          </Button>
        </div>
        {useDraftWorkflow ? (
          !online ? (
            <p className="text-xs text-amber-400" role="status">
              Offline — drafts save on this device and sync when you reconnect.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground" role="status">
              Autosaves every 10 seconds while you write. Leaving this page saves
              your draft first.
            </p>
          )
        ) : readOnly ? (
          <p className="text-xs text-muted-foreground" role="status">
            Submitted — choose Edit to update your essay, then submit again.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground" role="status">
            Editing a submitted essay — use Submit Update when you are done.
          </p>
        )}
      </CardFooter>
    );
  }

  async function handleSave() {
    setSaving(true);
    const payload = resolveDraftPayload();
    try {
      if (freeformDraft != null) {
        setSectionsContent(payload.sectionsContent);
        setFreeformDraft(null);
      }
      if (!online) {
        writeLocalEssayDraft(userId, {
          documentId,
          body: payload.body,
          wordCount: payload.wordCount,
          sectionsContent: payload.sectionsContent,
        });
        toast.success("Draft saved locally. It will sync when you are online.");
        return;
      }
      await saveEssayDraftAction({
        documentId,
        body: payload.body,
        wordCount: payload.wordCount,
        sectionsContent: payload.sectionsContent,
      });
      clearLocalEssayDraft(documentId, userId);
      toast.success("Draft saved");
      router.refresh();
    } catch (e) {
      writeLocalEssayDraft(userId, {
        documentId,
        body: payload.body,
        wordCount: payload.wordCount,
        sectionsContent: payload.sectionsContent,
      });
      toast.error(e instanceof Error ? e.message : "Could not save draft");
    } finally {
      setSaving(false);
    }
  }

  async function completeSubmit() {
    const payload = resolveDraftPayload();
    setSubmitting(true);
    try {
      if (freeformDraft != null) {
        setSectionsContent(payload.sectionsContent);
        setFreeformDraft(null);
      }
      const submitted = await submitEssayAction({
        documentId,
        body: payload.body || freeformValue,
        wordCount: payload.wordCount || freeformValue.trim().split(/\s+/).length,
        sectionsContent: payload.sectionsContent,
      });
      clearLocalEssayDraft(documentId, userId);
      setStatus("submitted");
      setHasBeenSubmitted(true);
      setTopicMismatch(null);
      toast.success(
        submitted.feedbackSaved
          ? "Essay submitted — writing and AI feedback saved"
          : "Essay submitted — writing saved (model essay unchanged)",
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit() {
    if (!online) {
      toast.error("Editing requires an internet connection.");
      return;
    }
    setEditing(true);
    try {
      await reopenEssayForEditAction({ documentId });
      setStatus("draft");
      setHasBeenSubmitted(true);
      toast.success("Editing unlocked — submit your update when ready.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open for edit");
    } finally {
      setEditing(false);
    }
  }

  async function openEssayGeneratorWithPrefill() {
    setTopicMismatch(null);
    if (useDraftWorkflow && body.trim()) {
      try {
        await saveDraftForLeave();
      } catch {
        // local draft already persisted
      }
    }
    router.push(`/dashboard/essay/generate?fromEssay=${documentId}`);
  }

  async function handleSubmit() {
    if (!online) {
      toast.error("Submitting requires an internet connection.");
      return;
    }
    const payload = resolveDraftPayload();
    if (!payload.body.trim() && !freeformValue.trim()) {
      toast.error("Write at least one essay section before submitting.");
      return;
    }

    setTopicMatchPending(true);
    try {
      const match = await checkEssayTopicMatchAction({
        documentId,
        body: payload.body || freeformValue,
      });
      if (!match.matches) {
        setTopicMismatch(match);
        return;
      }
      await completeSubmit();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not verify topic match",
      );
    } finally {
      setTopicMatchPending(false);
    }
  }

  async function handleFeedback() {
    if (!online) {
      toast.error("AI feedback requires an internet connection.");
      return;
    }
    setFeedbackPending(true);
    try {
      const payload = resolveDraftPayload();
      if (freeformDraft != null) {
        setSectionsContent(payload.sectionsContent);
        setFreeformDraft(null);
      }
      if (useDraftWorkflow) {
        await saveEssayDraftAction({
          documentId,
          body: payload.body || freeformValue,
          wordCount: payload.wordCount,
          sectionsContent: payload.sectionsContent,
        });
      }
      const fb = await generateEssayFeedbackAction({ documentId });
      setFeedback(fb);
      toast.success("Feedback ready");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Feedback failed");
    } finally {
      setFeedbackPending(false);
    }
  }

  async function handleRevealModel() {
    try {
      await revealModelEssayAction(documentId);
      setRevealed(true);
      toast.success("Model essay revealed");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reveal model essay");
    }
  }

  const timerLabel =
    secondsLeft == null
      ? null
      : `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(
          secondsLeft % 60,
        ).padStart(2, "0")}`;

  const tabTriggerClass =
    "flex-none shrink-0 rounded-none border-0 px-3 py-2.5 text-sm shadow-none after:bottom-0 data-active:bg-transparent dark:data-active:bg-transparent";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
      <div className="space-y-4">
        <EssayPromptInstructionsPanel
          documentId={documentId}
          title={docTitle}
          result={result}
          documentStudio={documentStudio}
          wordCountTarget={wordCountTarget}
          readOnly={readOnly}
          isOwner={isOwner}
          modelEssayRevealed={revealed}
          onRevealModel={() => void handleRevealModel()}
          onUpdated={({ title: nextTitle, result: nextResult }) => {
            setDocTitle(nextTitle);
            setResult(nextResult);
          }}
        />
      </div>

      <div className="space-y-4">
        <Card className="overflow-hidden">
          <Tabs
            value={workspaceTab}
            onValueChange={onWorkspaceTabChange}
            className="gap-0"
          >
            <CardHeader className="gap-3 border-b pb-0">
              <div className="space-y-1">
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  Target length
                </p>
                <p className="text-sm font-medium text-foreground">
                  Approximately {wordCountTarget} words
                </p>
              </div>
              <div className="flex flex-col gap-3 @md/card-header:flex-row @md/card-header:items-end @md/card-header:justify-between">
                <TabsList
                  variant="line"
                  className="h-auto w-fit justify-start gap-0 border-0 bg-transparent p-0"
                >
                  <TabsTrigger
                    value="sections"
                    className={tabTriggerClass}
                    disabled={splittingSections}
                  >
                    Writing workspace
                  </TabsTrigger>
                  <TabsTrigger
                    value="freeform"
                    className={tabTriggerClass}
                    disabled={splittingSections}
                  >
                    Writing area
                  </TabsTrigger>
                </TabsList>
                <div className="flex flex-wrap items-center gap-1.5 pb-2.5">
                  <Badge variant="secondary">{wordCount} words</Badge>
                  <Badge
                    variant={status === "submitted" ? "default" : "outline"}
                  >
                    {status === "submitted" ? "Submitted" : "Draft"}
                  </Badge>
                  {timerLabel ? (
                    <Badge variant="outline" className="gap-1">
                      <Timer className="size-3.5" aria-hidden />
                      {timerLabel}
                    </Badge>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => setLargeText((v) => !v)}
                  >
                    {largeText ? "Normal text" : "Large text"}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              {showTopicWarning && liveTopicMatch ? (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle aria-hidden />
                  <AlertTitle>Draft does not match the assigned topic</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>{liveTopicMatch.reason}</p>
                    {liveTopicMatch.writingSeemsAbout ? (
                      <p>
                        Your draft appears to discuss:{" "}
                        <span className="text-foreground">
                          {liveTopicMatch.writingSeemsAbout}
                        </span>
                      </p>
                    ) : null}
                    <p>
                      Assigned essay:{" "}
                      <span className="text-foreground">{docTitle}</span>
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-1"
                      onClick={openEssayGeneratorWithPrefill}
                    >
                      Change topic in Essay Generator
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : null}
              <TabsContent
                value="sections"
                className="mt-0 space-y-4 rounded-none border-0 bg-transparent p-0 shadow-none ring-0"
                keepMounted
              >
                <p className="text-sm text-muted-foreground">
                  Write by section — structure adapts to this activity.
                </p>
                {splittingSections ? (
                  <div className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-4 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Organizing your essay into Introduction, Supporting, and
                    Conclusion sections…
                  </div>
                ) : null}
                <div className="space-y-3">
                  {result.sections.map((section) => (
                    <EssaySectionCard
                      key={section.id}
                      section={section}
                      value={sectionsContent[section.id] ?? ""}
                      onChange={(value) => updateSection(section.id, value)}
                      disabled={readOnly || splittingSections}
                      largeText={largeText}
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent
                value="freeform"
                className="mt-0 space-y-3 rounded-none border-0 bg-transparent p-0 shadow-none ring-0"
                keepMounted
              >
                <p className="text-sm text-muted-foreground">
                  Write the full essay in one continuous draft.
                </p>
                <Textarea
                  id="essay-writing-area"
                  value={freeformValue}
                  onChange={(e) => updateFreeformBody(e.target.value)}
                  disabled={readOnly}
                  placeholder="Start writing your essay..."
                  rows={18}
                  className={
                    largeText
                      ? "min-h-[320px] resize-y text-base leading-relaxed"
                      : "min-h-[320px] resize-y"
                  }
                  aria-label="Writing area"
                />
              </TabsContent>
            </CardContent>

            {renderWorkspaceFooter()}
          </Tabs>
        </Card>

        {feedback ? (
          <Card>
            <CardHeader>
              <CardTitle>AI Feedback</CardTitle>
              <CardDescription>
                Overall score: {feedback.overallScore}/100
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium">Strengths</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {feedback.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium">Areas for improvement</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {feedback.areasForImprovement.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium">Revision suggestions</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {feedback.revisionSuggestions.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <Separator />
              <p>
                <span className="font-medium">Grammar: </span>
                {feedback.grammar}
              </p>
              <p>
                <span className="font-medium">Organization: </span>
                {feedback.organization}
              </p>
              <p>
                <span className="font-medium">Vocabulary: </span>
                {feedback.vocabulary}
              </p>
              <p>
                <span className="font-medium">Supporting details: </span>
                {feedback.supportingDetails}
              </p>
              <p>
                <span className="font-medium">Essay structure: </span>
                {feedback.essayStructure}
              </p>
              <p>
                <span className="font-medium">Introduction: </span>
                {feedback.introduction}
              </p>
              <p>
                <span className="font-medium">Essay sections: </span>
                {feedback.bodyParagraphs}
              </p>
              <p>
                <span className="font-medium">Conclusion: </span>
                {feedback.conclusion}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <AlertDialog
        open={topicMismatch != null}
        onOpenChange={(open) => {
          if (!open) setTopicMismatch(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Writing does not match the topic</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-left">
              <span className="block">{topicMismatch?.reason}</span>
              {topicMismatch?.writingSeemsAbout ? (
                <span className="block text-muted-foreground">
                  Your draft appears to discuss:{" "}
                  <span className="text-foreground">
                    {topicMismatch.writingSeemsAbout}
                  </span>
                </span>
              ) : null}
              <span className="block">
                Assigned essay: <span className="text-foreground">{docTitle}</span>
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={openEssayGeneratorWithPrefill}
              className="w-full"
            >
              Change topic in Essay Generator
            </AlertDialogAction>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={submitting}
              onClick={() => void completeSubmit()}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit anyway"
              )}
            </Button>
            <AlertDialogCancel className="w-full">Keep editing</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
