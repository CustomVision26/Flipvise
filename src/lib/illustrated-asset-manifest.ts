import type { SubjectKey } from "@/lib/illustrated-appearance";
import {
  ILLUSTRATED_REFERENCE_BOARDS,
  ILLUSTRATED_REFERENCE_TILES,
} from "@/lib/illustrated-reference-bank";

export type IllustratedAssetFit = "cover" | "contain";

/** Boards never appear in the interface. Tiles only where their pixels cover the slot. */
export type IllustratedAssetRole = "board" | "scene-tile" | "hero" | "card-cover" | "prop";

/** Approved assets may be shown. Limited assets are a fallback. Rejected assets are never shown. */
export type IllustratedReviewStatus = "approved" | "limited" | "rejected";

export type IllustratedAsset = {
  id: string;
  subject: SubjectKey;
  topic: string | null;
  role: IllustratedAssetRole;
  path: string;
  width: number;
  height: number;
  transparent: boolean;
  /** Largest CSS box this file can fill without being enlarged, at device pixel ratio 2. */
  suitableDisplay: { width: number; height: number };
  reviewStatus: IllustratedReviewStatus;
  fit: IllustratedAssetFit;
  keywords: string[];
  /** Used only when no cover keyword matches, so a statistics card can rotate the three covers. */
  fallbackKeywords?: string[];
  /**
   * When no keyword matches, gallery cards rotate through the subject's pool
   * by card id so a deck does not repeat one picture.
   */
  varietyPool?: boolean;
};

export type IllustratedProp =
  | "ai-recall-intro"
  | "quiz-stopwatch"
  | "quiz-pencil"
  | "quiz-stars"
  | "quiz-spark";

const SCENE_TILE_WIDTH = 251;
const SCENE_TILE_HEIGHT = 119;

function suitableDisplay(width: number, height: number, devicePixelRatio = 2) {
  return {
    width: Math.floor(width / devicePixelRatio),
    height: Math.floor(height / devicePixelRatio),
  };
}

const SUBJECT_HEROES: Array<Omit<IllustratedAsset, "suitableDisplay" | "role" | "transparent" | "reviewStatus" | "fit"> & {
  width: number;
  height: number;
}> = [
  { id: "history", subject: "history", topic: null, path: "/illustrated/heroes/history.jpg", width: 1280, height: 720, keywords: [] },
  { id: "science", subject: "science", topic: null, path: "/illustrated/heroes/science.jpg", width: 1280, height: 720, keywords: [] },
  { id: "mathematics", subject: "mathematics", topic: null, path: "/illustrated/heroes/mathematics.jpg", width: 1280, height: 720, keywords: [] },
  { id: "english", subject: "english", topic: null, path: "/illustrated/heroes/english.jpg", width: 1280, height: 720, keywords: [] },
  { id: "geography", subject: "geography", topic: null, path: "/illustrated/heroes/geography.jpg", width: 1280, height: 720, keywords: [] },
  { id: "technology", subject: "technology", topic: null, path: "/illustrated/heroes/technology.jpg", width: 1280, height: 720, keywords: [] },
  { id: "general", subject: "general", topic: null, path: "/illustrated/heroes/general.jpg", width: 1024, height: 1024, keywords: [] },
];

function blendHero(
  id: string,
  subject: SubjectKey,
  path: string,
): IllustratedAsset {
  return {
    id,
    subject,
    topic: null,
    role: "hero",
    path,
    width: 1024,
    height: 1024,
    transparent: true,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "contain",
    keywords: [],
  };
}

function varietyCover(
  id: string,
  subject: SubjectKey,
  keywords: string[] = [],
): IllustratedAsset {
  return {
    id,
    subject,
    topic: id,
    role: "card-cover",
    path: `/illustrated/topics/${id}.jpg`,
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "cover",
    keywords,
    varietyPool: true,
  };
}

const BLEND_HEROES: IllustratedAsset[] = [
  blendHero("math-hero", "mathematics", "/illustrated/math-hero.png"),
  blendHero("english-hero", "english", "/illustrated/english-hero.png"),
  blendHero("science-hero", "science", "/illustrated/science-hero.png"),
  blendHero("geography-hero", "geography", "/illustrated/geography-hero.png"),
  blendHero("technology-hero", "technology", "/illustrated/technology-hero.png"),
  blendHero("general-hero", "general", "/illustrated/general-hero.png"),
];

