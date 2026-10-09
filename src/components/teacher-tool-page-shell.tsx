"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  createContext,
  useContext,
} from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Maximize2, Minimize2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import { dismissOpenOverlays } from "@/lib/dismiss-open-overlays";
import { cn } from "@/lib/utils";

const TeacherPreviewExpandedContext = createContext(false);

export function useTeacherPreviewExpanded() {
  return useContext(TeacherPreviewExpandedContext);
}

export function TeacherToolPageShell({
  title,
  description,
  children,
  result,
  showResult: controlledShowResult,
  onGenerate,
  isGenerating = false,
  generateLabel = "Generate",
  submittingLabel = "Generating…",
  generateTooltip,
  generateWithAiIcon = false,
  previewActions,
  errorMessage,
  footer,
  headerExtra,
  submitDisabled = false,
  backHref = "/teacher",
  onBackClick,
}: {
  title: string;
  description: string;
  children: ReactNode;
  result?: ReactNode;
  showResult?: boolean;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  generateLabel?: string;
  submittingLabel?: string;
  generateTooltip?: string;
  generateWithAiIcon?: boolean;
  previewActions?: ReactNode;
  errorMessage?: string | null;
  footer?: ReactNode;
  headerExtra?: ReactNode;
  submitDisabled?: boolean;
  backHref?: string;
  /** Return false to block navigation (e.g. unsaved deck→lesson sync). */
  onBackClick?: () => boolean;
}) {
  const [internalShowResult, setInternalShowResult] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const showResult = controlledShowResult ?? internalShowResult;
  const shouldShowPreview = showResult && result != null;
  const lastErrorToast = useRef<string | null>(null);

  useEffect(() => {
    if (!errorMessage) {
      lastErrorToast.current = null;
      return;
    }
    if (lastErrorToast.current === errorMessage) return;
    lastErrorToast.current = errorMessage;
    toast.error(errorMessage);
  }, [errorMessage]);

  useEffect(() => {
    if (!shouldShowPreview) setPreviewExpanded(false);
  }, [shouldShowPreview]);

  useEffect(() => {
    if (!previewExpanded) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPreviewExpanded(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewExpanded]);

  useLayoutEffect(() => {
    if (!previewExpanded) return;
    const header = document.querySelector<HTMLElement>("[data-app-header]");
    const root = document.documentElement;
    const apply = () => {
      const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
      const top = Math.max(headerBottom, 0) + 12;
      root.style.setProperty("--teacher-preview-top", `${top}px`);
    };
    apply();
    const observer = header ? new ResizeObserver(apply) : null;
    if (header && observer) observer.observe(header);
    window.addEventListener("resize", apply);
    window.addEventListener("scroll", apply, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", apply);
      window.removeEventListener("scroll", apply);
      root.style.removeProperty("--teacher-preview-top");
    };
  }, [previewExpanded]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dismissOpenOverlays();
    if (onGenerate) {
      await onGenerate();
    }
    if (controlledShowResult === undefined) {
      setInternalShowResult(true);
    }
  }

  const submitButton = (
    <Button
      type="submit"
      size="lg"
      className="gap-2"
      disabled={isGenerating || submitDisabled}
    >
      {isGenerating ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {submittingLabel}
        </>
      ) : (
        <>
          {generateWithAiIcon ? (
            <Sparkles className="size-4 shrink-0" aria-hidden />
          ) : null}
          {generateLabel}
        </>
      )}
    </Button>
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <Card className={cn(teamAdminCardClass, "backdrop-blur-md")}>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <Link
                href={backHref}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-0.5 gap-2 shrink-0")}
                onClick={(event) => {
                  if (onBackClick && onBackClick() === false) {
                    event.preventDefault();
                  }
                }}
              >
                <ArrowLeft className="size-4" aria-hidden />
                Back
              </Link>
              <div className="min-w-0 space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Teacher tool
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            </div>
            {headerExtra}
          </div>
        </CardHeader>
      </Card>

      <Card className={cn(teamAdminCardClass, "backdrop-blur-sm")}>
        <CardHeader>
          <CardTitle className="text-base">Input</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {children}
            {errorMessage ? (
              <p className="text-sm text-destructive" role="alert">
                {errorMessage}
              </p>
            ) : null}
            {generateTooltip ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span
                        className={cn(
                          "inline-flex",
                          (isGenerating || submitDisabled) && "cursor-not-allowed",
                        )}
                      />
                    }
                  >
                    {submitButton}
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-center">
                    {generateTooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              submitButton
            )}
          </form>
        </CardContent>
      </Card>

      {footer}

      {previewExpanded ? (
        <Button
          type="button"
          variant="ghost"
          className="fixed inset-x-0 bottom-0 z-40 h-auto w-auto max-w-none rounded-none bg-background/80 p-0 hover:bg-background/80"
          style={{ top: "var(--teacher-preview-top, 4.5rem)" }}
          aria-label="Collapse preview"
          onClick={() => setPreviewExpanded(false)}
        />
      ) : null}

      <Card
        className={cn(
          teamAdminCardClass,
          "backdrop-blur-sm",
          !shouldShowPreview && "hidden",
          previewExpanded &&
            "fixed inset-x-3 bottom-3 z-50 flex flex-col overflow-hidden shadow-2xl sm:inset-x-6 sm:bottom-6",
        )}
        style={
          previewExpanded
            ? { top: "var(--teacher-preview-top, 4.5rem)" }
            : undefined
        }
        aria-hidden={!shouldShowPreview}
      >
        <CardHeader className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Preview</CardTitle>
            {shouldShowPreview ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setPreviewExpanded((open) => !open)}
              >
                {previewExpanded ? (
                  <Minimize2 className="size-4" aria-hidden />
                ) : (
                  <Maximize2 className="size-4" aria-hidden />
                )}
                {previewExpanded ? "Collapse" : "Expand"}
              </Button>
            ) : null}
          </div>
          {previewActions ? (
            <div className="flex flex-wrap gap-2">{previewActions}</div>
          ) : null}
        </CardHeader>
        <CardContent
          className={cn(
            "space-y-3 text-sm leading-relaxed text-muted-foreground",
            previewExpanded && "min-h-0 flex-1 overflow-y-auto",
          )}
        >
          <TeacherPreviewExpandedContext.Provider value={previewExpanded}>
            {result}
          </TeacherPreviewExpandedContext.Provider>
        </CardContent>
      </Card>
    </div>
  );
}
