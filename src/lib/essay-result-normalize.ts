import type {
  EssayGenerationResult,
  EssayOutlineItem,
  EssaySection,
  EssaySectionsContent,
} from "@/lib/essay-ai-schema";

type LegacyResult = {
  title?: unknown;
  thesis?: unknown;
  prompt?: unknown;
  learningObjectives?: unknown;
  outline?: unknown;
  sections?: unknown;
  vocabulary?: unknown;
  planningGuide?: unknown;
  successChecklist?: unknown;
  rubric?: unknown;
  references?: unknown;
  titlePage?: unknown;
  referencesAreSamples?: unknown;
  referencesNote?: unknown;
  conclusion?: unknown;
  modelEssay?: unknown;
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function slugId(prefix: string, index: number, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${prefix}-${index + 1}-${slug || "section"}`;
}

/**
 * Normalize stored essay generation JSON (v1 string outlines → v2 dynamic sections).
 * Never invents "Body Paragraph 1/2/3" labels.
 */
export function normalizeEssayGenerationResult(
  raw: unknown,
): EssayGenerationResult {
  const data = (raw && typeof raw === "object" ? raw : {}) as LegacyResult;
  const title = asString(data.title, "Essay");
  const prompt = asString(data.prompt, "Write your response.");
  const learningObjectives = asStringArray(data.learningObjectives);
  const successChecklist = asStringArray(data.successChecklist);
  const planningGuide = asStringArray(data.planningGuide);

  let sections: EssaySection[] = [];
  if (Array.isArray(data.sections) && data.sections.length > 0) {
    sections = data.sections
      .map((item, index): EssaySection | null => {
        if (!item || typeof item !== "object") return null;
        const s = item as Record<string, unknown>;
        const sectionTitle = asString(s.title, `Section ${index + 1}`);
        return {
          id: asString(s.id, slugId("section", index, sectionTitle)),
          title: sectionTitle,
          type: asString(s.type, "supporting"),
          instructions: asString(s.instructions, `Write the ${sectionTitle} section.`),
          sentenceStarters: Array.isArray(s.sentenceStarters)
            ? asStringArray(s.sentenceStarters)
            : null,
          examples: Array.isArray(s.examples) ? asStringArray(s.examples) : null,
          transitionWords: Array.isArray(s.transitionWords)
            ? asStringArray(s.transitionWords)
            : null,
          checklist: Array.isArray(s.checklist) ? asStringArray(s.checklist) : null,
          teacherNotes: typeof s.teacherNotes === "string" ? s.teacherNotes : null,
          estimatedWords:
            typeof s.estimatedWords === "number" && s.estimatedWords > 0
              ? Math.min(2000, Math.max(10, Math.round(s.estimatedWords)))
              : 80,
          generatedContent:
            typeof s.generatedContent === "string" ? s.generatedContent : null,
          planningGoal: typeof s.planningGoal === "string" ? s.planningGoal : null,
          planningKeyIdea:
            typeof s.planningKeyIdea === "string" ? s.planningKeyIdea : null,
          planningEvidence:
            typeof s.planningEvidence === "string" ? s.planningEvidence : null,
        };
      })
      .filter((s): s is EssaySection => s != null);
  }

  let outline: EssayOutlineItem[] | null = null;
  if (Array.isArray(data.outline) && data.outline.length > 0) {
    const first = data.outline[0];
    if (typeof first === "string") {
      const titles = asStringArray(data.outline);
      outline = titles.map((t, index) => ({
        id: slugId("outline", index, t),
        title: t,
        purpose: t,
        estimatedWords: 80,
      }));
      if (sections.length === 0) {
        sections = titles.map((t, index) => ({
          id: slugId("section", index, t),
          title: t,
          type: /intro/i.test(t)
            ? "introduction"
            : /conclu/i.test(t)
              ? "conclusion"
              : /counter/i.test(t)
                ? "counterargument"
                : "supporting",
          instructions: `Develop this essay section: ${t}`,
          sentenceStarters: null,
          examples: null,
          transitionWords: null,
          checklist: null,
          teacherNotes: null,
          estimatedWords: 80,
          generatedContent: null,
          planningGoal: `Complete the ${t} section.`,
          planningKeyIdea: null,
          planningEvidence: null,
        }));
      }
    } else {
      outline = data.outline
        .map((item, index): EssayOutlineItem | null => {
          if (!item || typeof item !== "object") return null;
          const o = item as Record<string, unknown>;
          const t = asString(o.title, `Section ${index + 1}`);
          return {
            id: asString(o.id, slugId("outline", index, t)),
            title: t,
            purpose: asString(o.purpose, t),
            estimatedWords:
              typeof o.estimatedWords === "number"
                ? Math.max(0, Math.round(o.estimatedWords))
                : 80,
          };
        })
        .filter((o): o is EssayOutlineItem => o != null);
    }
  }

  if (sections.length === 0) {
    sections = [
      {
        id: "section-1-introduction",
        title: "Introduction",
        type: "introduction",
        instructions: "Introduce the topic and thesis.",
        sentenceStarters: null,
        examples: null,
        transitionWords: null,
        checklist: null,
        teacherNotes: null,
        estimatedWords: 60,
        generatedContent: null,
        planningGoal: "Hook the reader and state the controlling idea.",
        planningKeyIdea: null,
        planningEvidence: null,
      },
      {
        id: "section-2-development",
        title: "Development",
        type: "supporting",
        instructions: "Develop your main ideas with evidence.",
        sentenceStarters: null,
        examples: null,
        transitionWords: null,
        checklist: null,
        teacherNotes: null,
        estimatedWords: 120,
        generatedContent: null,
        planningGoal: "Support the thesis with clear points.",
        planningKeyIdea: null,
        planningEvidence: null,
      },
      {
        id: "section-3-conclusion",
        title: "Conclusion",
        type: "conclusion",
        instructions: "Close the essay thoughtfully.",
        sentenceStarters: null,
        examples: null,
        transitionWords: null,
        checklist: null,
        teacherNotes: null,
        estimatedWords: 50,
        generatedContent: null,
        planningGoal: "Restate and leave a lasting impression.",
        planningKeyIdea: null,
        planningEvidence: null,
      },
    ];
  }

  if (!outline) {
    outline = sections.map((s) => ({
      id: `outline-${s.id}`,
      title: s.title,
      purpose: s.instructions,
      estimatedWords: s.estimatedWords,
    }));
  }

  let vocabulary: EssayGenerationResult["vocabulary"] = null;
  if (Array.isArray(data.vocabulary)) {
    vocabulary = data.vocabulary
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const v = item as Record<string, unknown>;
        const term = asString(v.term);
        const definition = asString(v.definition);
        if (!term || !definition) return null;
        return { term, definition };
      })
      .filter((v): v is { term: string; definition: string } => v != null);
    if (vocabulary.length === 0) vocabulary = null;
  }

  let rubric: EssayGenerationResult["rubric"] = null;
  if (Array.isArray(data.rubric)) {
    rubric = data.rubric
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const r = item as Record<string, unknown>;
        const name = asString(r.name);
        const description = asString(r.description);
        const maxPoints =
          typeof r.maxPoints === "number" ? Math.round(r.maxPoints) : 0;
        if (!name || !description || maxPoints < 1) return null;
        return { name, description, maxPoints };
      })
      .filter(
        (r): r is { name: string; description: string; maxPoints: number } =>
          r != null,
      );
    if (rubric.length === 0) rubric = null;
  }

  const references = Array.isArray(data.references)
    ? asStringArray(data.references)
    : [];

  const titlePage =
    typeof data.titlePage === "string" && data.titlePage.trim()
      ? data.titlePage.trim()
      : null;
  const referencesNote =
    typeof data.referencesNote === "string" && data.referencesNote.trim()
      ? data.referencesNote.trim()
      : null;
  const referencesAreSamples =
    typeof data.referencesAreSamples === "boolean"
      ? data.referencesAreSamples
      : references.some((r) => /^\[Sample\]/i.test(r))
        ? true
        : null;

  return {
    title,
    thesis: typeof data.thesis === "string" ? data.thesis : null,
    prompt,
    learningObjectives:
      learningObjectives.length > 0
        ? learningObjectives
        : ["Complete a structured written response."],
    outline,
    sections,
    vocabulary,
    planningGuide: planningGuide.length > 0 ? planningGuide : null,
    successChecklist:
      successChecklist.length > 0
        ? successChecklist
        : ["Addresses the prompt", "Uses organized essay sections", "Uses clear language"],
    rubric,
    references: references.length > 0 ? references : null,
    titlePage,
    referencesAreSamples,
    referencesNote,
    conclusion: typeof data.conclusion === "string" ? data.conclusion : null,
    modelEssay: typeof data.modelEssay === "string" ? data.modelEssay : null,
  };
}

export function joinSectionsContent(
  sections: EssaySection[],
  content: Record<string, string>,
): string {
  return sections
    .map((section) => {
      const text = (content[section.id] ?? "").trim();
      if (!text) return "";
      return `## ${section.title}\n\n${text}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function normalizeSectionHeading(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ");
}

function resolveSectionIdFromHeading(
  heading: string,
  sections: EssaySection[],
): string | undefined {
  const key = normalizeSectionHeading(heading);
  if (!key) return undefined;

  for (const section of sections) {
    if (normalizeSectionHeading(section.title) === key) return section.id;
  }

  for (const section of sections) {
    const sectionKey = normalizeSectionHeading(section.title);
    const sectionLead = sectionKey.split(":")[0]?.trim() ?? sectionKey;
    const headingLead = key.split(":")[0]?.trim() ?? key;
    if (
      sectionKey.startsWith(key) ||
      key.startsWith(sectionKey) ||
      sectionLead === headingLead ||
      section.type.toLowerCase() === headingLead
    ) {
      return section.id;
    }
  }

  return undefined;
}

function emptySectionsMap(sections: EssaySection[]): EssaySectionsContent {
  const next: EssaySectionsContent = {};
  for (const section of sections) next[section.id] = "";
  return next;
}

function splitEssayParagraphs(text: string): string[] {
  const byBlock = splitParagraphs(text);
  if (byBlock.length > 1) return byBlock;
  const byLine = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return byLine.length > 1 ? byLine : byBlock;
}

function sectionRole(
  section: EssaySection,
  index: number,
  total: number,
): ModelEssayRoleBadge {
  return roleBadgeForSectionType(
    `${section.type} ${section.title}`,
    index,
    total,
  );
}

function chunkItemsEvenly<T>(items: T[], bucketCount: number): T[][] {
  if (bucketCount <= 0) return [];
  if (bucketCount === 1) return [items];
  const buckets: T[][] = Array.from({ length: bucketCount }, () => []);
  if (items.length === 0) return buckets;
  const size = Math.ceil(items.length / bucketCount);
  items.forEach((item, index) => {
    const bucketIndex = Math.min(Math.floor(index / size), bucketCount - 1);
    buckets[bucketIndex]!.push(item);
  });
  return buckets;
}

function splitIntoSentences(paragraph: string): string[] {
  const matches = paragraph.match(/[^.!?]+(?:[.!?]+|$)/g);
  if (!matches) return paragraph.trim() ? [paragraph.trim()] : [];
  return matches.map((s) => s.trim()).filter(Boolean);
}

/** True when a sentence reads as a closing judgment / thesis restatement. */
export function looksLikeConclusionSentence(sentence: string): boolean {
  const s = sentence.trim();
  if (!s) return false;
  if (
    /^(In conclusion|To conclude|In summary|To summarize|Overall|Ultimately|Finally|In the end)\b/i.test(
      s,
    )
  ) {
    return true;
  }
  if (
    /\b(readers should|it is clear that|the strongest (?:response|answer|position))\b/i.test(
      s,
    )
  ) {
    return true;
  }
  // Persuasive closer: actor + should/must + because/therefore…
  if (
    /\b(schools|students|teachers|communities|we|society)\s+should\b/i.test(s) &&
    /\b(because|therefore|thus|so that)\b/i.test(s) &&
    s.split(/\s+/).length >= 12
  ) {
    return true;
  }
  return false;
}

/**
 * Keep Conclusion focused on closing judgment sentences.
 * - If empty: peel trailing closers from the last body section.
 * - If filled with a mixed paragraph: move leading body sentences back to support.
 */
export function refineConclusionBoundary(
  sections: EssaySection[],
  content: EssaySectionsContent,
): EssaySectionsContent {
  if (sections.length < 2) return content;

  const n = sections.length;
  const conclusionSection =
    sections.find(
      (section, index) => sectionRole(section, index, n) === "Conclusion",
    ) ?? sections[n - 1]!;

  const supportSections = sections.filter(
    (section, index) =>
      section.id !== conclusionSection.id &&
      sectionRole(section, index, n) === "Supporting",
  );
  const fallbackBody =
    supportSections[supportSections.length - 1] ??
    sections.filter((section) => section.id !== conclusionSection.id).at(-1) ??
    null;

  let next = { ...content };
  let conclusionText = (next[conclusionSection.id] ?? "").trim();

  if (!conclusionText) {
    next = peelTrailingConclusionIntoSection(sections, next);
    conclusionText = (next[conclusionSection.id] ?? "").trim();
  }

  if (!conclusionText || !fallbackBody) return next;

  const sentences = splitIntoSentences(conclusionText);
  if (sentences.length < 2) return next;

  let start = sentences.length;
  while (start > 0 && looksLikeConclusionSentence(sentences[start - 1]!)) {
    start -= 1;
  }
  if (start <= 0 || start >= sentences.length) return next;

  const bodyPart = sentences.slice(0, start).join(" ").trim();
  const conclusionPart = sentences.slice(start).join(" ").trim();
  if (!bodyPart || !conclusionPart) return next;

  const prior = (next[fallbackBody.id] ?? "").trim();
  return {
    ...next,
    [fallbackBody.id]: prior ? `${prior}\n\n${bodyPart}` : bodyPart,
    [conclusionSection.id]: conclusionPart,
  };
}

/**
 * If Conclusion is empty, peel trailing concluding sentence(s) from the
 * last filled body section (common when freeform ends body + closer in one paragraph).
 */
export function peelTrailingConclusionIntoSection(
  sections: EssaySection[],
  content: EssaySectionsContent,
): EssaySectionsContent {
  if (sections.length < 2) return content;

  const n = sections.length;
  const conclusionSection =
    sections.find(
      (section, index) => sectionRole(section, index, n) === "Conclusion",
    ) ?? sections[n - 1]!;

  if ((content[conclusionSection.id] ?? "").trim()) return content;

  const prior = sections.filter((section) => section.id !== conclusionSection.id);
  for (let i = prior.length - 1; i >= 0; i--) {
    const section = prior[i]!;
    const text = (content[section.id] ?? "").trim();
    if (!text) continue;

    const paragraphs = splitEssayParagraphs(text);
    const lastPara = paragraphs[paragraphs.length - 1]!;
    const sentences = splitIntoSentences(lastPara);
    if (sentences.length === 0) continue;

    let cut = sentences.length;
    while (cut > 0 && looksLikeConclusionSentence(sentences[cut - 1]!)) {
      cut -= 1;
    }

    // Need at least one sentence left in the body section when multiple exist.
    if (cut === 0 && sentences.length > 1) cut = 1;
    if (cut >= sentences.length) {
      // Whole last paragraph looks like a conclusion.
      if (
        sentences.length === 1 &&
        looksLikeConclusionSentence(sentences[0]!)
      ) {
        const next = { ...content };
        const remaining = paragraphs.slice(0, -1).join("\n\n").trim();
        next[section.id] = remaining;
        next[conclusionSection.id] = lastPara;
        return next;
      }
      break;
    }

    const conclusionText = sentences.slice(cut).join(" ").trim();
    const remainingLast = sentences.slice(0, cut).join(" ").trim();
    const remainingParas = [...paragraphs.slice(0, -1), remainingLast]
      .map((p) => p.trim())
      .filter(Boolean);

    return {
      ...content,
      [section.id]: remainingParas.join("\n\n"),
      [conclusionSection.id]: conclusionText,
    };
  }

  return content;
}

/**
 * Map a freeform essay onto section ids by heading, or by
 * Introduction / Supporting / Conclusion roles when unheaded.
 */
export function distributeEssayTextAcrossSections(
  sections: EssaySection[],
  freeform: string,
): EssaySectionsContent {
  const next = emptySectionsMap(sections);
  const trimmed = freeform.trim();
  if (!trimmed || sections.length === 0) return next;

  const headingRe = /^##\s+(.+)$/gm;
  const matches = [...trimmed.matchAll(headingRe)];
  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i]!;
      const title = (match[1] ?? "").trim();
      const start = (match.index ?? 0) + match[0].length;
      const end = matches[i + 1]?.index ?? trimmed.length;
      const body = trimmed.slice(start, end).replace(/^\n+/, "").trimEnd();
      const id =
        resolveSectionIdFromHeading(title, sections) ??
        sections[Math.min(i, sections.length - 1)]!.id;
      next[id] = (next[id] ? `${next[id]}\n\n` : "") + body.trim();
    }
    return refineConclusionBoundary(sections, next);
  }

  const paragraphs = splitEssayParagraphs(trimmed);
  const n = sections.length;

  if (paragraphs.length === 1) {
    // Single blob: still place by role slots when multiple sections exist.
    if (n === 1) {
      next[sections[0]!.id] = paragraphs[0]!;
      return next;
    }
    // Keep short single-paragraph essays in the introduction section.
    const intro =
      sections.find((section, index) => sectionRole(section, index, n) === "Introduction") ??
      sections[0]!;
    next[intro.id] = paragraphs[0]!;
    return refineConclusionBoundary(sections, next);
  }

  if (paragraphs.length === n) {
    paragraphs.forEach((paragraph, index) => {
      next[sections[index]!.id] = paragraph;
    });
    return refineConclusionBoundary(sections, next);
  }

  const roles = sections.map((section, index) =>
    sectionRole(section, index, n),
  );
  let introIds = sections
    .filter((_, index) => roles[index] === "Introduction")
    .map((section) => section.id);
  let supportIds = sections
    .filter((_, index) => roles[index] === "Supporting")
    .map((section) => section.id);
  let conclusionIds = sections
    .filter((_, index) => roles[index] === "Conclusion")
    .map((section) => section.id);

  if (introIds.length === 0) introIds = [sections[0]!.id];
  if (conclusionIds.length === 0 && n > 1) {
    conclusionIds = [sections[n - 1]!.id];
  }
  if (supportIds.length === 0 && n > 2) {
    supportIds = sections.slice(1, -1).map((section) => section.id);
  }

  const conclusionCount =
    conclusionIds.length > 0
      ? Math.min(
          conclusionIds.length,
          paragraphs.length >= 6 ? 2 : 1,
          Math.max(1, paragraphs.length - 1),
        )
      : 0;
  const introCount =
    introIds.length > 0
      ? Math.min(introIds.length, Math.max(1, paragraphs.length - conclusionCount))
      : 0;

  const introParas = paragraphs.slice(0, introCount);
  const conclusionParas =
    conclusionCount > 0 ? paragraphs.slice(-conclusionCount) : [];
  const supportParas = paragraphs.slice(
    introCount,
    paragraphs.length - conclusionCount,
  );

  chunkItemsEvenly(introParas, introIds.length).forEach((chunk, index) => {
    if (chunk.length === 0) return;
    next[introIds[index]!] = chunk.join("\n\n");
  });
  chunkItemsEvenly(supportParas, Math.max(supportIds.length, 1)).forEach(
    (chunk, index) => {
      if (chunk.length === 0) return;
      const id = supportIds[index] ?? introIds[0] ?? sections[0]!.id;
      next[id] = (next[id] ? `${next[id]}\n\n` : "") + chunk.join("\n\n");
    },
  );
  chunkItemsEvenly(conclusionParas, Math.max(conclusionIds.length, 1)).forEach(
    (chunk, index) => {
      if (chunk.length === 0) return;
      const id = conclusionIds[index] ?? sections[n - 1]!.id;
      next[id] = (next[id] ? `${next[id]}\n\n` : "") + chunk.join("\n\n");
    },
  );

  return refineConclusionBoundary(sections, next);
}

