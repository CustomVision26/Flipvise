import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Building2,
  LayoutList,
  LifeBuoy,
  Megaphone,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

export type AdminNavItem = {
  title: string;
  path: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
};

export type AdminNavSection = {
  title: string;
  description: string;
  items: AdminNavItem[];
};

function pathMatches(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export const ADMIN_DASHBOARD_NAV: AdminNavSection[] = [
  {
    title: "Users & workspaces",
    description: "Monitor accounts and team workspaces across Flipvise.",
    items: [
      {
        title: "Team Workspaces",
        path: "/admin/team-workspaces",
        icon: Building2,
        isActive: (pathname) => pathname === "/admin/team-workspaces",
      },
    ],
  },
  {
    title: "Billing",
    description: "Subscriptions, invoices, and payment monitoring.",
    items: [
      {
        title: "Subscription",
        path: "/admin/subscription",
        icon: WalletCards,
        isActive: (pathname) =>
          pathname === "/admin/subscription" ||
          pathname === "/admin/subscription-monitor" ||
          pathname === "/admin/subscription-deletion-proration" ||
          pathname === "/admin/paid-subscribers",
      },
      {
        title: "Invoices",
        path: "/admin/invoices",
        icon: ReceiptText,
        isActive: (pathname) => pathname === "/admin/invoices",
      },
    ],
  },
  {
    title: "Access & support",
    description: "Admin roles, audit history, and support queues.",
    items: [
      {
        title: "Admin Roles",
        path: "/admin/admin-roles",
        icon: ShieldCheck,
        isActive: (pathname) =>
          pathname === "/admin/admin-roles" || pathname === "/admin/audit-log",
      },
      {
        title: "Support Center",
        path: "/admin/support-center",
        icon: LifeBuoy,
        isActive: (pathname) => pathMatches(pathname, "/admin/support-center"),
      },
    ],
  },
  {
    title: "Plans & growth",
    description: "Pricing, trials, and affiliate programs.",
    items: [
      {
        title: "Plans",
        path: "/admin/plans",
        icon: LayoutList,
        isActive: (pathname) =>
          pathname === "/admin/plans" ||
          pathname === "/admin/plan-history" ||
          pathname === "/admin/affiliate-messaging" ||
          pathname === "/admin/plan-trials",
      },
      {
        title: "Marketing Affiliates",
        path: "/admin/marketing-affiliates",
        icon: Megaphone,
        isActive: (pathname) => pathname === "/admin/marketing-affiliates",
      },
    ],
  },
  {
    title: "Documentation",
    description: "Platform admin and user documentation.",
    items: [
      {
        title: "Documentation",
        path: "/admin/documentation",
        icon: BookOpen,
        isActive: (pathname) => pathname === "/admin/documentation",
      },
    ],
  },
];

export function isAdminOverviewActive(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname === "/admin/all-users"
  );
}
