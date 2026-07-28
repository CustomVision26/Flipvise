"use client";

import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LESSON_PLAN_DAY_SCOPE_ALL,
  parseLessonPlanDayScopeRadioValue,
  type LessonPlanDayScope,
  type LessonPlanDayScopeOption,
} from "@/lib/lesson-plan-day-scope";

const DEFAULT_DESCRIPTION =
  "All Days uses the full multi-day plan. A single day uses only that day’s vocabulary, daily focus, and class outline.";

const DEFAULT_INFO_TOOLTIP =
  "Generation is limited to the scope you pick. Choose All Days for coverage across the unit, or one day when you want content tied to that session only.";

export function LessonPlanDayScopeDialog({
  open,
  onOpenChange,
  options,
  onConfirm,
  confirmLabel = "Generate",
  title = "Which part of the lesson plan?",
  description = DEFAULT_DESCRIPTION,
  infoTooltip = DEFAULT_INFO_TOOLTIP,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: LessonPlanDayScopeOption[];
  onConfirm: (scope: LessonPlanDayScope) => void;
  confirmLabel?: string;
  title?: string;
  description?: string;
  infoTooltip?: string;
}) {
  const [selectedValue, setSelectedValue] = useState<string>(LESSON_PLAN_DAY_SCOPE_ALL);

  useEffect(() => {
    if (!open) return;
    setSelectedValue(
      options[0]?.value ?? LESSON_PLAN_DAY_SCOPE_ALL,
    );
  }, [open, options]);

  function handleConfirm() {
    const matched = options.find((option) => option.value === selectedValue);
    if (matched) {
      onConfirm(matched.scope);
      return;
    }
    const parsed = parseLessonPlanDayScopeRadioValue(selectedValue);
    onConfirm(parsed ?? LESSON_PLAN_DAY_SCOPE_ALL);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5 pr-6">
            <span>{title}</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  className="inline-flex shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="About lesson plan day scope"
                >
                  <HelpCircle className="h-4 w-4" aria-hidden />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  {infoTooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={selectedValue}
          onValueChange={(value) => {
            if (value != null) setSelectedValue(value);
          }}
          className="gap-3"
          aria-label="Lesson plan day scope"
        >
          {options.map((option) => {
            const id = `lesson-plan-day-scope-${option.value}`;
            return (
              <div
                key={option.value}
                className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/10 px-3 py-2.5"
              >
                <RadioGroupItem
                  value={option.value}
                  id={id}
                  aria-label={
                    option.caption
                      ? `${option.label}. ${option.caption}`
                      : option.label
                  }
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <Label
                    htmlFor={id}
                    className="cursor-pointer text-sm font-medium text-foreground"
                  >
                    {option.label}
                  </Label>
                  {option.caption ? (
                    <p className="text-xs leading-snug text-muted-foreground">
                      {option.caption}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </RadioGroup>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
