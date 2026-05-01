import { getGradientBySlug, type DeckGradient } from "@/lib/deck-gradients";

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.replace(/^#/, "").trim();
  if (!raw || raw === "transparent") return null;
  if (raw.length === 3) {
    const [a, b, c] = raw;
    if (!a || !b || !c) return null;
    return {
      r: parseInt(a + a, 16),
      g: parseInt(b + b, 16),
      b: parseInt(c + c, 16),
    };
  }
  if (raw.length === 6 && /^[0-9a-fA-F]{6}$/.test(raw)) {
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16),
    };
  }
  return null;
}

/** WCAG relative luminance for sRGB hex (0–1). */
export function relativeLuminanceFromHex(hex: string): number {
  const rgb = parseHexRgb(hex);
  if (!rgb) return 0;
  const lin = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const r = lin(rgb.r);
  const g = lin(rgb.g);
  const b = lin(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Text colour on solid fills using the deck preview swatch (readable contrast). */
export function contrastTextOnAccent(fillHex: string): "#fafafa" | "#0a0a0a" {
  return relativeLuminanceFromHex(fillHex) > 0.45 ? "#0a0a0a" : "#fafafa";
}

export type DeckQuizAccent = {
  gradient: DeckGradient;
  /** Deck has a non-default gradient / colour theme. */
  hasDeckAccent: boolean;
  /** Mid-tone swatch — solid buttons, progress, current pill. */
  accent: string | null;
  /** For text/icons on solid `accent` fills. */
  accentForeground: string | null;
};

export function getDeckQuizAccent(deckGradientSlug: string | null | undefined): DeckQuizAccent {
  const gradient = getGradientBySlug(deckGradientSlug);
  const hasDeckAccent = gradient.slug !== "none" && gradient.previewColor !== "transparent";
  if (!hasDeckAccent) {
    return { gradient, hasDeckAccent: false, accent: null, accentForeground: null };
  }
  const accent = gradient.previewColor;
  return {
    gradient,
    hasDeckAccent: true,
    accent,
    accentForeground: contrastTextOnAccent(accent),
  };
}
