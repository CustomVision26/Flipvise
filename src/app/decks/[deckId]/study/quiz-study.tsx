"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  XCircle,
  RotateCcw,
  ArrowLeft,
  Trophy,
  Sparkles,
  HeartHandshake,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  CircleHelp,
  Play,
  ListChecks,
  BookCheck,
  ShieldAlert,
  Shield,
  Lock,
  PenLine,
  ToggleLeft,
  Shuffle,
} from "lucide-react";
import { shuffleDeckQuizCardOrdersAction } from "@/actions/quiz-card-orders";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  submitQuizResultAction,
  saveQuizResultAction,
  type QuizResult,
} from "@/actions/study";
import {
  completeQuizSecuritySessionAction,
  lockQuizSecuritySessionAction,
  startQuizSecuritySessionAction,
} from "@/actions/quiz-security";
import type { QuizSecuritySessionState } from "@/db/schema";
import { SpeakButton, VoiceSelector, type TtsVoice } from "@/components/speak-button";
import { FormatQuizQuestionButton } from "@/components/format-quiz-question-dialog";
import type { QuizFormatsDeckSnapshot } from "@/db/queries/quiz-formats";
import { getDeckQuizAccent } from "@/lib/deck-quiz-accent";
import {
  formatCountdown,
  formatQuizStartSchedule,
  isQuizStartAllowed,
  secondsUntilQuizStart,
  type ResolvedQuizStartSchedule,
} from "@/lib/quiz-start-schedule";
import {
  resolveSecuredEducationQuizInboxTargets,
  type QuizResultInboxTarget,
} from "@/lib/quiz-result-inbox-targets";
import { Input } from "@/components/ui/input";
import type { QuizFormatKey, QuizFormatsSettings } from "@/lib/quiz-formats";
import {
  enabledQuizFormatKeys,
  QUIZ_FORMAT_META,
} from "@/lib/quiz-formats";
import { parseCardQuizVariants } from "@/lib/card-quiz-variants";
import {
  buildQuizQuestions,
  formatQuestionWithTypeLabel,
  questionPromptText,
  questionTypeLabel,
  summarizeSessionQuestionFormats,
  summarizeQuizFormatDistribution,
  type QuizCardInput,
  type QuizQuestion,
  type QuizQuestionType,
} from "@/lib/quiz-questions";
import {
  buildPerCardSnapshotForSave,
  buildQuizSessionState,
  isQuizQuestionAnswered,
  questionsFromSessionState,
  trueFalseOptions,
} from "@/lib/quiz-study-helpers";

type SubmitQuizOptions = {
  timedOut: boolean;
  saveResult?: boolean;
  inboxTargets?: QuizResultInboxTarget[];
};

import { cn } from "@/lib/utils";
import type { DeckQuizFormatAssignments } from "@/lib/quiz-format-assignments";
import { distributionFromQuestionTypes } from "@/lib/quiz-format-assignments";
import { FormattedCardFront } from "@/components/formatted-card-front";
import { polishCardText } from "@/lib/format-card-content";

const QUIZ_FORMAT_ICONS: Record<QuizFormatKey, typeof CircleHelp> = {
  multipleChoice: CircleHelp,
  trueFalse: ToggleLeft,
  fillInBlank: PenLine,
};

type CardData = QuizCardInput;

interface QuizStudyProps {
  cards: CardData[];
  deckId: number;
  deckName: string;
  deckDescription?: string | null;
  teamId: number | null;
  /** Same gradient slug as deck detail / flashcards — tints quiz chrome and question card. */
  deckGradient?: string | null;
  /** Set when study was opened from a team workspace URL — result is saved right after submit. */
  autoSaveQuizResult?: boolean;
  /** Team workspace admin setting — flat quiz duration in seconds. */
  quizDurationSeconds?: number;
  hasAiReading?: boolean;
  exitHref: string;
  exitLabel: string;
  /** Team member quiz — owner inbox can be chosen when saving after timeout. */
  ownerInboxAvailable?: boolean;
  /** Workspace owner / team admin — Cancel exits the quiz without submitting. */
  allowQuizCancelExit?: boolean;
  quizSchedule?: {
    enabled: boolean;
    startAtIso: string;
    source: "deck" | "workspace";
  };
  quizSecurity?: {
    enabled: boolean;
    teamId: number;
    initialSession: {
      id: number;
      status: "active" | "locked" | "granted_resume" | "terminated" | "completed";
      sessionState: QuizSecuritySessionState | null;
    } | null;
  };
  /** Enabled quiz question formats (workspace/deck resolved). */
  quizFormats?: QuizFormatsSettings;
  /** Admin-applied per-card format map and target distribution. */
  quizFormatAssignmentPlan?: DeckQuizFormatAssignments | null;
  /** Stable per-viewer card order from Team Admin shuffle (when set, not randomized). */
  quizCardOrder?: number[] | null;
  /** ISO timestamp when deck-level member card-order shuffle was last applied. */
  quizCardOrderShuffledAt?: string | null;
  /** Owner / team admin may reshuffle card order from the Timed quiz lobby. */
  canReshuffleCardOrder?: boolean;
  /** Education Gold / Enterprise — secured quizzes auto-save to user, owner, and team admins. */
  isEducationTeamPlan?: boolean;
  /** Pro Plus / Education Plus personal deck — Format Quiz Question dialog. */
  quizFormatEditorSnapshot?: QuizFormatsDeckSnapshot | null;
}

type QuizSecurityStatus = NonNullable<QuizStudyProps["quizSecurity"]>["initialSession"] extends infer S
  ? S extends { status: infer St }
    ? St
    : never
  : never;

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Quiz UI only: multiple-choice options that include a step-by-step workout
 * (`Step 1:`, `Step 2:`, …) are shown as the final answer (e.g. after
 * `Answer:`) so each choice matches short options like the others.
 * `submitQuizResultAction` still receives the full stored option string.
 */
function formatQuizOptionForDisplay(raw: string): string {
  const text = raw.trim();
  if (!text) return raw;
  if (!/\bStep\s*\d+\s*:/i.test(text)) return text;

  let lastExplicit: string | null = null;
  const explicitRe = /(?:Answer|Result|Solution|∴)\s*:\s*([^\n]+)/gi;
  let em: RegExpExecArray | null;
  while ((em = explicitRe.exec(text)) !== null) {
    const v = em[1]?.trim();
    if (v) lastExplicit = v;
  }
  if (lastExplicit) return lastExplicit;

  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!/^Step\s*\d+\s*:/i.test(line) && line.length > 0) return line;
  }

  const segments = text.split(/\bStep\s*\d+\s*:/i);
  const lastSeg = segments[segments.length - 1]?.replace(/^\s+/, "").trim() ?? "";
  if (lastSeg && lastSeg.length < text.length) return lastSeg;

  return text;
}

/**
 * Quiz time budget — 10 minutes for the first 25 cards, +10 for every
 * additional tier up to 50 cards, +10 more beyond 50.
 */
function getQuizDurationSeconds(cardCount: number): number {
  if (cardCount <= 25) return 10 * 60;
  if (cardCount <= 50) return 20 * 60;
  return 30 * 60;
}