const VARIETY_COVERS: IllustratedAsset[] = [
  varietyCover("lang-door", "english", ["door", "porte"]),
  varietyCover("lang-window", "english", ["window", "fenêtre", "fenetre"]),
  varietyCover("lang-house", "english", ["house", "casa", "maison"]),
  varietyCover("lang-chair", "english", ["chair", "silla", "chaise"]),
  varietyCover("lang-book", "english", ["book", "libro", "livre"]),
  varietyCover("lang-water", "english", ["water", "agua", "eau"]),
  varietyCover("lang-duck", "english", ["duck", "canard"]),
  varietyCover("lang-pardon", "english", ["pardon", "sorry"]),
  varietyCover("lang-cat", "english", ["cat", "gato", "gata"]),
  varietyCover("lang-dog", "english", ["dog", "perro"]),
  varietyCover("lang-sun", "english", ["sun", "sol"]),
  varietyCover("lang-tree", "english", ["tree", "arbol", "árbol"]),
  varietyCover("lang-car", "english", ["car", "coche"]),
  varietyCover("lang-school", "english", ["school", "escuela"]),
  varietyCover("lang-river", "english", ["river", "río", "rio"]),
  varietyCover("lang-sea", "english", ["sea", "mar"]),
  varietyCover("lang-fruit", "english", ["fruit", "fruta"]),
  varietyCover("lang-apple", "english", ["apple", "manzana"]),
  varietyCover("lang-table", "english", ["table", "mesa"]),
  varietyCover("lang-pig", "english", ["pig", "cerda"]),
  varietyCover("lang-red", "english", ["red", "rojo"]),
  varietyCover("lang-green", "english", ["green", "verde"]),
  varietyCover("lang-birthday", "english", ["birthday", "feliz", "cumpleaños", "cumpleanos"]),
  varietyCover("lang-morning", "english", ["morning", "buenos", "días", "dias"]),
  varietyCover("lang-mother", "english", ["mother", "madre"]),
  varietyCover("lang-letter", "english", ["extraño", "extrano", "miss"]),
  varietyCover("lang-run", "english", ["run", "correr"]),
  varietyCover("math-triangle", "mathematics", ["triangle", "triangles"]),
  varietyCover("math-cube", "mathematics", ["cube", "cubes"]),
  varietyCover("math-circle", "mathematics", ["circle", "circumference"]),
  varietyCover("math-rectangle", "mathematics", ["rectangle", "perimeter"]),
  varietyCover("math-sphere", "mathematics", ["sphere", "surface area"]),
  varietyCover("math-balance", "mathematics"),
  varietyCover("math-blocks", "mathematics"),
  varietyCover("math-curve", "mathematics"),
  varietyCover("sci-cell", "science", ["mitochondria", "mitochondrion"]),
  varietyCover("sci-blood", "science", ["red blood", "white blood", "blood"]),
  varietyCover("sci-neuron", "science", ["neuron", "neurons", "synapse"]),
  varietyCover("sci-kidney", "science", ["kidney", "kidneys"]),
  varietyCover("sci-plant", "science", ["photosynthesis"]),
  varietyCover("sci-dna", "science", ["dna"]),
  varietyCover("sci-lungs", "science", ["alveoli", "lung", "lungs"]),
  varietyCover("geo-layers", "geography", ["crust"]),
  varietyCover("geo-divergent", "geography", ["divergent"]),
  varietyCover("geo-convergent", "geography", ["convergent"]),
  varietyCover("geo-transform", "geography", ["transform"]),
  varietyCover("geo-volcano", "geography", ["subduction", "volcano"]),
  varietyCover("geo-drift", "geography", ["continental drift", "plate tectonics", "plate boundaries", "tectonic"]),
  varietyCover("ja-village", "history", ["taino", "tainos", "inhabitants"]),
  varietyCover("ja-ships", "history", ["spain", "spanish", "colonized", "conquest", "british"]),
  varietyCover("ja-celebration", "history", ["independence"]),
  varietyCover("ja-treaty", "history", ["treaty", "madrid"]),
  varietyCover("ja-gathering", "history", ["baptist", "morant", "sharpe", "bogle"]),
  varietyCover("gen-tiles", "general"),
  varietyCover("gen-clock", "general"),
  varietyCover("gen-books", "general"),
  varietyCover("gen-pencil", "general"),
  varietyCover("gen-stars", "general"),
  varietyCover("gen-lamp", "general"),
];

function opaqueHero(asset: (typeof SUBJECT_HEROES)[number]): IllustratedAsset {
  return {
    ...asset,
    role: "hero",
    transparent: false,
    suitableDisplay: suitableDisplay(asset.width, asset.height),
    reviewStatus: "limited",
    fit: "contain",
  };
}

