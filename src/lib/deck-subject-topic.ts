import { stripLessonPlanScopedDeckSuffix } from "@/lib/teacher-generation-titles";

/** Subject — Topic in the deck name. Colons stay inside the subject (e.g. Science : Environmental Science). */
const NAME_SUBJECT_TOPIC_SPLIT = /\s+[—–-]\s+/;
const DESCRIPTION_SEGMENT_SPLIT = /\s*[·•]\s*/;

function isTeacherToolMetadataSegment(segment: string): boolean {
  return (
    /^teacher quiz deck$/i.test(segment) ||
    /^teacher lesson plan deck$/i.test(segment) ||
    /^lesson plan #\d+/i.test(segment) ||
    /^lesson scope:/i.test(segment) ||
    /^grade\s+/i.test(segment) ||
    /\bdifficulty$/i.test(segment)
  );
}

function isTeacherToolDeckDescription(description: string): boolean {
  return (
    /teacher quiz deck/i.test(description) ||
    /teacher lesson plan deck/i.test(description)
  );
}

function parseStructuredTeacherDeckDescription(
  description: string | null | undefined,
): { subject: string; topic: string } | null {
  const raw = description?.trim();
  if (!raw || !isTeacherToolDeckDescription(raw)) return null;

  const segments = raw
    .split(DESCRIPTION_SEGMENT_SPLIT)
    .map((part) => part.trim())
    .filter(Boolean);
  const content = segments.filter((segment) => !isTeacherToolMetadataSegment(segment));
  if (content.length >= 2) {
    return { topic: content[0] ?? "", subject: content[1] ?? "" };
  }
  if (content.length === 1) {
    return { topic: content[0] ?? "", subject: "" };
  }
  return null;
}

function gradeFromDescriptionSegment(segment: string): string | null {
  const match = segment.match(/^grade\s+(.+)$/i);
  if (!match) return null;
  const rest = match[1]?.trim() ?? "";
  if (!rest) return null;
  // Stored values already include "grade" (for example "grade 7"), and the
  // description prefixes another "Grade ". Keep a bare "Grade 7" intact.
  if (/^grade\b/i.test(rest)) return rest;
  return segment.trim();
}

function difficultyFromDescriptionSegment(segment: string): string | null {
  const match = segment.match(/^(.+?)\s+difficulty$/i);
  const value = match?.[1]?.trim() ?? "";
  return value || null;
}

/** Grade and difficulty written into teacher quiz and lesson-plan deck descriptions. */
export function parseTeacherDeckGradeAndDifficulty(
  description: string | null | undefined,
): { gradeLevel: string; difficultyLevel: string } {
  const raw = description?.trim();
  if (!raw || !isTeacherToolDeckDescription(raw)) {
    return { gradeLevel: "", difficultyLevel: "" };
  }

  let gradeLevel = "";
  let difficultyLevel = "";
  for (const segment of raw.split(DESCRIPTION_SEGMENT_SPLIT)) {
    const part = segment.trim();
    if (!part) continue;
    if (!gradeLevel) gradeLevel = gradeFromDescriptionSegment(part) ?? "";
    if (!difficultyLevel) {
      difficultyLevel = difficultyFromDescriptionSegment(part) ?? "";
    }
  }
  return { gradeLevel, difficultyLevel };
}

function parseSubjectTopicFromName(name: string): { subject: string; topic: string } {
  const stripped = stripLessonPlanScopedDeckSuffix(name.trim());
  if (!stripped) {
    return { subject: "", topic: "" };
  }

  const dashParts = stripped
    .split(NAME_SUBJECT_TOPIC_SPLIT)
    .map((part) => part.trim())
    .filter(Boolean);
  if (dashParts.length >= 2) {
    return {
      subject: dashParts[0] ?? "",
      topic: dashParts.slice(1).join(" — "),
    };
  }

  return { subject: stripped, topic: "" };
}

export function parseDeckSubjectTopic(deck: {
  name: string;
  description?: string | null;
}): { subject: string; topic: string } {
  const fromDescription = parseStructuredTeacherDeckDescription(deck.description);
  const fromName = parseSubjectTopicFromName(deck.name);

  if (fromDescription) {
    return {
      subject: fromDescription.subject || fromName.subject,
      topic: fromDescription.topic || fromName.topic,
    };
  }

  const topicFromDescription = deck.description?.trim() ?? "";
  return {
    subject: fromName.subject,
    topic: topicFromDescription || fromName.topic,
  };
}

/** Deck name → subject; Description/Topic → topic, unless the description is quiz/lesson-plan metadata. */
export function resolveDeckSubjectAndTopic(deck: {
  name: string;
  description?: string | null;
}): { subject: string; topic: string } {
  return parseDeckSubjectTopic(deck);
}