/**
 * Map a freeform Writing area draft back onto dynamic section ids.
 * Prefer `## Section Title` blocks; otherwise distribute by essay role.
 */
export function splitFreeformIntoSections(
  sections: EssaySection[],
  freeform: string,
): EssaySectionsContent {
  return distributeEssayTextAcrossSections(sections, freeform);
}

/** True when at least one section has non-empty draft text. */
export function hasMeaningfulSectionsContent(
  content: Record<string, string> | null | undefined,
): boolean {
  if (!content) return false;
  return Object.values(content).some(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
}

/** True when all draft text sits in a single section despite multiple slots. */
export function isEssayContentCollapsedToOneSection(
  sections: EssaySection[],
  content: Record<string, string> | null | undefined,
): boolean {
  if (!content || sections.length <= 1) return false;
  const filled = sections.filter((section) => content[section.id]?.trim());
  return filled.length === 1;
}

/**
 * Resolve per-section draft text from stored sections JSON and/or legacy body.
 * Redistributes collapsed single-section blobs across intro/support/conclusion.
 */
export function resolveEssaySectionsContent(
  sections: EssaySection[],
  sectionsContent: Record<string, string> | null | undefined,
  body?: string | null,
  options?: {
    redistributeCollapsed?: boolean;
    fallbackText?: string | null;
  },
): EssaySectionsContent {
  const empty = emptySectionsMap(sections);
  const redistributeCollapsed = options?.redistributeCollapsed ?? true;

  if (hasMeaningfulSectionsContent(sectionsContent)) {
    const merged = { ...empty, ...sectionsContent };
    if (
      redistributeCollapsed &&
      isEssayContentCollapsedToOneSection(sections, merged)
    ) {
      const blob =
        Object.values(merged).find((value) => value.trim())?.trim() ?? "";
      return distributeEssayTextAcrossSections(sections, blob);
    }
    return merged;
  }

  const seedBody =
    (body ?? "").trim() || (options?.fallbackText ?? "").trim();
  if (!seedBody) return empty;

  return distributeEssayTextAcrossSections(sections, seedBody);
}

export function countWordsInSectionsContent(
  content: Record<string, string>,
): number {
  const combined = Object.values(content).join(" ").trim();
  if (!combined) return 0;
  return combined.split(/\s+/).length;
}

function normalizeComparableText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function stripLeadingOutlineIndex(value: string): string {
  return value.replace(/^\d+\.\s*/, "").trim();
}

function outlineTextsRedundant(title: string, purpose: string): boolean {
  const a = normalizeComparableText(stripLeadingOutlineIndex(title));
  const b = normalizeComparableText(stripLeadingOutlineIndex(purpose));
  if (!b) return true;
  return a === b || a.includes(b) || b.includes(a);
}

/** Single clean outline line — no duplicated title/purpose or double numbering. */
export function formatEssayOutlineDisplay(
  item: Pick<EssayOutlineItem, "title" | "purpose" | "estimatedWords">,
  index: number,
): string {
  const title = stripLeadingOutlineIndex(item.title) || item.title.trim();
  const purpose = item.purpose.trim();
  const purposePart =
    purpose && !outlineTextsRedundant(title, purpose) ? ` — ${purpose}` : "";
  const words =
    item.estimatedWords > 0 ? ` (~${item.estimatedWords} words)` : "";
  return `${index + 1}. ${title}${purposePart}${words}`;
}

export type ModelEssayRoleBadge =
  | "Introduction"
  | "Supporting"
  | "Conclusion";

export type ModelEssaySegment = {
  badge: ModelEssayRoleBadge;
  text: string;
  /** Section title when segments are kept per section (not badge-merged). */
  title?: string | null;
  /** Construction tip / writing guidance — shown separately from sample prose. */
  guidance?: string | null;
};

function roleBadgeForSectionType(
  type: string,
  index: number,
  total: number,
): ModelEssayRoleBadge {
  const t = type.trim().toLowerCase();
  if (
    t.includes("intro") ||
    t === "hook" ||
    t === "opening" ||
    t === "engage"
  ) {
    return "Introduction";
  }
  if (
    t.includes("concl") ||
    t.includes("resolut") ||
    t.includes("closing") ||
    t.includes("ending")
  ) {
    return "Conclusion";
  }
  if (
    t.includes("support") ||
    t.includes("body") ||
    t.includes("rising") ||
    t.includes("climax") ||
    t.includes("falling") ||
    t.includes("counter") ||
    t.includes("analysis") ||
    t.includes("evidence") ||
    t.includes("elaborate")
  ) {
    return "Supporting";
  }
  if (index === 0) return "Introduction";
  if (index === total - 1) return "Conclusion";
  return "Supporting";
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function mergeSegmentsByBadge(
  parts: Array<{ badge: ModelEssayRoleBadge; text: string }>,
): ModelEssaySegment[] {
  const order: ModelEssayRoleBadge[] = [
    "Introduction",
    "Supporting",
    "Conclusion",
  ];
  const buckets: Record<ModelEssayRoleBadge, string[]> = {
    Introduction: [],
    Supporting: [],
    Conclusion: [],
  };
  for (const part of parts) {
    if (!part.text.trim()) continue;
    buckets[part.badge].push(part.text.trim());
  }
  return order
    .filter((badge) => buckets[badge].length > 0)
    .map((badge) => ({
      badge,
      text: buckets[badge].join("\n\n"),
    }));
}

/**
 * Split the model essay into Introduction / Supporting / Conclusion segments
 * for labeled display (PDF + UI).
 */
export function segmentModelEssay(
  result: EssayGenerationResult,
): ModelEssaySegment[] {
  const fromGenerated = result.sections
    .map((section, index, arr) => {
      const text = (section.generatedContent ?? "").trim();
      if (!text) return null;
      const guidance = section.teacherNotes?.trim() || null;
      return {
        badge: sectionRole(section, index, arr.length),
        text,
        title: section.title,
        guidance,
      };
    })
    .filter(
      (
        part,
      ): part is {
        badge: ModelEssayRoleBadge;
        text: string;
        title: string;
        guidance: string | null;
      } => part != null,
    );

  // Keep one card per section so construction tips stay aligned with prose.
  if (fromGenerated.length > 0) {
    return fromGenerated;
  }

  const model = (result.modelEssay ?? "").trim();
  if (!model) return [];

  const paragraphs = splitParagraphs(model);
  if (paragraphs.length === 0) return [];

  if (result.sections.length > 0) {
    const n = result.sections.length;
    const chunks: string[] = Array.from({ length: n }, () => "");

    if (paragraphs.length === n) {
      paragraphs.forEach((p, i) => {
        chunks[i] = p;
      });
    } else if (n === 1) {
      chunks[0] = model;
    } else if (paragraphs.length === 1) {
      chunks[0] = paragraphs[0]!;
    } else {
      chunks[0] = paragraphs[0]!;
      chunks[n - 1] = paragraphs[paragraphs.length - 1]!;
      const middleParas = paragraphs.slice(1, -1);
      const middleCount = Math.max(1, n - 2);
      middleParas.forEach((p, i) => {
        const si = 1 + (i % middleCount);
        chunks[si] = chunks[si] ? `${chunks[si]}\n\n${p}` : p;
      });
    }

    const parts = result.sections.map((section, index) => ({
      badge: sectionRole(section, index, n),
      text: chunks[index] ?? "",
      title: section.title,
      guidance: section.teacherNotes?.trim() || null,
    }));
    const withText = parts.filter((p) => p.text.trim());
    if (withText.length > 0) return withText;
  }

  if (paragraphs.length === 1) {
    return [{ badge: "Introduction", text: paragraphs[0]! }];
  }
  if (paragraphs.length === 2) {
    return [
      { badge: "Introduction", text: paragraphs[0]! },
      { badge: "Conclusion", text: paragraphs[1]! },
    ];
  }
  if (paragraphs.length === 3) {
    return [
      { badge: "Introduction", text: paragraphs[0]! },
      { badge: "Supporting", text: paragraphs[1]! },
      { badge: "Conclusion", text: paragraphs[2]! },
    ];
  }

  const conclusionCount = paragraphs.length >= 6 ? 2 : 1;
  const intro = paragraphs[0]!;
  const conclusion = paragraphs.slice(-conclusionCount).join("\n\n");
  const supporting = paragraphs
    .slice(1, paragraphs.length - conclusionCount)
    .join("\n\n");
  return [
    { badge: "Introduction", text: intro },
    ...(supporting ? [{ badge: "Supporting" as const, text: supporting }] : []),
    { badge: "Conclusion", text: conclusion },
  ];
}

/** Keep writing-workspace sections aligned when the outline is edited. */
export function syncEssaySectionsFromOutline(
  result: EssayGenerationResult,
): EssayGenerationResult {
  if (!result.outline || result.outline.length === 0) {
    return { ...result, title: result.title };
  }

  const sections = result.sections.map((section, index) => {
    const outlineItem =
      result.outline!.find(
        (item) =>
          item.id === section.id ||
          item.id === `outline-${section.id}` ||
          item.id.endsWith(`-${section.id}`),
      ) ?? result.outline![index];
    if (!outlineItem) return section;
    const estimatedWords = Math.min(
      2000,
      Math.max(10, outlineItem.estimatedWords || section.estimatedWords),
    );
    return {
      ...section,
      title: outlineItem.title.trim() || section.title,
      instructions: outlineItem.purpose.trim() || section.instructions,
      estimatedWords,
    };
  });

  return {
    ...result,
    sections,
    prompt: result.prompt,
  };
}

/** True when student writing matches the model essay (avoid PDF duplication). */
export function writtenEssayDuplicatesModel(
  result: EssayGenerationResult,
  writtenSections: Record<string, string> | null | undefined,
): boolean {
  const model = normalizeComparableText(result.modelEssay ?? "");
  if (!model || !writtenSections) return false;
  const written = normalizeComparableText(
    Object.values(writtenSections).join(" "),
  );
  if (!written) return false;
  return written === model || model.includes(written) || written.includes(model);
}
