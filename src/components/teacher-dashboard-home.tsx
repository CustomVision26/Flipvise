"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  FileText,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  LayoutGrid,
  Library,
  NotebookPen,
  PenLine,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import { buildTeacherSubPath } from "@/lib/teacher-url";
import type { TeacherWorkspaceContext } from "@/lib/teacher-url";

export type TeacherDashboardDeck = {
  title: string;
  description: string;
  icon: LucideIcon;
  suffix: string;
  buttonLabel: string;
};

type TeacherDashboardSection = {
  title: string;
  description: string;
  decks: TeacherDashboardDeck[];
};

const TEACHER_DASHBOARD_SECTIONS: TeacherDashboardSection[] = [
  {
    title: "AI content tools",
    description: "Generate structured materials from your linked deck cards.",
    decks: [
      {
        title: "AI Lesson Builder",
        description: "Build lesson plans with objectives, activities, and assessments.",
        icon: NotebookPen,
        suffix: "/lesson-builder",
        buttonLabel: "Open Lesson Builder",
      },
      {
        title: "AI Quiz/Test Generator",
        description: "Create quizzes with answer keys from deck content.",
        icon: HelpCircle,
        suffix: "/quizzes",
        buttonLabel: "Generate Quiz",
      },
      {
        title: "Homework Generator",
        description: "Build homework assignments and answer keys for your classes.",
        icon: PenLine,
        suffix: "/homework",
        buttonLabel: "Generate Homework",
      },
      {
        title: "Study Guide Generator",
        description: "Produce study guides with vocabulary, key points, and practice questions.",
        icon: BookOpen,
        suffix: "/study-guides",
        buttonLabel: "Generate Study Guide",
      },
      {
        title: "Worksheet Generator",
        description: "Create printable worksheets with student sections and teacher answer keys.",
        icon: FileText,
        suffix: "/worksheets",
        buttonLabel: "Generate Worksheet",
      },
      {
        title: "Answer Key Generator",
        description: "Generate answer keys from your lesson materials and assessments.",
        icon: ClipboardList,
        suffix: "/worksheets",
        buttonLabel: "Generate Answer Key",
      },
    ],
  },
  {
    title: "Classroom management",
    description: "Organize classes, track students, and review progress.",
    decks: [
      {
        title: "Classes",
        description: "Manage classes linked to decks used for lesson plan generation.",
        icon: LayoutGrid,
        suffix: "/classes",
        buttonLabel: "Manage Classes",
      },
      {
        title: "Students",
        description: "Track student progress, quiz scores, and assignment completion.",
        icon: Users,
        suffix: "/students",
        buttonLabel: "View Students",
      },
      {
        title: "Student Progress",
        description: "Monitor class-wide performance and identify topics needing review.",
        icon: GraduationCap,
        suffix: "/students",
        buttonLabel: "View Progress",
      },
    ],
  },
  {
    title: "Resources",
    description: "Access saved materials and reusable content.",
    decks: [
      {
        title: "Teacher Resource Library",
        description: "Browse saved lesson plans, quizzes, worksheets, and study guides.",
        icon: Library,
        suffix: "/resources",
        buttonLabel: "View Resources",
      },
    ],
  },
];

const teacherToolCardClass = cn(
  teamAdminCardClass,
  "flex flex-col backdrop-blur-sm transition-colors hover:border-border hover:bg-card/75 hover:shadow-md",
);

function TeacherToolCard({
  deck,
  teacherWorkspace,
}: {
  deck: TeacherDashboardDeck;
  teacherWorkspace: TeacherWorkspaceContext;
}) {
  const Icon = deck.icon;

  return (
    <Card className={teacherToolCardClass}>
      <CardHeader className="flex-1 space-y-3 pb-3">
        <div className="flex items-start gap-3">
          <span
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/40"
            aria-hidden
          >
            <Icon className="size-4 text-primary" />
          </span>
          <div className="min-w-0 space-y-1.5">
            <CardTitle className="text-base font-semibold leading-snug">
              {deck.title}
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              {deck.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Link
          href={buildTeacherSubPath(
            deck.suffix,
            teacherWorkspace.teamId,
            teacherWorkspace.teamMemberId,
          )}
          className={cn(
            buttonVariants({ variant: "outline", size: "default" }),
            "h-9 w-full justify-between gap-2 px-3 font-medium",
          )}
        >
          <span>{deck.buttonLabel}</span>
          <ArrowRight className="size-4 shrink-0 opacity-70" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  );
}

export function TeacherDashboardHome({
  planLabel,
  workspaceNote,
  teamAdminHref = null,
  teacherWorkspace,
}: {
  planLabel: string;
  workspaceNote: string;
  teamAdminHref?: string | null;
  teacherWorkspace: TeacherWorkspaceContext;
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:gap-10 sm:px-6 sm:py-8">
      <Card className={cn(teamAdminCardClass, "overflow-hidden backdrop-blur-md")}>
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
            {teamAdminHref ? (
              <Link
                href={teamAdminHref}
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "inline-flex h-9 shrink-0 items-center gap-2 self-start font-medium",
                )}
              >
                <LayoutDashboard className="size-4" aria-hidden />
                Team Admin Dashboard
                <ArrowRight className="size-4 opacity-70" aria-hidden />
              </Link>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      <div className="flex flex-col gap-8 sm:gap-10">
        {TEACHER_DASHBOARD_SECTIONS.map((section, sectionIndex) => (
          <section key={section.title} className="space-y-4 sm:space-y-5">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
                {section.title}
              </h2>
              <p className="text-sm text-muted-foreground">{section.description}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {section.decks.map((deck) => (
                <TeacherToolCard
                  key={deck.title}
                  deck={deck}
                  teacherWorkspace={teacherWorkspace}
                />
              ))}
            </div>
            {sectionIndex < TEACHER_DASHBOARD_SECTIONS.length - 1 ? (
              <Separator className="mt-2 bg-border/60" />
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
