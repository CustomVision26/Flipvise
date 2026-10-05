"use client";

import * as React from "react";
import Image from "next/image";
import {
  BookOpen,
  Building2,
  ChevronLeft,
  ChevronRight,
  Expand,
  Eye,
  GraduationCap,
  Images,
  Layers,
  Lightbulb,
  Maximize2,
  Minimize2,
  MousePointerClick,
  Shrink,
  Sparkles,
  X,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  DOCS_UI_GUIDE_CATEGORIES,
  DOCS_UI_GUIDES,
  FLIPVISE_UI_GUIDE_LABEL,
  HOMEPAGE_SCREENSHOT,
  type DocsUiGuideCategoryId,
  type DocsUiGuideId,
} from "@/lib/flipvise-ui-guides";

const STORAGE_KEY = "flipvise.docsUiGuide";

type GuideSession = {
  id: DocsUiGuideId;
  step: number;
  minimized: boolean;
  expanded: boolean;
};

type DocsUiGuideContextValue = {
  openGuide: (id: DocsUiGuideId) => void;
  closeGuide: () => void;
};

const DocsUiGuideContext = React.createContext<DocsUiGuideContextValue | null>(
  null,
);

function readSession(): GuideSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuideSession;
    if (!(parsed.id in DOCS_UI_GUIDES)) return null;
    const max = DOCS_UI_GUIDES[parsed.id].steps.length - 1;
    return {
      id: parsed.id,
      step: Math.min(Math.max(0, Number(parsed.step) || 0), max),
      minimized: Boolean(parsed.minimized),
      expanded: Boolean(parsed.expanded),
    };
  } catch {
    return null;
  }
}

function writeSession(session: GuideSession | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function useDocsUiGuide() {
  return React.useContext(DocsUiGuideContext);
}

export function DocsUiGuideProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<GuideSession | null>(null);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setSession(readSession());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    writeSession(session);
  }, [hydrated, session]);

  const openGuide = React.useCallback((id: DocsUiGuideId) => {
    setSession((current) => {
      if (current?.id === id) {
        return { ...current, minimized: false };
      }
      return { id, step: 0, minimized: false, expanded: false };
    });
  }, []);

  const closeGuide = React.useCallback(() => {
    setSession(null);
  }, []);

  const value = React.useMemo(
    () => ({ openGuide, closeGuide }),
    [openGuide, closeGuide],
  );

  return (
    <DocsUiGuideContext.Provider value={value}>
      {children}
      {hydrated && session ? (
        <DocsUiGuidePanel
          session={session}
          onSessionChange={setSession}
          onClose={closeGuide}
        />
      ) : null}
    </DocsUiGuideContext.Provider>
  );
}

