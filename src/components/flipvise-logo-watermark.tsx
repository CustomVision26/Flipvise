import { LOGO_PUBLIC_URL } from "@/lib/branding";
import { cn } from "@/lib/utils";

/**
 * Faded centered logo behind full-screen views (native sign-in, etc.).
 * Matches the offline Study shell watermark in `mobile/offline-app/styles.css`.
 */
export function FlipviseLogoWatermark({
  className,
  opacityClassName = "opacity-[0.14]",
}: {
  className?: string;
  /** Tailwind opacity utility — slightly stronger on glass sign-in surfaces. */
  opacityClassName?: string;
} = {}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 z-[1] flex items-center justify-center",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_PUBLIC_URL}
        alt=""
        className={cn(
          "h-auto w-[min(68vw,380px)] grayscale",
          opacityClassName,
        )}
      />
    </div>
  );
}
