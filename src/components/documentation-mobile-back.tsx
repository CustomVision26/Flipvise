"use client";

import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type DocumentationMobileBackProps = {
  onClick: () => void;
  label?: string;
  className?: string;
};

export function DocumentationMobileBack({
  onClick,
  label = "Back to topics",
  className,
}: DocumentationMobileBackProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mb-4 inline-flex w-fit items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground lg:hidden",
        className,
      )}
    >
      <ChevronLeft className="size-4 shrink-0" aria-hidden />
      {label}
    </button>
  );
}
