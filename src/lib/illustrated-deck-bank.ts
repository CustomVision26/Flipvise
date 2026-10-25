import deckBankManifest from "../../artwork-import/artwork-manifest.json";
import {
  resolveSubjectArtwork,
  type SubjectKey,
} from "@/lib/illustrated-appearance";

export type DeckBankReviewStatus = "approved-decorative" | "pending-owner-review";

export type DeckBankAsset = {
  id: string;
  group: string;
  subject: string;
  topic: string;
  keywords: string[];
  role: "deck-cover";
  path: string;
  sourceWidth: number;
  sourceHeight: number;
  transparent: false;
  selectionEnabled: boolean;
  reviewStatus: string;
  /** Decorative only. These covers are not verified teaching diagrams. */
  verifiedTeachingDiagram: false;
};

type ManifestAsset = {
  id: string;
  group: string;
  subject: string;
  topic: string;
  keywords: string[];
  role: string;
  path: string;
  sourceWidth: number;
  sourceHeight: number;
  transparent: boolean;
  selectionEnabled: boolean;
  reviewStatus: string;
  usage?: string;
};

const SUBJECT_FAMILY: Record<string, SubjectKey> = {
  biology: "science",
  chemistry: "science",
  physics: "science",
  "environmental science": "science",
  agriculture: "science",
  geography: "geography",
  geology: "geography",
  astronomy: "science",
  english: "english",
  spanish: "english",
  mathematics: "mathematics",
  "computer science": "technology",
  technology: "technology",
  "auto mechanics": "technology",
  tvet: "technology",
  history: "history",
  civics: "history",
  business: "general",
  "life skills": "general",
  "early learning": "general",
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPhrase(haystack: string, phrase: string) {
  const normalized = normalize(phrase);
  if (normalized.length < 3) return false;
  return ` ${haystack} `.includes(` ${normalized} `);
}

function phraseMatches(haystack: string, phrase: string) {
  if (hasPhrase(haystack, phrase)) return true;
  const normalized = normalize(phrase);
  if (normalized.endsWith("s") && normalized.length > 4) {
    return hasPhrase(haystack, normalized.slice(0, -1));
  }
  return false;
}

export const ILLUSTRATED_DECK_BANK: DeckBankAsset[] = (
  deckBankManifest.assets as ManifestAsset[]
).map((asset) => ({
  id: asset.id,
  group: asset.group,
  subject: asset.subject,
  topic: asset.topic,
  keywords: asset.keywords,
  role: "deck-cover",
  path: asset.path,
  sourceWidth: asset.sourceWidth,
  sourceHeight: asset.sourceHeight,
  transparent: false,
  selectionEnabled: asset.selectionEnabled,
  reviewStatus: asset.reviewStatus,
  verifiedTeachingDiagram: false,
}));

function selectable(asset: DeckBankAsset, displayWidth: number, displayHeight: number, dpr: number) {
  if (!asset.selectionEnabled) return false;
  if (asset.reviewStatus !== "approved-decorative") return false;
  if (asset.role !== "deck-cover") return false;
  if (asset.transparent) return false;
  if (asset.verifiedTeachingDiagram) return false;
  return asset.sourceWidth >= displayWidth * dpr && asset.sourceHeight >= displayHeight * dpr;
}

function keywordScore(asset: DeckBankAsset, haystack: string) {
  let score = 0;
  if (phraseMatches(haystack, asset.topic)) {
    score += normalize(asset.topic).length + 80;
  }
  for (const keyword of asset.keywords) {
    if (phraseMatches(haystack, keyword)) score += normalize(keyword).length + 24;
  }
  return score;
}

function subjectFallback(assets: DeckBankAsset[], subject: SubjectKey, haystack: string) {
  const core = assets.filter(
    (asset) =>
      asset.group === "Core subjects" &&
      SUBJECT_FAMILY[normalize(asset.subject)] === subject &&
      phraseMatches(haystack, asset.subject),
  );
  return core[0] ?? null;
}

export type DeckCoverChoice = {
  source: "custom" | "deck-bank" | "hero";
  url: string | null;
  assetId: string | null;
};

/**
 * Deck-level cover. A stored custom cover wins. Otherwise an enabled
 * decorative bank cover is chosen from the title, topic, and subject.
 * This never selects a transparent hero or a teaching diagram.
 */
export function resolveDeckCover(input: {
  name?: string | null;
  description?: string | null;
  gradeLevel?: string | null;
  subject?: string | null;
  coverImageUrl?: string | null;
  displayWidth?: number;
  displayHeight?: number;
  devicePixelRatio?: number;
}): DeckCoverChoice {
  const custom = input.coverImageUrl?.trim();
  if (custom) return { source: "custom", url: custom, assetId: null };

  const displayWidth = input.displayWidth ?? 448;
  const displayHeight = input.displayHeight ?? 299;
  const dpr = input.devicePixelRatio ?? 2;
  const haystack = normalize(
    [input.subject, input.name, input.description, input.gradeLevel].filter(Boolean).join(" "),
  );
  const deckSubject = resolveSubjectArtwork(input).subject;
  const candidates = ILLUSTRATED_DECK_BANK.filter((asset) =>
    selectable(asset, displayWidth, displayHeight, dpr),
  );

  let best: { asset: DeckBankAsset; score: number } | null = null;
  for (const asset of candidates) {
    const score = keywordScore(asset, haystack);
    if (score <= 0) continue;
    if (!best || score > best.score) best = { asset, score };
  }
  const chosen = best?.asset ?? subjectFallback(candidates, deckSubject, haystack);
  if (!chosen) return { source: "hero", url: null, assetId: null };
  return { source: "deck-bank", url: chosen.path, assetId: chosen.id };
}