export const ILLUSTRATED_ASSET_MANIFEST: IllustratedAsset[] = [
  ...SUBJECT_HEROES.map(opaqueHero),
  ...BLEND_HEROES,
  ...VARIETY_COVERS,
  {
    id: "statistics-hero",
    subject: "mathematics",
    topic: "statistics",
    role: "hero",
    path: "/illustrated/statistics-hero.png",
    width: 1024,
    height: 1024,
    transparent: true,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "contain",
    keywords: ["statistics", "statistic"],
  },
  {
    id: "history-hero",
    subject: "history",
    topic: null,
    role: "hero",
    path: "/illustrated/history-hero.png",
    width: 1024,
    height: 1024,
    transparent: true,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "contain",
    keywords: ["america", "american", "united states"],
  },
  {
    id: "history-cover",
    subject: "history",
    topic: null,
    role: "card-cover",
    path: "/illustrated/topics/history-cover.jpg",
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "cover",
    keywords: [],
    fallbackKeywords: ["history"],
  },
  {
    id: "history-colonial",
    subject: "history",
    topic: "colonial government",
    role: "card-cover",
    path: "/illustrated/topics/history-colonial.jpg",
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "cover",
    keywords: ["local governments", "colonists", "colonist"],
  },
  {
    id: "history-modern",
    subject: "history",
    topic: "modern america",
    role: "card-cover",
    path: "/illustrated/topics/history-modern.jpg",
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "cover",
    keywords: ["modern america", "modern american"],
  },
  {
    id: "history-depression",
    subject: "history",
    topic: "great depression",
    role: "card-cover",
    path: "/illustrated/topics/history-depression.jpg",
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "cover",
    keywords: ["great depression", "world war"],
  },
  {
    id: "history-constitution",
    subject: "history",
    topic: "constitution",
    role: "card-cover",
    path: "/illustrated/topics/history-constitution.jpg",
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "cover",
    keywords: ["constitution"],
  },
  {
    id: "history-civil-war",
    subject: "history",
    topic: "civil war",
    role: "card-cover",
    path: "/illustrated/topics/history-civil-war.jpg",
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "cover",
    keywords: ["civil war"],
  },
  {
    id: "history-declaration",
    subject: "history",
    topic: "declaration",
    role: "card-cover",
    path: "/illustrated/topics/history-declaration.jpg",
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "cover",
    keywords: ["declaration of independence", "declaration"],
  },
  {
    id: "states-town-hero",
    subject: "geography",
    topic: "towns",
    role: "hero",
    path: "/illustrated/states-town-header.png",
    width: 1024,
    height: 1024,
    transparent: true,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "contain",
    keywords: ["town", "towns", "states and town", "states and towns"],
  },
  {
    id: "town-albany",
    subject: "geography",
    topic: "albany",
    role: "card-cover",
    path: "/illustrated/topics/town-albany.jpg",
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "cover",
    keywords: ["albany"],
    fallbackKeywords: ["town", "towns"],
  },
  {
    id: "town-austin",
    subject: "geography",
    topic: "austin",
    role: "card-cover",
    path: "/illustrated/topics/town-austin.jpg",
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "cover",
    keywords: ["austin"],
    fallbackKeywords: ["town", "towns"],
  },
  {
    id: "town-sacramento",
    subject: "geography",
    topic: "sacramento",
    role: "card-cover",
    path: "/illustrated/topics/town-sacramento.jpg",
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "cover",
    keywords: ["sacramento"],
    fallbackKeywords: ["town", "towns"],
  },
  {
    id: "town-columbus",
    subject: "geography",
    topic: "columbus",
    role: "card-cover",
    path: "/illustrated/topics/town-columbus.jpg",
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "cover",
    keywords: ["columbus"],
    fallbackKeywords: ["town", "towns"],
  },
  {
    id: "probability",
    subject: "mathematics",
    topic: "probability",
    role: "card-cover",
    path: "/illustrated/topics/probability.jpg",
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "cover",
    keywords: ["probability", "chance", "spinner", "dice", "random"],
    fallbackKeywords: ["statistics", "statistic"],
  },
  {
    id: "data-analysis",
    subject: "mathematics",
    topic: "data analysis",
    role: "card-cover",
    path: "/illustrated/topics/data-analysis.jpg",
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "cover",
    keywords: ["data analysis", "data set", "mean", "median", "average"],
    fallbackKeywords: ["statistics", "statistic"],
  },
  {
    id: "percentages",
    subject: "mathematics",
    topic: "percentages",
    role: "card-cover",
    path: "/illustrated/topics/percentages.jpg",
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "cover",
    keywords: ["percentage", "percent", "percentages", "budget"],
    fallbackKeywords: ["statistics", "statistic"],
  },
  {
    id: "sales",
    subject: "mathematics",
    topic: "sales",
    role: "card-cover",
    path: "/illustrated/topics/sales.jpg",
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "cover",
    keywords: ["sales", "by day"],
  },
  {
    id: "survey",
    subject: "mathematics",
    topic: "survey",
    role: "card-cover",
    path: "/illustrated/topics/survey.jpg",
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "cover",
    keywords: ["surveyed", "survey", "favorite sports", "favourite sports"],
  },
  {
    id: "industrial-revolution",
    subject: "history",
    topic: "industrial revolution",
    role: "card-cover",
    path: "/illustrated/topics/industrial-revolution.jpg",
    width: 1280,
    height: 720,
    transparent: false,
    suitableDisplay: suitableDisplay(1280, 720),
    reviewStatus: "approved",
    fit: "cover",
    keywords: ["industrial revolution", "industrial", "factory", "steam"],
  },
  {
    id: "magna-carta",
    subject: "history",
    topic: "magna carta",
    role: "card-cover",
    path: "/illustrated/topics/magna-carta.jpg",
    width: 1280,
    height: 720,
    transparent: false,
    suitableDisplay: suitableDisplay(1280, 720),
    reviewStatus: "approved",
    fit: "cover",
    keywords: ["magna carta", "magna", "charter"],
  },
  {
    id: "roman-britain",
    subject: "history",
    topic: "roman britain",
    role: "card-cover",
    path: "/illustrated/topics/roman-britain.jpg",
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "cover",
    keywords: ["roman", "emperor", "invasion"],
  },
  {
    id: "queen-elizabeth",
    subject: "history",
    topic: "queen elizabeth",
    role: "card-cover",
    path: "/illustrated/topics/queen-elizabeth.jpg",
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "cover",
    keywords: ["elizabeth", "queen", "tudor", "throne"],
  },
  {
    id: "act-of-union",
    subject: "history",
    topic: "act of union",
    role: "card-cover",
    path: "/illustrated/topics/act-of-union.jpg",
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "cover",
    keywords: ["act of union", "1707", "scotland"],
  },
  {
    id: "bible-translation",
    subject: "history",
    topic: "bible",
    role: "card-cover",
    path: "/illustrated/topics/bible-translation.jpg",
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "approved",
    fit: "cover",
    keywords: ["bible", "scripture", "translation"],
  },
  {
    id: "statistics-flat",
    subject: "mathematics",
    topic: "statistics",
    role: "card-cover",
    path: "/illustrated/topics/statistics.jpg",
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "rejected",
    fit: "cover",
    keywords: ["spinner", "dice", "probability", "statistic"],
  },
  {
    id: "data-bars",
    subject: "mathematics",
    topic: "data",
    role: "card-cover",
    path: "/illustrated/topics/data-bars.jpg",
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "rejected",
    fit: "cover",
    keywords: ["pie", "chart", "bar", "temperature", "mean", "budget"],
  },
  {
    id: "ai-recall-intro",
    subject: "general",
    topic: "ai-recall-intro",
    role: "prop",
    path: "/illustrated/heroes/ai-recall-intro.jpg",
    width: 1024,
    height: 1024,
    transparent: false,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "limited",
    fit: "contain",
    keywords: [],
  },
  {
    id: "quiz-stopwatch",
    subject: "general",
    topic: "quiz-stopwatch",
    role: "prop",
    path: "/illustrated/props/quiz-stopwatch.png",
    width: 1024,
    height: 1024,
    transparent: true,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "limited",
    fit: "contain",
    keywords: [],
  },
  {
    id: "quiz-pencil",
    subject: "general",
    topic: "quiz-pencil",
    role: "prop",
    path: "/illustrated/props/quiz-pencil.png",
    width: 1024,
    height: 1024,
    transparent: true,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "limited",
    fit: "contain",
    keywords: [],
  },
  {
    id: "quiz-stars",
    subject: "general",
    topic: "quiz-stars",
    role: "prop",
    path: "/illustrated/props/quiz-stars.png",
    width: 1024,
    height: 1024,
    transparent: true,
    suitableDisplay: suitableDisplay(1024, 1024),
    reviewStatus: "limited",
    fit: "contain",
    keywords: [],
  },
  {
    id: "quiz-spark",
    subject: "general",
    topic: "quiz-spark",
    role: "prop",
    path: "/illustrated/props/quiz-spark.png",
    width: 1280,
    height: 720,
    transparent: true,
    suitableDisplay: suitableDisplay(1280, 720),
    reviewStatus: "limited",
    fit: "contain",
    keywords: [],
  },
  ...ILLUSTRATED_REFERENCE_BOARDS.map((publicPath): IllustratedAsset => ({
    id: `board-${publicPath.split("/").pop()?.replace(/\.webp$/, "") ?? "board"}`,
    subject: "general",
    topic: null,
    role: "board",
    path: publicPath,
    width: 909,
    height: 574,
    transparent: false,
    suitableDisplay: { width: 0, height: 0 },
    reviewStatus: "rejected",
    fit: "cover",
    keywords: [],
  })),
  ...ILLUSTRATED_REFERENCE_TILES.map((tile): IllustratedAsset => ({
    id: `tile-${tile.id}`,
    subject: tile.subject,
    topic: tile.id,
    role: "scene-tile",
    path: tile.publicPath,
    width: SCENE_TILE_WIDTH,
    height: SCENE_TILE_HEIGHT,
    transparent: false,
    suitableDisplay: suitableDisplay(SCENE_TILE_WIDTH, SCENE_TILE_HEIGHT),
    reviewStatus: "limited",
    fit: "cover",
    keywords: tile.keywords,
  })),
];

