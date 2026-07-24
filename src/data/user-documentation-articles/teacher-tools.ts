import type { DocArticle } from "@/lib/user-documentation-article-types";

function a(
  pageId: string,
  title: string,
  intro: string,
  sections: DocArticle["sections"],
): DocArticle {
  return { pageId, title, intro, sections };
}

export const TEACHER_TOOLS_ARTICLES: DocArticle[] = [
  a(
    "teacher-dashboard",
    "Teacher Dashboard — In-Depth Guide",
    "The Teacher Dashboard at /teacher is the home for education plan subscribers.",
    [
      {
        id: "access",
        title: "Who can access",
        table: {
          headers: ["Plan / membership", "Teacher Dashboard"],
          rows: [
            ["Education Plus (personal)", "Yes — full teacher tools"],
            ["Education Gold / Education Enterprise (owner)", "Yes — teacher tools + team admin"],
            ["Education Gold / Education Enterprise (member)", "Yes — scoped to workspace access"],
            ["Pro / Pro Plus / consumer team tiers", "No — upgrade to an education plan"],
          ],
        },
        paragraphs: [
          "Access is enforced on every /teacher route. Unauthenticated users are redirected to /pricing; users without an education plan cannot open teacher tools.",
        ],
      },
      {
        id: "layout",
        title: "Dashboard layout",
        bullets: [
          "Header Teacher link appears when you qualify for education features.",
          "Welcome card shows your plan badge and workspace guidance.",
          "Left sidebar lists AI content tools, Classroom management, and Resources.",
          "Workspace selector scopes deck pickers to personal or team context on Education Gold/Enterprise.",
          "Team Admin Dashboard shortcut appears when you can manage an education team workspace.",
        ],
      },
      {
        id: "deck-workflow",
        title: "Deck workflow for teachers",
        bullets: [
          "Education Plus: create decks on your personal dashboard, then link them in teacher tools.",
          "Education Gold/Enterprise team admins: create decks for assigned workspaces — they appear on the plan owner's personal dashboard grouped by workspace.",
          "AI tools use linked deck cards as source context — add representative cards before generating.",
        ],
      },
    ],
  ),
  a(
    "teacher-ai-content-tools",
    "AI Content Tools — In-Depth Guide",
    "Five AI generators under /teacher produce classroom-ready materials from your flashcard decks.",
    [
      {
        id: "shared-pattern",
        title: "Shared workflow",
        bullets: [
          "Open a tool from the Teacher Dashboard sidebar.",
          "Link one or more decks as source material (personal or team-scoped).",
          "Set topic, grade level, difficulty, and tool-specific options.",
          "Generate → preview → edit sections → save to Teacher Resource Library.",
          "Regenerate individual sections or the full output when results need refinement.",
          "Export PDF where supported (lesson plans, study guides, worksheets).",
        ],
      },
      {
        id: "lesson-builder",
        title: "AI Lesson Builder (/teacher/lesson-builder)",
        bullets: [
          "Multi-day lesson plans with objectives, warm-ups, activities, and assessments.",
          "Weekly schedule with configurable plan period (days per plan).",
          "Vocabulary detail expands definitions, examples, process steps, and learning goals per schedule day.",
          "Reference material fields for standards, textbook pages, or notes.",
          "When Learning Standard is linked to Jamaica (confirmed by AI), generation follows stored Jamaica NSC guidelines — 5E class timelines (Engage → Evaluate), inquiry-based design, inclusive education, and culturally relevant examples. Non-Jamaica standards do not use Jamaica NSC or forced 5E outlines.",
          "Save and reopen from Teacher Resource Library; download PDF.",
        ],
      },
      {
        id: "quizzes-homework",
        title: "Quiz, Homework, Study Guide, Worksheet generators",
        bullets: [
          "AI Quiz/Test Generator (/teacher/quizzes) — review AI cards before saving to a deck.",
          "Homework Generator (/teacher/homework) — take-home practice aligned to deck content.",
          "Study Guide Generator (/teacher/study-guides) — structured review materials with PDF export.",
          "Worksheet Generator (/teacher/worksheets) — printable sheets with answer keys.",
        ],
      },
      {
        id: "requirements",
        title: "Requirements and limits",
        bullets: [
          "Education plan access (personal or team membership).",
          "Internet connection — AI generation is disabled offline.",
          "Linked decks must have cards — empty decks produce poor results.",
          "Deck quota labels show how many decks you can link per tool session.",
        ],
      },
    ],
  ),
  a(
    "teacher-classroom",
    "Classes & Student Progress — In-Depth Guide",
    "Classroom management tools help educators organize groups and monitor learning outcomes.",
    [
      {
        id: "classes",
        title: "Classes (/teacher/classes)",
        bullets: [
          "Create and manage classroom groups.",
          "Associate students and assignments with each class.",
          "Education Gold/Enterprise teams can collaborate via shared department workspaces.",
        ],
      },
      {
        id: "students",
        title: "Student Progress (/teacher/students)",
        bullets: [
          "Review student quiz performance and study activity.",
          "Education Gold adds a student progress dashboard and teacher analytics.",
          "Education Enterprise adds school-wide learning analytics and teacher performance reports.",
        ],
      },
      {
        id: "team-features",
        title: "Education team collaboration",
        bullets: [
          "Education Gold: shared lesson library, shared quizzes, shared flashcards, department workspace.",
          "Education Enterprise: multi-campus support, curriculum management, school resource library, advanced user roles.",
        ],
      },
    ],
  ),
  a(
    "teacher-resources",
    "Teacher Resource Library — In-Depth Guide",
    "Saved outputs from AI content tools are stored at /teacher/resources for reuse.",
    [
      {
        id: "browse",
        title: "Browse saved materials",
        bullets: [
          "Lists lesson plans, quizzes, homework, study guides, and worksheets you saved.",
          "Open any item to edit, regenerate, or export.",
          "Filter and search by title or tool type.",
        ],
      },
      {
        id: "sharing",
        title: "Sharing on education team plans",
        bullets: [
          "Education Gold/Enterprise: shared lesson library lets teaching teams reuse materials.",
          "School resource library (Education Enterprise) centralizes institution-wide content.",
        ],
      },
      {
        id: "cautions",
        title: "Best practices",
        bullets: [
          "Export PDFs for offline classroom use as a backup.",
          "Do not delete resources still referenced in active class plans.",
        ],
      },
    ],
  ),
];
