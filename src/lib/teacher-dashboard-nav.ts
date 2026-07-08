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
      },
      {
        title: "AI Quiz/Test Generator",
        suffix: "/quizzes",
        icon: HelpCircle,
      },
      {
        title: "Homework Generator",
        suffix: "/homework",
        icon: PenLine,
      },
      {
        title: "Study Guide Generator",
        suffix: "/study-guides",
        icon: BookOpen,
      },
      {
        title: "Worksheet Generator",
        suffix: "/worksheets",
        icon: FileText,
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
      },
      {
        title: "Student Progress",
        suffix: "/students",
        icon: GraduationCap,
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
