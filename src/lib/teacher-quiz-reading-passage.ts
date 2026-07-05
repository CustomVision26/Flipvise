import { cleanReadingPassageFront } from "@/lib/source-import-reading-passage";

const SUBJECT_NATURE_BY_AREA: Record<string, string> = {
  mathematics: `The nature of Mathematics is step-by-step working, understanding formulas, rules, patterns, and concepts, then using them to solve problems and provide answers.`,
  english: `The nature of English Language is communication. Students learn to read, write, speak, listen, understand grammar, build vocabulary, interpret texts, and express ideas clearly.`,
  science: `The nature of Science is inquiry and investigation. Students observe, ask questions, test ideas, conduct experiments, understand facts/concepts, and explain how the natural world works.`,
  geography: `The nature of Geography is understanding places, people, environments, maps, landforms, climate, resources, and how humans interact with the Earth.`,
  it: `The nature of IT is using technology to create, store, process, share, and protect information. Students learn computer skills, software, hardware, internet use, digital safety, and problem-solving with technology.`,
  social_studies: `The nature of Social Studies is understanding people, communities, culture, history, government, rights, responsibilities, and how society works.`,
  religious_education: `The nature of Religious Education is learning about beliefs, values, morals, worship, respect, and how religion influences people's lives.`,
  physical_education: `The nature of PE is movement, health, fitness, teamwork, sports skills, discipline, and body awareness.`,
  general: `Match the passage and question style to how students learn and use this subject at the stated grade level.`,
};

export function detectQuizSubjectArea(subject: string, topic: string): keyof typeof SUBJECT_NATURE_BY_AREA {
  const text = `${subject} ${topic}`.toLowerCase();

  if (/math|algebra|geometry|calculus|arithmetic|fraction|equation|number|pep.*math/.test(text)) {
    return "mathematics";
  }
  if (
    /reading|comprehension|literature|language arts|\bela\b|english|writing|grammar|vocabulary|communication|pep/.test(
      text,
    )
  ) {
    return "english";
  }
  if (/science|biology|chemistry|physics|ecosystem|cell|energy|matter|experiment|lab/.test(text)) {
    return "science";
  }
  if (/geography|map|climate|landform|environment|resource/.test(text)) {
    return "geography";
  }
  if (/information technology|\bit\b|computer|software|hardware|digital|coding|programming/.test(text)) {
    return "it";
  }
  if (/history|social studies|civics|government|culture|community|jamaica|independence/.test(text)) {
    return "social_studies";
  }
  if (/religious|religion|bible|worship|moral|values|faith/.test(text)) {
    return "religious_education";
  }
  if (/\bpe\b|physical education|fitness|sport|movement|health/.test(text)) {
    return "physical_education";
  }

  return "general";
}

export function resolveSubjectNature(subject: string, topic: string): string {
  const area = detectQuizSubjectArea(subject, topic);
  return SUBJECT_NATURE_BY_AREA[area] ?? SUBJECT_NATURE_BY_AREA.general;
}

export function formatReadingPassageQuizFront(passage: string, question: string): string {
  return `Passage\n\n${passage.trim()}\n\nQuestion\n\n${question.trim()}`;
}

export function buildTeacherQuizReadingPassagePrompt(input: {
  subject: string;
  gradeLevel: string;
  topic: string;
  difficultyLevel: string;
  count: number;
  lessonPlanContext?: string | null;
}): { system: string; user: string } {
  const subjectNature = resolveSubjectNature(input.subject, input.topic);
  const isMath = detectQuizSubjectArea(input.subject, input.topic) === "mathematics";
  const isEnglish = detectQuizSubjectArea(input.subject, input.topic) === "english";
  const hasLessonPlan = Boolean(input.lessonPlanContext?.trim());

  const lessonPlanBlock = hasLessonPlan
    ? `

SAVED LESSON PLAN IS THE PRIMARY SOURCE:
- Write each passage as an original short story or reading paragraph (3–5 sentences) grounded in the lesson plan below
- ${
        isEnglish
          ? "For reading comprehension / language arts: use narrative or informational mini-stories with characters, settings, and events appropriate for the grade level — similar to a library visit, classroom reading, or everyday scenario"
          : "Use scenarios, examples, and vocabulary from the lesson plan teaching steps and classroom activity"
      }
- Weave lesson vocabulary words naturally into each passage
- Base each question on comprehension of THAT passage; adapt or extend the lesson plan assessment questions where they fit
- Never output placeholder text (e.g. "Sample passage") — every passage must be complete, classroom-ready reading material`
    : "";

  const system = `You are an expert K–12 assessment designer creating reading-passage quiz flashcards for teachers.

${subjectNature}
${lessonPlanBlock}

Generate exactly ${input.count} passage-based quiz cards.

Each card MUST follow this flashcard structure:

front (combine passage + question only — NO answer choices on the front):
Passage

[3–5 sentences of original, age-appropriate reading material for ${input.gradeLevel} ${input.subject} — topic: ${input.topic}]

Question

[One question answerable only from the passage]

correctAnswer (back of card):
${
  isMath
    ? `For Mathematics, provide a full step-by-step solution using this plain-text format (no markdown):
Step 1: [label]
[work]
Step 2: [label]
[work]
(continue as needed)
Answer: [final result with units if needed]`
    : `The complete correct answer text only — e.g. "Because it helps her learn new words and improve her imagination." Do not prefix with "Answer:" unless needed for clarity.`
}

wrongAnswers: exactly 3 plausible but incorrect answer texts (no letter prefixes, no emoji).

Rules:
- Difficulty: ${input.difficultyLevel}
- Ground content in the subject nature above${hasLessonPlan ? " and the saved lesson plan source material" : ""}
- Each passage must be different
- Never put A/B/C/D options on the front
- Never use markdown, emoji, or checkmarks
- wrongAnswers must be clearly wrong after reading the passage
- For non-math subjects, wrongAnswers should be similar length and tone to the correct answer`;

  const user = hasLessonPlan
    ? `Subject: ${input.subject}
Grade level: ${input.gradeLevel}
Topic: ${input.topic}
Difficulty: ${input.difficultyLevel}

Generate exactly ${input.count} passage-based quiz cards using the saved lesson plan below as your primary reference. Write original short passages and comprehension questions — do not copy placeholder text.

Saved lesson plan:
${input.lessonPlanContext!.trim()}`
    : `Subject: ${input.subject}
Grade level: ${input.gradeLevel}
Topic: ${input.topic}
Difficulty: ${input.difficultyLevel}

Generate exactly ${input.count} passage-based quiz cards for this class.`;

  return { system, user };
}

export function normalizePassageQuizFront(front: string): string {
  return cleanReadingPassageFront(front);
}
