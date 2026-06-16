"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, HelpCircle, Home, Mail } from "lucide-react";
import { openHelpCenter } from "@/lib/help-center-open";
import { cn } from "@/lib/utils";

type AppTopNavProps = {
  homeHref?: string;
  className?: string;
  /** When true, Home and Contact Us are hidden (authenticated header). */
  signedIn?: boolean;
  /** When false, Help Center is omitted (e.g. plain team members in team workspace). */
  showHelpCenter?: boolean;
  /** When true, Help Center opens the in-app sheet; otherwise links to documentation. */
  helpCenterOpensSheet?: boolean;
};

const navItemClassName =
  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors sm:text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground";

export function AppTopNav({
  homeHref = "/",
  className,
  signedIn = false,
  showHelpCenter = true,
  helpCenterOpensSheet = false,
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
      ? [{ href: homeHref, label: "Home", shortLabel: "Home", icon: Home, active: isHome }]
      : []),
    ...(!isGuestHomepage
      ? [{ href: "/docs", label: "Documentation", shortLabel: "Docs", icon: BookOpen, active: isDocs }]
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
      {linkItems.map(({ href, label, shortLabel, icon: Icon, active }) => (
        <Link
          key={href + label}
          href={href}
          className={cn(
            navItemClassName,
            active && "bg-muted/70 text-foreground",
          )}
          aria-current={active ? "page" : undefined}
        >
          <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">{shortLabel}</span>
        </Link>
      ))}

      {showHelpCenter &&
        !isGuestHomepage &&
        (helpCenterOpensSheet ? (
          <button
            type="button"
            className={navItemClassName}
            onClick={() => openHelpCenter()}
          >
            <HelpCircle className="size-3.5 shrink-0 opacity-80" aria-hidden />
            <span className="hidden sm:inline">Help Center</span>
            <span className="sm:hidden">Help</span>
          </button>
        ) : (
          <Link href="/docs#help-center-overview" className={navItemClassName}>
            <HelpCircle className="size-3.5 shrink-0 opacity-80" aria-hidden />
            <span className="hidden sm:inline">Help Center</span>
            <span className="sm:hidden">Help</span>
          </Link>
        ))}

      {!signedIn && (
        <Link
          href="/contact"
          className={cn(
            navItemClassName,
            isContact && "bg-muted/70 text-foreground",
          )}
          aria-current={isContact ? "page" : undefined}
        >
          <Mail className="size-3.5 shrink-0 opacity-80" aria-hidden />
          <span className="hidden sm:inline">Contact Us</span>
          <span className="sm:hidden">Contact</span>
        </Link>
      )}
    </nav>
  );
}
