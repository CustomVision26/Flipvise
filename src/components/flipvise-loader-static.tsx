import Image from "next/image";
import { Sparkles } from "lucide-react";
import { LOGO_PUBLIC_URL } from "@/lib/branding";
import { cn } from "@/lib/utils";

export type FlipviseLoaderStaticProps = {
  variant?: "fullscreen" | "inline";
  message?: string;
  className?: string;
};

/**
 * Server-safe branded loader (CSS flip-card). Use in `loading.tsx` boundaries —
 * no client hooks, Lottie, or dynamic imports.
 */
export function FlipviseLoaderStatic({
  variant = "inline",
  message,
  className,
}: FlipviseLoaderStaticProps) {
  const large = variant === "fullscreen";
  const cardClass = large ? "h-28 w-40 sm:h-32 sm:w-44" : "h-20 w-28 sm:h-24 sm:w-32";
  const logoSize = large ? 56 : 40;
  const iconSize = large ? "size-10" : "size-7";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        variant === "fullscreen" &&
          "flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4",
        variant === "inline" &&
          "flex flex-col items-center justify-center gap-3 py-4",
        className,
      )}
    >
      <div className={cn("flipvise-loader-scene relative", cardClass)} aria-hidden>
        <div
          className={cn(
            "flipvise-loader-deck-card inset-0 translate-x-2 translate-y-2 rotate-3 opacity-40",
            cardClass,
          )}
        />
        <div
          className={cn(
            "flipvise-loader-deck-card inset-0 translate-x-1 translate-y-1 -rotate-2 opacity-60",
            cardClass,
          )}
        />

        <div className={cn("flipvise-loader-flipper", cardClass)}>
          <div
            className={cn(
              "flipvise-loader-face glass-card-3d neon-border-blue border-2 border-cyan-400/40 bg-gradient-to-br from-cyan-500/15 to-blue-600/15 shadow-lg shadow-cyan-500/20",
              cardClass,
            )}
          >
            <Image
              src={LOGO_PUBLIC_URL}
              alt=""
              width={logoSize}
              height={logoSize}
              className="object-contain"
              priority={large}
            />
          </div>
          <div
            className={cn(
              "flipvise-loader-face flipvise-loader-face--back glass-card-3d neon-border-purple border-2 border-purple-400/40 bg-gradient-to-br from-purple-500/15 to-violet-600/15 shadow-lg shadow-purple-500/20",
              cardClass,
            )}
          >
            <Sparkles className={cn(iconSize, "text-purple-300")} />
          </div>
        </div>
      </div>

      {message ? (
        <p className="text-center text-sm text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}
