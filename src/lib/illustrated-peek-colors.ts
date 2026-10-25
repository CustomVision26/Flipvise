const PEEK_ORANGES = ["#fb923c", "#f97316", "#fdba74", "#ea580c", "#ff8a3d"] as const;
const PEEK_BLUES = ["#60a5fa", "#38bdf8", "#2563eb", "#818cf8", "#3b82f6"] as const;

function peekSeed(seed: number | string): number {
  if (typeof seed === "number") {
    return Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) : 0;
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 33 + seed.charCodeAt(i)) >>> 0;
  return hash;
}

/** Stable orange/blue pair so each card's back layers differ without flickering. */
export function peekLayerColors(seed: number | string): { layerA: string; layerB: string } {
  const n = peekSeed(seed);
  const orange = PEEK_ORANGES[n % PEEK_ORANGES.length];
  const blue = PEEK_BLUES[Math.floor(n / PEEK_ORANGES.length) % PEEK_BLUES.length];
  return n % 2 === 0
    ? { layerA: orange, layerB: blue }
    : { layerA: blue, layerB: orange };
}
