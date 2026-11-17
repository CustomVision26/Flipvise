"use client";

import { useState, useSyncExternalStore, type MouseEvent, type ReactElement } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type HeaderNavTooltipProps = {
  label: string;
  children: ReactElement<{
    href?: string;
    onClick?: (event: MouseEvent<HTMLElement>) => void;
    nativeButton?: boolean;
    render?: ReactElement<{ href?: string }>;
  }>;
  side?: "top" | "bottom" | "left" | "right";
};

const popoverActionClass =
  "h-auto whitespace-normal bg-transparent px-0 py-0 text-left text-xs text-background hover:bg-transparent hover:text-background";

function subscribeCoarsePointer(onChange: () => void) {
  const query = window.matchMedia("(pointer: coarse)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readCoarsePointer() {
  return window.matchMedia("(pointer: coarse)").matches;
}

function useCoarsePointer() {
  return useSyncExternalStore(subscribeCoarsePointer, readCoarsePointer, () => false);
}

function triggerHref(child: HeaderNavTooltipProps["children"]) {
  if (typeof child.props.href === "string") return child.props.href;
  const renderedHref = child.props.render?.props?.href;
  return typeof renderedHref === "string" ? renderedHref : null;
}

function triggerRendersButton(child: HeaderNavTooltipProps["children"]) {
  if (child.props.href || child.props.nativeButton === false) return false;
  if (child.props.render?.props?.href) return false;
  return true;
}

/**
 * Name popover for header icons. Hover opens it with a mouse.
 * On a phone or tablet the first tap shows the name. Tap that name to open it.
 */
export function HeaderNavTooltip({
  label,
  children,
  side = "bottom",
}: HeaderNavTooltipProps) {
  const coarse = useCoarsePointer();
  const [open, setOpen] = useState(false);
  const href = triggerHref(children);

  function holdFirstTap(event: MouseEvent<HTMLElement>) {
    if (!coarse || open) return;
    if (event.currentTarget.closest("[data-header-tools]") == null) return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  }

  function runButtonAction(event: MouseEvent<HTMLElement>) {
    setOpen(false);
    children.props.onClick?.(event);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <span className="inline-flex" onClickCapture={holdFirstTap}>
        <PopoverTrigger
          openOnHover
          delay={120}
          closeDelay={80}
          nativeButton={triggerRendersButton(children)}
          render={children}
        />
      </span>
      <PopoverContent
        side={side}
        className="z-[80] w-auto max-w-xs whitespace-normal rounded-md bg-foreground px-3 py-1.5 text-xs leading-snug text-background shadow-md ring-0"
      >
        {href ? (
          <Button
            nativeButton={false}
            render={<Link href={href} />}
            variant="ghost"
            size="sm"
            className={popoverActionClass}
          >
            {label}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={popoverActionClass}
            onClick={runButtonAction}
          >
            {label}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
