import { cleanReadingPassageFront } from "@/lib/source-import-reading-passage";
import { STUDY_MODE_STEP_ANSWER_PROMPT } from "@/lib/parse-step-answer";

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

/**
 * Formats a reading-passage quiz card front.
 * Math and English/literature titled passages use: Passage Title → body → Question.
 * Other subjects keep: Passage → body → Question.
 */
export function formatReadingPassageQuizFront(
  passage: string,
  question: string,
  passageTitle?: string | null,
): string {
  const trimmed = passage.trim();
  const embedded = trimmed.match(
    /^Passage Title:\s*(.+?)(?:\r?\n+|$)([\s\S]*)$/i,
  );
  const embeddedTitle = embedded?.[1]?.trim() || null;
  const body = (embedded ? (embedded[2] ?? "") : trimmed).trim();
  const resolvedTitle = passageTitle?.trim() || embeddedTitle;

  if (resolvedTitle) {
    return `Passage Title: ${resolvedTitle}\n\n${body}\n\nQuestion\n\n${question.trim()}`;
  }

  return `Passage\n\n${body}\n\nQuestion\n\n${question.trim()}`;
}

const QUESTION_TYPE_GUIDANCE = `Prefer a mix of comprehension question types adapted to the subject/topic (like Jamaica PEP Language Arts), for example:
- Main Idea
- Detail / Recall
- Vocabulary in Context (meaning of a lesson term as used in the passage — never ask students to recite a glossary definition that was pasted into the passage)
- Inference
- Author's Purpose / Why the writer included an example
- Evidence (which detail from the passage supports …)
Do not force every type if count is small; choose the best types for the passage. Label each question's questionType with a short name.`;

const MATH_QUESTION_TYPE_GUIDANCE = `Prefer a mix of math vocabulary / algebra question types linked to the SAME story passage, for example:
- Variable Meaning (What does the variable j / w / t represent?)
- Expression (Which expression represents the total…?)
- Equation (Which equation represents the situation?)
- Evaluate / Compute (How much money…? / How many…? / What is the value of…?)
- Identify Constant / Coefficient / Like Terms / Distributive Property / Inequality / Order of Operations
Do not force every type if the question count is small; choose the best types for that passage. Label each question's questionType with a short name.`;

const ENGLISH_QUESTION_TYPE_GUIDANCE = `Prefer a mix of Jamaica PEP Language Arts skills linked to the SAME short story, for example:
- Main Idea (What is the main idea of the passage?)
- Detail / Recall (Why did the character…? / What happened when…?)
- Vocabulary in Context (What does the word "…" mean as it is used in the passage? — use a lesson vocabulary word OR a rich story word; never paste a glossary definition into the story)
- Character Trait (Which character trait best describes …?)
- Theme / Moral (What lesson does the story teach?)
- Textual Evidence (Which sentence from the passage best supports …?)
- Inference (What can the reader infer…?)
Do not force every type if the question count is small; choose the best types for that passage. Label each question's questionType with a short name.`;

function formatPassageCountPlan(questionCounts: number[]): string {
  return questionCounts
    .map(
      (count, index) =>
        `Passage ${index + 1}: exactly ${count} comprehension question${count === 1 ? "" : "s"}`,
    )
    .join("; ");
}

