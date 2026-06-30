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
          "AI generation requires a connection — the Generate button is disabled and explains why when you are offline.",
        ],
      },
      {
        id: "ai-generation-quality",
        title: "Getting reliable AI-generated cards",
        paragraphs: [
          "Whenever you use batch Generate, Add card → From source, or Generate answer, Flipvise builds context from your deck name, description, and a sample of cards already in that deck. The model treats those existing cards as the reference for subject scope, question style, answer length, and difficulty — so new cards feel like they belong in the same deck.",
        ],
        bullets: [
          "Use a specific deck name and a short description that states the topic clearly (for example, \"AP Biology — cell division\" rather than a vague title like \"Bio\").",
          "Add several representative cards by hand before your first large AI batch — even three to five well-written examples usually produces much more consistent output.",
          "Keep your manual cards consistent in format (all definitions, all worked problems, and so on) so the AI can mirror that pattern.",
          "AI generates new material within the deck topic and does not copy or trivially rephrase cards you already have.",
          "If the deck is still empty, AI has only the name and description to work from, so the first batch may vary more until you edit results or add sample cards.",
          "Math and problem-solving decks receive step-by-step worked answers; vocabulary and fact decks receive concise term-and-definition pairs.",
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
          "Admins enable formats and set how many questions of each type per deck in Team Admin → Deck Manager → Study privileges.",
        ],
      },
      {
        id: "quiz-lobby-mix",
        title: "Quiz lobby and session mix",
        bullets: [
          "Before you start a quiz, the lobby lists which formats are enabled and how many questions of each type you will see (e.g. 5 multiple choice, 2 true/false, 3 fill in the blank).",
          "When a team admin has entered question counts and used Reshuffle format questions, the lobby reflects that exact distribution.",
          "Without an admin reshuffle, the lobby estimates a random mix across enabled formats.",
          "Each question shows a format badge while you answer (Multiple choice, True / false, or Fill in the blank).",
          "When reshuffled, each card keeps its assigned format for every member until the admin reshuffles again.",
        ],
      },
      {
        id: "quiz-results-review",
        title: "Quiz results review",
        bullets: [
          "After you submit a quiz, the Review section labels each question with its format: Question N (MCQ), (True/False), or (Fill in the blank).",
          "Saved results in your inbox and on /dashboard/quiz-results/[id] show the same format labels.",
          "PDF exports include the format on each question line when the result was saved with format metadata.",
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
          "Per-question answers, format label (MCQ, True/False, Fill in the blank), and timing.",
          "Expandable question cards in the review list — filter by correct, incorrect, or unanswered.",
          "Deck name and attempt timestamp.",
        ],
      },
      {
        id: "formats",
        title: "Question format labels",
        bullets: [
          "Each row shows Question N (MCQ), Question N (True/False), or Question N (Fill in the blank) above the prompt.",
          "Labels come from the question type used in that attempt (including admin-defined question counts and reshuffled deck assignments).",
          "Older saved results from before format metadata was stored may show Question N without a parenthetical format.",
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
