"use client";

import { useCallback, useRef, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const THUMB_SIZE_PX = 44;
const TRACK_PADDING_PX = 4;
const COMPLETE_RATIO = 0.9;

export function SlideToSubmitButton({
  label,
  disabled,
  pending,
  onSubmit,
  variant = "default",
}: {
  label: string;
  disabled?: boolean;
  pending?: boolean;
  onSubmit: () => void | Promise<void>;
  /** `checkout` — light Stripe-style track with navy thumb */
  variant?: "default" | "checkout";
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const committedRef = useRef(false);

  const reset = useCallback(() => {
    setOffsetX(0);
    committedRef.current = false;
  }, []);

  const maxOffset = useCallback(() => {
    const track = trackRef.current;
    if (!track) return 0;
    return Math.max(0, track.clientWidth - THUMB_SIZE_PX - TRACK_PADDING_PX * 2);
  }, []);

  const commit = useCallback(async () => {
    if (committedRef.current || disabled || pending) return;
    committedRef.current = true;
    setOffsetX(maxOffset());
    try {
      await onSubmit();
    } catch {
      // Caller surfaces errors; unlock the slider for retry.
    } finally {
      reset();
    }
  }, [disabled, maxOffset, onSubmit, pending, reset]);

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || pending) return;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging || disabled || pending) return;
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const max = maxOffset();
    const next = Math.max(
      0,
      Math.min(max, event.clientX - rect.left - THUMB_SIZE_PX / 2 - TRACK_PADDING_PX),
    );
    setOffsetX(next);
    if (next >= max * COMPLETE_RATIO) {
      void commit();
    }
  };

  const endDrag = () => {
    setDragging(false);
    if (!committedRef.current) reset();
  };

  return (
    <div
      ref={trackRef}
      className={cn(
        "relative h-12 w-full overflow-hidden rounded-md border",
        variant === "checkout"
          ? "border-[#1a2332]/20 bg-[#eef1f5]"
          : "border-border/80 bg-muted/30",
        (disabled || pending) && "opacity-60",
      )}
      aria-disabled={disabled || pending}
    >
      <span
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center px-14 text-center text-sm font-medium",
          variant === "checkout" ? "text-[#6b7280]" : "text-muted-foreground",
        )}
      >
        {pending ? "Processing…" : label}
      </span>
      <Button
        type="button"
        size="icon"
        disabled={disabled || pending}
        className={cn(
          "absolute top-1 left-1 z-10 size-11 touch-none rounded-md shadow-sm transition-[transform] duration-75",
          variant === "checkout" &&
            "bg-[#1a2332] text-white hover:bg-[#1a2332]/90",
          !dragging && offsetX === 0 && "transition-transform duration-200",
        )}
        style={{ transform: `translateX(${offsetX}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        aria-label={label}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ChevronRight className="size-4" />
        )}
      </Button>
    </div>
  );
}
