import Link from "next/link";
import {
  ArrowRight,
  LayoutDashboard,
  PanelLeft,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import { TEACHER_DASHBOARD_NAV } from "@/lib/teacher-dashboard-nav";
import { withTeacherQuery } from "@/lib/teacher-url";

const WORKFLOW_STEPS = [
  {
    title: "Select a tool",
    description:
      "Choose any item from the sidebar navigation. Each link opens a dedicated workspace for that generator or management view.",
  },
  {
    title: "Link source decks",
    description:
      "Connect one or more flashcard decks that define your topic, vocabulary, and learning objectives. AI output quality depends on this source material.",
  },
  {
    title: "Generate, refine, and save",
    description:
      "Run AI generation, preview the result, edit sections as needed, and save finished materials to your Teacher Resource Library.",
  },
] as const;

function toolHref(suffix: string, queryString: string): string {
  const normalized = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return withTeacherQuery(`/teacher${normalized}`, queryString);
}

export function TeacherDashboardHome({
  planLabel,
  workspaceNote,
  teamAdminHref = null,
  personalDashboardHref = null,
  teacherQueryString = "",
}: {
  planLabel: string;
  workspaceNote: string;
  teamAdminHref?: string | null;
  /** Education Plus only — link to /dashboard for deck creation. */
  personalDashboardHref?: string | null;
  teacherQueryString?: string;
}) {
  const toolCount = TEACHER_DASHBOARD_NAV.reduce(
    (count, section) => count + section.items.length,
    0,
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <Card
        className={cn(
          teamAdminCardClass,
          "overflow-hidden backdrop-blur-md animate-in fade-in-0 duration-300",
        )}
      >
        <CardHeader className="gap-4 pb-4 sm:pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Teacher workspace
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Teacher Dashboard
                </h1>
                <Badge variant="outline" className="h-6 px-2.5 text-xs font-medium">
                  {planLabel}
                </Badge>
              </div>
              <CardDescription className="max-w-3xl text-sm leading-relaxed sm:text-[0.9375rem]">
                {workspaceNote}
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-col gap-2 self-start sm:flex-row sm:flex-wrap">
              {personalDashboardHref ? (
                <Link
                  href={personalDashboardHref}
                  className={cn(
                    buttonVariants({ variant: "default", size: "default" }),
                    "inline-flex h-9 items-center gap-2 font-medium",
                  )}
                >
                  <LayoutDashboard className="size-4" aria-hidden />
                  Personal Dashboard
                  <ArrowRight className="size-4 opacity-70" aria-hidden />
                </Link>
              ) : null}
              {teamAdminHref ? (
                <Link
                  href={teamAdminHref}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "inline-flex h-9 items-center gap-2 font-medium",
                  )}
                >
                  <LayoutDashboard className="size-4" aria-hidden />
                  Team Admin Dashboard
                  <ArrowRight className="size-4 opacity-70" aria-hidden />
                </Link>
              ) : null}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card
        className={cn(
          teamAdminCardClass,
          "backdrop-blur-sm animate-in fade-in-0 duration-300",
        )}
      >
        <CardHeader className="gap-3 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base font-semibold">Using your teacher tools</CardTitle>
            <Badge variant="secondary" className="h-5 px-2 text-[10px] font-medium uppercase tracking-wide">
              {toolCount} tools
            </Badge>
          </div>
          <CardDescription className="max-w-3xl text-sm leading-relaxed">
            The sidebar organizes every teacher tool by purpose. Select a category, open the
            tool you need, and follow the same workflow across all AI generators: link decks,
            generate content, then save or export your results.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          <div className="flex items-start gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5 text-sm text-muted-foreground lg:hidden">
            <PanelLeft className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <p>
              On smaller screens, open <span className="font-medium text-foreground">Teacher menu</span>{" "}
              above to access the same navigation panel shown on desktop.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {WORKFLOW_STEPS.map((step, index) => (
              <div
                key={step.title}
                className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3.5"
              >
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                  Step {index + 1}
                </p>
                <p className="text-sm font-medium text-foreground">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] lg:items-start">
            <aside
              aria-hidden
              className="hidden rounded-xl border border-border/80 bg-card/60 p-3 lg:block"
            >
              <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Sidebar
              </p>
              <div className="space-y-3">
                <div className="rounded-md bg-primary/15 px-2.5 py-2 text-xs font-medium text-foreground">
                  Dashboard
                </div>
                {TEACHER_DASHBOARD_NAV.map((section) => (
                  <div key={section.title} className="space-y-1">
                    <p className="px-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      {section.title}
                    </p>
                    <ul className="space-y-0.5">
                      {section.items.map((item) => (
                        <li
                          key={item.title}
                          className="truncate rounded-md px-2.5 py-1.5 text-xs text-muted-foreground"
                        >
                          {item.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="mt-3 flex items-center gap-1.5 px-2 text-[10px] text-muted-foreground">
                <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
                Select any item to begin
              </p>
            </aside>

            <div className="space-y-5">
              {TEACHER_DASHBOARD_NAV.map((section, sectionIndex) => (
                <section key={section.title} className="space-y-5">
                  <div className="mb-3 space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const href = toolHref(item.suffix, teacherQueryString);
                      return (
                        <li key={item.title}>
                          <Link
                            href={href}
                            className={cn(
                              "group flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-3",
                              "transition-colors hover:border-primary/25 hover:bg-primary/5",
                            )}
                          >
                            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                              <Icon className="size-4" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-foreground">
                                  {item.title}
                                </span>
                                <ArrowRight
                                  className="size-3.5 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                                  aria-hidden
                                />
                              </span>
                              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                                {item.summary}
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  {sectionIndex < TEACHER_DASHBOARD_NAV.length - 1 ? (
                    <Separator className="mt-5 bg-border/50" />
                  ) : null}
                </section>
              ))}
            </div>
          </div>

          <div
            className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/15 px-4 py-3.5"
          >
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
              <span className="font-medium text-foreground">Tip:</span> AI generators require an
              internet connection and at least one linked deck with cards. Saved outputs appear in
              the Teacher Resource Library for reuse across your classes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
