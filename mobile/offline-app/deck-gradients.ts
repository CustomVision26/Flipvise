/** CSS gradient backgrounds for offline deck tiles (matches `src/lib/deck-gradients.ts` slugs). */
export const OFFLINE_DECK_GRADIENTS: Record<string, string> = {
  ocean: "linear-gradient(145deg, #1e3a8a 0%, #0e7490 50%, #0f766e 100%)",
  sunset: "linear-gradient(145deg, #881337 0%, #c2410c 50%, #d97706 100%)",
  forest: "linear-gradient(145deg, #064e3b 0%, #166534 50%, #4d7c0f 100%)",
  violet: "linear-gradient(145deg, #4c1d95 0%, #6b21a8 50%, #a21caf 100%)",
  midnight: "linear-gradient(145deg, #0f172a 0%, #1f2937 50%, #3f3f46 100%)",
  rose: "linear-gradient(145deg, #831843 0%, #be123c 50%, #dc2626 100%)",
  sky: "linear-gradient(145deg, #075985 0%, #1d4ed8 50%, #4338ca 100%)",
};

export function offlineDeckGradientStyle(
  slug: string | null | undefined,
): string | undefined {
  if (!slug || slug === "none") return undefined;
  return OFFLINE_DECK_GRADIENTS[slug];
}
