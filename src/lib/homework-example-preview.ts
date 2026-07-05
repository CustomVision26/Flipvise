export type HomeworkExampleInput = {
  subject: string;
  gradeLevel: string;
  topic: string;
  difficultyLevel: string;
};

export type HomeworkExamplePreview = {
  question: string;
  answer: string;
  note: string;
};

type SubjectArea =
  | "ela"
  | "math"
  | "science"
  | "social_studies"
  | "world_language"
  | "general";

function detectSubjectArea(subject: string, topic: string): SubjectArea {
  const text = `${subject} ${topic}`.toLowerCase();

  if (
    /reading|comprehension|literature|language arts|\bela\b|english|writing|grammar|vocabulary|pep|narrative|poetry|inference|figurative/.test(
      text,
    )
  ) {
    return "ela";
  }
  if (
    /math|algebra|geometry|calculus|arithmetic|fraction|equation|number|measurement|statistics|pemdas|ratio|percent/.test(
      text,
    )
  ) {
    return "math";
  }
  if (
    /science|biology|chemistry|physics|ecosystem|cell|energy|matter|experiment|lab|earth|space|anatomy/.test(
      text,
    )
  ) {
    return "science";
  }
  if (
    /history|social studies|geography|civics|government|economics|culture|revolution|independence|map skills/.test(
      text,
    )
  ) {
    return "social_studies";
  }
  if (
    /french|spanish|mandarin|german|language learning|foreign language|translation|vocabulary list/.test(
      text,
    )
  ) {
    return "world_language";
  }

  return "general";
}

function gradeLabel(gradeLevel: string): string {
  const trimmed = gradeLevel.trim();
  return trimmed || "your grade level";
}

function difficultyPhrase(difficultyLevel: string): string {
  switch (difficultyLevel.trim()) {
    case "Beginner":
      return "recall and basic understanding";
    case "Intermediate":
      return "application and short written explanation";
    case "Advanced":
      return "analysis with evidence or multi-step reasoning";
    case "Honors/Gifted":
      return "evaluation, synthesis, or extended justification";
    case "On-level":
    default:
      return "grade-appropriate reasoning and clear support";
  }
}

const EXAMPLES: Record<
  SubjectArea,
  Record<
    "Beginner" | "On-level" | "Intermediate" | "Advanced" | "Honors/Gifted",
    (input: HomeworkExampleInput) => HomeworkExamplePreview
  >
