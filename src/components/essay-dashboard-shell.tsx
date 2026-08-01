"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  ESSAY_DASHBOARD_NAV,
  isEssayNavItemActive,
} from "@/lib/essay-dashboard-nav";
import {
  DOCUMENT_STUDIO_TITLE,
  DOCUMENT_STUDIO_TYPES,
} from "@/lib/document-generation-studio";
import {
  AI_DOC_STUDIO_BASE,
  AI_ESSAY_STUDIO_BASE,
} from "@/lib/ai-document-studio-paths";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";
import { Badge } from "@/components/ui/badge";

export function EssayDashboardShell({
  children,
  unlocked,
}: {
  children: React.ReactNode;
  unlocked: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-4 sm:gap-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Link
            href={AI_DOC_STUDIO_BASE}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "-ml-2 w-fit gap-1.5 text-muted-foreground",
            )}
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            {DOCUMENT_STUDIO_TITLE}
          </Link>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Premium add-on · AI Essay
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Essay Generator
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate activities, write, and get AI feedback inside{" "}
              {DOCUMENT_STUDIO_TITLE}.
            </p>
          </div>
        </div>
        <Badge variant={unlocked ? "secondary" : "outline"}>
          {unlocked ? "Unlocked" : "Locked"}
        </Badge>
      </div>

      {unlocked ? (
        <>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Document types
            </p>
            <div className="flex flex-wrap gap-2">
              {DOCUMENT_STUDIO_TYPES.map((type) => {
                if (type.enabled && type.href) {
                  const typeActive =
                    pathname === AI_ESSAY_STUDIO_BASE ||
                    pathname.startsWith(`${AI_ESSAY_STUDIO_BASE}/`);
                  return (
                    <Link
                      key={type.id}
                      href={
                        type.id === "essay" ? AI_ESSAY_STUDIO_BASE : type.href
                      }
                      className={cn(
                        buttonVariants({
                          size: "sm",
                          variant: typeActive ? "default" : "outline",
                        }),
                      )}
                    >
                      {type.label}
                    </Link>
                  );
                }
                return (
                  <span
                    key={type.id}
                    className={cn(
                      buttonVariants({ size: "sm", variant: "outline" }),
                      "pointer-events-none opacity-60",
                    )}
                    aria-disabled="true"
                  >
                    {type.label}
                    <Badge variant="secondary" className="ml-1.5 text-[10px]">
                      Coming Soon
                    </Badge>
                  </span>
                );
              })}
            </div>
          </div>

          <nav
            className="flex flex-wrap gap-2"
            aria-label="AI Essay navigation"
          >
            {ESSAY_DASHBOARD_NAV.map((item) => {
              const active = isEssayNavItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    buttonVariants({
                      size: "sm",
                      variant: active ? "default" : "outline",
                    }),
                  )}
                >
                  <item.icon className="size-3.5" />
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </>
      ) : null}

      {children}
    </div>
  );
}
