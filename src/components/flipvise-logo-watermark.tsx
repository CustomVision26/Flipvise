import { LOGO_PUBLIC_URL } from "@/lib/branding";

/**
 * Faded centered logo behind full-screen views (native sign-in, etc.).
 * Matches the offline Study shell watermark in `mobile/offline-app/styles.css`.
 */
export function FlipviseLogoWatermark() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_PUBLIC_URL}
        alt=""
        className="h-auto w-[min(62vw,340px)] opacity-[0.05] grayscale"
      />
    </div>
  );
}