function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const mm = Math.floor(clamped / 60)
    .toString()
    .padStart(2, "0");
  const ss = (clamped % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function prepareCardsForQuiz(cards: CardData[]): QuizCardInput[] {
  return cards.map((c) => ({
    ...c,
    quizVariants: parseCardQuizVariants(c.quizVariants) ?? null,
  }));
}

export function QuizStudy({
  cards,
  deckId,
  deckName,
  deckDescription = null,
  teamId,
  deckGradient = null,
  autoSaveQuizResult = false,
  quizDurationSeconds,
  hasAiReading = false,
  exitHref,
  exitLabel,
  ownerInboxAvailable = false,
  allowQuizCancelExit = false,
  quizSchedule,
  quizSecurity,
  quizFormats = { multipleChoice: true, trueFalse: false, fillInBlank: false },
  quizFormatAssignmentPlan = null,
  quizCardOrder = null,
  quizCardOrderShuffledAt = null,
  canReshuffleCardOrder = false,
  isEducationTeamPlan = false,
  quizFormatEditorSnapshot = null,
}: QuizStudyProps) {
  const quizFormatAssignments = quizFormatAssignmentPlan?.byCardId ?? null;
  const router = useRouter();
  const preparedCards = useMemo(() => prepareCardsForQuiz(cards), [cards]);
  const leaveStudy = useCallback(() => router.push(exitHref), [router, exitHref]);
  const [cardOrderShuffledAtLocal, setCardOrderShuffledAtLocal] = useState<string | null>(
    quizCardOrderShuffledAt,
  );
  const [cardOrderReshuffling, setCardOrderReshuffling] = useState(false);
  const [cardOrderMessage, setCardOrderMessage] = useState<string | null>(null);

  useEffect(() => {
    setCardOrderShuffledAtLocal(quizCardOrderShuffledAt);
  }, [quizCardOrderShuffledAt]);
  const securityEnabled = Boolean(quizSecurity?.enabled);
  const resultTeamId = quizSecurity?.teamId ?? teamId;
  const securedEducationInboxTargets = useMemo(
    () => resolveSecuredEducationQuizInboxTargets(securityEnabled, isEducationTeamPlan),
    [securityEnabled, isEducationTeamPlan],
  );
  const securedEducationSave = securedEducationInboxTargets != null;
  const shouldAutoSaveResult = autoSaveQuizResult || securityEnabled;
  const initialSession = quizSecurity?.initialSession ?? null;
  const restoredState =
    initialSession?.sessionState &&
    (initialSession.status === "active" ||
      (initialSession.status === "granted_resume" && initialSession.sessionState != null))
      ? initialSession.sessionState
      : null;

  const deckAccent = useMemo(() => getDeckQuizAccent(deckGradient), [deckGradient]);
  const deckAccentCss =
    deckAccent.hasDeckAccent && deckAccent.accent && deckAccent.accentForeground
      ? ({
          "--deck-accent": deckAccent.accent,
          "--deck-accent-fg": deckAccent.accentForeground,
        } as CSSProperties)
      : undefined;

  const buildQuestions = useCallback(
    () =>
      buildQuizQuestions(
        preparedCards,
        quizFormats,
        quizFormatAssignments,
        quizCardOrder && quizCardOrder.length > 0 ? quizCardOrder : null,
      ),
    [preparedCards, quizFormats, quizFormatAssignments, quizCardOrder],
  );

  const [questions, setQuestions] = useState<QuizQuestion[]>(() =>
    restoredState
      ? questionsFromSessionState(restoredState)
      : buildQuestions(),
  );
  const [currentIndex, setCurrentIndex] = useState(() => restoredState?.currentIndex ?? 0);
  const [selectedByIndex, setSelectedByIndex] = useState<(number | null)[]>(() =>
    restoredState
      ? restoredState.selectedByIndex
      : Array(buildQuestions().length).fill(null),
  );
  const [typedAnswersByIndex, setTypedAnswersByIndex] = useState<(string | null)[]>(() => {
    if (restoredState) {
      return (
        restoredState.typedAnswersByIndex ??
        Array(restoredState.questions.length).fill(null)
      );
    }
    return Array(buildQuestions().length).fill(null);
  });
  const [voice, setVoice] = useState<TtsVoice>("nova");

  const totalSeconds = useMemo(
    () => quizDurationSeconds ?? getQuizDurationSeconds(questions.length),
    [quizDurationSeconds, questions.length],
  );
  const [remainingSeconds, setRemainingSeconds] = useState(
    () => restoredState?.remainingSeconds ?? totalSeconds,
  );
  const startTimeRef = useRef<number>(0);
  // Always show the Timed quiz intro first; never auto-skip into an in-progress session.
  const [quizStarted, setQuizStarted] = useState(false);
  /** Owner/admin Cancel from unanswered dialog — return to lobby without leaving study. */
  const [returnedToLobby, setReturnedToLobby] = useState(false);
  const [securitySessionId, setSecuritySessionId] = useState<number | null>(
    () => initialSession?.id ?? null,
  );
  const [securityStatus, setSecurityStatus] = useState<QuizSecurityStatus | null>(
    () => initialSession?.status ?? null,
  );
  const [securityLocking, setSecurityLocking] = useState(false);
  const lockingRef = useRef(false);
  /** Owner/admin leave via Dashboard — skip security lock on intentional leave. */
  const skipSecurityLockOnExitRef = useRef(false);

  const grantedFreshStart = useMemo(
    () =>
      securityEnabled &&
      (securityStatus === "granted_resume" || initialSession?.status === "granted_resume") &&
      restoredState == null &&
      !returnedToLobby,
    [securityEnabled, securityStatus, initialSession?.status, restoredState, returnedToLobby],
  );
  const grantedResume = useMemo(() => {
    if (returnedToLobby) return true;
    if (!securityEnabled || restoredState == null) return false;
    const status = securityStatus ?? initialSession?.status;
    return status === "granted_resume" || status === "active";
  }, [
    returnedToLobby,
    securityEnabled,
    securityStatus,
    initialSession?.status,
    restoredState,
  ]);
  const isSecurityTerminated = useMemo(
    () =>
      securityEnabled &&
      (securityStatus === "terminated" || initialSession?.status === "terminated"),
    [securityEnabled, securityStatus, initialSession?.status],
  );
  const isSecurityCompleted = useMemo(
    () =>
      securityEnabled &&
      (securityStatus === "completed" || initialSession?.status === "completed"),
    [securityEnabled, securityStatus, initialSession?.status],
  );
  const isSecurityLocked = useMemo(
    () =>
      securityEnabled &&
      (securityStatus === "locked" || initialSession?.status === "locked"),
    [securityEnabled, securityStatus, initialSession?.status],
  );
  const canStartSecuredQuiz = useMemo(
    () =>
      !securityEnabled ||
      grantedFreshStart ||
      grantedResume ||
      (!isSecurityTerminated && !isSecurityCompleted && !isSecurityLocked),
    [
      securityEnabled,
      grantedFreshStart,
      grantedResume,
      isSecurityTerminated,
      isSecurityCompleted,
      isSecurityLocked,
    ],
  );

  const activeSchedule = useMemo<ResolvedQuizStartSchedule | null>(() => {
    if (!quizSchedule?.enabled) return null;
    const startAt = new Date(quizSchedule.startAtIso);
    if (Number.isNaN(startAt.getTime())) return null;
    return {
      enabled: true,
      startAt,
      source: quizSchedule.source,
    };
  }, [quizSchedule]);

  const [scheduleSecondsRemaining, setScheduleSecondsRemaining] = useState(() =>
    secondsUntilQuizStart(activeSchedule),
  );

  useEffect(() => {
    setScheduleSecondsRemaining(secondsUntilQuizStart(activeSchedule));
    if (!activeSchedule) return;
    const timerId = window.setInterval(() => {
      setScheduleSecondsRemaining(secondsUntilQuizStart(activeSchedule));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [activeSchedule]);

  const scheduleBlocksStart = useMemo(() => {
    if (!activeSchedule || grantedResume || grantedFreshStart) return false;
    return !isQuizStartAllowed(activeSchedule);
  }, [activeSchedule, grantedResume, grantedFreshStart, scheduleSecondsRemaining]);

  const canStartQuiz = canStartSecuredQuiz && !scheduleBlocksStart;

  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitChoiceDialogOpen, setSubmitChoiceDialogOpen] = useState(false);
  const [submitChoiceTimedOut, setSubmitChoiceTimedOut] = useState(false);
  const timeoutPromptShownRef = useRef(false);
  const [saveToUserInbox, setSaveToUserInbox] = useState(true);
  const [saveToOwnerInbox, setSaveToOwnerInbox] = useState(ownerInboxAvailable);
  const [autoPersisted, setAutoPersisted] = useState(false);
  const [autoPersistError, setAutoPersistError] = useState<string | null>(null);

  const totalQuestions = questions.length;
  const enabledFormats = useMemo(() => enabledQuizFormatKeys(quizFormats), [quizFormats]);
  const sessionFormatSummary = useMemo(() => {
    const actual = summarizeSessionQuestionFormats(questions);
    if (actual) return actual;
    if (quizFormatAssignmentPlan?.distribution) {
      return summarizeQuizFormatDistribution(quizFormatAssignmentPlan.distribution);
    }
    if (quizFormatAssignmentPlan?.byCardId) {
      const derived = distributionFromQuestionTypes(
        Object.values(quizFormatAssignmentPlan.byCardId),
      );
      return summarizeQuizFormatDistribution(derived);
    }
    return null;
  }, [quizFormatAssignmentPlan, questions]);
  const answeredCount = questions.filter((q, i) =>
    isQuizQuestionAnswered(q, selectedByIndex[i] ?? null, typedAnswersByIndex[i] ?? null),
  ).length;
  const unansweredCount = totalQuestions - answeredCount;
  const progressPercent =
    totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  const revealQuizResult = useCallback((res: QuizResult) => {
    setSubmitChoiceDialogOpen(false);
    setConfirmOpen(false);
    setResult(res);
  }, []);

  const submitQuiz = useCallback(
    (reason: SubmitQuizOptions) => {
      if (result || submitting) return;
      const elapsed = Math.min(
        totalSeconds,
        Math.floor((Date.now() - startTimeRef.current) / 1000),
      );
      const answers = questions.map((q, i) => {
        const sel = selectedByIndex[i];
        const typed = typedAnswersByIndex[i];
        if (q.type === "fill_in_blank") {
          return {
            cardId: q.cardId,
            questionType: "fill_in_blank" as const,
            selectedText: null,
            typedAnswer: typed?.trim() ? typed.trim() : null,
          };
        }
        if (q.type === "true_false") {
          const options = trueFalseOptions();
          return {
            cardId: q.cardId,
            questionType: "true_false" as const,
            selectedText:
              sel !== null && sel !== undefined ? (options[sel] ?? null) : null,
            typedAnswer: null,
          };
        }
        return {
          cardId: q.cardId,
          questionType: "multiple_choice" as const,
          selectedText:
            sel !== null && sel !== undefined
              ? q.options[sel]?.trim()
                ? q.options[sel]
                : q.optionImageUrls[sel] ?? null
              : null,
          typedAnswer: null,
        };
      });
      setSubmitError(null);
      startTransition(async () => {
        try {
          const res = await submitQuizResultAction({
            deckId,
            answers,
            elapsedSeconds: elapsed,
            timedOut: reason.timedOut,
          });
          const shouldSave =
            shouldAutoSaveResult ||
            Boolean(reason.saveResult && reason.inboxTargets && reason.inboxTargets.length > 0);
          if (shouldSave) {
            try {
              const perCard = buildPerCardSnapshotForSave(
                res,
                questions,
                selectedByIndex,
                typedAnswersByIndex,
              );
              await saveQuizResultAction({
                deckId,
                deckName,
                teamId: resultTeamId,
                savedFromTeamWorkspace: autoSaveQuizResult || securedEducationSave,
                correct: res.correct,
                incorrect: res.incorrect,
                unanswered: res.unanswered,
                total: res.total,
                percent: res.percent,
                elapsedSeconds: res.elapsedSeconds,
                perCard,
                inboxTargets:
                  securedEducationInboxTargets ??
                  (shouldAutoSaveResult ? undefined : reason.inboxTargets),
                inboxOnly: securedEducationSave,
              });
              setAutoPersisted(true);
              setAutoPersistError(null);
            } catch (err) {
              setAutoPersisted(false);
              setAutoPersistError(
                err instanceof Error ? err.message : "Failed to save result",
              );
            }
          } else {
            setAutoPersisted(false);
            setAutoPersistError(null);
          }
          if (securityEnabled && securitySessionId) {
            await completeQuizSecuritySessionAction({ sessionId: securitySessionId });
            setSecurityStatus("completed");
          }
          revealQuizResult(res);
        } catch (err) {
          setSubmitError(err instanceof Error ? err.message : "Failed to submit quiz");
        }
      });
    },
    [
      result,
      submitting,
      totalSeconds,
      questions,
      selectedByIndex,
      typedAnswersByIndex,
      deckId,
      shouldAutoSaveResult,
      autoSaveQuizResult,
      securedEducationSave,
      securedEducationInboxTargets,
      deckName,
      resultTeamId,
      securityEnabled,
      securitySessionId,
      revealQuizResult,
    ],
  );

  const lockSecuritySession = useCallback(async () => {
    if (
      !securityEnabled ||
      !securitySessionId ||
      !quizStarted ||
      result ||
      securityStatus === "locked" ||
      lockingRef.current ||
      skipSecurityLockOnExitRef.current
    ) {
      return;
    }
    lockingRef.current = true;
    setSecurityLocking(true);
    try {
      const sessionState = buildQuizSessionState(
        questions,
        selectedByIndex,
        typedAnswersByIndex,
        currentIndex,
        remainingSeconds,
      );
      await lockQuizSecuritySessionAction({ sessionId: securitySessionId, sessionState });
      setSecurityStatus("locked");
      setQuizStarted(false);
    } catch {
      // Best-effort lock — UI still pauses locally.
      setSecurityStatus("locked");
      setQuizStarted(false);
    } finally {
      setSecurityLocking(false);
    }
  }, [
    securityEnabled,
    securitySessionId,
    quizStarted,
    result,
    securityStatus,
    questions,
    selectedByIndex,
    typedAnswersByIndex,
    currentIndex,
    remainingSeconds,
  ]);

  useEffect(() => {
    if (!securityEnabled || !quizStarted || result) return;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        void lockSecuritySession();
      }
    };
    const onPageHide = () => {
      void lockSecuritySession();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [securityEnabled, quizStarted, result, lockSecuritySession]);

  useEffect(() => {
    if (quizStarted && startTimeRef.current === 0) {
      startTimeRef.current = Date.now();
    }
  }, [quizStarted]);

  useEffect(() => {
    if (!quizStarted || result || totalQuestions === 0) return;
    const id = window.setInterval(() => {
      setRemainingSeconds((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [quizStarted, result, totalQuestions]);

  useEffect(() => {
    if (
      !quizStarted ||
      remainingSeconds !== 0 ||
      result ||
      totalQuestions === 0
    ) {
      return;
    }
    if (securityEnabled) {
      submitQuiz({ timedOut: true });
      return;
    }
    if (!timeoutPromptShownRef.current) {
      timeoutPromptShownRef.current = true;
      openSubmitChoiceDialog(true);
    }
  }, [
    quizStarted,
    remainingSeconds,
    result,
    totalQuestions,
    submitQuiz,
    securityEnabled,
    ownerInboxAvailable,
  ]);

  function openSubmitChoiceDialog(timedOut: boolean) {
    setSubmitChoiceTimedOut(timedOut);
    setSaveToUserInbox(true);
    setSaveToOwnerInbox(ownerInboxAvailable);
    setSubmitChoiceDialogOpen(true);
  }

  function buildSubmitInboxTargets(): QuizResultInboxTarget[] {
    const targets: QuizResultInboxTarget[] = [];
    if (saveToUserInbox) targets.push("user");
    if (ownerInboxAvailable && saveToOwnerInbox) targets.push("owner");
    return targets;
  }

  function handleSubmitChoiceViewOnly() {
    submitQuiz({ timedOut: submitChoiceTimedOut, saveResult: false });
  }

  function handleSubmitChoiceSaveAndView() {
    const inboxTargets = buildSubmitInboxTargets();
    if (inboxTargets.length === 0) return;
    submitQuiz({ timedOut: submitChoiceTimedOut, saveResult: true, inboxTargets });
  }

  function submitChoiceDialogTitle(): string {
    if (submitChoiceTimedOut) return "Time's up — submit your quiz?";
    if (unansweredCount > 0) {
      return `Submit with ${unansweredCount} unanswered ${unansweredCount === 1 ? "question" : "questions"}?`;
    }
    return "Submit your quiz?";
  }

  function submitChoiceDialogDescription(): string {
    if (submitChoiceTimedOut) {
      if (unansweredCount > 0) {
        return `${unansweredCount} unanswered ${unansweredCount === 1 ? "question" : "questions"} will count as incorrect. Choose whether to save this result before viewing your score.`;
      }
      return "Your time has run out. Choose whether to save this result before viewing your score.";
    }
    if (unansweredCount > 0) {
      return "Unanswered questions will be counted as incorrect. You can go back and answer them first, or submit now and choose where to save your result.";
    }
    return "Choose whether to save this result before viewing your score.";
  }

  function handleTypedAnswer(value: string) {
    setTypedAnswersByIndex((prev) => {
      const next = [...prev];
      next[currentIndex] = value;
      return next;
    });
  }

  function handleSelect(optionIndex: number) {
    setSelectedByIndex((prev) => {
      const next = [...prev];
      next[currentIndex] = optionIndex;
      return next;
    });
  }

  function goPrev() {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  }
  function goNext() {
    if (currentIndex < totalQuestions - 1) setCurrentIndex((i) => i + 1);
  }

  function handleFinishRequest() {
    if (securityEnabled) {
      if (unansweredCount > 0) {
        setConfirmOpen(true);
        return;
      }
      submitQuiz({ timedOut: false });
      return;
    }
    openSubmitChoiceDialog(false);
  }

  async function handleStartQuiz() {
    if (securityEnabled && quizSecurity) {
      const sessionState = buildQuizSessionState(
        questions,
        selectedByIndex,
        typedAnswersByIndex,
        currentIndex,
        remainingSeconds,
      );
      try {
        const session = await startQuizSecuritySessionAction({
          teamId: quizSecurity.teamId,
          deckId,
          deckName,
          sessionState,
        });
        if (session) {
          setSecuritySessionId(session.id);
          setSecurityStatus(session.status);
        }
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Could not start secured quiz");
        return;
      }
    }
    startTimeRef.current = Date.now();
    // Keep remaining time when resuming a server session or after Cancel → lobby.
    if (!restoredState && !returnedToLobby) {
      setRemainingSeconds(totalSeconds);
    }
    setReturnedToLobby(false);
    setQuizStarted(true);
  }

  async function handleReshuffleCardOrder() {
    const shuffleTeamId = quizSecurity?.teamId ?? teamId;
    if (!canReshuffleCardOrder || shuffleTeamId == null) return;
    setCardOrderReshuffling(true);
    setCardOrderMessage(null);
    try {
      const result = await shuffleDeckQuizCardOrdersAction({
        teamId: shuffleTeamId,
        deckId,
      });
      setCardOrderShuffledAtLocal(result.shuffledAt);
      setCardOrderMessage(
        `Card order reshuffled for ${result.viewerCount} viewer${result.viewerCount === 1 ? "" : "s"}. Refreshing…`,
      );
      router.refresh();
    } catch (e) {
      setCardOrderMessage(
        e instanceof Error ? e.message : "Could not reshuffle card order.",
      );
    } finally {
      setCardOrderReshuffling(false);
    }
  }

  async function handleCancelToLobby() {
    setConfirmOpen(false);
    if (securityEnabled && quizSecurity) {
      const sessionState = buildQuizSessionState(
        questions,
        selectedByIndex,
        typedAnswersByIndex,
        currentIndex,
        remainingSeconds,
      );
      try {
        const session = await startQuizSecuritySessionAction({
          teamId: quizSecurity.teamId,
          deckId,
          deckName,
          sessionState,
        });
        if (session) {
          setSecuritySessionId(session.id);
          setSecurityStatus(session.status);
        }
      } catch {
        // Still return to lobby; progress is kept in local state.
      }
    }
    setReturnedToLobby(true);
    setQuizStarted(false);
  }

  function handleRetake() {
    if (securityEnabled) return;
    const fresh = buildQuestions();
    setQuestions(fresh);
    setSelectedByIndex(Array(fresh.length).fill(null));
    setTypedAnswersByIndex(Array(fresh.length).fill(null));
    setCurrentIndex(0);
    setResult(null);
    setSubmitError(null);
    setAutoPersisted(false);
    setAutoPersistError(null);
    setQuizStarted(false);
    startTimeRef.current = 0;
    setRemainingSeconds(quizDurationSeconds ?? getQuizDurationSeconds(fresh.length));
    timeoutPromptShownRef.current = false;
    setSubmitChoiceDialogOpen(false);
  }

  const quizSubmitDialogs = (
    <>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md mx-4 sm:mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              Submit with {unansweredCount} unanswered{" "}
              {unansweredCount === 1 ? "question" : "questions"}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              Unanswered questions will be counted as incorrect. You can go
              back and answer them first, or submit now to see your score.
              {securedEducationSave
                ? " Your result will be saved to the in-app inbox for you, the workspace owner, and team admins."
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            {allowQuizCancelExit ? (
              <Button
                type="button"
                variant="ghost"
                className="w-full sm:w-auto"
                disabled={submitting}
                onClick={() => {
                  void handleCancelToLobby();
                }}
              >
                Cancel
              </Button>
            ) : null}
            <AlertDialogCancel className="w-full sm:w-auto">
              Keep answering
            </AlertDialogCancel>
            <AlertDialogAction
              className="w-full sm:w-auto"
              disabled={submitting}
              onClick={() => {
                setConfirmOpen(false);
                submitQuiz({ timedOut: false });
              }}
            >
              {submitting ? "Submitting…" : "Submit anyway"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={submitChoiceDialogOpen}
        onOpenChange={setSubmitChoiceDialogOpen}
      >
        <DialogContent
          className="w-[calc(100vw-2rem)] max-w-md mx-4 sm:mx-auto sm:max-w-md"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              {submitChoiceDialogTitle()}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-left">
              {submitChoiceDialogDescription()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-lg border border-border/80 bg-muted/15 p-3 text-left">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Save result to
            </p>
            <div className="flex items-start gap-2">
              <Checkbox
                id="submit-save-user-inbox"
                checked={saveToUserInbox}
                onCheckedChange={(checked) => setSaveToUserInbox(checked === true)}
              />
              <Label htmlFor="submit-save-user-inbox" className="text-sm font-normal leading-snug">
                My inbox
              </Label>
            </div>
            {ownerInboxAvailable ? (
              <div className="flex items-start gap-2">
                <Checkbox
                  id="submit-save-owner-inbox"
                  checked={saveToOwnerInbox}
                  onCheckedChange={(checked) => setSaveToOwnerInbox(checked === true)}
                />
                <Label
                  htmlFor="submit-save-owner-inbox"
                  className="text-sm font-normal leading-snug"
                >
                  Workspace owner inbox
                </Label>
              </div>
            ) : null}
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 sm:justify-end">
            {!submitChoiceTimedOut ? (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={submitting}
                onClick={() => setSubmitChoiceDialogOpen(false)}
              >
                Keep answering
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={submitting}
              onClick={handleSubmitChoiceViewOnly}
            >
              View results only
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={submitting || buildSubmitInboxTargets().length === 0}
              onClick={handleSubmitChoiceSaveAndView}
            >
              {submitting ? "Submitting…" : "Save & view results"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  let quizBody: ReactNode;

  if (result) {
    quizBody = (
      <QuizResultCard
        result={result}
        questions={questions}
        selectedByIndex={selectedByIndex}
        typedAnswersByIndex={typedAnswersByIndex}
        deckId={deckId}
        deckName={deckName}
        teamId={teamId}
        deckGradient={deckGradient}
        autoSaveQuizResult={shouldAutoSaveResult}
        autoPersisted={autoPersisted}
        autoPersistError={autoPersistError}
        onRetake={handleRetake}
        onBack={leaveStudy}
        backLabel={exitLabel}
        allowRetake={!securityEnabled}
        hideSaveResult={shouldAutoSaveResult}
        securedQuiz={securityEnabled}
      />
    );
  } else if (isSecurityTerminated || isSecurityCompleted) {
    const isTerminated = isSecurityTerminated;
    quizBody = (
      <div className="flex flex-1 items-center justify-center px-4 py-6">
        <Card className="w-full max-w-md shadow-md">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">
              {isTerminated ? "Quiz terminated" : "Quiz already completed"}
            </CardTitle>
            <CardDescription className="text-balance">
              {isTerminated
                ? "This quiz was ended by your team admin. Check your inbox for details and await team feedback before trying again."
                : "You already finished this quiz. Retakes are not allowed for this deck."}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            {isTerminated ? (
              <Button variant="secondary" onClick={() => router.refresh()}>
                Check for access
              </Button>
            ) : null}
            <Button variant="outline" onClick={leaveStudy}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {exitLabel}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  } else if (isSecurityLocked) {
    quizBody = (
      <div className="flex flex-1 items-center justify-center px-4 py-6">
        <Card className="w-full max-w-md shadow-md">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
              <Lock className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">Quiz paused</CardTitle>
            <CardDescription className="text-balance">
              You left the quiz window. Your session is locked until your team admin grants access.
              {securityLocking ? " Saving your progress…" : null}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button variant="secondary" onClick={() => router.refresh()}>
              Check for access
            </Button>
            <Button variant="outline" onClick={leaveStudy}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {exitLabel}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  } else if (totalQuestions === 0) {
    quizBody = (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-md text-center flex flex-col gap-3">
          <CircleHelp className="h-10 w-10 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-semibold">No quiz questions available</h3>
          <p className="text-sm text-muted-foreground">
            Quiz mode needs cards with a text answer. Add a few cards with a
            written back, or generate multiple-choice cards, then come back.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="self-center gap-2"
            onClick={leaveStudy}
          >
            <ArrowLeft className="h-4 w-4" />
            {exitLabel}
          </Button>
        </div>
      </div>
    );
  } else if (!quizStarted) {
    quizBody = (
      <div
        className="flex flex-1 items-center justify-center px-4 py-6"
        style={deckAccentCss}
      >
        <Card className="relative w-full max-w-lg shadow-md">
          {securityEnabled ? (
            <Tooltip>
              <TooltipTrigger
                type="button"
                className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-emerald-400"
                aria-label="Quiz security is on for members"
              >
                <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
                </span>
                <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="text-[11px] font-medium leading-none tracking-wide">
                  Security on
                </span>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs text-left">
                Quiz security is on for normal members. Stay on this tab until you submit — leaving
                will lock your session.
              </TooltipContent>
            </Tooltip>
          ) : null}
          <CardHeader className="text-center">
            <div
              className={cn(
                "mx-auto flex h-12 w-12 items-center justify-center rounded-full",
                !deckAccent.hasDeckAccent && "bg-primary/15 text-primary",
              )}
              style={
                deckAccent.hasDeckAccent && deckAccent.accent && deckAccent.accentForeground
                  ? { backgroundColor: deckAccent.accent, color: deckAccent.accentForeground }
                  : undefined
              }
            >
              <ListChecks className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">
              {grantedResume ? "Resume quiz" : grantedFreshStart ? "Start over" : "Timed quiz"}
            </CardTitle>
            <CardDescription className="text-balance space-y-1">
              <span className="block font-medium text-foreground">{deckName}</span>
              {deckDescription?.trim() ? (
                <span className="block text-muted-foreground">{deckDescription.trim()}</span>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-center text-sm text-muted-foreground">
            <p>
              {totalQuestions} question{totalQuestions !== 1 ? "s" : ""} ·{" "}
              <span className="tabular-nums font-medium text-foreground">
                {formatClock(
                  grantedResume ? remainingSeconds : (restoredState?.remainingSeconds ?? totalSeconds),
                )}
              </span>{" "}
              on the clock
            </p>
            {enabledFormats.length > 0 ? (
              <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-3 text-left">
                <p className="text-center text-xs font-medium text-foreground">
                  Question formats in this quiz
                </p>
                <div className="flex flex-col gap-2">
                  {enabledFormats.map((formatKey) => {
                    const Icon = QUIZ_FORMAT_ICONS[formatKey];
                    const meta = QUIZ_FORMAT_META[formatKey];
                    return (
                      <div
                        key={formatKey}
                        className="flex items-start gap-2.5 rounded-md border border-border/50 bg-background/40 px-2.5 py-2"
                      >
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                          <Icon className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <span className="min-w-0 text-left">
                          <span className="block text-xs font-medium text-foreground">
                            {meta.label}
                          </span>
                          <span className="block text-[11px] leading-snug text-muted-foreground">
                            {meta.description}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
                {sessionFormatSummary ? (
                  <p className="text-center text-[11px] text-muted-foreground">
                    {sessionFormatSummary}
                  </p>
                ) : null}
              </div>
            ) : null}
            {cardOrderShuffledAtLocal ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-left">
                <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                  <Shuffle className="size-3.5 shrink-0" aria-hidden />
                  Question order shuffled for members
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Each assignee gets a unique card sequence. Last shuffled{" "}
                  {new Date(cardOrderShuffledAtLocal).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  .
                </p>
                {cardOrderMessage ? (
                  <p className="mt-1 text-[11px] text-muted-foreground" role="status">
                    {cardOrderMessage}
                  </p>
                ) : null}
              </div>
            ) : null}
            {securityEnabled ? (
              <p className="text-xs text-amber-400/90">
                Quiz security is on. Stay on this tab until you submit — leaving will lock your
                session.
              </p>
            ) : null}
            {scheduleBlocksStart && activeSchedule ? (
              <p className="text-xs text-amber-400/90">
                This quiz unlocks at {formatQuizStartSchedule(activeSchedule.startAt)} (
                {activeSchedule.source === "deck" ? "deck schedule" : "workspace schedule"}). Time
                remaining:{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {formatCountdown(scheduleSecondsRemaining)}
                </span>
              </p>
            ) : null}
            <p className="text-xs">
              {grantedResume
                ? securityStatus === "active" || initialSession?.status === "active"
                  ? "You have an in-progress quiz. Press start to continue where you left off. The timer resumes after you start."
                  : "Your team admin granted access. Press start to continue where you left off."
                : grantedFreshStart
                  ? "Your team admin granted access to start this quiz over from the beginning."
                  : scheduleBlocksStart
                    ? "The start button unlocks when the scheduled time arrives."
                    : "Press start when you are ready. The timer begins only after you start."}
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            {canStartQuiz ? (
              <Button
                size="default"
                className={cn(
                  "w-full gap-2 sm:w-auto sm:min-w-40",
                  deckAccent.hasDeckAccent &&
                    "!bg-[var(--deck-accent)] !text-[var(--deck-accent-fg)] hover:opacity-90 border-transparent",
                )}
                onClick={handleStartQuiz}
              >
                <Play className="h-4 w-4" />
                {grantedResume
                  ? "Resume quiz"
                  : grantedFreshStart
                    ? "Start over"
                    : "Start quiz"}
              </Button>
            ) : null}
            {quizFormatEditorSnapshot ? (
              <FormatQuizQuestionButton
                deckId={deckId}
                deckName={deckName}
                deckDescription={deckDescription}
                snapshot={quizFormatEditorSnapshot}
                cards={preparedCards}
                onPublished={() => router.refresh()}
              />
            ) : null}
            {canReshuffleCardOrder && (quizSecurity?.teamId ?? teamId) != null ? (
              <Button
                type="button"
                variant="outline"
                size="default"
                className="w-full gap-2 sm:w-auto"
                disabled={cardOrderReshuffling || quizStarted}
                onClick={() => void handleReshuffleCardOrder()}
              >
                <Shuffle className="h-4 w-4" />
                {cardOrderReshuffling
                  ? "Reshuffling…"
                  : cardOrderShuffledAtLocal
                    ? "Reshuffle order"
                    : "Shuffle order"}
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="default"
              className="w-full gap-2 sm:w-auto"
              onClick={leaveStudy}
            >
              <ArrowLeft className="h-4 w-4" />
              {exitLabel}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  } else {
  const current = questions[currentIndex]!;
  const selectedForCurrent = selectedByIndex[currentIndex];
  const typedForCurrent = typedAnswersByIndex[currentIndex] ?? "";
  const promptText = questionPromptText(current);
  const answerHint =
    current.type === "true_false"
      ? "True or false"
      : current.type === "fill_in_blank"
        ? "Type the missing word or phrase"
        : "Select the best answer";
  const choiceOptions =
    current.type === "true_false" ? trueFalseOptions() : current.type === "multiple_choice" ? current.options : [];
  const choiceOptionImages =
    current.type === "multiple_choice" ? current.optionImageUrls : [];
  const timerWarning = remainingSeconds <= 60;
  const timerCritical = remainingSeconds <= 30;

  quizBody = (
    <div
      className="flex flex-1 flex-col items-center gap-4 sm:gap-6 w-full min-w-0"
      style={deckAccentCss}
    >
      <div className="w-full max-w-2xl flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-sm sm:text-base ${
                timerCritical
                  ? "border-rose-500/50 bg-rose-500/10 text-rose-400 animate-pulse"
                  : timerWarning
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                    : "border-border bg-muted/30 text-foreground"
              }`}
              aria-label="Time remaining"
            >
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              {formatClock(remainingSeconds)}
            </div>
            {hasAiReading ? <VoiceSelector voice={voice} onChange={setVoice} /> : null}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
            <span>
              Question{" "}
              <span className="font-semibold text-foreground">{currentIndex + 1}</span> of{" "}
              {totalQuestions}
            </span>
            <span className="hidden sm:inline">·</span>
            <span>
              <span className="font-semibold text-foreground">{answeredCount}</span>{" "}
              answered
            </span>
          </div>
        </div>
        <Progress
          value={progressPercent}
          className={cn(
            "h-2",
            deckAccent.hasDeckAccent &&
              "[&_[data-slot=progress-indicator]]:!bg-[var(--deck-accent)]",
          )}
        />
        <div className="flex flex-wrap gap-1.5">
          {questions.map((_, i) => {
            const isCurrent = i === currentIndex;
            const isAnswered = isQuizQuestionAnswered(
              questions[i]!,
              selectedByIndex[i] ?? null,
              typedAnswersByIndex[i] ?? null,
            );
            const answeredDeckStyle: CSSProperties | undefined =
              deckAccent.hasDeckAccent && deckAccent.accent && !isCurrent && isAnswered
                ? {
                    borderColor: `color-mix(in srgb, ${deckAccent.accent} 52%, transparent)`,
                    backgroundColor: `color-mix(in srgb, ${deckAccent.accent} 20%, transparent)`,
                    color: `color-mix(in srgb, ${deckAccent.accent} 72%, #ffffff)`,
                  }
                : undefined;
            const currentDeckStyle: CSSProperties | undefined =
              deckAccent.hasDeckAccent &&
              deckAccent.accent &&
              deckAccent.accentForeground &&
              isCurrent
                ? {
                    backgroundColor: deckAccent.accent,
                    color: deckAccent.accentForeground,
                    borderColor: "transparent",
                  }
                : undefined;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIndex(i)}
                className={cn(
                  "h-6 w-6 sm:h-7 sm:w-7 rounded-md border text-[10px] sm:text-xs font-semibold transition-colors",
                  isCurrent &&
                    !deckAccent.hasDeckAccent &&
                    "border-primary bg-primary text-primary-foreground",
                  isCurrent && deckAccent.hasDeckAccent && "border-transparent",
                  !isCurrent &&
                    isAnswered &&
                    !deckAccent.hasDeckAccent &&
                    "border-emerald-500/50 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25",
                  !isCurrent &&
                    isAnswered &&
                    deckAccent.hasDeckAccent &&
                    "hover:opacity-95 border",
                  !isCurrent &&
                    !isAnswered &&
                    "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50",
                )}
                style={isCurrent ? currentDeckStyle : answeredDeckStyle}
                aria-label={`Go to question ${i + 1}${isAnswered ? " (answered)" : ""}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={cn(
          "w-full max-w-2xl rounded-xl sm:rounded-2xl border shadow-md overflow-hidden",
          deckAccent.hasDeckAccent
            ? cn(deckAccent.gradient.classes, "border-white/20")
            : "bg-card border-border",
        )}
      >
        <div className="flex items-center justify-between px-3 sm:px-5 pt-3 sm:pt-4 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                deckAccent.hasDeckAccent && "border border-white/30 bg-white/20 text-white",
              )}
            >
              Question {currentIndex + 1}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                deckAccent.hasDeckAccent && "border-white/30 bg-white/10 text-white",
              )}
            >
              {questionTypeLabel(current.type)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-xs hidden sm:inline",
                deckAccent.hasDeckAccent ? "text-white/70" : "text-muted-foreground",
              )}
            >
              {answerHint}
            </span>
            {promptText && hasAiReading ? (
              <SpeakButton text={promptText} voice={voice} stopKey={currentIndex} />
            ) : null}
          </div>
        </div>
        {current.questionImageUrl && (
          <div className="px-3 sm:px-6 pb-2">
            <div
              className={cn(
                "relative w-full h-40 sm:h-60 md:h-72 rounded-lg overflow-hidden border bg-muted/20 shadow-inner",
                deckAccent.hasDeckAccent ? "border-white/25" : "border-border",
              )}
            >
              <Image
                src={current.questionImageUrl}
                alt="Question image"
                fill
                className="object-contain p-2 sm:p-3"
              />
            </div>
          </div>
        )}
        <div className="px-4 sm:px-8 py-5 sm:py-6">
          {current.type === "fill_in_blank" ? (
            <div
              className={cn(
                "flex flex-wrap items-center justify-center gap-x-1 gap-y-2 text-base sm:text-xl font-semibold leading-relaxed break-words",
                deckAccent.hasDeckAccent && "text-white",
              )}
            >
              {current.segments.map((seg, segIdx) =>
                seg.type === "text" ? (
                  <span key={`${current.cardId}-t-${segIdx}`}>{seg.value}</span>
                ) : (
                  <Input
                    key={`${current.cardId}-b-${segIdx}`}
                    value={typedForCurrent}
                    onChange={(e) => handleTypedAnswer(e.target.value)}
                    className={cn(
                      "inline-flex h-10 min-w-[7rem] max-w-[12rem] sm:max-w-xs text-center font-semibold",
                      deckAccent.hasDeckAccent &&
                        "border-white/40 bg-white/10 text-white placeholder:text-white/50",
                    )}
                    aria-label="Fill in the blank"
                    autoComplete="off"
                  />
                ),
              )}
            </div>
          ) : current.type === "true_false" ? (
            <FormattedCardFront
              text={current.statement}
              variant="quiz"
              hasGradient={deckAccent.hasDeckAccent}
            />
          ) : current.question ? (
            <FormattedCardFront
              text={current.question}
              variant="quiz"
              hasGradient={deckAccent.hasDeckAccent}
            />
          ) : (
            <p
              className={cn(
                "text-center text-sm",
                deckAccent.hasDeckAccent ? "text-white/75" : "text-muted-foreground",
              )}
            >
              (Image only)
            </p>
          )}
        </div>
      </div>

      {current.type !== "fill_in_blank" ? (
      <div
        className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3"
        role="radiogroup"
        aria-label="Answer options"
      >
        {choiceOptions.map((text, i) => {
          const isSelected = selectedForCurrent === i;
          const displayText = formatQuizOptionForDisplay(text);
          const optionImageUrl =
            current.type === "multiple_choice" ? choiceOptionImages[i] ?? null : null;
          const hasOptionText = displayText.trim().length > 0;
          return (
            <div key={`${current.cardId}-${i}`} className="flex items-center gap-1.5">
              <Button
                variant={isSelected ? "default" : "outline"}
                role="radio"
                aria-checked={isSelected}
                className={cn(
                  "flex-1 justify-start text-left h-auto py-3 px-4 whitespace-normal break-words",
                  isSelected ? "" : "hover:bg-muted/50",
                  deckAccent.hasDeckAccent &&
                    isSelected &&
                    "!bg-[var(--deck-accent)] !text-[var(--deck-accent-fg)] hover:opacity-90 border-transparent",
                )}
                onClick={() => handleSelect(i)}
              >
                <span className="flex items-start gap-2.5 w-full">
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                      isSelected &&
                        (deckAccent.hasDeckAccent
                          ? "border-[var(--deck-accent-fg)] bg-[var(--deck-accent-fg)] text-[var(--deck-accent)]"
                          : "border-primary-foreground bg-primary-foreground text-primary"),
                      !isSelected && "border-muted-foreground/40 bg-transparent",
                    )}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-2">
                    {optionImageUrl ? (
                      <span className="relative block h-24 w-full max-w-xs overflow-hidden rounded-md border border-border/60 bg-muted/20">
                        <Image
                          src={optionImageUrl}
                          alt=""
                          fill
                          className="object-contain"
                          sizes="240px"
                        />
                      </span>
                    ) : null}
                    {hasOptionText ? (
                      <span className="break-words font-normal text-sm sm:text-base leading-relaxed">
                        {polishCardText(displayText)}
                      </span>
                    ) : optionImageUrl ? (
                      <span className="text-xs text-muted-foreground">(Image answer)</span>
                    ) : null}
                  </span>
                </span>
              </Button>
              {hasAiReading && hasOptionText ? (
                <SpeakButton text={displayText} voice={voice} stopKey={currentIndex} />
              ) : null}
            </div>
          );
        })}
      </div>
      ) : null}

      <div className="w-full max-w-2xl flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
        <Button
          variant="outline"
          size="default"
          className="gap-1 sm:gap-2 h-10 sm:h-11 px-3 sm:px-4 text-xs sm:text-sm"
          onClick={goPrev}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        <Button
          size="default"
          className={cn(
            "gap-2 h-10 sm:h-11 px-4 sm:px-6 text-sm",
            deckAccent.hasDeckAccent &&
              "!bg-[var(--deck-accent)] !text-[var(--deck-accent-fg)] hover:opacity-90 border-transparent",
          )}
          onClick={handleFinishRequest}
          disabled={submitting}
        >
          <Flag className="h-4 w-4" />
          {submitting ? "Submitting…" : "Finish Quiz"}
        </Button>

        <Button
          variant="outline"
          size="default"
          className="gap-1 sm:gap-2 h-10 sm:h-11 px-3 sm:px-4 text-xs sm:text-sm"
          onClick={goNext}
          disabled={currentIndex === totalQuestions - 1}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
      </div>

      {submitError && (
        <div className="w-full max-w-2xl flex flex-col items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-center">
          <p className="text-sm text-destructive">{submitError}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => submitQuiz({ timedOut: false })}
            disabled={submitting}
          >
            Retry submission
          </Button>
        </div>
      )}
    </div>
  );
  }

  return (
    <>
      {quizBody}
      {quizSubmitDialogs}
    </>
  );
}

function QuizResultCard({
  result,
  questions,
  selectedByIndex,
  typedAnswersByIndex,
  deckId,
  deckName,
  teamId,
  deckGradient,
  autoSaveQuizResult,
  autoPersisted,
  autoPersistError,
  onRetake,
  onBack,
  backLabel = "Back to Deck",
  allowRetake = true,
  hideSaveResult = false,
  securedQuiz = false,
}: {
  result: QuizResult;
  questions: QuizQuestion[];
  selectedByIndex: (number | null)[];
  typedAnswersByIndex: (string | null)[];
  deckId: number;
  deckName: string;
  teamId: number | null;
  deckGradient: string | null;
  autoSaveQuizResult: boolean;
  autoPersisted: boolean;
  autoPersistError: string | null;
  onRetake: () => void;
  onBack: () => void;
  backLabel?: string;
  allowRetake?: boolean;
  hideSaveResult?: boolean;
  securedQuiz?: boolean;
}) {
  const { percent, correct, incorrect, unanswered, total, tier, quote, elapsedSeconds, timedOut } =
    result;

  const resultAccent = useMemo(() => getDeckQuizAccent(deckGradient), [deckGradient]);
  const resultAccentCss =
    resultAccent.hasDeckAccent && resultAccent.accent && resultAccent.accentForeground
      ? ({
          "--deck-accent": resultAccent.accent,
          "--deck-accent-fg": resultAccent.accentForeground,
        } as CSSProperties)
      : undefined;

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(() => autoSaveQuizResult && autoPersisted);
  const [saveError, setSaveError] = useState<string | null>(() =>
    autoPersistError && (autoSaveQuizResult || hideSaveResult) ? autoPersistError : null,
  );

  const perCardSnapshot = useMemo(
    () =>
      buildPerCardSnapshotForSave(result, questions, selectedByIndex, typedAnswersByIndex),
    [questions, selectedByIndex, typedAnswersByIndex, result],
  );

  function handleSaveConfirm() {
    startSaving(async () => {
      try {
        setSaveError(null);
        await saveQuizResultAction({
          deckId,
          deckName,
          teamId,
          savedFromTeamWorkspace: autoSaveQuizResult,
          correct,
          incorrect,
          unanswered,
          total,
          percent,
          elapsedSeconds,
          perCard: perCardSnapshot,
        });
        setSaved(true);
        setSaveDialogOpen(false);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Failed to save result");
      }
    });
  }

  const tierStyles: Record<
    typeof tier,
    { heading: string; color: string; accent: string; Icon: typeof Trophy }
  > = {
    low: {
      heading: "Keep Going — You're Building It",
      color: "text-purple-400",
      accent: "from-purple-500/10 to-purple-500/0",
      Icon: HeartHandshake,
    },
    mid: {
      heading: "Nice Progress!",
      color: "text-blue-400",
      accent: "from-blue-500/10 to-blue-500/0",
      Icon: Sparkles,
    },
    high: {
      heading: "Outstanding — Victory!",
      color: "text-yellow-500",
      accent: "from-yellow-500/15 to-yellow-500/0",
      Icon: Trophy,
    },
  };
  const style = tierStyles[tier];
  const Icon = style.Icon;
  return (
    <div
      className="flex flex-1 flex-col items-center gap-6 px-2 sm:px-4 py-2 sm:py-4 w-full min-w-0"
      style={resultAccentCss}
    >
      <div
        className={`w-full max-w-xl flex flex-col items-center gap-4 sm:gap-6 rounded-xl sm:rounded-2xl border bg-gradient-to-b ${style.accent} bg-card p-6 sm:p-10 shadow-md text-center`}
      >
        <div className="flex flex-col items-center gap-2">
          <Icon className={`h-10 w-10 sm:h-12 sm:w-12 ${style.color}`} />
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{style.heading}</h2>
          <p className="text-muted-foreground text-sm break-words max-w-full">{deckName}</p>
          {timedOut && (
            <Badge variant="outline" className="mt-1 text-xs gap-1 border-amber-500/40 text-amber-400">
              <Clock className="h-3 w-3" />
              Time ran out
            </Badge>
          )}
        </div>

        <div className="w-full flex flex-col gap-2">
          <div className="flex justify-between text-sm text-muted-foreground mb-1">
            <span>Score</span>
            <span className={`font-semibold ${style.color}`}>{percent} / 100</span>
          </div>
          <Progress value={percent} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Correct cards</span>
            <span className={`font-semibold ${style.color}`}>
              {correct} / {total}
            </span>
          </div>
        </div>

        <div className="w-full grid grid-cols-3 gap-2 sm:gap-3">
          <div className="flex flex-col items-center gap-1 rounded-xl border bg-emerald-500/10 border-emerald-500/20 py-3">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            <span className="text-lg sm:text-xl font-bold text-emerald-500">{correct}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground">Correct</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl border bg-rose-500/10 border-rose-500/20 py-3">
            <XCircle className="h-5 w-5 text-rose-500" />
            <span className="text-lg sm:text-xl font-bold text-rose-500">{incorrect}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground">Incorrect</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl border bg-muted/30 border-border py-3">
            <CircleHelp className="h-5 w-5 text-muted-foreground" />
            <span className="text-lg sm:text-xl font-bold text-foreground">{unanswered}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground">Unanswered</span>
          </div>
        </div>

        <p className="text-muted-foreground text-xs sm:text-sm">
          {total} question{total !== 1 ? "s" : ""} · finished in {formatClock(elapsedSeconds)}
        </p>

        <figure className="w-full rounded-xl border bg-background/50 p-4 text-left">
          <blockquote className={`text-sm sm:text-base italic leading-relaxed ${style.color}`}>
            “{quote.text}”
          </blockquote>
          <figcaption className="mt-2 text-xs text-muted-foreground">
            — {quote.author}
          </figcaption>
        </figure>

        {saveError && (
          <p className="text-xs text-rose-500 text-center">{saveError}</p>
        )}

        {!saved && !autoSaveQuizResult && (
          <p className="text-xs text-muted-foreground text-center px-2">
            Saving is optional. Use Back to deck or Retake to leave without keeping this attempt in your history or
            inbox.
          </p>
        )}

        {!saved && autoSaveQuizResult && saveError && !hideSaveResult ? (
          <p className="text-xs text-muted-foreground text-center px-2">
            Automatic save did not complete. Use Save result below, or try again later.
          </p>
        ) : null}
        {!saved && hideSaveResult && saveError ? (
          <p className="text-xs text-muted-foreground text-center px-2">
            Automatic save did not complete. Your score is shown above; contact your team admin if
            this keeps happening.
          </p>
        ) : null}

        <div className="w-full flex flex-col gap-3">
          {!saved && !hideSaveResult ? (
            <Button
              size="default"
              variant="secondary"
              className="w-full gap-2 h-10 sm:h-11"
              onClick={() => setSaveDialogOpen(true)}
              disabled={saving}
            >
              <BookCheck className="h-4 w-4" />
              Save Result
            </Button>
          ) : saved ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-sm font-medium text-emerald-400">
              <CheckCircle className="h-4 w-4" />
              {securedQuiz
                ? "Result saved — check your inbox; your team owner was notified"
                : autoSaveQuizResult
                  ? "Result saved for your workspace — check your inbox and email"
                  : "Result saved — check your inbox and email"}
            </div>
          ) : null}
          {allowRetake ? (
            <Button
              size="default"
              className={cn(
                "w-full gap-2 h-10 sm:h-11",
                resultAccent.hasDeckAccent &&
                  "!bg-[var(--deck-accent)] !text-[var(--deck-accent-fg)] hover:opacity-90 border-transparent",
              )}
              onClick={onRetake}
            >
              <RotateCcw className="h-4 w-4" />
              Retake Quiz
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="default"
            className="w-full gap-2 h-10 sm:h-11"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Button>
        </div>

        <AlertDialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Save quiz result?</AlertDialogTitle>
              <AlertDialogDescription>
                {teamId
                  ? "Your result will be saved. You and your workspace owner will each get a copy in your app inbox and by email, including a link to view and download the result."
                  : "Your result will be saved. You will get a copy in your inbox and by email with a link to view and download it."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSaveConfirm} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="w-full max-w-xl flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground px-1">Review</h3>
        <ol className="flex flex-col gap-2">
          {perCardSnapshot.map((row, i) => {
            const wasCorrect = row.correct;
            const wasAnswered = row.selectedAnswer !== null;
            const selectedDisplay =
              row.selectedAnswer !== null
                ? formatQuizOptionForDisplay(row.selectedAnswer)
                : null;
            const correctDisplay = formatQuizOptionForDisplay(row.correctAnswer);
            return (
              <li
                key={`${row.cardId}-${i}`}
                className={`rounded-lg border p-3 text-left ${
                  wasCorrect
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : wasAnswered
                      ? "border-rose-500/30 bg-rose-500/5"
                      : "border-border bg-muted/20"
                }`}
              >
                <div className="flex items-start gap-2">
                  {wasCorrect ? (
                    <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : wasAnswered ? (
                    <XCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  ) : (
                    <CircleHelp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <p className="text-xs text-muted-foreground">
                      {formatQuestionWithTypeLabel(i + 1, questions[i]?.type)}
                    </p>
                    <FormattedCardFront
                      text={row.question ?? "(Image only)"}
                      variant="quiz"
                      className="text-sm"
                    />
                    <p className="text-xs break-words">
                      <span className="text-muted-foreground">Your answer: </span>
                      <span
                        className={
                          wasCorrect
                            ? "text-emerald-400"
                            : wasAnswered
                              ? "text-rose-400"
                              : "text-muted-foreground italic"
                        }
                      >
                        {selectedDisplay ?? "Unanswered"}
                      </span>
                    </p>
                    {!wasCorrect && (
                      <p className="text-xs break-words">
                        <span className="text-muted-foreground">Correct answer: </span>
                        <span className="text-emerald-400">{correctDisplay}</span>
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
