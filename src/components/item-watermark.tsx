import { cn } from "@/lib/utils";

export type ItemWatermarkView = "grid" | "list" | "compact";

export function ItemWatermark({
  label,
  view,
  onGradient = false,
}: {
  label: string;
  view: ItemWatermarkView;
  onGradient?: boolean;
}) {
  return (
    <span
      data-item-watermark
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-0 flex overflow-hidden select-none leading-none",
        view === "list"
          ? "bottom-0 right-0 top-0 w-[36%] items-center justify-end pr-1"
          : view === "compact"
            ? "bottom-6 left-0 right-0 h-[38%] items-end justify-center"
            : "bottom-1 right-2 top-1 w-[40%] items-center justify-end",
        "text-[length:clamp(0.7rem,min(14cqi,4.5vw),2.75rem)] tracking-[0.16em]",
        "rotate-[-12deg] font-semibold uppercase",
        onGradient ? "text-white/18" : "text-muted-foreground/22",
      )}
    >
      {label}
    </span>
  );
}

export const itemCardContainerClass =
  "@container/item-card [container-type:inline-size] relative overflow-hidden [&>*:not([data-item-watermark])]:relative [&>*:not([data-item-watermark])]:z-[1]";

export function itemPrimaryTextClass(onGradient = false) {
  return cn(
    "relative z-[2]",
    onGradient
      ? "drop-shadow-md"
      : "drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]",
  );
}
