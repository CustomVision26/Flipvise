"use client";

import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function TeacherHelpBalloon({
  label,
  help,
  side = "right",
  className,
}: {
  label: string;
  help: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className={cn(
          "text-muted-foreground transition-colors hover:text-foreground",
          className,
        )}
        aria-label={`Help for ${label}`}
      >
        <HelpCircle className="size-3.5 shrink-0" aria-hidden />
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed">
        {help}
      </TooltipContent>
    </Tooltip>
  );
}

export function TeacherFieldLabel({
  htmlFor,
  label,
  help,
}: {
  htmlFor: string;
  label: string;
  help: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor} className="text-sm">
        {label}
      </Label>
      <TeacherHelpBalloon label={label} help={help} />
    </div>
  );
}

/** Compact uppercase label + help balloon for card review panels. */
export function TeacherReviewFieldLabel({
  label,
  help,
  htmlFor,
  className,
}: {
  label: string;
  help: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  const labelClassName = cn(
    "text-[10px] uppercase tracking-wide text-muted-foreground",
    className,
  );

  return (
    <div className="flex items-center gap-1">
      {htmlFor ? (
        <Label htmlFor={htmlFor} className={labelClassName}>
          {label}
        </Label>
      ) : (
        <span className={labelClassName}>{label}</span>
      )}
      <TeacherHelpBalloon label={label} help={help} side="top" />
    </div>
  );
}
