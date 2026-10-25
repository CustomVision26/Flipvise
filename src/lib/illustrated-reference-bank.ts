/**
 * Local cartoon reference bank for deck artwork.
 * Image generation checks this bank before calling an online image model.
 * Boards are the supplied style sheets. Tiles are the individual scenes cut
 * from those sheets so titles and controls stay in HTML.
 */

import {
  resolveSubjectArtwork,
  type SubjectKey,
} from "@/lib/illustrated-appearance";

export const ILLUSTRATED_REFERENCE_BOARDS = [
  "/illustrated/reference-bank/boards/learn-beyond-classroom.webp",
  "/illustrated/reference-bank/boards/explore-subjects.webp",
  "/illustrated/reference-bank/boards/mathematics.webp",
  "/illustrated/reference-bank/boards/life-science.webp",
  "/illustrated/reference-bank/boards/physical-science.webp",
  "/illustrated/reference-bank/boards/english-literacy.webp",
  "/illustrated/reference-bank/boards/earth-space.webp",
  "/illustrated/reference-bank/boards/earth-space-stack.webp",
] as const;

export type IllustratedReferenceTile = {
  id: string;
  subject: SubjectKey;
  publicPath: string;
  /** Scene phrases. A hit here is preferred over a broad subject hero. */
  keywords: string[];
  /** Stand-in when the deck names the subject but not a scene. */
  heroKeywords?: string[];
};

