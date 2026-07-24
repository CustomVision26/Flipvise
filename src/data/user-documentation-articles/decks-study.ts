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
          "AI card generation on Pro, Pro Plus, Education Plus, and team-tier / education team workspaces.",
          "Deck cover image upload when your plan allows (Pro personal, team-tier workspace).",
          "Edit deck can set or replace the oldest card’s front image (first card front image).",
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
          "Choose Answer with diagram for graphs, geometry figures, stats charts, measurement figures, or simple 3D shapes — Flipvise draws labeled diagrams from a structured spec (not a freehand AI doodle).",
          "Answer with diagram: front gets a question figure without the correct answer; back gets a solution figure with the correct answer labeled; quiz wrong answers get their own incorrect figures when those slots are shown.",
          "If a diagram cannot be built, the text answer still updates and you can retry or switch to Answer with image.",
          "Answer with image adds a decorative illustration on the selected Front or Back side only.",
          "While editing a card, double-click a front, back, or wrong-answer image thumbnail to open a full-size preview.",
        ],
      },
      {
        id: "source-import-review",
        title: "From source — review, swap, and quiz distractors",
        bullets: [
          "After AI drafts cards from a URL or file, review each card before adding it to the deck.",
          "Swap flips the front and back you save — e.g. move a definition to the front and the term to the back.",
          "Three quiz wrong answers are generated when you save; by default they match the original back (answer) style, such as other definitions, numbers, or fact lists.",
          "Wrong answers from original front — enable per card after Swap when the saved back holds the short term or question; distractors then match that side (other terms, parallel questions like \"what is 5+5?\", etc.).",
          "Swap toggles that option automatically; you can change it per card before clicking Add.",
          "Three editable quiz wrong answers are shown on each card before save; use Regenerate to refresh them from AI or edit the fields directly.",
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
          "Double-click the front or back image on a flashcard to open a full-size preview; Escape or click outside closes it.",
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
          "Pro Plus and Education Plus (Stripe paid, admin-assigned, or affiliate grant): on your personal deck’s quiz lobby, use Format Quiz Question to enable formats, set Questions per format counts, set a Quiz time limit (minutes), Generate AI quiz sentences when needed, then Publish to quiz (or Republish to quiz).",
          "Eligibility follows your effective Pro Plus / Education Plus entitlement — the same plan shown in Billing and the header plan badge.",
          "Team admins configure formats in Team Admin → Deck Manager → Study privileges (not via Format Quiz Question on personal decks).",
        ],
      },
      {
        id: "format-quiz-question",
        title: "Format Quiz Question (personal decks)",
        bullets: [
          "Shown on the Timed quiz lobby when you own the deck and hold Pro Plus or Education Plus.",
          "Draft formats and counts stay in the dialog until you click Publish to quiz — then the lobby, timer, and question mix update.",
          "Questions per format counts must add up to the deck’s eligible card total before Generate or Publish.",
          "Quiz time limit is 1–180 minutes; Publish saves it for this deck’s personal timed quiz clock.",
          "Team workspace quizzes still use the team admin Quiz Timer when you study from a workplace assignment.",
        ],
      },
      {
        id: "quiz-lobby-mix",
        title: "Quiz lobby and session mix",
        bullets: [
          "Before you start a quiz, the lobby lists which formats are enabled and how many questions of each type you will see (e.g. 5 multiple choice, 2 true/false, 3 fill in the blank).",
          "When question counts have been entered and Publish to quiz used (personal Format Quiz Question or team Study privileges reshuffle), the lobby reflects that exact distribution.",
          "Without a publish/reshuffle, the lobby estimates a random mix across enabled formats.",
          "Each question shows a format badge while you answer (Multiple choice, True / false, or Fill in the blank).",
          "When published, each card keeps its assigned format until formats are published again.",
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
          "Quiz timer — time limit per attempt set by team admin (or by you via Format Quiz Question on personal Pro Plus / Education Plus decks).",
          "Quiz schedule — quizzes cannot start before the configured date/time.",
          "Quiz security — session locking, admin grant to resume/restart, one controlled attempt per deck. Applies to the plan owner whenever security is on, plus Team Admins and/or Members selected in Quiz security settings. When active for you, the Timed quiz lobby shows a green Security on light.",
          "Owners and team admins get a Cancel button on the unanswered-submit dialog to exit without submitting (members only see Keep answering / Submit anyway).",
          "Workspace deck study links canonicalize to /decks/[deckId]/study?team=&userid=&plan=&teamMemberId=.",
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
