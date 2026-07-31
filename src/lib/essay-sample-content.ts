import type { EssayGenerateInput, EssaySection } from "@/lib/essay-ai-schema";
import { essayTypeLabel, formatEssayStanceForPrompt } from "@/lib/essay-ai-schema";
import {
  FALLBACK_CITE_SOURCES,
  formatFallbackInTextCitation,
  replacePlaceholderInTextCitations,
} from "@/lib/essay-fallback-citations";
import { ESSAY_TYPE_META } from "@/lib/essay-types";

const PLACEHOLDER_SAMPLE_RE =
  /\(Sample content for\b|Sample content for .{0,120} on "/i;

/** Meta coaching lines that must not appear inside sample essay prose. */
const EMBEDDED_GUIDANCE_RE =
  /Using transitions such as[\s\S]*?(?:section goal|planningGoal)[^.]*\.?/gi;

/**
 * True when prose is missing or is the old fallback placeholder.
 */
export function isPlaceholderEssayProse(
  text: string | null | undefined,
): boolean {
  const t = (text ?? "").trim();
  if (!t) return true;
  if (PLACEHOLDER_SAMPLE_RE.test(t)) return true;
  if (/^##\s+.+\n+\(Sample content/im.test(t)) return true;
  return false;
}

/** Strip coaching / construction asides that were wrongly baked into essay body. */
export function stripEmbeddedEssayGuidance(text: string): string {
  return text
    .replace(EMBEDDED_GUIDANCE_RE, "")
    .replace(
      /\bThis (?:evidence|reasoning|point) (?:strengthens|advances|connects)[\s\S]*?(?:controlling idea|central claim|practical classroom payoff)\./gi,
      "",
    )
    .replace(
      /\bThis essay presents reasons and examples in a [^.]+\./gi,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

export function buildFallbackThesis(input: EssayGenerateInput): string {
  const typeLabel = essayTypeLabel(input.essayType).toLowerCase();
  const topic = input.topic.trim() || "this topic";

  if (
    input.essayType === "persuasive" ||
    input.essayType === "argumentative" ||
    input.essayType === "opinion"
  ) {
    if (input.essayStance === "side_2") {
      return `Although some people favor sweeping change on ${topic}, the stronger position is to resist the weakest options and keep only what clearly helps learners.`;
    }
    return `Schools should take a clear stand on ${topic}: keep practices that improve learning and access, and leave behind what does not serve students well.`;
  }

  if (input.essayType === "narrative") {
    return `A focused story about ${topic} can show what the experience taught and why that lesson still matters.`;
  }

  return `A careful ${typeLabel} on ${topic} should present a clear controlling idea and support it with organized evidence.`;
}

function cite(input: EssayGenerateInput, authorIndex: number): string {
  if (input.citationStyle === "none") return "";
  const source =
    FALLBACK_CITE_SOURCES[
      Math.max(0, Math.min(FALLBACK_CITE_SOURCES.length - 1, authorIndex - 1))
    ]!;
  return formatFallbackInTextCitation(input.citationStyle, source);
}

function approxWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function padToTarget(paragraph: string, target: number): string {
  if (target <= 0 || approxWords(paragraph) >= target * 0.75) {
    return paragraph;
  }
  const extras = [
    " Clear examples help readers see why the idea matters in everyday situations.",
    " When adults explain trade-offs honestly, students can practice better decisions.",
    " Prioritizing what works saves time and builds trust in the classroom.",
  ];
  let out = paragraph;
  let i = 0;
  while (approxWords(out) < target * 0.85 && i < extras.length * 3) {
    out = `${out}${extras[i % extras.length]}`;
    i += 1;
  }
  return out;
}

function supportingAngle(
  topic: string,
  index: number,
  title: string,
): { claim: string; evidence: string; close: string } {
  const angles = [
    {
      claim: `One important reason related to ${topic} is that clear expectations prevent repeated mistakes.`,
      evidence:
        "When schools define what to keep and what to drop, students and teachers can focus on routines that actually improve learning.",
      close:
        "Those practical gains make a stronger case than vague promises of change.",
    },
    {
      claim: `Furthermore, a thoughtful approach to ${topic} supports equity: every learner deserves access to what works, not only those with extra resources at home.`,
      evidence:
        "Shared standards and well-designed options reduce gaps that appear when families must invent solutions alone.",
      close:
        "Fair access therefore belongs at the center of the argument.",
    },
    {
      claim: `In addition, debating ${topic} builds critical thinking: students weigh trade-offs, test claims, and judge which practices deserve to stay.`,
      evidence:
        "Classroom discussion of realistic scenarios trains judgment more effectively than slogans or one-time announcements.",
      close:
        "That habit of careful evaluation prepares graduates for complex decisions ahead.",
    },
    {
      claim: `However, even thoughtful critics of ${topic} often agree that guided practice reduces harm when goals stay clear.`,
      evidence:
        "Short case studies, reflection prompts, and timely feedback turn abstract advice into usable skills.",
      close:
        "Honest limits do not erase the case for keeping what has already proven useful.",
    },
  ];

  const base = angles[index % angles.length]!;
  if (/against|oppose|disadvantage|counter/i.test(title)) {
    return {
      claim: `A careful look at ${topic} also requires acknowledging serious concerns and trade-offs.`,
      evidence:
        "Crowded schedules, uneven preparation, and shallow coverage can weaken any plan if schools do not design it well.",
      close:
        "Naming those limits honestly builds credibility while still steering toward a reasoned position.",
    };
  }
  return base;
}

/**
 * Student-facing construction tip — separate from sample essay prose.
 */
export function buildSampleSectionGuidance(
  input: EssayGenerateInput,
  section: EssaySection,
  index: number,
  total: number,
): string {
  const stance = formatEssayStanceForPrompt(
    input.essayType,
    input.essayStance,
  );
  const type = (section.type ?? "").toLowerCase();
  const title = section.title.toLowerCase();
  const goal =
    section.planningGoal?.trim() || `Complete the ${section.title} section.`;
  const transitions = (section.transitionWords ?? [])
    .slice(0, 4)
    .join(", ");

  if (type === "introduction" || title.includes("intro") || index === 0) {
    return [
      "Construction tip — Introduction:",
      "Open with brief context on the topic, state a clear thesis, and preview the reasons you will develop.",
      `Write in a ${input.tone} ${essayTypeLabel(input.essayType).toLowerCase()} voice for ${input.gradeLevel}.`,
      stance ? `Honor stance/focus: ${stance}.` : null,
      `Goal: ${goal}`,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (
    type === "conclusion" ||
    title.includes("conclu") ||
    index === total - 1
  ) {
    return [
      "Construction tip — Conclusion:",
      "Restate the thesis in fresh words, synthesize the strongest reasons, and end with a memorable judgment or call to action.",
      "Avoid adding brand-new evidence here.",
      `Goal: ${goal}`,
    ].join(" ");
  }

  if (type === "counterargument" || title.includes("counter")) {
    return [
      "Construction tip — Counterargument:",
      "Present a fair opposing view, then refute or limit it with reasoning and evidence that returns to your thesis.",
      transitions ? `Useful transitions: ${transitions}.` : null,
      `Goal: ${goal}`,
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    `Construction tip — ${section.title}:`,
    "Lead with a claim, support it with concrete evidence or examples, then link the point back to the thesis.",
    transitions
      ? `Useful transitions: ${transitions}.`
      : "Useful transitions: Furthermore, However, In addition, Therefore.",
    `Goal: ${goal}`,
  ].join(" ");
}

/**
 * Build real sample prose for one section (essay body only — no coaching asides).
 */
export function buildSampleSectionProse(
  input: EssayGenerateInput,
  section: EssaySection,
  index: number,
  total: number,
  thesis: string,
): string {
  const topic = input.topic.trim() || "the assigned topic";
  const target = Math.max(60, section.estimatedWords || 80);
  const c1 = cite(input, 1);
  const c2 = cite(input, 2);
  const type = (section.type ?? "").toLowerCase();
  const title = section.title.toLowerCase();

  let prose: string;

  if (type === "introduction" || title.includes("intro") || index === 0) {
    prose = [
      `Debates about ${topic} matter because the choices schools make shape daily learning and long-term opportunity.`,
      `Students and teachers need clarity about which practices help, which distract, and which deserve to stay.`,
      thesis,
      `The sections that follow present reasons and examples that support this position${c1}.`,
    ].join(" ");
  } else if (
    type === "conclusion" ||
    title.includes("conclu") ||
    index === total - 1
  ) {
    prose = [
      `In conclusion, the strongest response to ${topic} is a clear, evidence-based stance that schools can actually use.`,
      `Earlier points showed why keeping what works—and dropping what does not—serves learners better than all-or-nothing thinking.`,
      `Schools that treat this issue seriously give students both structure and flexibility${c1}${c2 ? `, and the combined evidence supports lasting classroom value${c2}` : ""}.`,
      `Readers should leave persuaded that thoughtful action on this topic is both practical and fair.`,
    ].join(" ");
  } else if (type === "counterargument" || title.includes("counter")) {
    prose = [
      `Some readers argue that schools already face too many demands, so further change around ${topic} would only add confusion.`,
      `That concern deserves attention: poorly designed mandates waste time and frustrate teachers.`,
      `However, the better answer is not silence—it is a lean plan with clear goals, realistic practice, and honest review of results${c2}.`,
      `Keeping what works while revising what fails protects students without ignoring legitimate worries.`,
    ].join(" ");
  } else if (
    type === "narrative" ||
    /beginning|conflict|climax|resolution|rising/.test(title)
  ) {
    prose = [
      `In this part of the story connected to ${topic}, the narrator faces a concrete moment that forces a choice.`,
      `Details of setting, dialogue, and emotion keep the scene vivid without drifting from the lesson.`,
      `What happens next reveals why the experience matters and how it changed the narrator’s understanding.`,
    ].join(" ");
  } else {
    const angle = supportingAngle(topic, Math.max(0, index - 1), section.title);
    prose = [angle.claim, angle.evidence + c1, angle.close].join(" ");
  }

  return padToTarget(prose, target);
}

export function enrichSectionsWithSampleContent(
  input: EssayGenerateInput,
  sections: EssaySection[],
  thesis: string,
): EssaySection[] {
  return sections.map((section, index) => {
    const guidance =
      section.teacherNotes?.trim() ||
      buildSampleSectionGuidance(input, section, index, sections.length);

    if (!isPlaceholderEssayProse(section.generatedContent)) {
      const cleaned = replacePlaceholderInTextCitations(
        stripEmbeddedEssayGuidance(section.generatedContent ?? ""),
        input.citationStyle,
      );
      return {
        ...section,
        generatedContent: cleaned || section.generatedContent,
        teacherNotes: guidance,
      };
    }

    return {
      ...section,
      generatedContent: buildSampleSectionProse(
        input,
        section,
        index,
        sections.length,
        thesis,
      ),
      teacherNotes: guidance,
    };
  });
}

/** Join section samples into a single model essay (plain prose, no ## headings). */
export function buildModelEssayFromSections(sections: EssaySection[]): string {
  return sections
    .map((s) => (s.generatedContent ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
}

export function ensureModelEssaySample(
  input: EssayGenerateInput,
  sections: EssaySection[],
  thesis: string,
  existingModelEssay: string | null | undefined,
): { sections: EssaySection[]; modelEssay: string | null } {
  if (!input.includeModelEssay) {
    return { sections, modelEssay: null };
  }

  const filled = enrichSectionsWithSampleContent(input, sections, thesis);
  let modelEssay = replacePlaceholderInTextCitations(
    stripEmbeddedEssayGuidance((existingModelEssay ?? "").trim()),
    input.citationStyle,
  );

  if (isPlaceholderEssayProse(modelEssay)) {
    modelEssay = buildModelEssayFromSections(filled);
  }

  if (
    isPlaceholderEssayProse(modelEssay) ||
    filled.some((s) => isPlaceholderEssayProse(s.generatedContent))
  ) {
    const again = enrichSectionsWithSampleContent(input, filled, thesis);
    return {
      sections: again,
      modelEssay: buildModelEssayFromSections(again),
    };
  }

  // Prefer section prose for the joined model essay so coaching never leaks in.
  const fromSections = buildModelEssayFromSections(filled);
  return {
    sections: filled,
    modelEssay: fromSections || modelEssay,
  };
}

/** Prefer human section titles over raw stance dropdown labels. */
export function supportingSectionTitlePrefix(
  input: EssayGenerateInput,
  side: "side_1" | "side_2" | "both_1" | "both_2",
): string {
  const meta = ESSAY_TYPE_META[input.essayType];
  if (input.essayType === "cause_and_effect") {
    return side === "side_2" || side === "both_2" ? "Effect" : "Cause";
  }
  if (input.essayType === "for_and_against") {
    return side === "side_2" || side === "both_2"
      ? "Argument Against"
      : "Argument For";
  }
  if (
    input.essayType === "persuasive" ||
    input.essayType === "argumentative" ||
    input.essayType === "opinion"
  ) {
    if (side === "both_1") return "Argument For";
    if (side === "both_2") return "Argument Against";
    return "Supporting Argument";
  }
  if (side === "both_1") return meta.side1Label ?? "Supporting Point";
  if (side === "both_2") return meta.side2Label ?? "Supporting Point";
  if (side === "side_2") return "Supporting Argument";
  return "Supporting Argument";
}
