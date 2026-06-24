"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeaderNavTooltip } from "@/components/header-nav-tooltip";
import { cn } from "@/lib/utils";

/** Header icon that links to `/docs` (signed-in users — keeps docs visible beside Help and Inbox). */
export function DocsNavIconButton() {
  const pathname = usePathname() ?? "";
  const active = pathname === "/docs" || pathname.startsWith("/docs/");

  return (
    <HeaderNavTooltip label="Documentation">
      <Button
        nativeButton={false}
        render={<Link href="/docs" />}
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8 rounded-full", active && "bg-muted/70 text-foreground")}
        aria-label="Documentation"
        aria-current={active ? "page" : undefined}
      >
        <BookOpen className="size-[18px]" aria-hidden />
      </Button>
    </HeaderNavTooltip>
  );
}
