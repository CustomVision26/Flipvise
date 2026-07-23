/**
 * Subject/topic vocabulary banks for lesson-plan fallbacks and detail expansion.
 * Prefer real domain concepts — never the lesson topic title as a "term".
 */

export type VocabularyBankEntry = {
  term: string;
  shortDefinition: string;
};

/** Format bank entries as "Term — definition" lines for unit/day vocabulary. */
export function formatVocabularyBankLines(entries: VocabularyBankEntry[]): string[] {
  return entries.map((entry) => `${entry.term} — ${entry.shortDefinition}`);
}

const ALGEBRA_1_BANK: VocabularyBankEntry[] = [
  {
    term: "Algebra",
    shortDefinition:
      "a branch of mathematics that uses letters, numbers, and symbols to represent relationships and solve problems",
  },
  {
    term: "Variable",
    shortDefinition:
      "a letter or symbol that represents an unknown or changing value (e.g., x, y)",
  },
  {
    term: "Constant",
    shortDefinition: "a fixed value that does not change (e.g., 5 in x + 5)",
  },
  {
    term: "Expression",
    shortDefinition:
      "a mathematical phrase made up of numbers, variables, and operations, without an equals sign (e.g., 3x + 4)",
  },
  {
    term: "Equation",
    shortDefinition:
      "a mathematical statement showing that two expressions are equal, indicated by an equals sign (e.g., x + 7 = 12)",
  },
  {
    term: "Coefficient",
    shortDefinition: "the number multiplied by a variable (e.g., 4 in 4x)",
  },
  {
    term: "Term",
    shortDefinition:
      "a single number, variable, or the product of numbers and variables separated by + or - signs (e.g., 3x, 5, -2y)",
  },
  {
    term: "Pattern",
    shortDefinition: "a sequence that follows a rule or repeated relationship",
  },
  {
    term: "Rule",
    shortDefinition: "a mathematical relationship that describes how a pattern changes",
  },
  {
    term: "Solve",
    shortDefinition:
      "to find the value of the unknown variable that makes an equation true",
  },
  {
    term: "Substitute",
    shortDefinition: "to replace a variable with a given number",
  },
  {
    term: "Inverse Operations",
    shortDefinition:
      "opposite operations used to solve equations, such as addition and subtraction or multiplication and division",
  },
];

const WATER_CYCLE_BANK: VocabularyBankEntry[] = [
  {
    term: "Evaporation",
    shortDefinition:
      "liquid water changing into water vapor, often from oceans, lakes, or soil",
  },
  {
    term: "Condensation",
    shortDefinition:
      "water vapor cooling and forming tiny droplets that create clouds",
  },
  {
    term: "Precipitation",
    shortDefinition: "water falling from clouds as rain, snow, sleet, or hail",
  },
  {
    term: "Collection",
    shortDefinition:
      "water gathering in rivers, lakes, oceans, and underground aquifers",
  },
  {
    term: "Transpiration",
    shortDefinition: "water vapor released by plants through their leaves",
  },
  {
    term: "Runoff",
    shortDefinition:
      "water flowing over land into streams and rivers after precipitation",
  },
  {
    term: "Infiltration",
    shortDefinition: "water soaking into the ground to replenish groundwater",
  },
  {
    term: "Water vapor",
    shortDefinition: "water in gas form in the atmosphere",
  },
];

const JAMAICAN_INDEPENDENCE_BANK: VocabularyBankEntry[] = [
  {
    term: "Colony",
    shortDefinition: "a territory controlled by another country",
  },
  {
    term: "Self-government",
    shortDefinition: "local leaders making decisions for their own people",
  },
  {
    term: "Nationalism",
    shortDefinition: "pride and political desire for an independent nation",
  },
  {
    term: "Constitution",
    shortDefinition: "a document defining how a country is governed",
  },
  {
    term: "Sovereignty",
    shortDefinition: "full authority of a state to govern itself",
  },
  {
    term: "Referendum",
    shortDefinition: "a public vote on an important political decision",
  },
  {
    term: "Legacy",
    shortDefinition: "long-term impact of historical events on present society",
  },
];

const EXACT_TOPIC_BANKS: Record<string, VocabularyBankEntry[]> = {
  "water cycle": WATER_CYCLE_BANK,
  "jamaican independence": JAMAICAN_INDEPENDENCE_BANK,
};

/** Generic meta-terms that must never be treated as subject vocabulary. */
const META_VOCABULARY_TERMS = new Set([
  "process",
  "cause and effect",
  "evidence",
  "model",
  "application",
  "vocabulary",
  "analysis",
  "concept",
  "example",
  "review",
  "consolidation",
  "main concept",
  "key idea",
  "key ideas",
]);

