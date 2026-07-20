"use client";

import type { ComponentType } from "react";
import { ImagePlus, Shapes, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type AiImageSide = "front" | "back";
export type AiGenerateMode = "diagram" | "illustration" | "text";

type AiGeneratePopoverProps = {
  imageSide: AiImageSide;
  onImageSideChange: (side: AiImageSide) => void;
  onGenerate: (mode: AiGenerateMode) => void;
  disabled?: boolean;
  /** When false, hides the decorative image option (edit dialog). */
  showIllustrationOption?: boolean;
};

function OptionButton({
  icon: Icon,
  title,
  description,
  onClick,
  disabled,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-auto w-full justify-start gap-3 rounded-lg border-border/80 bg-background/40 px-3 py-3 text-left whitespace-normal",
        "hover:bg-accent/60 hover:border-primary/40",
        "focus-visible:border-primary/50",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/40 text-foreground">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-[11px] font-normal leading-snug text-muted-foreground">
          {description}
        </span>
      </span>
    </Button>
  );
}

export function AiGeneratePopoverContent({
  imageSide,
  onImageSideChange,
  onGenerate,
  disabled = false,
  showIllustrationOption = true,
}: AiGeneratePopoverProps) {
  const sideLabel = imageSide === "front" ? "front" : "back";

  return (
    <PopoverContent align="end" className="z-[60] w-[19.5rem] gap-0 p-0">
      <div className="space-y-1 border-b border-border/70 px-4 py-3">
        <PopoverHeader className="gap-1">
          <PopoverTitle className="text-sm font-semibold tracking-tight">
            Generate answer
          </PopoverTitle>
          <PopoverDescription className="text-xs leading-relaxed text-muted-foreground">
            Matches this deck’s topic, tone, and existing cards.
          </PopoverDescription>
        </PopoverHeader>
      </div>

      <div className="space-y-3 px-4 py-3">
        {showIllustrationOption ? (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label className="text-xs font-semibold text-foreground">
                Place image on
              </Label>
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Decorative image only
              </span>
            </div>
            <ToggleGroup
              value={[imageSide]}
              onValueChange={(next) => {
                const value = next[0] as AiImageSide | undefined;
                if (value) onImageSideChange(value);
              }}
              variant="outline"
              spacing={0}
              size="sm"
              className="flex w-full rounded-lg border border-border/80 p-0.5"
              disabled={disabled}
              aria-label="Choose front of card or back of card for the decorative image"
            >
              <ToggleGroupItem
                value="front"
                className="h-8 flex-1 rounded-md border-0 px-1.5 text-[11px] font-bold aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              >
                Front of card
              </ToggleGroupItem>
              <ToggleGroupItem
                value="back"
                className="h-8 flex-1 rounded-md border-0 px-1.5 text-[11px] font-bold aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              >
                Back of card
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Used only for Answer with image. Diagrams always fill front,
              back, and wrong-answer figures.
            </p>
          </div>
        ) : null}

        {showIllustrationOption ? <Separator /> : null}

        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">Choose an option</p>
          <div className="flex flex-col gap-2">
            <OptionButton
              icon={Shapes}
              title="Answer with diagram"
              description="Front: question figure (no answer). Back: solution with answer. Wrong answers get their own figures."
              onClick={() => onGenerate("diagram")}
              disabled={disabled}
            />
            {showIllustrationOption ? (
              <OptionButton
                icon={ImagePlus}
                title="Answer with image"
                description={`Decorative illustration on the ${sideLabel}.`}
                onClick={() => onGenerate("illustration")}
                disabled={disabled}
              />
            ) : null}
            <OptionButton
              icon={Type}
              title="Answer only"
              description="Text answer without a figure or illustration."
              onClick={() => onGenerate("text")}
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    </PopoverContent>
  );
}
