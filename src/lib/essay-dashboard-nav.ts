import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  FilePenLine,
  FolderOpen,
  LayoutDashboard,
  Sparkles,
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
    title: "Generate Essay",
    href: "/dashboard/essay/generate",
    icon: Sparkles,
    summary: "Create a new AI essay activity.",
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
    title: "Assignments",
    href: "/dashboard/essay/assignments",
    icon: ClipboardList,
    summary: "Essays assigned by your Team Admin.",
  },
];

export function isEssayNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard/essay") {
    return pathname === "/dashboard/essay";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
