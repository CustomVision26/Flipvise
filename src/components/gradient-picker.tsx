"use client";

import { cn } from "@/lib/utils";
import { DECK_GRADIENTS, type GradientSlug } from "@/lib/deck-gradients";
import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";

interface GradientPickerProps {
  value: GradientSlug | null;
  onChange: (slug: GradientSlug) => void;
  disabled?: boolean;
}

export function GradientPicker({ value, onChange, disabled }: GradientPickerProps) {
  const active = value ?? "none";

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs sm:text-sm">Background gradient (optional)</Label>
      <div className="flex flex-wrap gap-2">
        {DECK_GRADIENTS.map((g) => {
          const isSelected = active === g.slug;
          return (
            <button
              key={g.slug}
              type="button"
              disabled={disabled}
              title={g.label}
              aria-label={`${g.label} gradient${isSelected ? " — selected" : ""}`}
              onClick={() => onChange(g.slug)}
              className={cn(
                "relative h-8 w-8 rounded-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected ? "border-white scale-110 shadow-lg" : "border-transparent hover:scale-105 hover:border-white/50",
                g.slug === "none"
                  ? "bg-muted border-border"
                  : g.classes,
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              {isSelected && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Check className={cn("h-4 w-4", g.slug === "none" ? "text-foreground" : "text-white")} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
