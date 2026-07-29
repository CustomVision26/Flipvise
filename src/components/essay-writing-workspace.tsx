"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Timer } from "lucide-react";
import {
  generateEssayFeedbackAction,
  revealModelEssayAction,
  saveEssayDraftAction,
  submitEssayAction,
} from "@/actions/essay";
import type { EssayFeedbackResult, EssayGenerationResult } from "@/lib/essay-ai-schema";
import {
  clearLocalEssayDraft,
  readLocalEssayDraft,
  writeLocalEssayDraft,
} from "@/lib/essay-offline-drafts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  EssayAssignDialog,
  type EssayAssignMemberOption,
} from "@/components/essay-assign-dialog";

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

type EssayWritingWorkspaceProps = {
  documentId: number;
  userId: string;
  title: string;
  prompt: string;
  result: EssayGenerationResult;
  wordCountTarget: number;
  timeLimitMinutes: number;
  initialBody: string;
  initialStatus: "draft" | "submitted";
  isOwner: boolean;
  modelEssayRevealed: boolean;
  initialFeedback: EssayFeedbackResult | null;
  assignTeamId?: number | null;
  assignMembers?: EssayAssignMemberOption[];
};

export function EssayWritingWorkspace({
  documentId,
  userId,
  title,
  prompt,
  result,
  wordCountTarget,
  timeLimitMinutes,
  initialBody,
  initialStatus,
  isOwner,
  modelEssayRevealed: initialRevealed,
  initialFeedback,
  assignTeamId = null,
  assignMembers = [],
}: EssayWritingWorkspaceProps) {
  const router = useRouter();
  const [body, setBody] = React.useState(initialBody);
  const [status, setStatus] = React.useState(initialStatus);
  const [feedback, setFeedback] = React.useState(initialFeedback);
  const [revealed, setRevealed] = React.useState(initialRevealed);
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [feedbackPending, setFeedbackPending] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState(
    timeLimitMinutes > 0 ? timeLimitMinutes * 60 : null,
  );
  const [online, setOnline] = React.useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  const wordCount = countWords(body);

  React.useEffect(() => {
    const local = readLocalEssayDraft(documentId, userId);
    if (local && local.body && (!initialBody || local.updatedAt)) {
      if (!initialBody || local.body.length >= initialBody.length) {
        setBody(local.body);
      }
    }
  }, [documentId, userId, initialBody]);

  React.useEffect(() => {
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
    writeLocalEssayDraft(userId, { documentId, body, wordCount });
  }, [body, documentId, userId, wordCount]);

  React.useEffect(() => {
    if (secondsLeft == null || status === "submitted") return;
    if (secondsLeft <= 0) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s == null ? s : Math.max(0, s - 1)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [secondsLeft, status]);

  async function handleSave() {
    setSaving(true);
    try {
      if (!online) {
        writeLocalEssayDraft(userId, { documentId, body, wordCount });
        toast.success("Draft saved locally. It will sync when you are online.");
        return;
      }
      await saveEssayDraftAction({ documentId, body, wordCount });
      clearLocalEssayDraft(documentId, userId);
      toast.success("Draft saved");
      router.refresh();
    } catch (e) {
      writeLocalEssayDraft(userId, { documentId, body, wordCount });
      toast.error(e instanceof Error ? e.message : "Could not save draft");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!online) {
      toast.error("Submitting requires an internet connection.");
      return;
    }
    setSubmitting(true);
    try {
      await submitEssayAction({ documentId, body, wordCount });
      clearLocalEssayDraft(documentId, userId);
      setStatus("submitted");
      toast.success("Essay submitted");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFeedback() {
    if (!online) {
      toast.error("AI feedback requires an internet connection.");
      return;
    }
    setFeedbackPending(true);
    try {
      if (status !== "submitted") {
        await saveEssayDraftAction({ documentId, body, wordCount });
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

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>Essay prompt & instructions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="whitespace-pre-wrap text-foreground">{prompt}</p>
            <Separator />
            <div>
              <p className="mb-1 font-medium">Learning objectives</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {result.learningObjectives.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
            {result.outline && result.outline.length > 0 ? (
              <div>
                <p className="mb-1 font-medium">Outline</p>
                <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                  {result.outline.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ol>
              </div>
            ) : null}
            {result.vocabulary && result.vocabulary.length > 0 ? (
              <div>
                <p className="mb-1 font-medium">Vocabulary</p>
                <ul className="space-y-1 text-muted-foreground">
                  {result.vocabulary.map((v) => (
                    <li key={v.term}>
                      <span className="font-medium text-foreground">{v.term}</span>
                      {" — "}
                      {v.definition}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div>
              <p className="mb-1 font-medium">Planning guide</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {result.planningGuide.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 font-medium">Success checklist</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {result.successChecklist.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
            {result.rubric && result.rubric.length > 0 ? (
              <div>
                <p className="mb-1 font-medium">Rubric</p>
                <ul className="space-y-2 text-muted-foreground">
                  {result.rubric.map((r) => (
                    <li key={r.name}>
                      <span className="font-medium text-foreground">
                        {r.name} ({r.maxPoints} pts)
                      </span>
                      <br />
                      {r.description}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.modelEssay ? (
              <div className="space-y-2">
                <p className="font-medium">Model essay</p>
                {revealed || !isOwner ? (
                  revealed ? (
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      {result.modelEssay}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">
                      A model essay is available to the activity owner after reveal.
                    </p>
                  )
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={() => void handleRevealModel()}>
                    Reveal model essay
                  </Button>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Writing area</CardTitle>
              <CardDescription>
                Target ~{wordCountTarget} words
                {!online ? " · Offline — drafts save locally" : null}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{wordCount} words</Badge>
              {timerLabel ? (
                <Badge variant="outline" className="gap-1">
                  <Timer className="size-3" />
                  {timerLabel}
                </Badge>
              ) : null}
              <Badge variant={status === "submitted" ? "default" : "outline"}>
                {status === "submitted" ? "Submitted" : "Draft"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="essay-body" className="sr-only">
              Essay body
            </Label>
            <Textarea
              id="essay-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={18}
              className="min-h-[280px] font-serif text-base leading-relaxed"
              placeholder="Start writing your essay…"
            />
            <div className="flex flex-wrap gap-2">
              {isOwner && assignTeamId != null && assignMembers.length > 0 ? (
                <EssayAssignDialog
                  documentId={documentId}
                  teamId={assignTeamId}
                  members={assignMembers}
                />
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                Save Draft
              </Button>
              <Button
                type="button"
                disabled={submitting || !body.trim()}
                onClick={() => void handleSubmit()}
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                Submit Essay
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={feedbackPending || !body.trim()}
                onClick={() => void handleFeedback()}
              >
                {feedbackPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Receive AI Feedback
              </Button>
            </div>
          </CardContent>
        </Card>

        {feedback ? (
          <Card>
            <CardHeader>
              <CardTitle>AI Feedback</CardTitle>
              <CardDescription>Overall score: {feedback.overallScore}/100</CardDescription>
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
              <div className="grid gap-2 sm:grid-cols-2 text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Grammar: </span>
                  {feedback.grammar}
                </p>
                <p>
                  <span className="font-medium text-foreground">Organization: </span>
                  {feedback.organization}
                </p>
                <p>
                  <span className="font-medium text-foreground">Vocabulary: </span>
                  {feedback.vocabulary}
                </p>
                <p>
                  <span className="font-medium text-foreground">Supporting details: </span>
                  {feedback.supportingDetails}
                </p>
                <p>
                  <span className="font-medium text-foreground">Structure: </span>
                  {feedback.essayStructure}
                </p>
                <p>
                  <span className="font-medium text-foreground">Introduction: </span>
                  {feedback.introduction}
                </p>
                <p>
                  <span className="font-medium text-foreground">Body paragraphs: </span>
                  {feedback.bodyParagraphs}
                </p>
                <p>
                  <span className="font-medium text-foreground">Conclusion: </span>
                  {feedback.conclusion}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
