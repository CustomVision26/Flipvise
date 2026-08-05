export type PassageDiversityInput = {
  title: string;
  scenarioCategory?: string | null;
  scenarioSummary?: string | null;
  centralEvent?: string | null;
  mainProblem?: string | null;
  consequence?: string | null;
  requiredResponse?: string | null;
  perspective?: string | null;
  setting?: string | null;
  passageText: string;
  vocabularyTermsUsed?: string[];
  alignedObjectives?: string[];
};

export type DuplicatePair = {
  indexA: number;
  indexB: number;
  reason: string;
  summarySimilarity: number;
  passageSimilarity: number;
  fingerprintSimilarity: number;
};

export type DiversityValidationResult = {
  ok: boolean;
  duplicates: DuplicatePair[];
  reasons?: string[];
  message?: string;
};

export type PassageAgainstSetResult = {
  valid: boolean;
  reasons: string[];
  duplicates: DuplicatePair[];
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "that",
  "this",
  "these",
  "those",
  "it",
  "its",
  "their",
  "his",
  "her",
  "they",
  "them",
  "he",
  "she",
  "we",
  "you",
  "i",
  "student",
  "students",
  "teacher",
  "instructor",
  "class",
  "lesson",
  "learner",
  "peer",
  "mentor",
  "practice",
  "understanding",
  "about",
  "during",
  "while",
  "must",
  "should",
  "can",
  "will",
]);

/** Common person-name tokens to strip when comparing scenarios. */
const NAME_LIKE =
  /\b(kai|marissa|devon|aaliyah|omar|tiana|ricardo|naomi|andre|shanice|malik|asha|emma|jordan|alex|sam|taylor|chris|jamie|lee|pat|morgan|casey|riley|avery|quinn)\b/gi;

const VOCAB_TITLE_PATTERNS = [
  /^(understanding|practicing|applying|learning|using|about)\s+/i,
  /\s+(in practice|at work|basics|overview|explained|defined)$/i,
];

/** Narrative arcs that often repeat with only names/tools swapped. */
const REPEATED_ARC_MARKERS = [
  ["starts", "ignores", "stops", "explains"],
  ["begin", "ignore", "stop", "explain"],
  ["task", "unsafe", "instructor", "stop"],
  ["near", "miss", "instructor", "stop"],
  ["rushes", "instructor", "stops", "reviews"],
];

export function normalizeForSimilarity(
  text: string,
  excludeTerms: string[] = [],
): string[] {
  const excluded = new Set<string>();
  for (const term of excludeTerms) {
    for (const token of term
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)) {
      if (token.length > 1) excluded.add(token);
    }
  }
  return text
    .toLowerCase()
    .replace(NAME_LIKE, " ")
    .replace(/\b\d+(\.\d+)?\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length > 1 && !STOP_WORDS.has(token) && !excluded.has(token),
    );
}

export function calculateJaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function createScenarioFingerprint(
  passage: Pick<
    PassageDiversityInput,
    | "scenarioCategory"
    | "centralEvent"
    | "mainProblem"
    | "consequence"
    | "requiredResponse"
    | "perspective"
    | "setting"
  >,
  excludeTerms: string[] = [],
): string[] {
  return normalizeForSimilarity(
    [
      passage.scenarioCategory,
      passage.centralEvent,
      passage.mainProblem,
      passage.consequence,
      passage.requiredResponse,
      passage.perspective,
      passage.setting,
    ]
      .filter(Boolean)
      .join(" "),
    excludeTerms,
  );
}

/**
 * Reject titles/categories whose main subject is merely a lesson vocabulary term
 * (e.g. "Hazard in Practice", "Understanding OSH").
 */
export function isVocabularyDerivedScenario(
  passage: Pick<PassageDiversityInput, "title" | "scenarioCategory">,
  vocabularyTerms: string[],
): boolean {
  const terms = vocabularyTerms
    .map((term) => term.toLowerCase().trim())
    .filter((term) => term.length > 1);
  if (terms.length === 0) return false;

  const candidates = [passage.title, passage.scenarioCategory]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);

  for (const candidate of candidates) {
    let normalized = candidate.toLowerCase();
    for (const pattern of VOCAB_TITLE_PATTERNS) {
      normalized = normalized.replace(pattern, " ").trim();
    }
    normalized = normalized.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

    for (const term of terms) {
      const termNorm = term.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      if (!termNorm) continue;
      if (normalized === termNorm) return true;
      if (normalized === `${termNorm} practice`) return true;
      if (normalized.startsWith(`${termNorm} `) && normalized.split(" ").length <= 4) {
        return true;
      }
      // Acronym-only categories like "OSH" or "PPE"
      if (/^[a-z]{2,6}$/.test(normalized) && termNorm.includes(normalized)) {
        return true;
      }
    }
  }
  return false;
}