function DocsUiGuidePanel({
  session,
  onSessionChange,
  onClose,
}: {
  session: GuideSession;
  onSessionChange: React.Dispatch<React.SetStateAction<GuideSession | null>>;
  onClose: () => void;
}) {
  const guide = DOCS_UI_GUIDES[session.id];
  if (!guide) return null;
  const total = guide.steps.length;
  const step = guide.steps[session.step] ?? guide.steps[0];
  const progress = Math.round(((session.step + 1) / total) * 100);
  const isFirst = session.step === 0;
  const isLast = session.step === total - 1;

  const expanded = session.expanded;

  const goTo = (next: number) => {
    onSessionChange((current) =>
      current
        ? { ...current, step: Math.min(Math.max(0, next), total - 1) }
        : current,
    );
  };

  const setMinimized = (minimized: boolean) => {
    onSessionChange((current) => (current ? { ...current, minimized } : current));
  };

  const setExpanded = (nextExpanded: boolean) => {
    onSessionChange((current) =>
      current ? { ...current, expanded: nextExpanded, minimized: false } : current,
    );
  };

  if (session.minimized) {
    return (
      <div className="pointer-events-none fixed inset-x-3 bottom-3 z-40 flex justify-end sm:inset-x-4 sm:bottom-4">
        <Button
          type="button"
          variant="secondary"
          className="pointer-events-auto h-10 gap-2 shadow-lg ring-1 ring-border/70"
          onClick={() => setMinimized(false)}
        >
          <Maximize2 className="size-3.5" aria-hidden />
          <span className="max-w-[14rem] truncate">{guide.title}</span>
          <Badge variant="outline">
            {session.step + 1}/{total}
          </Badge>
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed z-40 flex",
        expanded
          ? "inset-3 items-stretch justify-center sm:inset-4"
          : "inset-x-3 bottom-3 justify-end sm:inset-x-4 sm:bottom-4",
      )}
    >
      <Card
        size="sm"
        className={cn(
          "pointer-events-auto flex flex-col overflow-hidden border-border/70 bg-card/95 shadow-2xl ring-1 ring-primary/20 backdrop-blur-md animate-in fade-in-0 duration-300",
          expanded
            ? "h-full max-h-full w-full max-w-[min(92rem,100%)] slide-in-from-bottom-2"
            : "max-h-[min(92vh,52rem)] w-full max-w-[32rem] slide-in-from-bottom-3",
        )}
      >
        <CardHeader className="shrink-0 gap-2 border-b border-border/50 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-2">
              <Badge variant="secondary">{FLIPVISE_UI_GUIDE_LABEL}</Badge>
              <CardTitle className={cn("leading-snug", expanded ? "text-lg" : "text-base")}>
                {guide.title}
              </CardTitle>
              <Alert
                className={cn(
                  "border-primary/50 bg-primary/10 text-foreground shadow-lg shadow-primary/15",
                  "animate-in fade-in-0 slide-in-from-top-1 duration-500",
                  expanded && "py-1.5",
                )}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-primary"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute -left-1 top-3 size-2.5 rounded-full bg-primary shadow-[0_0_12px] shadow-primary animate-ping"
                />
                <MousePointerClick
                  className="size-4 animate-bounce text-primary motion-reduce:animate-none"
                  aria-hidden
                />
                <AlertTitle className="text-foreground">Keep this guide open</AlertTitle>
                <AlertDescription className="text-foreground/90">
                  Follow each step on screen. You may browse Flipvise while this guide stays open.
                </AlertDescription>
              </Alert>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={expanded ? "Restore guide size" : "Expand guide"}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <Shrink className="size-3.5" aria-hidden />
                ) : (
                  <Expand className="size-3.5" aria-hidden />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Minimize guide"
                onClick={() => setMinimized(true)}
              >
                <Minimize2 className="size-3.5" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close guide"
                onClick={onClose}
              >
                <X className="size-3.5" aria-hidden />
              </Button>
            </div>
          </div>
          <Progress value={progress} className="gap-1.5">
            <ProgressLabel className="text-xs text-muted-foreground">
              Step {session.step + 1} of {total}
            </ProgressLabel>
            <ProgressValue className="text-xs" />
          </Progress>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pt-3">
          <div
            className={cn(
              "min-h-0 overflow-auto rounded-lg bg-muted/40 ring-1 ring-border/60",
              expanded ? "flex-1" : "max-h-[min(50vh,22rem)] shrink-0",
            )}
          >
            <Image
              key={step.src}
              src={step.src}
              alt={step.title}
              width={1920}
              height={1080}
              sizes={expanded ? "92vw" : "(max-width: 640px) 100vw, 32rem"}
              className="h-auto w-full animate-in fade-in-0 zoom-in-95 duration-300"
              style={{ width: "100%", height: "auto", aspectRatio: "auto" }}
              unoptimized
              priority
            />
          </div>
          <Alert
            key={session.step}
            className={cn(
              "shrink-0 border-primary/55 bg-primary/12 text-foreground shadow-lg shadow-primary/20",
              "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-500",
            )}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-primary"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-pulse"
            />
            <Sparkles className="relative size-4 text-primary" aria-hidden />
            <AlertTitle className="relative flex items-center gap-2 text-foreground">
              <Lightbulb className="size-3.5 text-primary" aria-hidden />
              {step.title}
            </AlertTitle>
            <AlertDescription
              className={cn(
                "relative leading-relaxed text-foreground",
                expanded ? "text-sm" : "text-xs",
              )}
            >
              {step.caption}
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="shrink-0 justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isFirst}
            onClick={() => goTo(session.step - 1)}
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            Back
          </Button>
          {isLast ? (
            <Button type="button" size="sm" onClick={onClose}>
              Finish
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={() => goTo(session.step + 1)}>
              Next
              <ChevronRight className="size-3.5" aria-hidden />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

export function HomepageScreenshotViewButton({
  className,
}: {
  className?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm" className={cn("gap-1.5", className)} />
        }
      >
        <Eye className="size-3.5" aria-hidden />
        View
      </DialogTrigger>
      <DialogContent className="max-w-[min(72rem,calc(100%-1.5rem))] p-0 sm:max-w-[min(72rem,calc(100%-2rem))]">
        <DialogHeader className="px-4 pt-4 pr-12 sm:px-5 sm:pt-5">
          <DialogTitle>{HOMEPAGE_SCREENSHOT.title}</DialogTitle>
          <DialogDescription>
            Guest landing page — Sign In, Sign Up, Plans, Contact Us, and documentation.
          </DialogDescription>
        </DialogHeader>
        <div className="relative mx-4 mb-4 overflow-hidden rounded-lg bg-muted/40 ring-1 ring-border/60 sm:mx-5 sm:mb-5">
          <div className="relative aspect-[16/9] w-full">
            <Image
              src={HOMEPAGE_SCREENSHOT.src}
              alt={HOMEPAGE_SCREENSHOT.alt}
              fill
              sizes="90vw"
              className="object-contain"
              unoptimized
              priority
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const CATEGORY_ICONS: Record<
  DocsUiGuideCategoryId,
  React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
> = {
  "getting-started": BookOpen,
  "decks-and-cards": Layers,
  "team-tier": Building2,
};

type CatalogAccent = {
  iconWrap: string;
  iconPing: string;
  bar: string;
  blob: string;
  card: string;
  hover: string;
  badge: string;
  itemBorder: string;
};

const ACCENT_CYAN: CatalogAccent = {
  iconWrap:
    "border-cyan-400/55 bg-cyan-500/15 text-cyan-700 shadow-cyan-400/40 dark:text-cyan-300",
  iconPing: "bg-cyan-400/30",
  bar: "bg-cyan-400 shadow-cyan-400",
  blob: "bg-cyan-400/20 group-hover/button:bg-cyan-400/35",
  card: "border-cyan-400/25 bg-cyan-500/5",
  hover:
    "hover:border-cyan-400/70 hover:bg-cyan-500/15 hover:shadow-cyan-500/25",
  badge:
    "border-cyan-400/40 bg-cyan-500/15 text-cyan-800 dark:text-cyan-200",
  itemBorder: "border-cyan-400/30",
};

const ACCENT_TEAL: CatalogAccent = {
  iconWrap:
    "border-teal-400/55 bg-teal-500/15 text-teal-700 shadow-teal-400/40 dark:text-teal-300",
  iconPing: "bg-teal-400/30",
  bar: "bg-teal-400 shadow-teal-400",
  blob: "bg-teal-400/20 group-hover/button:bg-teal-400/35",
  card: "border-teal-400/25 bg-teal-500/5",
  hover: "hover:border-teal-400/70 hover:bg-teal-500/15 hover:shadow-teal-500/25",
  badge: "border-teal-400/40 bg-teal-500/15 text-teal-800 dark:text-teal-200",
  itemBorder: "border-teal-400/30",
};

const ACCENT_VIOLET: CatalogAccent = {
  iconWrap:
    "border-violet-400/55 bg-violet-500/15 text-violet-700 shadow-violet-400/40 dark:text-violet-300",
  iconPing: "bg-violet-400/30",
  bar: "bg-violet-400 shadow-violet-400",
  blob: "bg-violet-400/20 group-hover/button:bg-violet-400/35",
  card: "border-violet-400/25 bg-violet-500/5",
  hover:
    "hover:border-violet-400/70 hover:bg-violet-500/15 hover:shadow-violet-500/25",
  badge:
    "border-violet-400/40 bg-violet-500/15 text-violet-800 dark:text-violet-200",
  itemBorder: "border-violet-400/30",
};

const ACCENT_AMBER: CatalogAccent = {
  iconWrap:
    "border-amber-400/55 bg-amber-500/15 text-amber-800 shadow-amber-400/40 dark:text-amber-300",
  iconPing: "bg-amber-400/30",
  bar: "bg-amber-400 shadow-amber-400",
  blob: "bg-amber-400/20 group-hover/button:bg-amber-400/35",
  card: "border-amber-400/25 bg-amber-500/5",
  hover:
    "hover:border-amber-400/70 hover:bg-amber-500/15 hover:shadow-amber-500/25",
  badge: "border-amber-400/40 bg-amber-500/15 text-amber-900 dark:text-amber-200",
  itemBorder: "border-amber-400/30",
};

const CATEGORY_ACCENTS: Record<DocsUiGuideCategoryId, CatalogAccent> = {
  "getting-started": ACCENT_CYAN,
  "decks-and-cards": ACCENT_TEAL,
  "team-tier": ACCENT_VIOLET,
};

function DocsUiGuideCatalogItem({
  id,
  index,
  accent,
  onSelect,
}: {
  id: DocsUiGuideId;
  index: number;
  accent: CatalogAccent;
  onSelect: (id: DocsUiGuideId) => void;
}) {
  const item = DOCS_UI_GUIDES[id];
  if (!item) return null;
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "relative h-auto min-h-[6.75rem] w-full items-start justify-start overflow-hidden rounded-xl bg-card/80 px-4 py-4 text-left whitespace-normal shadow-none",
        accent.itemBorder,
        "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg",
        accent.hover,
        "animate-in fade-in-0 slide-in-from-bottom-3 fill-mode-both duration-500",
      )}
      style={{ animationDelay: `${Math.min(index, 14) * 45}ms` }}
      onClick={() => onSelect(id)}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-1 shadow-[0_0_12px]",
          accent.bar,
        )}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 size-20 rounded-full blur-2xl transition-opacity duration-300",
          accent.blob,
        )}
      />
      <span className="relative flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex items-start justify-between gap-3">
          <span className="font-heading text-sm font-semibold leading-snug text-foreground sm:text-base">
            {item.title}
          </span>
          <Badge variant="outline" className={cn("shrink-0 font-normal", accent.badge)}>
            {item.steps.length} steps
          </Badge>
        </span>
        <span className="text-xs font-normal leading-relaxed text-muted-foreground sm:text-sm">
          {item.summary}
        </span>
      </span>
    </Button>
  );
}

