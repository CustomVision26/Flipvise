import type { EssayGenerateInput } from "@/lib/essay-ai-schema";

export type EssayTopicMatchResult = {
  matches: boolean;
  confidence: "high" | "medium" | "low";
  /** Short explanation shown to the user. */
  reason: string;
  /** Best-guess topic of the student's writing when mismatched. */
  writingSeemsAbout: string | null;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "about",
  "should",
  "be",
  "is",
  "are",
  "it",
  "as",
  "by",
  "from",
  "that",
  "this",
  "what",
  "when",
  "how",
  "why",
  "essay",
  "write",
  "topic",
  "versus",
  "vs",
  "year",
  "grade",
  "words",
  "aim",
  "use",
  "provided",
  "sections",
  "force",
  "three",
  "body",
  "paragraph",
  "template",
  "clear",
  "using",
  "ideas",
  "response",
  "produce",
  "organize",
  "support",
  "relevant",
  "details",
  "students",
  "student",
  "schools",
  "school",
  "learning",
  "learners",
]);

/** Domain cues that strongly identify common essay subjects. */
const TOPIC_SIGNAL_GROUPS: string[][] = [
  ["e-sports", "esports", "gaming", "video game", "video games"],
  ["remote", "hybrid", "online learning", "distance learning", "classroom"],
  ["climate", "global warming", "carbon", "emissions"],
  ["homework", "assignments"],
  ["social media", "instagram", "tiktok"],
  ["uniform", "dress code"],
  ["budget", "financial literacy", "credit", "saving"],
];

function tokenize(text: string): string[] {
  return normalizeForMatch(text)
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

function uniqueTokens(text: string): string[] {
  return [...new Set(tokenize(text))];
}

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/e-sports/g, "esports")
    .replace(/[—–]/g, " ");
}

function signalGroupHits(text: string): number[] {
  const norm = normalizeForMatch(text);
  return TOPIC_SIGNAL_GROUPS.map((group, index) =>
    group.some((cue) => norm.includes(cue)) ? index : -1,
  ).filter((index) => index >= 0);
}

/** Strip type suffixes like "— Cause and Effect" from titles for topic comparison. */
export function coreEssayTopic(topicOrTitle: string): string {
  return topicOrTitle
    .replace(
      /\s*[—–-]\s*(Cause and Effect|Persuasive|Argumentative|Narrative|Compare and Contrast|Problem and Solution|Discursive|For and Against|Opinion|Informative|Research|Reflective|Process).*$/i,
      "",
    )
    .trim();
}

/**
 * Fast heuristic: does the draft share enough distinctive tokens with the assigned topic?
 * Used as primary check (and fallback when AI is unavailable).
 */
