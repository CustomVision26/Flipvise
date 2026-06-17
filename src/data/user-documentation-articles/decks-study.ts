import type { DocArticle } from "@/lib/user-documentation-article-types";

function a(
  pageId: string,
  title: string,
  intro: string,
  sections: DocArticle["sections"],
): DocArticle {
  return { pageId, title, intro, sections };
}

export const DECKS_STUDY_ARTICLES: DocArticle[] = [
  a(
    "deck-editor",
    "Deck Editor — In-Depth Guide",
    "The deck editor (/decks/[deckId]) is where you manage deck metadata and individual flashcards.",
    [
      {
        id: "features",
        title: "Editor features",
        bullets: [
          "Add, edit, reorder, and delete cards.",
          "AI card generation on Pro Plus and team-tier workspaces.",
          "Deck cover image upload when your plan allows (Pro personal, team-tier workspace).",
          "Open Study to launch flashcard review or quiz mode.",
        ],
      },
      {
        id: "access",
        title: "Access control",
        bullets: [
          "Deck owners always have edit access on personal decks.",
          "Team admins and co-admins with edit access can edit in team context.",
          "Plain team members are redirected to study — they cannot change deck content.",
        ],
      },
      {
        id: "limits",
        title: "Limits and validation",
        bullets: [
          "Respect your plan’s cards-per-deck cap — the UI blocks additions beyond the limit.",
          "Empty decks cannot be studied — add at least one card first.",
        ],
      },
    ],
  ),
  a(
    "study-session",
    "Study Session — In-Depth Guide",
    "Study sessions (/decks/[deckId]/study) run flashcard review and quiz modes with optional team policies.",
    [
      {
        id: "modes",
        title: "Study modes",
        bullets: [
          "Flashcard review — flip cards and track familiarity.",
          "Quiz mode — timed session with scoring and optional team policies.",
          "Team members may be restricted to review only, quiz only, or both per assignment.",
        ],
      },
      {
        id: "quiz-formats",
        title: "Quiz question formats",
        bullets: [
          "Multiple choice — pick the best answer from several options (uses card front/back or stored choices).",
          "True / false — decide whether an AI-generated statement is true or false.",
          "Fill in the blank — type the missing word or phrase in an AI-generated sentence.",
          "Admins enable formats per workspace or deck in Team Admin → Deck Manager → Study privileges.",
          "The quiz lobby lists enabled formats and estimates the mix for the current session.",
          "Each question shows a format badge while you answer.",
          "When multiple formats are enabled, the app picks one format per card at random for variety.",
        ],
      },
      {
        id: "team-policies",
        title: "Team quiz policies",
        bullets: [
          "Quiz timer — time limit per attempt set by team admin.",
          "Quiz schedule — quizzes cannot start before the configured date/time.",
          "Quiz security — session locking, admin grant to resume/restart, one controlled attempt per deck.",
        ],
      },
      {
        id: "ai-reading",
        title: "AI Reading (text-to-speech)",
        paragraphs: [
          "On Pro Plus when enabled, cards can be read aloud during study for accessibility and language practice.",
        ],
      },
      {
        id: "requirements",
        title: "Requirements",
        bullets: [
          "At least one card in the deck.",
          "Quiz mode requires a paid or team-tier deck above the free card cap.",
          "Do not bypass security or schedule locks — contact your team admin.",
        ],
      },
    ],
  ),
  a(
    "quiz-result-detail",
    "Quiz Result Detail — In-Depth Guide",
    "Individual quiz breakdowns open from inbox links at /dashboard/quiz-results/[resultId].",
    [
      {
        id: "content",
        title: "What you see",
        bullets: [
          "Overall score percentage and correct/wrong/skipped counts.",
          "Per-question answers and timing.",
          "Deck name and attempt timestamp.",
        ],
      },
      {
        id: "access",
        title: "Access",
        bullets: [
          "You must be the result owner or have permission to view the attempt.",
          "Team admins can view and delete results from Team Admin → Quiz results.",
          "Do not share result URLs — access is tied to your account session.",
        ],
      },
    ],
  ),
];
