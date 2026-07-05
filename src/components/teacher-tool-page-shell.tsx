"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import { cn } from "@/lib/utils";

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
}) {
  const [internalShowResult, setInternalShowResult] = useState(false);
  const showResult = controlledShowResult ?? internalShowResult;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

      {showResult && result ? (
        <Card className={cn(teamAdminCardClass, "backdrop-blur-sm")}>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Preview</CardTitle>
            {previewActions ? (
              <div className="flex flex-wrap gap-2">{previewActions}</div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            {result}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
