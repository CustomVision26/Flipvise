"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  CircleHelp,
  ExternalLink,
  FilePenLine,
  MessageSquareText,
  Settings2,
  Sparkles,
  WifiOff,
} from "lucide-react";
import {
  ESSAY_DASHBOARD_NAV,
  isEssayNavItemActive,
} from "@/lib/essay-dashboard-nav";
import {
  DOCUMENT_STUDIO_TITLE,
  DOCUMENT_STUDIO_TYPES,
} from "@/lib/document-generation-studio";
import {
  AI_DOC_STUDIO_BASE,
  AI_ESSAY_STUDIO_BASE,
} from "@/lib/ai-document-studio-paths";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

const AI_ESSAY_USER_GUIDE_HREF = "/docs#ai-essay";

const HOW_AI_ESSAY_WORKS_STEPS = [
  {
    title: "Set up your activity",
    body: "Open Essay Generator and choose subject, grade, essay type, topic, and length.",
    icon: Settings2,
  },
  {
    title: "Generate the prompt",
    body: "Create objectives with an optional outline, vocabulary, and rubric. The model essay stays hidden until you reveal it.",
    icon: Sparkles,
  },
  {
    title: "Write and save drafts",
    body: "Use the writing workspace with word count and an optional timer. Drafts save anytime and can cache offline.",
    icon: FilePenLine,
  },
  {
    title: "Submit for AI feedback",
    body: "When online, submit for comments, revise your work, and keep essays in My Essays or Drafts.",
    icon: MessageSquareText,
  },
] as const;

export function EssayDashboardShell({
  children,
  unlocked,
}: {
  children: React.ReactNode;
  unlocked: boolean;
}) {
  const pathname = usePathname();
  const [howItWorksOpen, setHowItWorksOpen] = React.useState(false);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-4 sm:gap-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Link
            href={AI_DOC_STUDIO_BASE}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "-ml-2 w-fit gap-1.5 text-muted-foreground",
            )}
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            {DOCUMENT_STUDIO_TITLE}
          </Link>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Premium add-on · AI Essay
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Essay Generator
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate activities, write, and get AI feedback inside{" "}
              {DOCUMENT_STUDIO_TITLE}.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setHowItWorksOpen(true)}
          >
            <CircleHelp className="size-3.5" aria-hidden />
            How it work?
          </Button>
          <Badge variant={unlocked ? "secondary" : "outline"}>
            {unlocked ? "Unlocked" : "Locked"}
          </Badge>
        </div>
      </div>

      <Dialog open={howItWorksOpen} onOpenChange={setHowItWorksOpen}>
        <DialogContent
          className={cn(
            "flex max-h-[min(92vh,44rem)] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0",
            "sm:max-w-lg",
          )}
        >
          <DialogHeader className="shrink-0 space-y-2 border-b border-border/60 bg-muted/20 px-5 py-4 pr-12 text-left sm:px-6 sm:py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Premium add-on · AI Essay
            </p>
            <DialogTitle className="text-xl tracking-tight">
              How AI Essay works
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              A concise walkthrough of the Essay Generator workflow inside{" "}
              {DOCUMENT_STUDIO_TITLE}.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <ol className="space-y-3">
                {HOW_AI_ESSAY_WORKS_STEPS.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <li
                      key={step.title}
                      className="flex gap-3 rounded-lg border border-border/60 bg-card/40 px-3.5 py-3"
                    >
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40 text-xs font-semibold tabular-nums text-foreground"
                        aria-hidden
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Icon
                            className="size-3.5 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <p className="text-sm font-medium tracking-tight text-foreground">
                            {step.title}
                          </p>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {step.body}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <Alert className="border-border/60 bg-muted/20">
                <WifiOff className="size-4" aria-hidden />
                <AlertDescription className="text-sm leading-relaxed text-muted-foreground">
                  AI generation and feedback require an internet connection.
                  Reading the prompt and drafting can continue offline.
                </AlertDescription>
              </Alert>
            </div>
          </div>

          <Separator className="shrink-0" />

          <DialogFooter className="m-0 shrink-0 gap-2 rounded-none border-0 bg-muted/30 px-5 py-4 sm:justify-between sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setHowItWorksOpen(false)}
            >
              Close
            </Button>
            <Link
              href={AI_ESSAY_USER_GUIDE_HREF}
              className={cn(buttonVariants({ variant: "default" }), "gap-1.5")}
              onClick={() => setHowItWorksOpen(false)}
            >
              Open user guide
              <ExternalLink className="size-3.5 opacity-90" aria-hidden />
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {unlocked ? (
        <>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Document types
            </p>
            <div className="flex flex-wrap gap-2">
              {DOCUMENT_STUDIO_TYPES.map((type) => {
                if (type.enabled && type.href) {
                  const typeActive =
                    pathname === AI_ESSAY_STUDIO_BASE ||
                    pathname.startsWith(`${AI_ESSAY_STUDIO_BASE}/`);
                  return (
                    <Link
                      key={type.id}
                      href={
                        type.id === "essay" ? AI_ESSAY_STUDIO_BASE : type.href
                      }
                      className={cn(
                        buttonVariants({
                          size: "sm",
                          variant: typeActive ? "default" : "outline",
                        }),
                      )}
                    >
                      {type.label}
                    </Link>
                  );
                }
                return (
                  <span
                    key={type.id}
                    className={cn(
                      buttonVariants({ size: "sm", variant: "outline" }),
                      "pointer-events-none opacity-60",
                    )}
                    aria-disabled="true"
                  >
                    {type.label}
                    <Badge variant="secondary" className="ml-1.5 text-[10px]">
                      Coming Soon
                    </Badge>
                  </span>
                );
              })}
            </div>
          </div>

          <nav
            className="flex flex-wrap gap-2"
            aria-label="AI Essay navigation"
          >
            {ESSAY_DASHBOARD_NAV.map((item) => {
              const active = isEssayNavItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    buttonVariants({
                      size: "sm",
                      variant: active ? "default" : "outline",
                    }),
                  )}
                >
                  <item.icon className="size-3.5" />
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </>
      ) : null}

      {children}
    </div>
  );
}