function normalizeTopicKey(topic: string): string {
  return topic.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeComparable(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolve a curated concept bank for the topic/subject when available.
 * Matches exact topics and common keyword families (e.g. Algebra 1).
 */
export function resolveVocabularyBank(
  topic: string,
  subject: string,
): VocabularyBankEntry[] | null {
  const topicKey = normalizeTopicKey(topic);
  if (EXACT_TOPIC_BANKS[topicKey]) {
    return EXACT_TOPIC_BANKS[topicKey]!;
  }

  const haystack = normalizeComparable(`${topic} ${subject}`);

  if (
    /\balgebra\b/.test(haystack) ||
    /\balegbra\b/.test(haystack) ||
    (/\bmath(?:ematics)?\b/.test(haystack) &&
      /\b(variable|equation|expression)\b/.test(haystack))
  ) {
    return ALGEBRA_1_BANK;
  }

  if (/\bwater\s*cycle\b/.test(haystack)) {
    return WATER_CYCLE_BANK;
  }

  if (
    /\bjamaica(?:n)?\b/.test(haystack) &&
    /\bindependence\b/.test(haystack)
  ) {
    return JAMAICAN_INDEPENDENCE_BANK;
  }

  return null;
}

function stripLessonTopicPrefixes(value: string): string {
  return value
    .replace(
      /^(learning|introduction to|intro to|studying|understanding|exploring|about)\s+/i,
      "",
    )
    .trim();
}

function termsMatchTopicTitle(term: string, topicOrTitle: string): boolean {
  const normalizedTerm = normalizeComparable(term);
  const normalizedTopic = normalizeComparable(topicOrTitle);
  if (!normalizedTerm || !normalizedTopic) return false;
  if (normalizedTerm === normalizedTopic) return true;

  const strippedTopic = stripLessonTopicPrefixes(normalizedTopic);
  if (strippedTopic && normalizedTerm === strippedTopic) return true;

  // "Learning Algebra 1 — Math (Grade 7)" style titles
  const withoutParen = normalizedTopic.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  if (withoutParen && normalizedTerm === withoutParen) return true;
  const strippedWithoutParen = stripLessonTopicPrefixes(withoutParen);
  if (strippedWithoutParen && normalizedTerm === strippedWithoutParen) {
    return true;
  }

  return false;
}

/**
 * True when a vocabulary term is the lesson topic/title or a generic meta-term
 * rather than a real subject concept.
 */
export function isNonConceptVocabularyTerm(
  term: string,
  topic: string,
  lessonTitle?: string,
): boolean {
  const normalizedTerm = normalizeComparable(term);
  if (!normalizedTerm) return true;
  if (META_VOCABULARY_TERMS.has(normalizedTerm)) return true;
  if (termsMatchTopicTitle(normalizedTerm, topic)) return true;
  if (lessonTitle?.trim() && termsMatchTopicTitle(normalizedTerm, lessonTitle)) {
    return true;
  }
  return false;
}

/** Slice a bank to the difficulty-appropriate term count used by offline lesson plans. */
export function sliceVocabularyForDifficulty(
  entries: VocabularyBankEntry[],
  difficulty: string,
): VocabularyBankEntry[] {
  if (difficulty === "Beginner") {
    return entries.slice(0, 5);
  }
  if (difficulty === "Advanced" || difficulty === "Honors/Gifted") {
    return entries;
  }
  return entries.slice(0, Math.min(7, entries.length));
}

/**
 * Build unit vocabulary lines: curated concepts when possible, otherwise
 * subject-framed learning terms that are not the topic title.
 */
export function buildTopicVocabularyLines(
  topic: string,
  subject: string,
  difficulty: string,
): string[] {
  const bank = resolveVocabularyBank(topic, subject);
  if (bank) {
    return formatVocabularyBankLines(
      sliceVocabularyForDifficulty(bank, difficulty),
    );
  }

  const subjectLabel = subject.trim() || "this subject";
  const generic: VocabularyBankEntry[] = [
    {
      term: "Key concept",
      shortDefinition: `an essential idea students must understand in this ${subjectLabel} unit`,
    },
    {
      term: "Definition",
      shortDefinition: "the precise meaning of a subject-specific word or idea",
    },
    {
      term: "Example",
      shortDefinition: "a concrete instance that shows how a concept works",
    },
    {
      term: "Procedure",
      shortDefinition: "an ordered set of steps used to complete a task or solve a problem",
    },
    {
      term: "Relationship",
      shortDefinition: "how two or more ideas, quantities, or events connect",
    },
    {
      term: "Representation",
      shortDefinition: "a diagram, model, table, or symbol system used to show an idea",
    },
    {
      term: "Justification",
      shortDefinition: "a clear reason or evidence that supports an answer or claim",
    },
    {
      term: "Application",
      shortDefinition: "using a concept in a new problem or real-world context",
    },
  ];

  return formatVocabularyBankLines(
    sliceVocabularyForDifficulty(generic, difficulty),
  );
}
