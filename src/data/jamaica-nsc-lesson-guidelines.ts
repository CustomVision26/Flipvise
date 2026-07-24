/**
 * Flipvise AI Lesson Plan Generation Guidelines aligned with the
 * Jamaica National Standards Curriculum (NSC).
 *
 * Source: Summary based on "Student Teachers' Shared Experiences of
 * Jamaica's National Standards Curriculum (NSC)" (2020).
 *
 * Injected into lesson-plan generation only when AI confirms the
 * Learning Standard field is linked to Jamaica.
 */

export type JamaicaNscLessonGuidelines = {
  title: string;
  source: string;
  purpose: {
    summary: string;
    promote: string[];
    avoid: string[];
  };
  fiveEModel: {
    engage: string;
    explore: string;
    explain: string;
    elaborate: string;
    evaluate: string;
  };
  learningObjectives: {
    measurableVerbs: string[];
  };
  teacherRole: string[];
  studentRole: string[];
  activities: string[];
  realLifeContext: string[];
  stemAnd21stCenturySkills: string[];
  inclusiveEducation: {
    instruction: string;
    learnerGroups: string[];
  };
  assessment: {
    instruction: string;
    measure: string[];
    methods: string[];
  };
  resources: string[];
  homework: {
    instruction: string;
    taskTypes: string[];
  };
  questionProgression: string[];
  systemPromptRules: string[];
};

export const JAMAICA_NSC_LESSON_GUIDELINES: JamaicaNscLessonGuidelines = {
  title:
    "Flipvise AI Lesson Plan Generation Guidelines Aligned with the Jamaica National Standards Curriculum (NSC)",
  source:
    "Summary based on \"Student Teachers' Shared Experiences of Jamaica's National Standards Curriculum (NSC)\" (2020).",
  purpose: {
    summary:
      "Generate student-centered, inquiry-based, and competency-driven lesson plans aligned with the Jamaica NSC.",
    promote: [
      "Critical thinking",
      "Creativity",
      "Collaboration",
      "Communication",
      "Real-world application",
      "Inclusive education",
      "21st-century skills",
    ],
    avoid: ["Lecture-only lessons", "Note-copying lessons"],
  },
  fiveEModel: {
    engage: "Activate curiosity with a real-world hook.",
    explore:
      "Students investigate via research, discussion, experiments, or hands-on activities; teacher facilitates.",
    explain:
      "Students explain their discoveries before the teacher formalizes concepts and vocabulary.",
    elaborate:
      "Students apply learning to authentic problems, projects, or new contexts.",
    evaluate:
      "Assess through quizzes, observations, projects, reflections, exit tickets, and performance tasks.",
  },
  learningObjectives: {
    measurableVerbs: [
      "analyze",
      "explain",
      "evaluate",
      "investigate",
      "justify",
      "design",
      "create",
      "apply",
      "compare",
      "solve",
    ],
  },
  teacherRole: [
    "Act as a facilitator, not a lecturer.",
    "Guide discussion and ask probing questions.",
    "Encourage collaboration.",
    "Provide feedback.",
    "Support inquiry instead of delivering lengthy lectures.",
  ],
  studentRole: [
    "Investigate and collaborate.",
    "Ask questions.",
    "Explain reasoning.",
    "Solve authentic problems.",
    "Reflect and present findings.",
  ],
  activities: [
    "Group work",
    "Think-Pair-Share",
    "STEM challenges",
    "Inquiry tasks",
    "Research",
    "Projects",
    "Games",
    "Role-play",
    "Discussions",
    "Reflection",
  ],
  realLifeContext: [
    "Jamaican culture",
    "Community",
    "Environment",
    "Health",
    "Business",
    "Technology",
    "Agriculture",
    "Sports",
    "Everyday life",
  ],
  stemAnd21stCenturySkills: [
    "Integrate Science, Technology, Engineering, and Mathematics (STEM) where appropriate.",
    "Build 21st-century skills alongside content mastery.",
  ],
  inclusiveEducation: {
    instruction:
      "Provide optional accommodations for a variety of learner needs.",
    learnerGroups: [
      "Dyslexia",
      "ADHD",
      "Autism",
      "Visual impairments",
      "Hearing impairments",
      "English language learners",
      "Gifted learners",
      "Students needing additional support",
    ],
  },
  assessment: {
    instruction: "Align assessments to objectives.",
    measure: [
      "Knowledge",
      "Understanding",
      "Application",
      "Analysis",
      "Reasoning",
      "Communication",
      "Collaboration",
    ],
    methods: ["Formative", "Summative"],
  },
  resources: [
    "Images",
    "Videos",
    "Manipulatives",
    "Flashcards",
    "Worksheets",
    "Simulations",
    "Digital tools",
    "Graphic organizers",
  ],
  homework: {
    instruction:
      "Assign meaningful tasks instead of repetitive worksheets.",
    taskTypes: [
      "Real-world investigations",
      "Reflection",
      "Research",
      "Creative tasks",
      "Problem-solving",
    ],
  },
  questionProgression: [
    "Recall",
    "Understand",
    "Apply",
    "Analyze",
    "Evaluate",
    "Create",
  ],
  systemPromptRules: [
    "Always follow the 5E model (Engage, Explore, Explain, Elaborate, Evaluate).",
    "Align objectives, activities, and assessments.",
    "Promote the 4Cs (Critical thinking, Communication, Collaboration, Creativity).",
    "Include culturally relevant Jamaican examples where appropriate.",
    "Generate competency-based lessons.",
    "Recommend differentiation and accommodations.",
    "Integrate technology when appropriate.",
    "Ensure lessons are engaging, practical, and NSC-aligned.",
  ],
};