export function heuristicEssayTopicMatch(input: {
  topic: string;
  prompt: string;
  body: string;
}): EssayTopicMatchResult {
  const topic = coreEssayTopic(input.topic || "");
  const body = input.body.trim();
  if (!body) {
    return {
      matches: false,
      confidence: "high",
      reason: "No written essay content to check against the assigned topic.",
      writingSeemsAbout: null,
    };
  }

  // Too short to judge confidently — warn but don't hard-fail until more content.
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  if (wordCount < 12) {
    return {
      matches: true,
      confidence: "low",
      reason: "Draft is too short to verify topic match yet.",
      writingSeemsAbout: null,
    };
  }

  const topicCoreTokens = uniqueTokens(topic);
  const promptTokens = uniqueTokens(input.prompt);
  // Prefer title/topic tokens over long prompt boilerplate.
  const topicTokens =
    topicCoreTokens.length > 0
      ? topicCoreTokens
      : promptTokens.slice(0, 12);

  if (topicTokens.length === 0) {
    return {
      matches: true,
      confidence: "low",
      reason: "Topic keywords could not be extracted; allowing submit.",
      writingSeemsAbout: null,
    };
  }

  const bodyNorm = normalizeForMatch(body);
  const topicNorm = normalizeForMatch(topic);
  const hits = topicTokens.filter((token) => bodyNorm.includes(token));
  const ratio = hits.length / topicTokens.length;

  const topicSignals = signalGroupHits(`${topic} ${input.prompt}`);
  const bodySignals = signalGroupHits(body);
  const conflictingSignals = bodySignals.some(
    (signal) => !topicSignals.includes(signal),
  );
  const missingRequiredSignals =
    topicSignals.length > 0 &&
    !topicSignals.some((signal) => bodySignals.includes(signal));

  // Prefer distinctive multi-word cues from the topic title.
  const topicPhrases = normalizeForMatch(topic)
    .split(/[:?/]/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 6);
  const phraseHit = topicPhrases.some((phrase) => {
    const words = phrase
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9'-]/g, ""))
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
    if (words.length === 0) return false;
    return (
      words.filter((w) => bodyNorm.includes(w)).length >=
      Math.ceil(words.length * 0.6)
    );
  });

  const firstSentence =
    body.split(/(?<=[.!?])\s+/)[0]?.trim().slice(0, 160) || null;

  if (missingRequiredSignals || (conflictingSignals && ratio < 0.35)) {
    return {
      matches: false,
      confidence: "high",
      reason:
        "Your writing appears to be about a different subject than the assigned essay topic/prompt. Update the topic in Essay Generator, or rewrite your draft to match the assigned subject.",
      writingSeemsAbout: firstSentence,
    };
  }

  if (ratio >= 0.3 || phraseHit || hits.length >= 2) {
    return {
      matches: true,
      confidence: ratio >= 0.45 || phraseHit ? "high" : "medium",
      reason:
        "The written essay appears related to the assigned topic and prompt.",
      writingSeemsAbout: null,
    };
  }

  // Extra guard: if topic has a distinctive token (esports, hybrid…) absent from body.
  const distinctive = topicTokens.filter((t) => t.length >= 5);
  const distinctiveHits = distinctive.filter((t) => bodyNorm.includes(t));
  if (distinctive.length > 0 && distinctiveHits.length === 0) {
    return {
      matches: false,
      confidence: "high",
      reason: `Your draft does not mention key ideas from the assigned topic (“${topic}”). Please rewrite for this topic, or change the topic in Essay Generator.`,
      writingSeemsAbout: firstSentence,
    };
  }

  return {
    matches: false,
    confidence: hits.length <= 1 ? "high" : "medium",
    reason:
      "Your writing does not clearly match the assigned essay topic/prompt. Update the topic in Essay Generator, or revise your draft to address the assigned subject.",
    writingSeemsAbout: firstSentence,
  };
}

/** Build Essay Generator prefills from a saved document generation input. */
export function essayGeneratorPrefillFromInput(
  input: EssayGenerateInput,
  extras?: { title?: string | null },
): Partial<EssayGenerateInput> & { topic: string } {
  const knownPresets = new Set([100, 200, 300, 500, 750, 1000, 1500]);
  const wordCount = input.wordCount;
  const wordCountPreset = knownPresets.has(wordCount)
    ? (String(wordCount) as EssayGenerateInput["wordCountPreset"])
    : wordCount > 0
      ? ("custom" as const)
      : input.wordCountPreset;

  return {
    subject: input.subject,
    gradeLevel: input.gradeLevel,
    essayType: input.essayType,
    essayStance: input.essayStance ?? null,
    topic: coreEssayTopic(extras?.title?.trim() || input.topic),
    learningStandard: input.learningStandard ?? "",
    essayLength: input.essayLength,
    customMainPoints: input.customMainPoints,
    complexity: input.complexity,
    difficultyLevel: input.difficultyLevel,
    wordCountPreset,
    wordCount,
    writingStyle: input.writingStyle,
    tone: input.tone,
    includeCounterargument: input.includeCounterargument,
    citationStyle: input.citationStyle,
    sourcesRequired: input.sourcesRequired,
    accommodations: input.accommodations ?? [],
    timeLimitMinutes: input.timeLimitMinutes ?? 0,
    includeVocabulary: input.includeVocabulary,
    includeOutline: input.includeOutline,
    includeRubric: input.includeRubric,
    includeModelEssay: input.includeModelEssay,
    documentStudio: input.documentStudio,
  };
}
