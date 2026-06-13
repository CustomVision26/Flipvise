"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { LOGO_PUBLIC_URL } from "@/lib/branding";
import { FLIPVISE_LOADER_LOTTIE_URL } from "@/lib/loader-animation";
import { cn } from "@/lib/utils";

const Lottie = dynamic(
  () => import("lottie-react").then((m) => m.default),
  { ssr: false },
);

type LottieJson = Record<string, unknown>;

let lottieFetchPromise: Promise<LottieJson | null> | null = null;

function fetchLottieAnimation(): Promise<LottieJson | null> {
  if (!lottieFetchPromise) {
    lottieFetchPromise = fetch(FLIPVISE_LOADER_LOTTIE_URL)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
  }
  return lottieFetchPromise;
}

function useLottieAnimation(enabled: boolean) {
  const [data, setData] = useState<LottieJson | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setReady(true);
      return;
    }

    let cancelled = false;
    void fetchLottieAnimation().then((json) => {
      if (cancelled) return;
      setData(json);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { data, ready };
}

function CssFlipLoader({ large }: { large: boolean }) {
  const cardClass = large ? "h-28 w-40 sm:h-32 sm:w-44" : "h-20 w-28 sm:h-24 sm:w-32";
  const logoSize = large ? 56 : 40;
  const iconSize = large ? "size-10" : "size-7";

  return (
    <div
      className={cn("flipvise-loader-scene relative", cardClass)}
      aria-hidden
    >
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
            unoptimized
            priority
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
  );
}

function LottieLoader({
  data,
  large,
}: {
  data: LottieJson;
  large: boolean;
}) {
  const sizeClass = large ? "h-36 w-36 sm:h-40 sm:w-40" : "h-20 w-20 sm:h-24 sm:w-24";

  return (
    <div className={cn("relative", sizeClass)} aria-hidden>
      <Lottie
        animationData={data}
        loop
        className="h-full w-full"
        aria-hidden
      />
    </div>
  );
}

export type FlipviseLoaderProps = {
  variant?: "fullscreen" | "inline";
  message?: string;
  className?: string;
};

export function FlipviseLoader({
  variant = "inline",
  message,
  className,
}: FlipviseLoaderProps) {
  const large = variant === "fullscreen";
  const { data: lottieData, ready } = useLottieAnimation(true);
  const showLottie = ready && lottieData != null;

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
      <div className="relative flex items-center justify-center">
        {showLottie ? (
          <div className="animate-in fade-in duration-300">
            <LottieLoader data={lottieData} large={large} />
          </div>
        ) : (
          <div
            className={cn(
              "transition-opacity duration-300",
              ready ? "opacity-100" : "opacity-70",
            )}
          >
            <CssFlipLoader large={large} />
          </div>
        )}
      </div>

      {message ? (
        <p className="text-center text-sm text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}
