"use client";

import * as React from "react";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  Eye,
  Images,
  Lightbulb,
  Maximize2,
  Minimize2,
  MousePointerClick,
  Shrink,
  Sparkles,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { cn } from "@/lib/utils";
import {
  DOCS_UI_GUIDE_ORDER,
  DOCS_UI_GUIDES,
  FLIPVISE_UI_GUIDE_LABEL,
  HOMEPAGE_SCREENSHOT,
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
          "pointer-events-auto border-border/70 bg-card/95 shadow-2xl ring-1 ring-primary/20 backdrop-blur-md animate-in fade-in-0 duration-300",
          expanded
            ? "flex h-full max-h-full w-full max-w-[min(92rem,100%)] flex-col slide-in-from-bottom-2"
            : "w-full max-w-[32rem] slide-in-from-bottom-3",
        )}
      >
        <CardHeader className="gap-2 border-b border-border/50 pb-3">
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
        <CardContent
          className={cn("space-y-3 pt-3", expanded && "flex min-h-0 flex-1 flex-col")}
        >
          <div
            className={cn(
              "relative overflow-hidden rounded-lg bg-muted/40 ring-1 ring-border/60",
              expanded && "min-h-0 flex-1",
            )}
          >
            <div
              className={cn(
                "relative w-full",
                expanded ? "h-full min-h-[min(70vh,42rem)]" : "aspect-[16/10]",
              )}
            >
              <Image
                key={step.src}
                src={step.src}
                alt={step.title}
                fill
                sizes={expanded ? "92vw" : "(max-width: 640px) 100vw, 32rem"}
                className="object-contain animate-in fade-in-0 zoom-in-95 duration-300"
                unoptimized
                priority
              />
            </div>
          </div>
          <Alert
            key={session.step}
            className={cn(
              "overflow-hidden border-primary/55 bg-primary/12 text-foreground shadow-lg shadow-primary/20",
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
        <CardFooter className="justify-between gap-2">
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

export function DocsUiGuidesMenuButton({
  className,
}: {
  className?: string;
}) {
  const guide = useDocsUiGuide();
  const [open, setOpen] = React.useState(false);
  if (!guide) return null;

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
        <Images className="size-3.5 shrink-0" aria-hidden />
        <span className="hidden min-[420px]:inline">UI Guides</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Flipvise UI guides</DialogTitle>
          <DialogDescription>
            Choose a walkthrough. It stays open while you browse Flipvise.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {DOCS_UI_GUIDE_ORDER.map((id) => {
            const item = DOCS_UI_GUIDES[id];
            return (
              <Button
                key={id}
                type="button"
                variant="outline"
                className="h-auto w-full items-start justify-start gap-3 py-3 text-left whitespace-normal"
                onClick={() => {
                  setOpen(false);
                  guide.openGuide(id);
                }}
              >
                <Eye className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="block font-medium text-foreground">{item.title}</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {item.summary} {item.steps.length} steps.
                  </span>
                </span>
              </Button>
            );
          })}
        </div>
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