export const ILLUSTRATED_REFERENCE_TILES: IllustratedReferenceTile[] = [
  {
    id: "coding",
    subject: "technology",
    publicPath: "/illustrated/reference-bank/tiles/coding.webp",
    keywords: ["coding", "programming", "computer science", "software", "robot"],
    heroKeywords: ["technology", "computer"],
  },
  {
    id: "entrepreneurship",
    subject: "general",
    publicPath: "/illustrated/reference-bank/tiles/entrepreneurship.webp",
    keywords: ["entrepreneur", "entrepreneurship", "business"],
  },
  {
    id: "workshop-safety",
    subject: "technology",
    publicPath: "/illustrated/reference-bank/tiles/workshop-safety.webp",
    keywords: ["mechanic", "mechanics", "workshop", "automotive", "auto shop"],
  },
  {
    id: "spanish",
    subject: "english",
    publicPath: "/illustrated/reference-bank/tiles/spanish.webp",
    keywords: ["spanish"],
  },
  {
    id: "plant-growth",
    subject: "science",
    publicPath: "/illustrated/reference-bank/tiles/plant-growth.webp",
    keywords: ["plant growth", "agriculture", "seedling", "farming"],
  },
  {
    id: "jamaican-history",
    subject: "history",
    publicPath: "/illustrated/reference-bank/tiles/jamaican-history.webp",
    keywords: ["jamaican", "jamaica", "heritage"],
  },
  {
    id: "human-body",
    subject: "science",
    publicPath: "/illustrated/reference-bank/tiles/human-body.webp",
    keywords: ["human body", "anatomy", "circulatory"],
  },
  {
    id: "atoms",
    subject: "science",
    publicPath: "/illustrated/reference-bank/tiles/atoms.webp",
    keywords: ["atom", "atoms", "molecule", "chemistry", "chemical"],
  },
  {
    id: "forces-motion",
    subject: "science",
    publicPath: "/illustrated/reference-bank/tiles/forces-motion.webp",
    keywords: ["force", "forces", "motion", "magnet", "newton"],
    heroKeywords: ["physics", "physical science"],
  },
  {
    id: "geography-weather",
    subject: "geography",
    publicPath: "/illustrated/reference-bank/tiles/geography-weather.webp",
    keywords: ["weather", "compass"],
    heroKeywords: ["geography"],
  },
  {
    id: "story-writing",
    subject: "english",
    publicPath: "/illustrated/reference-bank/tiles/story-writing.webp",
    keywords: ["story writing", "narrative", "fiction"],
  },
  {
    id: "geometry",
    subject: "mathematics",
    publicPath: "/illustrated/reference-bank/tiles/geometry.webp",
    keywords: ["geometry", "pythagoras", "pythagorean"],
    heroKeywords: ["math", "maths", "mathematics"],
  },
  {
    id: "fractions",
    subject: "mathematics",
    publicPath: "/illustrated/reference-bank/tiles/fractions.webp",
    keywords: ["fraction", "fractions", "decimal", "decimals"],
  },
  {
    id: "algebra",
    subject: "mathematics",
    publicPath: "/illustrated/reference-bank/tiles/algebra.webp",
    keywords: ["algebra", "algebraic"],
  },
  {
    id: "statistics",
    subject: "mathematics",
    publicPath: "/illustrated/reference-bank/tiles/statistics.webp",
    keywords: ["statistic", "statistics", "probability"],
  },
  {
    id: "trigonometry",
    subject: "mathematics",
    publicPath: "/illustrated/reference-bank/tiles/trigonometry.webp",
    keywords: ["trigonometry", "trig"],
  },
  {
    id: "measurement",
    subject: "mathematics",
    publicPath: "/illustrated/reference-bank/tiles/measurement.webp",
    keywords: ["measurement", "units"],
  },
  {
    id: "money",
    subject: "mathematics",
    publicPath: "/illustrated/reference-bank/tiles/money.webp",
    keywords: ["money", "budget", "budgeting", "finance"],
  },
  {
    id: "cells",
    subject: "science",
    publicPath: "/illustrated/reference-bank/tiles/cells.webp",
    keywords: ["cell", "cells", "organelle", "organelles"],
  },
  {
    id: "ecosystems",
    subject: "science",
    publicPath: "/illustrated/reference-bank/tiles/ecosystems.webp",
    keywords: ["ecosystem", "ecosystems", "food web", "habitat"],
    heroKeywords: ["science", "biology", "life science"],
  },
  {
    id: "genetics",
    subject: "science",
    publicPath: "/illustrated/reference-bank/tiles/genetics.webp",
    keywords: ["genetic", "genetics", "inheritance", "dna", "heredity"],
  },
  {
    id: "nutrition",
    subject: "science",
    publicPath: "/illustrated/reference-bank/tiles/nutrition.webp",
    keywords: ["nutrition", "digestion", "digestive"],
  },
  {
    id: "microbes",
    subject: "science",
    publicPath: "/illustrated/reference-bank/tiles/microbes.webp",
    keywords: ["microbe", "microbes", "immunity", "bacteria", "virus"],
  },
  {
    id: "photosynthesis",
    subject: "science",
    publicPath: "/illustrated/reference-bank/tiles/photosynthesis.webp",
    keywords: ["photosynthesis", "chlorophyll"],
  },
  {
    id: "electricity",
    subject: "science",
    publicPath: "/illustrated/reference-bank/tiles/electricity.webp",
    keywords: ["electricity", "electric", "circuit", "circuits"],
  },
  {
    id: "light",
    subject: "science",
    publicPath: "/illustrated/reference-bank/tiles/light.webp",
    keywords: ["optics", "prism", "light"],
  },
  {
    id: "sound",
    subject: "science",
    publicPath: "/illustrated/reference-bank/tiles/sound.webp",
    keywords: ["sound", "acoustics"],
  },
  {
    id: "states-of-matter",
    subject: "science",
    publicPath: "/illustrated/reference-bank/tiles/states-of-matter.webp",
    keywords: ["states of matter", "boiling", "melting"],
  },
  {
    id: "acids-bases",
    subject: "science",
    publicPath: "/illustrated/reference-bank/tiles/acids-bases.webp",
    keywords: ["acid", "acids", "bases", "alkali"],
  },
  {
    id: "energy",
    subject: "science",
    publicPath: "/illustrated/reference-bank/tiles/energy.webp",
    keywords: ["energy", "heat", "thermodynamics"],
  },
  {
    id: "reading",
    subject: "english",
    publicPath: "/illustrated/reference-bank/tiles/reading.webp",
    keywords: ["reading", "comprehension"],
    heroKeywords: ["english", "literacy", "language arts"],
  },
  {
    id: "grammar",
    subject: "english",
    publicPath: "/illustrated/reference-bank/tiles/grammar.webp",
    keywords: ["grammar"],
  },
  {
    id: "poetry",
    subject: "english",
    publicPath: "/illustrated/reference-bank/tiles/poetry.webp",
    keywords: ["poetry", "poem", "figurative"],
  },
  {
    id: "persuasive-writing",
    subject: "english",
    publicPath: "/illustrated/reference-bank/tiles/persuasive-writing.webp",
    keywords: ["persuasive", "argumentative"],
  },
  {
    id: "spelling",
    subject: "english",
    publicPath: "/illustrated/reference-bank/tiles/spelling.webp",
    keywords: ["spelling", "vocabulary"],
  },
  {
    id: "public-speaking",
    subject: "english",
    publicPath: "/illustrated/reference-bank/tiles/public-speaking.webp",
    keywords: ["public speaking", "oratory"],
  },
  {
    id: "earth-space-stack",
    subject: "science",
    publicPath: "/illustrated/reference-bank/boards/earth-space-stack.webp",
    keywords: [],
    heroKeywords: ["earth and space", "earth space"],
  },
  {
    id: "solar-system",
    subject: "science",
    publicPath: "/illustrated/reference-bank/tiles/solar-system.webp",
    keywords: ["solar system", "planet", "planets", "astronomy"],
  },
  {
    id: "moon-phases",
    subject: "science",
    publicPath: "/illustrated/reference-bank/tiles/moon-phases.webp",
    keywords: ["moon", "lunar"],
  },
  {
    id: "rocks",
    subject: "science",
    publicPath: "/illustrated/reference-bank/tiles/rocks.webp",
    keywords: ["rock", "rocks", "mineral", "minerals", "geology"],
  },
  {
    id: "volcanoes",
    subject: "geography",
    publicPath: "/illustrated/reference-bank/tiles/volcanoes.webp",
    keywords: ["volcano", "volcanoes", "earthquake", "earthquakes"],
  },
  {
    id: "water-cycle",
    subject: "geography",
    publicPath: "/illustrated/reference-bank/tiles/water-cycle.webp",
    keywords: ["ocean", "oceans", "water cycle"],
  },
  {
    id: "climate",
    subject: "science",
    publicPath: "/illustrated/reference-bank/tiles/climate.webp",
    keywords: ["climate", "conservation", "pollution", "environment"],
  },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hasPhrase(haystack: string, phrase: string): boolean {
  return ` ${haystack} `.includes(` ${normalize(phrase)} `);
}

function tileScore(
  tile: IllustratedReferenceTile,
  haystack: string,
  specificOnly: boolean,
): number {
  let best = 0;
  for (const phrase of tile.keywords) {
    if (hasPhrase(haystack, phrase)) best = Math.max(best, 100 + phrase.length);
  }
  if (!specificOnly) {
    for (const phrase of tile.heroKeywords ?? []) {
      if (hasPhrase(haystack, phrase)) best = Math.max(best, 10 + phrase.length);
    }
  }
  return best;
}

/**
 * Best local scene for this text.
 * `specificOnly` ignores broad subject heroes, so a generic deck name does not
 * replace an answer illustration.
 */
export function matchIllustratedReference(
  text: string | null | undefined,
  options?: { specificOnly?: boolean },
): IllustratedReferenceTile | null {
  if (!text?.trim()) return null;
  const haystack = normalize(text);
  const specificOnly = options?.specificOnly === true;
  let best: { tile: IllustratedReferenceTile; score: number } | null = null;
  for (const tile of ILLUSTRATED_REFERENCE_TILES) {
    const score = tileScore(tile, haystack, specificOnly);
    if (score <= 0) continue;
    if (!best || score > best.score) best = { tile, score };
  }
  return best?.tile ?? null;
}

export function resolveIllustratedArtwork(input: {
  name?: string | null;
  description?: string | null;
  gradeLevel?: string | null;
  coverImageUrl?: string | null;
  subject?: string | null;
}): {
  subject: SubjectKey;
  source: "cover" | "subject" | "keyword" | "general";
  coverImageUrl: string | null;
  referenceImageUrl: string | null;
} {
  const art = resolveSubjectArtwork(input);
  if (art.coverImageUrl) {
    return { ...art, referenceImageUrl: null };
  }
  const match = matchIllustratedReference(
    [input.subject, input.name, input.description, input.gradeLevel]
      .filter(Boolean)
      .join(" "),
  );
  if (!match) return { ...art, referenceImageUrl: null };
  return {
    subject: match.subject,
    source: art.source === "general" ? "keyword" : art.source,
    coverImageUrl: null,
    referenceImageUrl: match.publicPath,
  };
}
