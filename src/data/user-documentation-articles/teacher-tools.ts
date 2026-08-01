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
          "Save to Existing deck lists workspace decks without a linked lesson plan — including decks assigned to you on the Team Dashboard.",
          "Weekly schedule with configurable plan period (days per plan).",
          "Vocabulary detail expands definitions, examples, process steps, and learning goals per schedule day.",
          "Reference material fields for standards, textbook pages, or notes.",
          "When Learning Standard is linked to Jamaica (confirmed by AI), generation follows stored Jamaica NSC guidelines — 5E class timelines (Engage → Evaluate), inquiry-based design, inclusive education, and culturally relevant examples. Non-Jamaica standards do not use Jamaica NSC or forced 5E outlines.",
          "Save and reopen from Teacher Resource Library; download PDF.",
          "Edit mode exit guard: if Input or Preview differ from the last-saved plan, or Input fields differ from the current preview (subject, topic, grade, duration, plan period, difficulty, learning standard, class size, lesson title cues)—or after Deck updated sync—leaving via Back, sidebar/tabs, other in-app links, or browser Back prompts you to stay, generate a new plan (does not auto-run AI), or keep the current preview and auto-save both intake and preview (then continues to the destination you clicked). Creators overwrite their Resource Library plan only while the deck is unassigned; once any member is assigned that deck, the linked original is frozen and creator Save/keep writes a personal copy instead. Assignees of an assigned-deck original always get a personal copy (never overwrite the original); if a personal copy already matches, leave without needless overwrite.",
          "Assignee generate choice: when editing a creator-linked assigned-deck plan, Generate (and the leave dialog’s Generate action) first asks whether to generate a completely new AI lesson plan or create your lesson plan from the linked plan without a new AI call. The original linked plan stays unchanged forever; content is copied from the creator’s deck-linked plan, restructured deterministically if intake details differ, and saved as your personal copy (insert or update that personal row only).",
        ],
      },
      {
        id: "quizzes-homework",
        title: "Quiz, Homework, Study Guide, Worksheet generators",
        bullets: [
          "AI Quiz/Test Generator (/teacher/quizzes) — review AI cards before saving to a deck. Set Regular quiz cards, optionally Include reading passage, then Number of passages and Passage 1 — questions / Passage 2 — questions / … (0 skips that passage; only passages with ≥1 questions are generated). Reading passages are short informational texts that teach the lesson vocabulary in context (not classroom-activity summaries); each question counts as one card toward the deck limit (regular + sum of passage questions). For Mathematics, passages use a Passage Title and real-world story (e.g. Selling Fruit Juice) with linked questions on variables, expressions, equations, and evaluation. For English / Literature / Language Arts, passages use a Jamaica PEP–style titled short story (e.g. The Mango Tree) based on that day’s lesson vocabulary, with main idea, detail, vocab-in-context, character trait, theme, and evidence questions. For math and problem-solving questions, AI can put a Step 1: … Answer: … workout on the card back for Standard Review study mode, while Quiz mode shows only the final Answer: value with short wrong answers. With a multi-day saved lesson plan selected, AI Generate asks whether to use All Days (full multi-day plan) or a specific day (Day 1 (Monday), Day 2 (Wednesday), etc.); each day option can show a muted caption from that day’s daily focus or vocabulary when present. Generation uses only that day’s vocab/focus/outline (or the whole plan for All Days). Single-day plans skip the dialog. When saving from a lesson plan: All Days adds cards to `{Deck} LP All Days` if that deck already exists, otherwise creates it (never the linked main lesson deck or a Day N deck); a specific day adds cards to `{Deck} LP Day N` if that deck already exists, otherwise creates it. Decks without a linked lesson-plan source still create a new short-named deck. Team members see assigned-deck original lesson plans in the Lesson plan dropdown (alongside personal saves), labeled as title · grade · creator name with (Owner)/(Team Admin) when applicable; personal saves use title · grade. View saved PDF works when the original has a PDF.",
          "Homework Generator (/teacher/homework) — take-home practice aligned to deck content. From saved lesson plan includes the same assigned-deck originals for team members. Multi-day plans show the same All Days / day picker (with day captions) before Generate. For Reading / Language Arts / Literature topics, set Number of passages and Questions per passage (total = passages × questions). Generate produces concrete practice from lesson vocabulary (math: solvable problems; reading: titled passages with linked questions) in Preview, Edit, and PDF. Math answers that require a number-line or coordinate graph include a drawn figure in the Answer Key (not only a text description).",
          "Study Guide Generator (/teacher/study-guides) — structured review materials with PDF export. Lesson plan picker includes assigned-deck originals for team members. Multi-day lesson plans generate from the full plan (All Days) without a day-scope dialog.",
          "Worksheet Generator (/teacher/worksheets) — printable sheets with answer keys.",
          "Generate AI Essay (/dashboard/ai-doc-studio/ai-essay/generate) — premium add-on; requires AI Essay entitlement.",
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
          "On team workspaces, lesson plan cards label the creator as (Owner) or (Team Admin) when that person is the workspace owner or a team admin; other roles show the name only.",
          "Saved Lesson Plans keep their original Saved date; if the linked source deck changes later, the card shows Source deck updated and a Deck updated badge.",
          "If the linked source deck no longer exists, the card shows a Deck deleted badge and caption; Edit and Create Quiz stay hidden because the deck link is broken. The saved plan content (and PDF, if any) can still be kept.",
        ],
      },
      {
        id: "assigned-lesson-plans",
        title: "Lesson plans from assigned decks",
        bullets: [
          "If an owner or team admin assigns you a deck that already has a linked lesson plan, that original plan auto-appears under From assigned decks in Saved Lesson Plans.",
          "Cards show the creator’s name and the assigned deck source label. On team workspaces, the name includes (Owner) or (Team Admin) when the creator is the workspace owner or a team admin (members have no role suffix).",
          "Edit opens AI Lesson Builder prefilled from the original. Save, keep-on-leave, or Create my lesson plan from the linked plan creates/updates your own copy under My lesson plans; the assigned original (and its deck link) stays unchanged forever — including against later creator deck-edit/keep/save updates, which also write personal copies once the deck is assigned. Create-from-linked uses the creator’s deck-linked plan as the content source (never a prior personal draft) and restructures it to your intake when details differ. If your personal copy already matches the current intake and preview, leave does not needlessly overwrite it.",
          "If the creator deletes the source deck, the assigned plan can remain as a saved copy with Deck deleted — without a working deck link.",
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
          "When a lesson plan shows Deck updated, open Edit in the AI Lesson Builder to regenerate or revise against the current deck.",
          "Deleting a deck while on a non-Education plan also breaks any leftover Education lesson-plan↔deck link — returning to Education later shows the saved plan only, not a working deck link.",
        ],
      },
    ],
  ),
];
