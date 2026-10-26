import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  FileCheck2,
  Link2,
  MousePointerClick,
  PanelLeft,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import { TEACHER_DASHBOARD_NAV } from "@/lib/teacher-dashboard-nav";
import { withTeacherQuery } from "@/lib/teacher-url";

const WORKFLOW_STEPS = [
  {
    title: "Select a tool",
    description:
      "Choose any item from the sidebar navigation. Each link opens a dedicated workspace for that generator or management view.",
    icon: MousePointerClick,
    accent: "violet",
  },
  {
    title: "Link source decks",
    description:
      "Connect one or more flashcard decks that define your topic, vocabulary, and learning objectives. AI output quality depends on this source material.",
    icon: Link2,
    accent: "sky",
  },
  {
    title: "Generate, refine, and save",
    description:
      "Run AI generation, preview the result, edit sections as needed, and save finished materials to your Teacher Resource Library.",
    icon: FileCheck2,
    accent: "emerald",
  },
] as const;

function toolAccent(suffix: string): string {
  switch (suffix) {
    case "/homework":
      return "amber";
    case "/study-guides":
    case "/students":
      return "sky";
    case "/worksheets":
      return "rose";
    default:
      return "violet";
  }
}

function toolHref(
  suffix: string,
  queryString: string,
  absoluteHref?: string,
): string {
  if (absoluteHref) return absoluteHref;
  const normalized = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return withTeacherQuery(`/teacher${normalized}`, queryString);
}

export function TeacherDashboardHome({
  planLabel,
  workspaceNote,
  teacherQueryString = "",
}: {
  planLabel: string;
  workspaceNote: string;
  teacherQueryString?: string;
}) {
  const toolCount = TEACHER_DASHBOARD_NAV.reduce(
    (count, section) => count + section.items.length,
    0,
  );

  return (
    <div className="teacher-home flex w-full flex-col gap-5">
      <Card
        className={cn(
          teamAdminCardClass,
          "lesson-studio-hero teacher-home-hero overflow-hidden",
        )}
      >
        <CardHeader className="gap-4 pb-4 sm:pb-5">
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Teacher workspace
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Teacher Dashboard
                </h1>
                <Badge className="teacher-plan-pill h-6 px-2.5 text-xs font-medium">
                  {planLabel}
                </Badge>
              </div>
              <CardDescription className="max-w-3xl text-sm leading-relaxed sm:text-[0.9375rem]">
                {workspaceNote}
              </CardDescription>
            </div>
            <Image
              src="/artwork/home/docs-owl.png"
              alt=""
              width={140}
              height={140}
              className="lesson-studio-owl"
            />
          </div>
        </CardHeader>
      </Card>

      <Card className={cn(teamAdminCardClass, "teacher-home-guide")}>
        <CardHeader className="gap-3 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base font-semibold">Using your teacher tools</CardTitle>
            <Badge className="teacher-home-count h-5 px-2 text-[10px] font-medium uppercase tracking-wide">
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
          <div className="teacher-home-note flex items-start gap-2 px-3 py-2.5 text-sm lg:hidden">
            <PanelLeft className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              On smaller screens, open <span className="font-medium">Teacher menu</span>{" "}
              above to access the same navigation panel shown on desktop.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {WORKFLOW_STEPS.map((step, index) => {
              const StepIcon = step.icon;
              return (
                <div key={step.title} className="teacher-home-step">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
                        <span className="teacher-home-step-index">{index + 1}</span>
                        Step {index + 1}
                      </p>
                      <p className="text-sm font-medium">{step.title}</p>
                    </div>
                    <span className="lesson-studio-chip" data-accent={step.accent}>
                      <StepIcon className="size-4" aria-hidden />
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="space-y-6">
            {TEACHER_DASHBOARD_NAV.map((section) => (
              <section key={section.title} className="space-y-3">
                <div className="teacher-home-section-head">
                  <h3 className="text-sm font-semibold">{section.title}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {section.description}
                  </p>
                </div>
                <ul className="teacher-home-tools">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const href = toolHref(
                      item.suffix,
                      teacherQueryString,
                      item.absoluteHref,
                    );
                    return (
                      <li key={item.title}>
                        <Link href={href} className="teacher-home-tool">
                          <span
                            className="lesson-studio-chip"
                            data-accent={toolAccent(item.suffix)}
                          >
                            <Icon className="size-4" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{item.title}</span>
                            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                              {item.summary}
                            </span>
                          </span>
                          <span className="teacher-home-arrow" aria-hidden>
                            <ArrowRight className="size-4" />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          <div className="teacher-home-note flex items-start gap-3 px-4 py-3.5">
            <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="text-xs leading-relaxed sm:text-sm">
              <span className="font-medium">Tip:</span> AI generators require an
              internet connection and at least one linked deck with cards. Saved outputs appear in
              the Teacher Resource Library for reuse across your classes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
