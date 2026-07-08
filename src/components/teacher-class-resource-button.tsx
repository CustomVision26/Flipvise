"use client";

import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SavedClassResourceLink } from "@/db/queries/teacher-class-resources";
import { cn } from "@/lib/utils";

type TeacherClassResourceButtonProps = {
  label: string;
  icon: LucideIcon;
  savedItems: SavedClassResourceLink[];
  createHref: string;
  createLabel: string;
  emptyHref: string;
};

export function TeacherClassResourceButton({
  label,
  icon: Icon,
  savedItems,
  createHref,
  createLabel,
  emptyHref,
}: TeacherClassResourceButtonProps) {
  if (savedItems.length === 0) {
    return (
      <Link
        href={emptyHref}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
      >
        <Icon className="size-3.5" aria-hidden />
        {label}
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
      >
        <Icon className="size-3.5" aria-hidden />
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Saved for this deck</DropdownMenuLabel>
          {savedItems.map((item) => {
            const href = item.pdfUrl ?? item.href ?? createHref;
            const isExternal = Boolean(item.pdfUrl);

            if (isExternal) {
              return (
                <DropdownMenuItem
                  key={item.id}
                  render={
                    <a href={item.pdfUrl!} target="_blank" rel="noopener noreferrer" />
                  }
                  className="gap-2"
                >
                  <ExternalLink className="size-3.5 opacity-70" aria-hidden />
                  <span className="truncate">{item.title}</span>
                </DropdownMenuItem>
              );
            }

            return (
              <DropdownMenuItem key={item.id} render={<Link href={href} />} className="gap-2">
                <span className="truncate">{item.title}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={createHref} />} className="gap-2">
          <Plus className="size-3.5 opacity-70" aria-hidden />
          {createLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