/** Jamaica PEP–style literature / Language Arts short story. */
function buildEnglishPassagePromptSection(input: {
  gradeLevel: string;
  countPlan: string;
  passageTotal: number;
  questionTotal: number;
}): string {
  return `ENGLISH LANGUAGE / LITERATURE READING-PASSAGE STYLE (required — Jamaica PEP Language Arts):
Write a short story with realistic characters, a clear setting, and a clear message — the same style as:

Example title: "The Mango Tree"
Example passage body:
Every afternoon after school, twelve-year-old Asha hurried to the large mango tree behind her grandmother's house. It was her favourite place to read and think. One afternoon, she noticed a small bird struggling with a piece of string tangled around its leg.

Although Asha was afraid the bird might fly away, she slowly moved closer and gently freed it. The bird chirped softly before flying into the branches above. As she watched it disappear into the leaves, Asha smiled, knowing that even a small act of kindness could make a big difference.

When her grandmother heard the story, she said, "Kindness is never wasted. It always finds its way back to the person who gives it."

Example linked questions on that SAME story:
- Main Idea → A small act of kindness can make a difference.
- Detail → She did not want to frighten the bird away.
- Vocabulary in Context ("struggling") → Having difficulty getting free
- Character Trait → Kind
- Theme / Moral → Kindness often has a positive effect on others and ourselves.
- Textual Evidence → "She slowly moved closer and gently freed it."

Skills this style assesses (cover a mix across the questions for each passage):
- Reading for the main idea
- Identifying supporting details
- Understanding vocabulary in context
- Making inferences
- Identifying character traits
- Determining the theme or moral
- Finding textual evidence

Passage rules for English / Literature:
- EVERY passage object MUST include a short story title in "title" (2–6 words), e.g. "The Mango Tree", "The Bus Stop", "River Saturday"
- passage body: a complete mini short story (about 3 short paragraphs / 8–14 sentences) with realistic characters, a clear problem or moment, and a clear message — suitable for Jamaica PEP examination style
- Prefer Caribbean-friendly, age-appropriate settings and names when natural for the grade (do not force tourist clichés)
- Weave lesson vocabulary TERMS naturally into dialogue and narration so students learn them from context — do NOT paste definitions, glossary lines, or "Word: meaning" patterns
- When a saved lesson plan / Day scope is provided, ground the story's theme and word choice in THAT day's vocabulary and focus
- Do NOT narrate a classroom lesson, warm-up, or partners discussing a worksheet
- When generating multiple passages, give each a distinct title, characters, and plot while staying on the lesson vocabulary/theme

Question rules for English / Literature:
- Every question MUST be answerable from its own passage alone
- ${ENGLISH_QUESTION_TYPE_GUIDANCE}
- Never put A/B/C/D options, markdown, emoji, or checkmarks on the question text
- Never number questions as "Question 1" inside the question field — the app labels Question separately
- For Vocabulary in Context, quote or clearly name the target word and ask for its meaning in the passage
- For Textual Evidence, correctAnswer should be a short quote or clearly recognizable sentence from the passage (no letter prefix)

Answer rules for English / Literature:
- correctAnswer: concise choice text only (no "A." / "B." prefixes)
- wrongAnswers: exactly 3 plausible but incorrect choice texts, similar length/tone, no letter prefixes
- explanation: brief educational rationale tied to the story

Generate exactly ${input.passageTotal} distinct titled short stor${input.passageTotal === 1 ? "y" : "ies"} and exactly ${input.questionTotal} questions total, distributed as: ${input.countPlan}.
Grade level: ${input.gradeLevel}.`;
}

/** Math story-passage style (Variables & Expressions, Solving Equations, etc.). */
function buildMathPassagePromptSection(input: {
  gradeLevel: string;
  countPlan: string;
  passageTotal: number;
  questionTotal: number;
}): string {
  return `MATHEMATICS READING-PASSAGE STYLE (required):
Write grade-appropriate story scenarios that teach algebra / pre-algebra vocabulary through use — the same style as:

Example — Vocabulary focus "Variables and Expressions":
title: "Selling Fruit Juice"
passage body:
A Grade 6 class is selling fruit juice to raise money for a school event. Each bottle of juice costs $5. The class already has $20 from donations. The teacher uses the variable j to represent the number of juice bottles sold.
Linked questions on that SAME passage:
- What does the variable j represent? → correct: The number of juice bottles sold
- Which expression represents the total money collected? → correct: 20 + 5j
- How much money will the class collect after selling 8 bottles? → correct: $60 (with step-by-step workout on correctAnswer when computational)

Example — Vocabulary focus "Solving Equations":
title: "Buying Movie Tickets"
passage body:
A family spends $12 on each movie ticket. They also pay a $6 booking fee. The total amount paid was $54, where t represents the number of movie tickets purchased.
Linked questions:
- What does the variable t represent?
- Which equation represents the situation? → 12t + 6 = 54
- How many tickets were purchased? → 4

Other concept targets to model when the topic fits (one titled story per concept, or several questions on one story):
- Variables — what the letter stands for in the story
- Constants — which number is the constant in an expression like 3m + 5
- Coefficients — coefficient of a variable (e.g. 8 in 8t)
- Algebraic Expressions — which expression matches the story (e.g. 4c + 15)
- Evaluating Expressions — substitute a given value and compute
- Solving Equations — find the unknown
- One-Step Inequalities — which value satisfies s ≥ 80 (or similar)
- Order of Operations — evaluate 4 + 3 × 6 style expressions from the story
- Like Terms — simplify 4x + 2x from the story
- Distributive Property — simplify 3(x + 4) from the story

Passage rules for Mathematics:
- EVERY passage object MUST include a short story title in "title" (2–6 words), e.g. "Selling Fruit Juice", "Buying Movie Tickets", "Emma's Tablet Savings"
- passage body: 3–6 clear sentences of readable prose with numbers, a named variable, and (when useful) an expression or equation written in plain text
- Do NOT include interactive widget text, axis tick lists, slider labels, graph coordinates dumps, or calculator UI noise
- Do NOT paste glossary definitions; show the math idea inside the story
- When generating multiple passages, give each a distinct title and scenario while staying on the topic vocabulary

Question rules for Mathematics:
- Every question MUST be answerable from its own passage alone
- ${MATH_QUESTION_TYPE_GUIDANCE}
- Never put A/B/C/D options, markdown, emoji, or checkmarks on the question text
- Never number questions as "Question 1" inside the question field — the app labels Question separately

Answer rules for Mathematics:
- Vocabulary / identify / which-expression / which-equation questions: keep correctAnswer concise (the choice text only, no letter prefix)
- Computational / evaluate / solve questions: put the full worked solution in correctAnswer using this study-mode format:
${STUDY_MODE_STEP_ANSWER_PROMPT}
- wrongAnswers: exactly 3 short plausible final-answer values (NOT full step workouts), no letter prefixes
- explanation: brief educational rationale

Generate exactly ${input.passageTotal} distinct titled story passage${input.passageTotal === 1 ? "" : "s"} and exactly ${input.questionTotal} questions total, distributed as: ${input.countPlan}.
Grade level: ${input.gradeLevel}.`;
}

