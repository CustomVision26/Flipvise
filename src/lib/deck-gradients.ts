export type GradientSlug =
  | "none"
  | "ocean"
  | "sunset"
  | "forest"
  | "violet"
  | "midnight"
  | "rose"
  | "sky";

export type DeckGradient = {
  slug: GradientSlug;
  label: string;
  /** Tailwind utility classes applied to the element that needs the gradient background. */
  classes: string;
  /** Representative mid-colour used for swatch previews (CSS colour string). */
  previewColor: string;
};

export const DECK_GRADIENTS: DeckGradient[] = [
  { slug: "none",     label: "None",     classes: "",                                                                    previewColor: "transparent" },
  { slug: "ocean",    label: "Ocean",    classes: "bg-gradient-to-br from-blue-900 via-cyan-800 to-teal-700",            previewColor: "#164e63" },
  { slug: "sunset",   label: "Sunset",   classes: "bg-gradient-to-br from-rose-900 via-orange-700 to-amber-600",         previewColor: "#9f1239" },
  { slug: "forest",   label: "Forest",   classes: "bg-gradient-to-br from-emerald-900 via-green-800 to-lime-700",        previewColor: "#064e3b" },
  { slug: "violet",   label: "Violet",   classes: "bg-gradient-to-br from-violet-900 via-purple-800 to-fuchsia-700",     previewColor: "#4c1d95" },
  { slug: "midnight", label: "Midnight", classes: "bg-gradient-to-br from-slate-900 via-gray-800 to-zinc-700",           previewColor: "#0f172a" },
  { slug: "rose",     label: "Rose",     classes: "bg-gradient-to-br from-pink-900 via-rose-700 to-red-600",             previewColor: "#831843" },
  { slug: "sky",      label: "Sky",      classes: "bg-gradient-to-br from-sky-800 via-blue-700 to-indigo-600",           previewColor: "#075985" },
];

export function getGradientBySlug(slug: string | null | undefined): DeckGradient {
  return DECK_GRADIENTS.find((g) => g.slug === slug) ?? DECK_GRADIENTS[0]!;
}
