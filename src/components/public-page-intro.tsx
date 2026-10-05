import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PublicPageIntroProps = {
  badge: string;
  title: string;
  description: string;
  className?: string;
  centered?: boolean;
  accent?: "cyan" | "teal";
};

const ACCENT = {
  cyan: {
    badge:
      "border-cyan-400/45 bg-cyan-500/15 text-cyan-800 dark:text-cyan-200",
    title:
      "animate-gradient-text bg-gradient-to-r from-cyan-600 via-sky-500 to-violet-600 bg-clip-text text-transparent dark:from-cyan-300 dark:via-sky-300 dark:to-violet-300",
    rule: "border-cyan-400/25",
  },
  teal: {
    badge:
      "border-teal-400/45 bg-teal-500/15 text-teal-800 dark:text-teal-200",
    title:
      "animate-gradient-text bg-gradient-to-r from-teal-600 via-cyan-500 to-emerald-600 bg-clip-text text-transparent dark:from-teal-300 dark:via-cyan-300 dark:to-emerald-300",
    rule: "border-teal-400/25",
  },
} as const;

export function PublicPageIntro({
  badge,
  title,
  description,
  className,
  centered = false,
  accent = "cyan",
}: PublicPageIntroProps) {
  const tone = ACCENT[accent];
  return (
    <header
      className={cn(
        "relative space-y-4 overflow-hidden rounded-2xl border px-5 py-7 sm:px-8",
        "border-cyan-400/20 bg-card/40 shadow-[0_0_40px] shadow-cyan-500/10 ring-1 ring-cyan-400/15",
        "animate-in fade-in-0 slide-in-from-top-2 duration-500",
        tone.rule,
        centered && "flex flex-col items-center text-center",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-cyan-400/15 blur-2xl"
      />
      <Badge
        variant="outline"
        className={cn(
          "gap-1.5 px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
          tone.badge,
        )}
      >
        <Sparkles className="size-3" aria-hidden />
        {badge}
      </Badge>
      <div className={cn("relative space-y-2.5", centered && "max-w-xl")}>
        <h1
          className={cn(
            "text-2xl font-semibold tracking-tight sm:text-[1.75rem] sm:leading-tight",
            tone.title,
          )}
        >
          {title}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
          {description}
        </p>
      </div>
    </header>
  );
}