function includesPhrase(text: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i").test(text);
}

/**
 * A file is usable when the slot does not have to enlarge it.
 * Contain art may be smaller than a wide box. Cover art must fill the box.
 */
export function illustratedAssetFitsDisplay(
  asset: Pick<IllustratedAsset, "width" | "height" | "fit">,
  displayWidth: number,
  displayHeight: number,
  devicePixelRatio = 2,
) {
  const boxWidth = displayWidth * devicePixelRatio;
  const boxHeight = displayHeight * devicePixelRatio;
  if (boxWidth <= 0 || boxHeight <= 0) return false;
  if (asset.fit === "cover") {
    return asset.width >= boxWidth && asset.height >= boxHeight;
  }
  const scale = Math.min(boxWidth / asset.width, boxHeight / asset.height);
  return scale <= 1;
}

export type IllustratedAssetRequest = {
  role: IllustratedAssetRole;
  subject?: SubjectKey | null;
  text?: string | null;
  variantIndex?: number | null;
  displayWidth: number;
  displayHeight: number;
  devicePixelRatio?: number;
  prop?: IllustratedProp | null;
  /** When true, a subject fallback is not used. A keyword must match. */
  keywordOnly?: boolean;
};

export type IllustratedAssetChoice = {
  asset: IllustratedAsset | null;
  missingPath: string | null;
};

