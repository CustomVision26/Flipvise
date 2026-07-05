import "server-only";

import type { LessonPlanActionInput } from "@/lib/lesson-plan-ai-schema";

export type CurriculumResearchContext = {
  summary: string;
  sources: { url: string; title: string }[];
};

function buildCurriculumResearchPrompt(input: {
  learningStandard: string;
  subject: string;
  gradeLevel: string;
  topic: string;
}): string {
  return `Search the web for the latest official curriculum and syllabus documents for the following learning standard, then extract requirements relevant to this lesson.

Learning standard / framework: ${input.learningStandard}
Subject: ${input.subject}
Grade level: ${input.gradeLevel}
Topic: ${input.topic}

Return a concise research brief (400–800 words max) covering:
1. Official curriculum or syllabus name, publisher/agency, and version or effective year if available
2. Specific learning outcomes, competencies, or standard codes that apply to this grade, subject, and topic
3. Scope and sequence expectations (what students should know before and after this topic)
4. Required skills, assessment expectations, and vocabulary mandated by the standard
5. Any regional syllabus notes relevant to ${input.learningStandard}

Prefer official government, ministry of education, or standards-body sources. If the standard name is an acronym (e.g. GSAT, NGSS, CCSS, Jamaica NSC), identify it correctly and use authoritative sources.

Do not invent standard codes — only cite what you find. If official documents are unavailable, state that clearly and summarize the best available authoritative guidance.`;
}

function extractSources(data: Record<string, unknown>): { url: string; title: string }[] {
  const seen = new Set<string>();
  const sources: { url: string; title: string }[] = [];

  function addSource(url: unknown, title: unknown) {
    if (typeof url !== "string" || !url.trim()) return;
    const normalized = url.trim();
    if (seen.has(normalized)) return;
    seen.add(normalized);
    sources.push({
      url: normalized,
      title: typeof title === "string" && title.trim() ? title.trim() : normalized,
    });
  }

  const output = data.output;
  if (!Array.isArray(output)) return sources;

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const message = item as {
      type?: string;
      content?: { type?: string; annotations?: unknown[]; text?: string }[];
    };
    if (message.type !== "message" || !Array.isArray(message.content)) continue;

    for (const content of message.content) {
      if (!content || content.type !== "output_text") continue;
      for (const annotation of content.annotations ?? []) {
        if (!annotation || typeof annotation !== "object") continue;
        const citation = annotation as { type?: string; url?: string; title?: string };
        if (citation.type === "url_citation") {
          addSource(citation.url, citation.title);
        }
      }
    }
  }

  return sources;
}

function extractOutputText(data: Record<string, unknown>): string | null {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const output = data.output;
  if (!Array.isArray(output)) return null;

  const texts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const message = item as {
      type?: string;
      role?: string;
      content?: { type?: string; text?: string }[];
    };
    if (message.type !== "message" || message.role !== "assistant") continue;

    for (const content of message.content ?? []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        texts.push(content.text.trim());
      }
    }
  }

  return texts.length > 0 ? texts.join("\n\n") : null;
}

/** Web search for official curriculum / syllabus context when a learning standard is provided. */
export async function fetchCurriculumContextForLessonPlan(
  input: Pick<
    LessonPlanActionInput,
    "learningStandard" | "subject" | "gradeLevel" | "topic"
  >,
): Promise<CurriculumResearchContext | null> {
  const learningStandard = input.learningStandard?.trim();
  if (!learningStandard) return null;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        tools: [{ type: "web_search", search_context_size: "medium" }],
        tool_choice: "required",
        input: buildCurriculumResearchPrompt({
          learningStandard,
          subject: input.subject.trim(),
          gradeLevel: input.gradeLevel.trim(),
          topic: input.topic.trim(),
        }),
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      if (process.env.NODE_ENV !== "production") {
        const body = await response.text().catch(() => "");
        console.warn(
          "[fetchCurriculumContextForLessonPlan] OpenAI Responses API error",
          response.status,
          body.slice(0, 300),
        );
      }
      return null;
    }

    const data = (await response.json()) as Record<string, unknown>;
    const summary = extractOutputText(data);
    if (!summary) return null;

    return {
      summary,
      sources: extractSources(data),
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[fetchCurriculumContextForLessonPlan] Curriculum research skipped.",
        error,
      );
    }
    return null;
  }
}

export function formatCurriculumContextForPrompt(
  context: CurriculumResearchContext,
): string {
  const sourceLines =
    context.sources.length > 0
      ? `\n\nReference sources consulted:\n${context.sources
          .map((source) => `- ${source.title}: ${source.url}`)
          .join("\n")}`
      : "";

  return `Official curriculum / syllabus research (use to align objectives, vocabulary, assessment, and pacing):\n\n${context.summary}${sourceLines}`;
}
