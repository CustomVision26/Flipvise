import type { LucideIcon } from "lucide-react";
import {
  FilePenLine,
  FolderOpen,
  LayoutDashboard,
  Scale,
  Sparkles,
  Type,
} from "lucide-react";
import { AI_ESSAY_STUDIO_BASE } from "@/lib/ai-document-studio-paths";

export type EssayNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  summary: string;
};

export const ESSAY_DASHBOARD_NAV: EssayNavItem[] = [
  {
    title: "Overview",
    href: AI_ESSAY_STUDIO_BASE,
    icon: LayoutDashboard,
    summary: "Recent essays, drafts, and quick actions.",
  },
  {
    title: "Essay Generator",
    href: `${AI_ESSAY_STUDIO_BASE}/generate`,
    icon: Sparkles,
    summary: "Create a new AI essay activity in AI Document Studio.",
  },
  {
    title: "My Essays",
    href: `${AI_ESSAY_STUDIO_BASE}/my-essays`,
    icon: FolderOpen,
    summary: "Browse essays you have generated.",
  },
  {
    title: "Drafts",
    href: `${AI_ESSAY_STUDIO_BASE}/drafts`,
    icon: FilePenLine,
    summary: "Continue unfinished writing.",
  },
  {
    title: "Citation & Formatting",
    href: `${AI_ESSAY_STUDIO_BASE}/citation-formatting`,
    icon: Type,
    summary: "Select a saved essay and apply a citation format.",
  },
  {
    title: "Academic Integrity",
    href: `${AI_ESSAY_STUDIO_BASE}/academic-integrity`,
    icon: Scale,
    summary: "Browse saved essays that have been cited and formatted.",
  },
];

export function isEssayNavItemActive(pathname: string, href: string): boolean {
  if (href === AI_ESSAY_STUDIO_BASE) {
    return pathname === AI_ESSAY_STUDIO_BASE;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