export function buildTeacherQuizReadingPassagePrompt(input: {
  subject: string;
  gradeLevel: string;
  topic: string;
  difficultyLevel: string;
  /** Per-passage question counts for passages that will be generated (each ≥ 1). */
  questionCounts: number[];
  lessonPlanContext?: string | null;
}): { system: string; user: string } {
  const subjectNature = resolveSubjectNature(input.subject, input.topic);
  const isMath = detectQuizSubjectArea(input.subject, input.topic) === "mathematics";
  const isEnglish = detectQuizSubjectArea(input.subject, input.topic) === "english";
  const hasLessonPlan = Boolean(input.lessonPlanContext?.trim());
  const passageTotal = input.questionCounts.length;
  const questionTotal = input.questionCounts.reduce((sum, count) => sum + count, 0);
  const countPlan = formatPassageCountPlan(input.questionCounts);

  const lessonPlanBlock = hasLessonPlan
    ? `

SAVED LESSON PLAN — VOCABULARY SOURCE ONLY:
- Write ${passageTotal === 1 ? "ONE coherent reading passage" : `exactly ${passageTotal} distinct reading passages`} that TEACH the lesson vocabulary for the selected day/lesson scope
- Primary focus: the TOPIC OF THE VOCABULARY (the terms and how their meanings work in use) — not a summary of lesson-plan notes, warm-ups, timelines, homework, or classroom activities
- Use the lesson plan only to identify target TERMS, daily focus/concepts, and grade-appropriate content — ignore activity scripts (“partners discuss”, “group wrote a takeaway”, “comparing notes”, “the teacher asked…”)
- Weave vocabulary TERMS naturally so students learn them from context
- ${
      isMath
        ? "For Mathematics: use titled real-world story problems (Passage Title + scenario with a variable/expression) — never narrate what students did during the lesson"
        : isEnglish
          ? "For English / Literature / Language Arts: use a Jamaica PEP–style titled short story (realistic characters, clear message) that naturally uses THAT day's vocabulary — never narrate a class period"
          : "Prefer real-world or content-domain scenarios that put the vocabulary to work — never narrate what students did during the lesson"
    }
- NEVER dump glossary entries, pasted definitions, term–definition lists, or “Word: meaning” lines into any passage
- Create questions that match this plan exactly: ${countPlan}
- Each question must be answerable only from ITS OWN passage (not from another passage)
- Adapt lesson assessment ideas only when they connect to what that passage actually illustrates about the vocabulary/topic
- Never output placeholder text (e.g. "Sample passage") — every passage must be complete, classroom-ready reading material`
    : "";

  if (isMath) {
    const system = `You are an expert K–12 math assessment designer creating reading-passage quiz flashcards for teachers.

${subjectNature}
${lessonPlanBlock}

${buildMathPassagePromptSection({
  gradeLevel: input.gradeLevel,
  countPlan,
  passageTotal,
  questionTotal,
})}

Output shape:
- passages: array of exactly ${passageTotal} objects
- Each object has:
  - title: required short story title (plain text)
  - passage: story body only (do NOT repeat "Passage Title:" inside the passage string)
  - questions: array with EXACTLY the count listed for that passage index (${countPlan})
- Each question item includes questionType, question, correctAnswer, wrongAnswers (exactly 3), and explanation
- Do NOT emit empty passages or passages with zero questions
- Difficulty: ${input.difficultyLevel}
- Ground content in the mathematics subject nature above${hasLessonPlan ? " and the lesson vocabulary/concepts from the saved lesson plan (not the activity notes)" : ""}`;

    const user = hasLessonPlan
      ? `Subject: ${input.subject}
Grade level: ${input.gradeLevel}
Topic: ${input.topic}
Difficulty: ${input.difficultyLevel}

Generate exactly ${passageTotal} titled math story passage${passageTotal === 1 ? "" : "s"} with this question plan: ${countPlan}.
Use the saved lesson plan below only to learn the vocabulary terms and conceptual focus (variables, expressions, equations, etc.).
Write story passages like "Selling Fruit Juice" / "Buying Movie Tickets" that teach those terms in context — never paste definitions, never open by restating Subject/Grade/Topic, and never include graph/widget UI text.

Saved lesson plan:
${input.lessonPlanContext!.trim()}`
      : `Subject: ${input.subject}
Grade level: ${input.gradeLevel}
Topic: ${input.topic}
Difficulty: ${input.difficultyLevel}

Generate exactly ${passageTotal} titled math story passage${passageTotal === 1 ? "" : "s"} with this question plan: ${countPlan}.
Use the Variables and Expressions / Solving Equations story style (Passage Title + real-world scenario + linked MC questions).
Do not open by restating Subject/Grade/Topic, and do not include interactive graph or calculator widget text.`;

    return { system, user };
  }

  if (isEnglish) {
    const system = `You are an expert K–12 Language Arts assessment designer creating Jamaica PEP–style literature reading-passage quiz flashcards for teachers.

${subjectNature}
${lessonPlanBlock}

${buildEnglishPassagePromptSection({
  gradeLevel: input.gradeLevel,
  countPlan,
  passageTotal,
  questionTotal,
})}

Output shape:
- passages: array of exactly ${passageTotal} objects
- Each object has:
  - title: required short story title (plain text)
  - passage: story body only (do NOT repeat "Passage Title:" inside the passage string)
  - questions: array with EXACTLY the count listed for that passage index (${countPlan})
- Each question item includes questionType, question, correctAnswer, wrongAnswers (exactly 3), and explanation
- Do NOT emit empty passages or passages with zero questions
- Difficulty: ${input.difficultyLevel}
- Ground content in the English / Language Arts subject nature above${hasLessonPlan ? " and THAT day's lesson vocabulary/focus from the saved lesson plan (not the activity notes)" : ""}`;

    const user = hasLessonPlan
      ? `Subject: ${input.subject}
Grade level: ${input.gradeLevel}
Topic: ${input.topic}
Difficulty: ${input.difficultyLevel}

Generate exactly ${passageTotal} Jamaica PEP–style titled short stor${passageTotal === 1 ? "y" : "ies"} with this question plan: ${countPlan}.
Use the saved lesson plan below ONLY to learn the Day/scope vocabulary terms and thematic focus.
Write a short story like "The Mango Tree" that weaves those vocabulary words into natural narration/dialogue, then ask Main Idea / Detail / Vocabulary in Context / Character Trait / Theme / Evidence questions.
Never paste definitions, never open by restating Subject/Grade/Topic, and never summarize classroom activities.

Saved lesson plan:
${input.lessonPlanContext!.trim()}`
      : `Subject: ${input.subject}
Grade level: ${input.gradeLevel}
Topic: ${input.topic}
Difficulty: ${input.difficultyLevel}

Generate exactly ${passageTotal} Jamaica PEP–style titled short stor${passageTotal === 1 ? "y" : "ies"} with this question plan: ${countPlan}.
Use the "The Mango Tree" literature style: Passage Title + realistic short story with a clear message + linked MC questions (main idea, detail, vocab in context, character trait, theme, textual evidence).
Do not open by restating Subject/Grade/Topic, and do not narrate a classroom lesson.`;

    return { system, user };
  }

  const system = `You are an expert K–12 assessment designer creating Jamaica PEP–style reading-passage quiz flashcards for teachers.

${subjectNature}
${lessonPlanBlock}

Generate exactly ${passageTotal} distinct informational reading passage${passageTotal === 1 ? "" : "s"} and exactly ${questionTotal} comprehension questions total, distributed as: ${countPlan}.

PURPOSE OF EACH PASSAGE:
- Construct a short informational passage geared toward LEARNING THE VOCABULARY for this lesson/topic
- Base the passage on the vocabulary topic (terms used correctly in meaningful content), not on summarizing a lesson plan or classroom meta-narrative
- Students should be able to infer what key terms mean from how they are used, then answer comprehension questions about the passage

Output shape:
- passages: array of exactly ${passageTotal} objects
- Each object has:
  - passage: one continuous reading passage (about 4–8 sentences, or 2 short paragraphs) appropriate for grade ${input.gradeLevel} on the vocabulary/topic scope (use Subject/Topic only as content guidance — never echo them as an opening line)
  - title: optional (omit for non-math unless a clear story title helps)
  - questions: array with EXACTLY the count listed for that passage index (${countPlan})
- Each question item includes questionType, question, correctAnswer, wrongAnswers (exactly 3), and explanation
- Do NOT emit empty passages or passages with zero questions

Passage quality rules (critical):
- Write coherent informational reading passages students can read and learn vocabulary from — NOT glossaries, vocabulary lists, definition dumps, or lesson-plan activity summaries
- Weave target vocabulary TERMS naturally into sentences — do NOT paste definitions inline like "Variable A symbol used to represent…"
- Do not use "Term — definition" or "Term: definition" patterns anywhere in any passage
- NEVER start with or include boilerplate that restates form fields, such as:
  - "In {subject} class, grade {grade} learners explored {topic}…"
  - "In {subject}, {grade} students…" / "A small group in {subject} worked through…"
  - Any opening that names the subject string, grade string, and topic string as a class diary ("learners explored…", "the class agreed…", "partners discussed…")
- Ban classroom meta-narrative: do not describe students comparing notes, writing takeaways, underlining clues as the main plot, or retelling warm-ups / timelines / homework instructions from the lesson plan
- Each passage must illustrate the vocabulary/topic so its own questions can probe Main Idea, Detail, Vocabulary in Context, Inference, Evidence, etc.
- When generating multiple passages, make each passage distinct (different scenario, angle, or details) while staying on the same vocabulary topic

Question quality rules:
- Every question MUST be answerable from its own passage alone
- ${QUESTION_TYPE_GUIDANCE}
- Never put A/B/C/D options on the question text
- Never use markdown, emoji, or checkmarks

Answer / wrong-answer rules:
- correctAnswer: concise correct choice text suitable for multiple-choice quiz mode (plain text only)
- correctAnswer should be complete answer text only — e.g. "Because it helps her learn new words and improve her imagination."
- wrongAnswers: exactly 3 plausible but incorrect answer texts (no letter prefixes, no emoji); clearly wrong after reading that passage; similar length/tone to the short final answer
- explanation: brief educational rationale
- Difficulty: ${input.difficultyLevel}
- Ground content in the subject nature above${hasLessonPlan ? " and the lesson vocabulary/concepts from the saved lesson plan (not the activity notes)" : ""}`;

  const user = hasLessonPlan
    ? `Subject: ${input.subject}
Grade level: ${input.gradeLevel}
Topic: ${input.topic}
Difficulty: ${input.difficultyLevel}

Generate exactly ${passageTotal} reading passage${passageTotal === 1 ? "" : "s"} with this question plan: ${countPlan}.
Use the saved lesson plan below only to learn the vocabulary terms and conceptual focus for this scope.
Write informational passages that teach those vocabulary terms in natural context — never paste definitions, never open by restating Subject/Grade/Topic, and never summarize classroom activities or lesson-plan notes.

Saved lesson plan:
${input.lessonPlanContext!.trim()}`
    : `Subject: ${input.subject}
Grade level: ${input.gradeLevel}
Topic: ${input.topic}
Difficulty: ${input.difficultyLevel}

Generate exactly ${passageTotal} reading passage${passageTotal === 1 ? "" : "s"} with this question plan: ${countPlan}.
Write short informational passages that teach key vocabulary for this topic in natural context.
Do not open by restating Subject/Grade/Topic (e.g. ban "In {subject} class, grade {grade} learners explored {topic}"), and do not narrate a classroom lesson.`;

  return { system, user };
}

export function normalizePassageQuizFront(front: string): string {
  return cleanReadingPassageFront(front);
}
