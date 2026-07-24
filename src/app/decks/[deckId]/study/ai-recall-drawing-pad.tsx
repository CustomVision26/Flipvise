"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Point = { x: number; y: number };

export type AiRecallDrawingPadHandle = {
  hasInk: () => boolean;
  toDataUrl: () => string | null;
  clear: () => void;
};

type AiRecallDrawingPadProps = {
  disabled?: boolean;
  className?: string;
  /** Bumps when parent wants a full reset (e.g. new card). */
  resetKey?: string | number;
  onInkChange?: (hasInk: boolean) => void;
  padRef?: React.MutableRefObject<AiRecallDrawingPadHandle | null>;
};

/**
 * Lightweight answer canvas for AI Recall™ drawing answers.
 * Uses a plain canvas (interaction surface), not a custom UI primitive library.
 */
export function AiRecallDrawingPad({
  disabled = false,
  className,
  resetKey,
  onInkChange,
  padRef,
}: AiRecallDrawingPadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const [hasInk, setHasInk] = useState(false);

  const markInk = useCallback(
    (next: boolean) => {
      setHasInk(next);
      onInkChange?.(next);
    },
    [onInkChange],
  );

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    markInk(false);
  }, [markInk]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const cssWidth = canvas.clientWidth || 560;
    const cssHeight = 220;
    canvas.width = Math.floor(cssWidth * ratio);
    canvas.height = Math.floor(cssHeight * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#0f172a";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    markInk(false);
  }, [resetKey, markInk]);

  useEffect(() => {
    if (!padRef) return;
    padRef.current = {
      hasInk: () => hasInk,
      toDataUrl: () => {
        const canvas = canvasRef.current;
        if (!canvas || !hasInk) return null;
        // JPEG keeps Server Action payloads smaller than PNG.
        return canvas.toDataURL("image/jpeg", 0.82);
      },
      clear: clearCanvas,
    };
    return () => {
      padRef.current = null;
    };
  }, [padRef, hasInk, clearCanvas]);

  function pointerPos(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const point = pointerPos(event);
    lastPointRef.current = point;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x + 0.01, point.y + 0.01);
    ctx.stroke();
    markInk(true);
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled) return;
    const ctx = canvasRef.current?.getContext("2d");
    const last = lastPointRef.current;
    if (!ctx || !last) return;
    const point = pointerPos(event);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
    markInk(true);
  }

  function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    try {
      canvasRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <canvas
        ref={canvasRef}
        className={cn(
          "h-[220px] w-full touch-none rounded-lg border border-border bg-white",
          disabled && "opacity-60",
        )}
        aria-label="Drawing answer canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Draw your answer — diagrams, equations, or short written words.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={clearCanvas}
          disabled={disabled || !hasInk}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear
        </Button>
      </div>
    </div>
  );
}
