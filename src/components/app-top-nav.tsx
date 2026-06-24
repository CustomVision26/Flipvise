"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, Mail } from "lucide-react";
import { HeaderNavTooltip } from "@/components/header-nav-tooltip";
import { cn } from "@/lib/utils";

type AppTopNavProps = {
  homeHref?: string;
  className?: string;
  /** When true, Home and Contact Us are hidden (authenticated header). */
  signedIn?: boolean;
};

const navItemClassName =
  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors sm:text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground";

export function AppTopNav({
  homeHref = "/",
  className,
  signedIn = false,
}: AppTopNavProps) {
  const pathname = usePathname() ?? "";
  const isDocs = pathname === "/docs" || pathname.startsWith("/docs/");
  const isContact = pathname === "/contact" || pathname.startsWith("/contact/");
  const isHome =
    pathname === "/" ||
    pathname === homeHref ||
    pathname.startsWith("/dashboard");
  const isGuestHomepage = !signedIn && pathname === "/";

  const linkItems = [
    ...(!signedIn && !isGuestHomepage
      ? [
          {
            href: homeHref,
            label: "Home",
            shortLabel: "Home",
            tooltip: "Home",
            icon: Home,
            active: isHome,
          },
        ]
      : []),
    ...(!isGuestHomepage
      ? [
          {
            href: "/docs",
            label: "Documentation",
            shortLabel: "Docs",
            tooltip: "Documentation",
            icon: BookOpen,
            active: isDocs,
          },
        ]
      : []),
  ] as const;

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "inline-flex min-w-0 flex-wrap items-center gap-1 rounded-full border border-border/50 bg-muted/15 p-1",
        className,
      )}
    >
      {linkItems.map(({ href, label, shortLabel, tooltip, icon: Icon, active }) => (
        <HeaderNavTooltip key={href + label} label={tooltip}>
          <Link
            href={href}
            className={cn(
              navItemClassName,
              active && "bg-muted/70 text-foreground",
            )}
            aria-current={active ? "page" : undefined}
            aria-label={label}
          >
            <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{shortLabel}</span>
          </Link>
        </HeaderNavTooltip>
      ))}

      {!signedIn && (
        <HeaderNavTooltip label="Contact Us">
          <Link
            href="/contact"
            className={cn(
              navItemClassName,
              isContact && "bg-muted/70 text-foreground",
            )}
            aria-current={isContact ? "page" : undefined}
            aria-label="Contact Us"
          >
            <Mail className="size-3.5 shrink-0 opacity-80" aria-hidden />
            <span className="hidden sm:inline">Contact Us</span>
            <span className="sm:hidden">Contact</span>
          </Link>
        </HeaderNavTooltip>
      )}
    </nav>
  );
}