function keywordScore(asset: IllustratedAsset, text: string, subject: SubjectKey) {
  let best = 0;
  for (const keyword of asset.keywords) {
    if (!includesPhrase(text, keyword)) continue;
    const score = keyword.length + (asset.subject === subject ? 20 : 0);
    if (score > best) best = score;
  }
  return best;
}

function missingPathFor(role: IllustratedAssetRole, subject: SubjectKey) {
  if (role === "hero") return `public/illustrated/heroes/${subject}.png`;
  if (role === "card-cover") return `public/illustrated/topics/${subject}-cover.png`;
  if (role === "prop") return "public/illustrated/props/missing.png";
  return null;
}

export function selectIllustratedAsset(input: IllustratedAssetRequest): IllustratedAssetChoice {
  const dpr = input.devicePixelRatio ?? 2;
  const subject = input.subject ?? "general";
  const text = input.text?.toLowerCase() ?? "";

  if (input.prop) {
    const prop = ILLUSTRATED_ASSET_MANIFEST.find(
      (asset) => asset.id === input.prop && asset.role === "prop" && asset.reviewStatus !== "rejected",
    );
    if (
      prop &&
      illustratedAssetFitsDisplay(prop, input.displayWidth, input.displayHeight, dpr)
    ) {
      return { asset: prop, missingPath: null };
    }
    return { asset: null, missingPath: prop?.path ?? missingPathFor("prop", subject) };
  }

  if (input.role === "board") {
    return { asset: null, missingPath: null };
  }

  const candidates = ILLUSTRATED_ASSET_MANIFEST.filter((asset) => {
    if (asset.reviewStatus === "rejected") return false;
    if (asset.role === "board") return false;
    if (asset.role !== input.role && !(input.role === "card-cover" && asset.role === "scene-tile")) {
      return false;
    }
    return illustratedAssetFitsDisplay(asset, input.displayWidth, input.displayHeight, dpr);
  });

  const ranked = candidates
    .map((asset) => ({ asset, score: text ? keywordScore(asset, text, subject) : 0 }))
    .sort((a, b) => {
      const statusRank = (status: IllustratedReviewStatus) => (status === "approved" ? 2 : 1);
      const statusDelta = statusRank(b.asset.reviewStatus) - statusRank(a.asset.reviewStatus);
      if (statusDelta !== 0) return statusDelta;
      const roleDelta = (a.asset.role === input.role ? 0 : 1) - (b.asset.role === input.role ? 0 : 1);
      if (roleDelta !== 0) return roleDelta;
      return b.score - a.score;
    });

  const keywordHit = ranked.find((entry) => entry.score > 0);
  if (keywordHit) return { asset: keywordHit.asset, missingPath: null };

  if (input.keywordOnly) {
    return { asset: null, missingPath: missingPathFor(input.role, subject) };
  }

  const family = ranked.filter((entry) => {
    if (entry.asset.role !== input.role) return false;
    return (entry.asset.fallbackKeywords ?? []).some((keyword) =>
      includesPhrase(text, keyword),
    );
  });
  if (family.length > 0) {
    const index =
      input.variantIndex == null ? 0 : Math.abs(input.variantIndex) % family.length;
    return { asset: family[index]!.asset, missingPath: null };
  }

  if (input.role === "card-cover") {
    const variety = ranked.filter(
      (entry) => entry.asset.subject === subject && entry.asset.varietyPool === true,
    );
    if (variety.length > 0) {
      const index =
        input.variantIndex == null ? 0 : Math.abs(input.variantIndex) % variety.length;
      return { asset: variety[index]!.asset, missingPath: null };
    }
  }

  const subjectAssets = ranked.filter(
    (entry) => entry.asset.subject === subject && entry.asset.role === input.role && entry.asset.topic == null,
  );
  if (subjectAssets.length > 0) {
    return { asset: subjectAssets[0]!.asset, missingPath: null };
  }

  // A subject with no topic covers still has a hero illustration. Use that on
  // gallery cards instead of a missing-file message. Subjects that already
  // have topic covers keep the missing flag so an unrelated card does not
  // borrow the wrong topic.
  if (input.role === "card-cover") {
    const hasTopicCover = ILLUSTRATED_ASSET_MANIFEST.some(
      (asset) =>
        asset.subject === subject &&
        asset.role === "card-cover" &&
        asset.reviewStatus === "approved",
    );
    if (!hasTopicCover) {
      const hero = ILLUSTRATED_ASSET_MANIFEST.find(
        (asset) =>
          asset.subject === subject &&
          asset.role === "hero" &&
          asset.topic == null &&
          asset.reviewStatus !== "rejected" &&
          illustratedAssetFitsDisplay(
            { ...asset, fit: "contain" },
            input.displayWidth,
            input.displayHeight,
            dpr,
          ),
      );
      if (hero) return { asset: { ...hero, fit: "contain" }, missingPath: null };
    }
  }

  return { asset: null, missingPath: missingPathFor(input.role, subject) };
}

/** @deprecated Use selectIllustratedAsset. Kept so older call sites keep compiling during the role migration. */
export function resolveIllustratedAsset(input: {
  subject?: SubjectKey | null;
  text?: string | null;
  variantIndex?: number | null;
  prefer?: "hero" | "topic";
  prop?: IllustratedProp | null;
}): IllustratedAsset {
  const choice = selectIllustratedAsset({
    role: input.prop ? "prop" : input.prefer === "hero" ? "hero" : "card-cover",
    subject: input.subject,
    text: input.text,
    variantIndex: input.variantIndex,
    prop: input.prop,
    displayWidth: input.prefer === "hero" ? 448 : 320,
    displayHeight: input.prefer === "hero" ? 280 : 160,
    devicePixelRatio: 2,
  });
  if (choice.asset) return choice.asset;
  const fallback = ILLUSTRATED_ASSET_MANIFEST.find((asset) => asset.id === "general");
  if (!fallback) {
    throw new Error("Illustrated asset catalog is empty.");
  }
  return fallback;
}
