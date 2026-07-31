import type { LucideIcon } from "lucide-react";
import {
  FilePenLine,
  FolderOpen,
  LayoutDashboard,
  Scale,
  Sparkles,
  Type,
} from "lucide-react";

export type EssayNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  summary: string;
};

export const ESSAY_DASHBOARD_NAV: EssayNavItem[] = [
  {
    title: "Overview",
    href: "/dashboard/essay",
    icon: LayoutDashboard,
    summary: "Recent essays, drafts, and quick actions.",
  },
  {
    title: "Essay Generator",
    href: "/dashboard/essay/generate",
    icon: Sparkles,
    summary: "Create a new AI essay activity in Document Generation Studio.",
  },
  {
    title: "My Essays",
    href: "/dashboard/essay/my-essays",
    icon: FolderOpen,
    summary: "Browse essays you have generated.",
  },
  {
    title: "Drafts",
    href: "/dashboard/essay/drafts",
    icon: FilePenLine,
    summary: "Continue unfinished writing.",
  },
  {
    title: "Citation & Formatting",
    href: "/dashboard/essay/citation-formatting",
    icon: Type,
    summary: "Select a saved essay and apply a citation format.",
  },
  {
    title: "Academic Integrity",
    href: "/dashboard/essay/academic-integrity",
    icon: Scale,
    summary: "Browse saved essays that have been cited and formatted.",
  },
];

export function isEssayNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard/essay") {
    return pathname === "/dashboard/essay";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