function detectRepeatedNarrativeArc(
  a: PassageDiversityInput,
  b: PassageDiversityInput,
  exclude: string[],
): boolean {
  const textA = normalizeForSimilarity(
    `${a.passageText} ${a.centralEvent ?? ""} ${a.mainProblem ?? ""} ${a.consequence ?? ""} ${a.requiredResponse ?? ""}`,
    exclude,
  ).join(" ");
  const textB = normalizeForSimilarity(
    `${b.passageText} ${b.centralEvent ?? ""} ${b.mainProblem ?? ""} ${b.consequence ?? ""} ${b.requiredResponse ?? ""}`,
    exclude,
  ).join(" ");

  for (const markers of REPEATED_ARC_MARKERS) {
    const aHits = markers.filter((marker) => textA.includes(marker)).length;
    const bHits = markers.filter((marker) => textB.includes(marker)).length;
    if (aHits >= 3 && bHits >= 3) return true;
  }

  // Instructor-stops-student pattern with different tools/names
  const stopPattern =
    /\b(stop|stops|stopped|halts|paused)\b.*\b(explain|explains|reviews|review)\b|\b(near\s*miss)\b/;
  const aStop = stopPattern.test(textA);
  const bStop = stopPattern.test(textB);
  if (aStop && bStop) {
    const problemSim = calculateJaccardSimilarity(
      normalizeForSimilarity(`${a.mainProblem ?? ""} ${a.centralEvent ?? ""}`, exclude),
      normalizeForSimilarity(`${b.mainProblem ?? ""} ${b.centralEvent ?? ""}`, exclude),
    );
    // Same arc even if problem wording differs slightly
    if (problemSim >= 0.35) return true;
  }
  return false;
}

