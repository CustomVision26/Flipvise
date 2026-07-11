import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  FileText,
  GraduationCap,
  HelpCircle,
  LayoutGrid,
  Library,
  NotebookPen,
  PenLine,
} from "lucide-react";

export type TeacherNavItem = {
  title: string;
  suffix: string;
  icon: LucideIcon;
  /** One-line description for the Teacher Dashboard welcome guide. */
  summary: string;
};

export type TeacherNavSection = {
  title: string;
  description: string;
  items: TeacherNavItem[];
};

export const TEACHER_DASHBOARD_NAV: TeacherNavSection[] = [
  {
    title: "AI content tools",
    description: "Generate structured materials from your linked deck cards.",
    items: [
      {
        title: "AI Lesson Builder",
        suffix: "/lesson-builder",
        icon: NotebookPen,
        summary: "Build multi-day lesson plans with objectives, activities, and assessments from your deck content.",
      },
      {
        title: "AI Quiz/Test Generator",
        suffix: "/quizzes",
        icon: HelpCircle,
        summary: "Create classroom quizzes and tests; review AI-generated questions before saving to a deck.",
      },
      {
        title: "Homework Generator",
        suffix: "/homework",
        icon: PenLine,
        summary: "Produce take-home assignments aligned to the topics in your linked flashcard decks.",
      },
      {
        title: "Study Guide Generator",
        suffix: "/study-guides",
        icon: BookOpen,
        summary: "Generate structured study guides for students, with PDF export when you are ready to distribute.",
      },
      {
        title: "Worksheet Generator",
        suffix: "/worksheets",
        icon: FileText,
        summary: "Create printable practice worksheets and answer keys from your deck vocabulary and concepts.",
      },
    ],
  },
  {
    title: "Classroom management",
    description: "Organize classes, track students, and review progress.",
    items: [
      {
        title: "Classes",
        suffix: "/classes",
        icon: LayoutGrid,
        summary: "Organize classroom groups and associate students with the materials you create.",
      },
      {
        title: "Student Progress",
        suffix: "/students",
        icon: GraduationCap,
        summary: "Review student quiz performance and study activity across your classes.",
      },
    ],
  },
  {
    title: "Resources",
    description: "Access saved materials and reusable content.",
    items: [
      {
        title: "Teacher Resource Library",
        suffix: "/resources",
        icon: Library,
        summary: "Browse, reopen, and reuse saved lesson plans, quizzes, homework, and study materials.",
      },
    ],
  },
];

export function isTeacherNavItemActive(pathname: string, suffix: string): boolean {
  const normalized = suffix.startsWith("/") ? suffix : `/${suffix}`;
  const target = `/teacher${normalized}`;
  if (target === "/teacher") {
    return pathname === "/teacher";
  }
  return pathname === target || pathname.startsWith(`${target}/`);
}