export function DocsUiGuidesMenuButton({
  className,
}: {
  className?: string;
}) {
  const guide = useDocsUiGuide();
  const [open, setOpen] = React.useState(false);
  if (!guide) return null;

  const openCatalogGuide = (id: DocsUiGuideId) => {
    setOpen(false);
    guide.openGuide(id);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("h-8 shrink-0 gap-1.5 px-2.5 text-xs sm:px-3", className)}
            aria-label="UI Guides"
          />
        }
      >
        <Images className="size-3.5 shrink-0 text-cyan-600 dark:text-cyan-300" aria-hidden />
        <span className="hidden min-[420px]:inline">UI Guides</span>
      </DialogTrigger>
      <DialogContent
        className={cn(
          "flex max-h-[min(96vh,68rem)] w-full max-w-[calc(100%-0.75rem)] flex-col gap-0 overflow-hidden p-0 text-base",
          "border-0 bg-popover/95 shadow-2xl shadow-cyan-500/20 ring-1 ring-cyan-400/40 backdrop-blur-md",
          "duration-500 data-open:slide-in-from-bottom-4 data-open:zoom-in-95 data-closed:slide-out-to-bottom-4",
          "sm:max-w-[min(92rem,calc(100%-2rem))]",
        )}
      >
        <div className="glass-card-3d relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-20 -top-24 size-72 animate-pulse-color-1 rounded-full bg-gradient-radial from-cyan-400/45 via-sky-500/15 to-transparent blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 top-0 size-64 animate-pulse-color-2 rounded-full bg-gradient-radial from-violet-500/40 via-fuchsia-500/10 to-transparent blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-[-20%] left-[30%] size-56 animate-pulse-color-3 rounded-full bg-gradient-radial from-teal-400/35 via-emerald-500/10 to-transparent blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 animate-aurora bg-gradient-to-r from-cyan-500/20 via-violet-500/10 to-teal-500/20"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-cyan-400/0 via-cyan-300/80 to-violet-400/0"
          />
          <DialogHeader className="relative z-10 gap-3 px-6 pt-7 pr-16 pb-6 sm:px-8 sm:pt-8 sm:pr-20">
            <div className="flex items-start gap-4">
              <span className="relative flex size-14 shrink-0 items-center justify-center rounded-xl border border-cyan-400/60 bg-cyan-500/15 text-cyan-700 shadow-[0_0_28px] shadow-cyan-400/40 dark:text-cyan-300">
                <span
                  aria-hidden
                  className="absolute inset-0 animate-ping rounded-xl bg-cyan-400/25"
                />
                <Images className="relative size-7" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <Badge
                  variant="outline"
                  className="gap-1.5 border-cyan-400/40 bg-cyan-500/15 font-normal text-cyan-800 dark:text-cyan-200"
                >
                  <Sparkles className="size-3 text-cyan-600 dark:text-cyan-300" aria-hidden />
                  Visual catalog
                </Badge>
                <DialogTitle className="animate-gradient-text bg-gradient-to-r from-cyan-600 via-teal-500 to-violet-600 bg-clip-text text-2xl tracking-tight text-transparent dark:from-cyan-300 dark:via-sky-300 dark:to-violet-300 sm:text-3xl">
                  Flipvise UI guides
                </DialogTitle>
                <DialogDescription className="max-w-3xl text-sm leading-relaxed sm:text-base">
                  Select a walkthrough from the catalog. The selected guide remains open while you
                  continue to work in Flipvise.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>
        <ScrollArea className="h-[min(76vh,50rem)]">
          <div className="px-6 py-5 sm:px-8 sm:py-6">
            <Accordion
              multiple
              defaultValue={DOCS_UI_GUIDE_CATEGORIES.map((category) => category.id)}
              className="gap-0"
            >
              {DOCS_UI_GUIDE_CATEGORIES.map((category) => {
                const Icon = CATEGORY_ICONS[category.id];
                const accent = CATEGORY_ACCENTS[category.id];
                const nestedCount =
                  category.nested?.reduce((sum, group) => sum + group.guideIds.length, 0) ??
                  0;
                const totalGuides = category.guideIds.length + nestedCount;
                return (
                  <AccordionItem
                    key={category.id}
                    value={category.id}
                    className={cn("border-b", accent.itemBorder)}
                  >
                    <AccordionTrigger className="items-center rounded-lg px-2 py-4 hover:bg-muted/30 hover:no-underline">
                      <span className="flex min-w-0 flex-1 items-start gap-4 pr-3">
                        <span
                          className={cn(
                            "relative mt-0.5 flex size-12 shrink-0 items-center justify-center rounded-xl border shadow-[0_0_18px]",
                            accent.iconWrap,
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn("absolute inset-0 animate-pulse rounded-xl", accent.iconPing)}
                          />
                          <Icon className="relative size-5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 space-y-1 text-left">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-heading text-base font-semibold tracking-tight text-foreground sm:text-lg">
                              {category.title}
                            </span>
                            <Badge variant="outline" className={cn("font-normal", accent.badge)}>
                              {totalGuides} {totalGuides === 1 ? "guide" : "guides"}
                            </Badge>
                          </span>
                          <span className="block text-sm font-normal leading-relaxed text-muted-foreground">
                            {category.description}
                          </span>
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-1 pb-6">
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {category.guideIds.map((id, index) => (
                          <DocsUiGuideCatalogItem
                            key={id}
                            id={id}
                            index={index}
                            accent={accent}
                            onSelect={openCatalogGuide}
                          />
                        ))}
                      </div>
                      {category.nested?.map((group) => (
                        <Card
                          key={group.id}
                          size="sm"
                          className="glass-card-3d mt-5 border-0 bg-amber-500/10 shadow-none ring-1 ring-amber-400/35"
                        >
                          <CardHeader className="gap-2 pb-3">
                            <div className="flex items-start gap-3">
                              <span
                                className={cn(
                                  "relative mt-0.5 flex size-12 shrink-0 items-center justify-center rounded-xl border shadow-[0_0_18px]",
                                  ACCENT_AMBER.iconWrap,
                                )}
                              >
                                <GraduationCap className="size-5" aria-hidden />
                              </span>
                              <div className="min-w-0 flex-1 space-y-1">
                                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                                  {group.title}
                                  <Badge
                                    variant="outline"
                                    className={cn("font-normal", ACCENT_AMBER.badge)}
                                  >
                                    {group.guideIds.length}{" "}
                                    {group.guideIds.length === 1 ? "guide" : "guides"}
                                  </Badge>
                                </CardTitle>
                                <CardDescription className="text-sm leading-relaxed">
                                  {group.description}
                                </CardDescription>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            {group.guideIds.length > 0 ? (
                              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {group.guideIds.map((id, index) => (
                                  <DocsUiGuideCatalogItem
                                    key={id}
                                    id={id}
                                    index={index}
                                    accent={ACCENT_AMBER}
                                    onSelect={openCatalogGuide}
                                  />
                                ))}
                              </div>
                            ) : (
                              <p className="rounded-lg border border-dashed border-amber-400/40 bg-card/70 px-4 py-5 text-sm leading-relaxed text-muted-foreground">
                                No Education Teacher walkthroughs are published in this catalog
                                yet. Teacher Dashboard documentation remains available in the
                                in-depth guide.
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function DocsUiGuideStartButton({
  guideId,
  children,
}: {
  guideId: DocsUiGuideId;
  children: React.ReactNode;
}) {
  const guide = useDocsUiGuide();
  if (!guide) return null;
  return (
    <Button
      type="button"
      variant="default"
      size="sm"
      className="gap-1.5"
      onClick={() => guide.openGuide(guideId)}
    >
      <Eye className="size-3.5" aria-hidden />
      {children}
    </Button>
  );
}