> = {
  ela: {
    Beginner: ({ topic, gradeLevel }) => ({
      question: `Read a short passage about ${topic}. List two details from the text that tell what the main character wants.`,
      answer: `Students should name two explicit facts from the passage that show the character's goal (e.g., preparing for an event, solving a problem, or helping someone).`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — focuses on literal comprehension.`,
    }),
    "On-level": ({ topic, gradeLevel }) => ({
      question: `Read a paragraph related to ${topic}. What is the main idea, and which sentence best supports it?`,
      answer: `The main idea summarizes what the paragraph is mostly about; the supporting sentence gives a key detail that proves that idea.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — main idea and text evidence.`,
    }),
    Intermediate: ({ topic, gradeLevel }) => ({
      question: `After reading a passage on ${topic}, explain how the author's word choice creates mood. Cite two phrases from the text.`,
      answer: `Answers should connect specific words (e.g., storm, whispered, bright) to a named mood such as tense, hopeful, or calm, with brief explanation.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — inference and author's craft.`,
    }),
    Advanced: ({ topic, gradeLevel }) => ({
      question: `Compare how two characters in a ${topic} passage respond to the same problem. What does each response reveal about their values?`,
      answer: `Strong answers compare both characters' actions or dialogue and explain what each choice shows about priorities or personality.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — compare/contrast with interpretation.`,
    }),
    "Honors/Gifted": ({ topic, gradeLevel }) => ({
      question: `Evaluate whether the narrator in a ${topic} excerpt is reliable. Use two pieces of evidence and explain how they support your judgment.`,
      answer: `Responses should take a clear position on reliability and tie evidence to narrator bias, omission, or tone.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — critical evaluation of narrator.`,
    }),
  },
  math: {
    Beginner: ({ topic, gradeLevel }) => ({
      question: `Solve a basic ${topic} problem suitable for ${gradeLabel(gradeLevel)}. Show each step.`,
      answer: `Work should show the operation used and the correct final value with units if needed.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — procedural practice.`,
    }),
    "On-level": ({ topic, gradeLevel }) => ({
      question: `A ${gradeLabel(gradeLevel)} class is working on ${topic}. Write and solve a word problem that uses the skill in a real-world setting.`,
      answer: `The equation or method should match the scenario, steps should be shown, and the answer should include appropriate units.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — word problem with reasoning.`,
    }),
    Intermediate: ({ topic, gradeLevel }) => ({
      question: `Create and solve a two-step ${topic} problem for ${gradeLabel(gradeLevel)}. Explain why your method works.`,
      answer: `Solution shows both steps in order and a sentence explaining the strategy (e.g., inverse operations, formula choice).`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — multi-step application.`,
    }),
    Advanced: ({ topic, gradeLevel }) => ({
      question: `Solve a ${topic} problem with an unknown in two places. Justify each algebraic move you make.`,
      answer: `Correct isolation of the variable with reasons for distributing, combining like terms, or dividing both sides.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — algebraic reasoning.`,
    }),
    "Honors/Gifted": ({ topic, gradeLevel }) => ({
      question: `Design a ${topic} problem for ${gradeLabel(gradeLevel)} that has more than one valid approach. Solve it two ways and compare the methods.`,
      answer: `Both solution paths should reach the same result; comparison notes efficiency or when each method is preferable.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — flexible problem solving.`,
    }),
  },
  science: {
    Beginner: ({ topic, gradeLevel }) => ({
      question: `Define the key term related to ${topic} and give one everyday example.`,
      answer: `Definition should match grade-level vocabulary; example should clearly connect to the concept.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — vocabulary and recall.`,
    }),
    "On-level": ({ topic, gradeLevel }) => ({
      question: `Explain how ${topic} applies to a familiar system (e.g., body, ecosystem, or machine). Use two supporting facts.`,
      answer: `Explanation links the concept to the system and cites two accurate science facts.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — concept application.`,
    }),
    Intermediate: ({ topic, gradeLevel }) => ({
      question: `Describe the cause-and-effect relationship involved in ${topic}. Include one diagram label or written sequence.`,
      answer: `Answer names cause, effect, and the steps or parts in order with correct science terms.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — processes and relationships.`,
    }),
    Advanced: ({ topic, gradeLevel }) => ({
      question: `A student claims a statement about ${topic} is true. Use evidence to agree or disagree and explain your reasoning.`,
      answer: `Response takes a position and uses data, observations, or scientific principles to support it.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — claim and evidence.`,
    }),
    "Honors/Gifted": ({ topic, gradeLevel }) => ({
      question: `Propose a simple investigation question about ${topic}. Identify the independent and dependent variables and one controlled variable.`,
      answer: `Investigation question is testable; variables are correctly labeled and tied to the topic.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — experimental design.`,
    }),
  },
  social_studies: {
    Beginner: ({ topic, gradeLevel }) => ({
      question: `Name two important facts about ${topic} that ${gradeLabel(gradeLevel)} students should remember.`,
      answer: `Facts should be accurate, specific, and directly related to the topic (people, places, dates, or events as appropriate).`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — foundational facts.`,
    }),
    "On-level": ({ topic, gradeLevel }) => ({
      question: `How did ${topic} affect people's daily lives? Give one cause and one effect.`,
      answer: `Cause and effect should be historically accurate and explained in student-friendly language.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — cause and effect.`,
    }),
    Intermediate: ({ topic, gradeLevel }) => ({
      question: `Using what you know about ${topic}, explain why historians might disagree about its impact.`,
      answer: `Answers mention different perspectives, sources, or values that lead to different interpretations.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — historical perspective.`,
    }),
    Advanced: ({ topic, gradeLevel }) => ({
      question: `Analyze one primary-source detail related to ${topic}. What does it suggest about the time period?`,
      answer: `Interpretation connects the source detail to context (economics, politics, culture) with supported inference.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — primary source analysis.`,
    }),
    "Honors/Gifted": ({ topic, gradeLevel }) => ({
      question: `Construct an argument about the lasting significance of ${topic}. Include a claim, two pieces of evidence, and a counterpoint.`,
      answer: `Argument is organized, evidence is relevant, and the counterpoint is addressed thoughtfully.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — structured historical argument.`,
    }),
  },
  world_language: {
    Beginner: ({ topic, gradeLevel }) => ({
      question: `Write three vocabulary items related to ${topic} in the target language with English meanings.`,
      answer: `Items should be spelled correctly with accurate translations appropriate for ${gradeLabel(gradeLevel)}.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — vocabulary recall.`,
    }),
    "On-level": ({ topic, gradeLevel }) => ({
      question: `Complete a short dialogue about ${topic} using classroom phrases. Translate your dialogue into English.`,
      answer: `Dialogue uses correct grammar and topic vocabulary; translation matches the original meaning.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — phrase use in context.`,
    }),
    Intermediate: ({ topic, gradeLevel }) => ({
      question: `Write four sentences about ${topic} in the target language. Include at least one past-tense and one future-tense sentence.`,
      answer: `Sentences are grammatically correct, on topic, and show tense variety with understandable meaning.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — tense and composition.`,
    }),
    Advanced: ({ topic, gradeLevel }) => ({
      question: `Read a short passage about ${topic} and answer two comprehension questions in the target language.`,
      answer: `Answers demonstrate understanding of main ideas and details using appropriate language structures.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — reading comprehension.`,
    }),
    "Honors/Gifted": ({ topic, gradeLevel }) => ({
      question: `Write a short paragraph comparing ${topic} customs in two cultures, using comparative language in the target language.`,
      answer: `Paragraph compares clearly, uses varied structures, and stays accurate in vocabulary and grammar.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${topic} — cultural comparison writing.`,
    }),
  },
  general: {
    Beginner: ({ subject, topic, gradeLevel }) => ({
      question: `List two things ${gradeLabel(gradeLevel)} students should know about ${topic} in ${subject}.`,
      answer: `Responses name two accurate, topic-specific facts or skills.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${subject} — ${topic}.`,
    }),
    "On-level": ({ subject, topic, gradeLevel }) => ({
      question: `Explain ${topic} in your own words and give one example from ${subject}.`,
      answer: `Explanation shows understanding; example is relevant and correct for the subject.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${subject} — ${topic}.`,
    }),
    Intermediate: ({ subject, topic, gradeLevel }) => ({
      question: `Apply ${topic} to a new scenario in ${subject}. Describe your thinking in 2–3 sentences.`,
      answer: `Application is logical, uses topic vocabulary, and shows how the concept fits the scenario.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${subject} — ${topic}.`,
    }),
    Advanced: ({ subject, topic, gradeLevel }) => ({
      question: `Compare two ideas within ${topic} for ${subject}. What is similar and what is different?`,
      answer: `Comparison identifies at least one similarity and one difference with clear support.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${subject} — ${topic}.`,
    }),
    "Honors/Gifted": ({ subject, topic, gradeLevel }) => ({
      question: `Evaluate an open-ended problem about ${topic} in ${subject}. Defend the best solution with evidence.`,
      answer: `Evaluation selects a solution, supports it with subject-specific evidence, and acknowledges a limitation.`,
      note: `Example for ${gradeLabel(gradeLevel)} ${subject} — ${topic}.`,
    }),
  },
};

function normalizeDifficulty(
  difficultyLevel: string,
): keyof (typeof EXAMPLES)["general"] {
  const value = difficultyLevel.trim();
  if (value in EXAMPLES.general) {
    return value as keyof (typeof EXAMPLES)["general"];
  }
  return "On-level";
}

export function buildHomeworkExamplePreview(
  input: HomeworkExampleInput,
): HomeworkExamplePreview | null {
  const subject = input.subject.trim();
  const gradeLevel = input.gradeLevel.trim();
  const topic = input.topic.trim();

  if (!subject || !gradeLevel || !topic) {
    return null;
  }

  const area = detectSubjectArea(subject, topic);
  const difficulty = normalizeDifficulty(input.difficultyLevel);
  const preview = EXAMPLES[area][difficulty]({
    subject,
    gradeLevel,
    topic,
    difficultyLevel: input.difficultyLevel,
  });

  return {
    ...preview,
    note: `${preview.note} Generated homework will use ${difficultyPhrase(input.difficultyLevel)}.`,
  };
}