function curriculumExcludeTerms(
  passages: PassageDiversityInput[],
  extraExclude: string[] = [],
): string[] {
  const counts = new Map<string, number>();
  for (const passage of passages) {
    for (const term of passage.vocabularyTermsUsed ?? []) {
      const key = term.toLowerCase().trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const threshold = Math.max(2, Math.ceil(Math.max(passages.length, 1) * 0.5));
  const shared = [...counts.entries()]
    .filter(([, count]) => count >= threshold)
    .map(([term]) => term);
  return [...new Set([...shared, ...extraExclude])];
}

export function findDuplicatePassages(
  passages: PassageDiversityInput[],
  options?: {
    summaryThreshold?: number;
    passageThreshold?: number;
    fingerprintThreshold?: number;
    excludeTerms?: string[];
  },
): DuplicatePair[] {
  const summaryThreshold = options?.summaryThreshold ?? 0.65;
  const passageThreshold = options?.passageThreshold ?? 0.75;
  const fingerprintThreshold = options?.fingerprintThreshold ?? 0.7;
  const exclude = curriculumExcludeTerms(passages, options?.excludeTerms ?? []);
  const duplicates: DuplicatePair[] = [];

  for (let i = 0; i < passages.length; i += 1) {
    for (let j = i + 1; j < passages.length; j += 1) {
      const a = passages[i]!;
      const b = passages[j]!;
      const categoryA = (a.scenarioCategory ?? "").trim().toLowerCase();
      const categoryB = (b.scenarioCategory ?? "").trim().toLowerCase();

      const summaryA = normalizeForSimilarity(
        `${a.scenarioSummary ?? ""} ${a.title}`,
        exclude,
      );
      const summaryB = normalizeForSimilarity(
        `${b.scenarioSummary ?? ""} ${b.title}`,
        exclude,
      );
      const eventA = normalizeForSimilarity(
        `${a.centralEvent ?? ""} ${a.mainProblem ?? ""}`,
        exclude,
      );
      const eventB = normalizeForSimilarity(
        `${b.centralEvent ?? ""} ${b.mainProblem ?? ""}`,
        exclude,
      );
      const problemA = normalizeForSimilarity(
        `${a.mainProblem ?? ""} ${a.requiredResponse ?? ""}`,
        exclude,
      );
      const problemB = normalizeForSimilarity(
        `${b.mainProblem ?? ""} ${b.requiredResponse ?? ""}`,
        exclude,
      );
      const passageA = normalizeForSimilarity(a.passageText, exclude);
      const passageB = normalizeForSimilarity(b.passageText, exclude);
      const fingerprintA = createScenarioFingerprint(a, exclude);
      const fingerprintB = createScenarioFingerprint(b, exclude);

      const summarySimilarity = calculateJaccardSimilarity(summaryA, summaryB);
      const passageSimilarity = calculateJaccardSimilarity(passageA, passageB);
      const eventSimilarity = calculateJaccardSimilarity(eventA, eventB);
      const problemResponseSimilarity = calculateJaccardSimilarity(problemA, problemB);
      const fingerprintSimilarity = calculateJaccardSimilarity(
        fingerprintA,
        fingerprintB,
      );

      const sameCategory =
        categoryA.length > 0 && categoryB.length > 0 && categoryA === categoryB;
      const similarCategory =
        categoryA.length > 0 &&
        categoryB.length > 0 &&
        calculateJaccardSimilarity(
          normalizeForSimilarity(categoryA, exclude),
          normalizeForSimilarity(categoryB, exclude),
        ) >= 0.8;

      let reason: string | null = null;
      if (sameCategory && (eventSimilarity >= 0.45 || summarySimilarity >= 0.45)) {
        reason = "Same scenario category with similar central event or summary";
      } else if (similarCategory && eventSimilarity >= 0.55) {
        reason = "Nearly identical scenario category and central event";
      } else if (summarySimilarity >= summaryThreshold) {
        reason = "Scenario summaries too similar";
      } else if (problemResponseSimilarity >= 0.65) {
        reason = "Same main problem and required response";
      } else if (fingerprintSimilarity >= fingerprintThreshold) {
        reason = "Scenario fingerprint too similar (same narrative structure)";
      } else if (detectRepeatedNarrativeArc(a, b, exclude)) {
        reason =
          "Repeated narrative template (e.g. student starts → ignores rule → instructor stops → explains)";
      } else if (passageSimilarity >= passageThreshold) {
        reason = "Passage text too similar";
      }

      if (reason) {
        duplicates.push({
          indexA: i,
          indexB: j,
          reason,
          summarySimilarity,
          passageSimilarity,
          fingerprintSimilarity,
        });
      }
    }
  }

  return duplicates;
}

export function validatePassageDiversity(
  passages: PassageDiversityInput[],
  options?: {
    excludeTerms?: string[];
  },
): DiversityValidationResult {
  if (passages.length < 2) {
    return { ok: true, duplicates: [], reasons: [] };
  }
  const duplicates = findDuplicatePassages(passages, {
    excludeTerms: options?.excludeTerms,
  });
  if (duplicates.length === 0) {
    return { ok: true, duplicates: [], reasons: [] };
  }
  return {
    ok: false,
    duplicates,
    reasons: duplicates.map((item) => item.reason),
    message:
      "The generator produced passages that are too similar. Distinct educational situations are required.",
  };
}

/** Validate one candidate against already-accepted passages. */
export function validatePassageAgainstSet(
  candidate: PassageDiversityInput,
  accepted: PassageDiversityInput[],
  vocabularyTerms: string[] = [],
): PassageAgainstSetResult {
  const reasons: string[] = [];

  if (isVocabularyDerivedScenario(candidate, vocabularyTerms)) {
    reasons.push(
      "Scenario category/title is vocabulary-derived rather than an educational event or context.",
    );
  }

  if (accepted.length === 0) {
    return { valid: reasons.length === 0, reasons, duplicates: [] };
  }

  const set = [...accepted, candidate];
  const duplicates = findDuplicatePassages(set, {
    excludeTerms: [
      ...vocabularyTerms,
      ...(candidate.vocabularyTermsUsed ?? []),
    ],
  }).filter((pair) => pair.indexB === set.length - 1 || pair.indexA === set.length - 1);

  for (const pair of duplicates) {
    reasons.push(pair.reason);
  }

  return {
    valid: reasons.length === 0,
    reasons,
    duplicates,
  };
}

export type PreviousPassageAvoidanceMeta = {
  title?: string;
  scenarioCategory?: string;
  scenarioSummary?: string;
  centralEvent?: string;
  mainProblem?: string;
  consequence?: string;
  requiredResponse?: string;
  perspective?: string;
  setting?: string;
  objectivesCovered?: string[];
  vocabularyUsed?: string[];
};

/** Compact previous-passage avoidance list for prompts. */
export function formatPreviousPassageAvoidance(
  summaries: PreviousPassageAvoidanceMeta[],
): string {
  if (summaries.length === 0) return "";
  return summaries
    .slice(0, 20)
    .map((item, index) => {
      const title = item.title?.trim() || `Passage ${index + 1}`;
      const category = item.scenarioCategory?.trim() || "unspecified";
      const summary = item.scenarioSummary?.trim() || "(no summary)";
      const lines = [
        `${index + 1}. [${category}] ${title}`,
        `   summary: ${summary}`,
      ];
      if (item.centralEvent) lines.push(`   centralEvent: ${item.centralEvent}`);
      if (item.mainProblem) lines.push(`   mainProblem: ${item.mainProblem}`);
      if (item.consequence) lines.push(`   consequence: ${item.consequence}`);
      if (item.requiredResponse) {
        lines.push(`   requiredResponse: ${item.requiredResponse}`);
      }
      if (item.perspective) lines.push(`   perspective: ${item.perspective}`);
      if (item.setting) lines.push(`   setting: ${item.setting}`);
      if (item.objectivesCovered?.length) {
        lines.push(`   objectives: ${item.objectivesCovered.join("; ")}`);
      }
      if (item.vocabularyUsed?.length) {
        lines.push(`   vocabularyUsed: ${item.vocabularyUsed.join("; ")}`);
      }
      return lines.join("\n");
    })
    .join("\n");
}

export function toDiversityMetadata(
  passage: PassageDiversityInput & {
    alignedObjectives?: string[];
  },
): PreviousPassageAvoidanceMeta {
  return {
    title: passage.title,
    scenarioCategory: passage.scenarioCategory ?? undefined,
    scenarioSummary: passage.scenarioSummary ?? undefined,
    centralEvent: passage.centralEvent ?? undefined,
    mainProblem: passage.mainProblem ?? undefined,
    consequence: passage.consequence ?? undefined,
    requiredResponse: passage.requiredResponse ?? undefined,
    perspective: passage.perspective ?? undefined,
    setting: passage.setting ?? undefined,
    objectivesCovered: passage.alignedObjectives,
    vocabularyUsed: passage.vocabularyTermsUsed,
  };
}

export function buildSinglePassageReplacementPrompt(input: {
  rejected: PassageDiversityInput;
  reasons: string[];
  previousPassages: PreviousPassageAvoidanceMeta[];
}): string {
  return [
    "The previous passage is rejected because it shares the same central incident or narrative pattern as an accepted passage.",
    "Do not revise, paraphrase, rename, or lightly edit it.",
    "Create a completely new passage using a different:",
    "- central event",
    "- problem",
    "- setting",
    "- perspective",
    "- action sequence",
    "- consequence",
    "- required response",
    "- objective emphasis",
    "",
    `Rejection reasons: ${input.reasons.join("; ") || "too similar to an accepted passage"}`,
    `Rejected title: ${input.rejected.title}`,
    `Rejected category: ${input.rejected.scenarioCategory ?? "(none)"}`,
    `Rejected summary: ${input.rejected.scenarioSummary ?? "(none)"}`,
    "",
    "PREVIOUS PASSAGES THAT MUST NOT BE REUSED OR PARAPHRASED:",
    formatPreviousPassageAvoidance(input.previousPassages) || "(none yet)",
    "",
    "Return one complete replacement passage in the required structured format.",
  ].join("\n");
}

/** @deprecated Prefer buildSinglePassageReplacementPrompt for sequential generation. */
export function buildDiversityRepairPrompt(input: {
  duplicates: DuplicatePair[];
  passages: PassageDiversityInput[];
}): string {
  const lines = [
    "The following passages are too similar. Replace ONLY these passage indexes with NEW educational situations that have different central events.",
    "Do not revise, paraphrase, rename, or lightly edit. Create completely new incidents.",
    "",
  ];
  for (const pair of input.duplicates) {
    const a = input.passages[pair.indexA];
    const b = input.passages[pair.indexB];
    lines.push(
      `Duplicate pair: #${pair.indexA + 1} and #${pair.indexB + 1} (${pair.reason})`,
      `  A: [${a?.scenarioCategory ?? "?"}] ${a?.scenarioSummary ?? a?.title ?? ""}`,
      `  B: [${b?.scenarioCategory ?? "?"}] ${b?.scenarioSummary ?? b?.title ?? ""}`,
    );
  }
  return lines.join("\n");
}
