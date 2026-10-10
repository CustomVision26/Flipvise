export type DocsUiGuideId =
  | "signup"
  | "signin"
  | "personal-dashboard"
  | "pricing"
  | "subscribe"
  | "create-deck"
  | "ai-created-cards"
  | "manual-added-cards"
  | "manual-add-mcq"
  | "add-card-from-source"
  | "create-workspace"
  | "invite-unregistered-member"
  | "link-deck-to-workspace"
  | "assign-deck-to-member"
  | "assign-deck-to-team-admin"
  | "change-study-mode-privileges"
  | "workspace-study-mode-settings"
  | "ai-recall-session-cards"
  | "quiz-formats-workspace"
  | "quiz-timer-workspace"
  | "quiz-schedule-workspace"
  | "quiz-exam-mode-workspace"
  | "quiz-results-workspace"
  | "edu-teacher-dashboard"
  | "edu-teacher-lesson-plan-owner"
  | "edu-teacher-lesson-plan-owner-new-deck"
  | "edu-teacher-quiz-owner-lesson-plan"
  | "edu-teacher-quiz-owner-existing-deck"
  | "edu-teacher-homework-owner-deck"
  | "edu-teacher-homework-owner-lesson-plan"
  | "edu-teacher-study-guide-owner-lesson-plan"
  | "edu-teacher-worksheet-owner-lesson-plan"
  | "edu-teacher-classes-owner"
  | "edu-teacher-student-progress-owner"
  | "edu-teacher-student-progress-add-student-owner"
  | "edu-teacher-student-progress-quiz-result-owner";

export const FLIPVISE_UI_GUIDE_LABEL = "Flipvise UI guide";

export type DocsUiGuideCategoryId =
  | "getting-started"
  | "decks-and-cards"
  | "team-tier";

export type DocsUiGuideNestedGroup = {
  id: string;
  title: string;
  description: string;
  guideIds: readonly DocsUiGuideId[];
};

export type DocsUiGuideCategory = {
  id: DocsUiGuideCategoryId;
  title: string;
  description: string;
  guideIds: readonly DocsUiGuideId[];
  nested?: readonly DocsUiGuideNestedGroup[];
};

export const DOCS_UI_GUIDE_CATEGORIES: readonly DocsUiGuideCategory[] = [
  {
    id: "getting-started",
    title: "Getting started",
    description: "Account access, Personal Dashboard, plans, and checkout.",
    guideIds: [
      "signup",
      "signin",
      "personal-dashboard",
      "pricing",
      "subscribe",
    ],
  },
  {
    id: "decks-and-cards",
    title: "Decks and cards",
    description: "Create decks and add cards from Personal Dashboard.",
    guideIds: [
      "create-deck",
      "ai-created-cards",
      "manual-added-cards",
      "manual-add-mcq",
      "add-card-from-source",
    ],
  },
  {
    id: "team-tier",
    title: "Team Tier Plan",
    description:
      "Workspaces, members, study-mode privileges, AI Recall™, and quiz policy.",
    guideIds: [
      "create-workspace",
      "invite-unregistered-member",
      "link-deck-to-workspace",
      "assign-deck-to-member",
      "assign-deck-to-team-admin",
      "change-study-mode-privileges",
      "workspace-study-mode-settings",
      "ai-recall-session-cards",
      "quiz-formats-workspace",
      "quiz-timer-workspace",
      "quiz-schedule-workspace",
      "quiz-exam-mode-workspace",
      "quiz-results-workspace",
    ],
    nested: [
      {
        id: "team-tier-education-teacher",
        title: "Education Teacher",
        description:
          "Teacher Dashboard walkthroughs for Education Gold and Education Enterprise team plans.",
        guideIds: [
          "edu-teacher-dashboard",
          "edu-teacher-lesson-plan-owner",
          "edu-teacher-lesson-plan-owner-new-deck",
          "edu-teacher-quiz-owner-lesson-plan",
          "edu-teacher-quiz-owner-existing-deck",
          "edu-teacher-homework-owner-deck",
          "edu-teacher-homework-owner-lesson-plan",
          "edu-teacher-study-guide-owner-lesson-plan",
          "edu-teacher-worksheet-owner-lesson-plan",
          "edu-teacher-classes-owner",
          "edu-teacher-student-progress-owner",
          "edu-teacher-student-progress-add-student-owner",
          "edu-teacher-student-progress-quiz-result-owner",
        ],
      },
    ],
  },
];

export const DOCS_UI_GUIDE_ORDER: readonly DocsUiGuideId[] =
  DOCS_UI_GUIDE_CATEGORIES.flatMap((category) => [
    ...category.guideIds,
    ...(category.nested?.flatMap((group) => group.guideIds) ?? []),
  ]);

export type DocsUiGuideStep = {
  src: string;
  title: string;
  caption: string;
};

const UI_GUIDE_DIR = "/flipvise ui";

function uiSrc(filename: string): string {
  return encodeURI(`${UI_GUIDE_DIR}/${filename}`);
}

export const HOMEPAGE_SCREENSHOT = {
  src: uiSrc("01 Flipvise Homepage.png"),
  alt: "Flipvise homepage with Sign In, Sign Up, and documentation",
  title: "Homepage",
} as const;

export const SIGNUP_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc("02 Flipvise - Signup 01.png"),
    title: "Open Sign Up",
    caption: "Choose Sign Up and enter your first name, last name, email, and password.",
  },
  {
    src: uiSrc("02 Flipvise - Signup 02.png"),
    title: "Complete the form",
    caption: "Confirm your password, then select Continue.",
  },
  {
    src: uiSrc("02 Flipvise - Signup 03.png"),
    title: "Verify your email",
    caption: "Enter the six-digit verification code sent to your email.",
  },
  {
    src: uiSrc("02 Flipvise - Signup 04.png"),
    title: "Open the verification email",
    caption: "Copy the code from Flipvise Studio. Do not share this code.",
  },
  {
    src: uiSrc("02 Flipvise - Signup 05.png"),
    title: "Begin account details",
    caption: "Complete contact information first. Three short steps unlock your dashboard.",
  },
  {
    src: uiSrc("02 Flipvise - Signup 06.png"),
    title: "Add your mailing address",
    caption: "Enter phone number, street, country, region, city, and optional postal code.",
  },
  {
    src: uiSrc("02 Flipvise - Signup 07.png"),
    title: "Choose account type",
    caption: "Select the option that best describes how you use Flipvise.",
  },
  {
    src: uiSrc("02 Flipvise - Signup 08.png"),
    title: "Confirm account type",
    caption: "Review your selection, then continue to security questions.",
  },
  {
    src: uiSrc("02 Flipvise - Signup 09.png"),
    title: "Set security questions",
    caption: "Choose three different questions known only to you.",
  },
  {
    src: uiSrc("02 Flipvise - Signup 10.png"),
    title: "Save your answers",
    caption: "Enter an answer for each question, then save and continue.",
  },
  {
    src: uiSrc("02 Flipvise - Signup 11.png"),
    title: "Dashboard ready",
    caption: "Your personal dashboard opens. You can now create your first deck.",
  },
];

export const SIGNIN_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc("03 Flipvise - Signin 01.png"),
    title: "Open Sign In",
    caption: "From the homepage, choose Sign In to open the authentication dialog.",
  },
  {
    src: uiSrc("03 Flipvise - Signin 02 -1.png"),
    title: "Enter your credentials",
    caption: "Sign in with email and password, or continue with Apple or Google.",
  },
  {
    src: uiSrc("03 Flipvise - Signin 02 -2.png"),
    title: "Confirm your password",
    caption:
      "Enter the password for your account, then continue. You can also choose Use another method to sign in with Apple, Google, or an email code.",
  },
  {
    src: uiSrc("03 Flipvise - Signin 02 -2a.png"),
    title: "Use another method",
    caption: "If needed, switch to Apple, Google, or an email verification code.",
  },
  {
    src: uiSrc("03 Flipvise - Signin 02 -2b.png"),
    title: "Check your email",
    caption: "When using email code, wait for the message and enter the digits.",
  },
  {
    src: uiSrc("03 Flipvise - Signin 02 -2c.png"),
    title: "Open the verification email",
    caption: "Copy the code from Flipvise Studio. Do not share this code.",
  },
  {
    src: uiSrc("03 Flipvise - Signin 02 -2d.png"),
    title: "Submit the code",
    caption: "Enter the code in the dialog. Flipvise verifies it automatically.",
  },
  {
    src: uiSrc("03 Flipvise - Signin 02 -2e.png"),
    title: "Signed in",
    caption: "Your personal dashboard opens. Use the account menu to manage your profile.",
  },
];

export const PERSONAL_DASHBOARD_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc("04 Flipvise - Personal DB - 01.png"),
    title: "Personal Dashboard",
    caption:
      "This is your deck home. Review Free plan usage, View plans to upgrade, and the add-on chips in the header. Open the avatar menu for Manage account or Sign out. When the library is empty, choose Create your first deck.",
  },
  {
    src: uiSrc("04 Flipvise - Personal DB - 02.png"),
    title: "Inbox",
    caption:
      "Open Inbox from the header to read your welcome message, quiz results, billing notices, invites, and support replies. Use Back to dashboard when you are done.",
  },
  {
    src: uiSrc("04 Flipvise - Personal DB - 03.png"),
    title: "Help Center",
    caption:
      "Open Help Center from the header for Support, Bug Report, Feature Request, Feedback, Billing, Account, or My Tickets.",
  },
  {
    src: uiSrc("04 Flipvise - Personal DB - 04.png"),
    title: "Documentation and New Deck",
    caption:
      "The book icon in the header opens this user guide. Use + New Deck or Create your first deck to start a flashcard library.",
  },
  {
    src: uiSrc("04 Flipvise - Personal DB - 05.png"),
    title: "Open Manage account",
    caption:
      "Select your avatar again, then Manage account to review contact details, profile, security, appearance, and billing.",
  },
  {
    src: uiSrc("04 Flipvise - Personal DB - 06.png"),
    title: "Account details",
    caption:
      "Account details shows phone, mailing address, account type, and Security Q&A. Use Edit details to update them. Click the masked Security Q&A to verify and view your questions.",
  },
  {
    src: uiSrc("04 Flipvise - Personal DB - 07.png"),
    title: "Profile",
    caption:
      "Profile lets you update your name, manage email addresses, and connect another sign-in account.",
  },
  {
    src: uiSrc("04 Flipvise - Personal DB - 08.png"),
    title: "Security",
    caption:
      "Security lets you update your password, review active devices, and delete your account.",
  },
  {
    src: uiSrc("04 Flipvise - Personal DB - 09.png"),
    title: "Appearance",
    caption:
      "Choose Light or Dark theme, an interface color (Free includes three options; paid plans unlock more), and Microphone settings for study features such as voice input.",
  },
  {
    src: uiSrc("04 Flipvise - Personal DB - 10.png"),
    title: "Billing",
    caption:
      "Billing shows your current plan, View plans to upgrade, and plan history for subscriptions, add-ons, complimentary access, and affiliate grants.",
  },
];

export const PRICING_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc("05 Flipvise - Pricing - 01.png"),
    title: "Open Plans & Pricing",
    caption:
      "From Personal Dashboard, choose View plans on the upgrade card, or select your plan name in the header (Free plan — view pricing) to open /pricing.",
  },
  {
    src: uiSrc("05 Flipvise - Pricing - 02.png"),
    title: "Compare consumer plans",
    caption:
      "Toggle Monthly or Yearly, filter with View plans, and open Browse Add-on Catalog when it is published. Free, Pro, and Pro Plus list deck limits and features. Your current plan is marked. Pro Plus may offer a 7-day free trial on monthly billing.",
  },
  {
    src: uiSrc("05 Flipvise - Pricing - 03.png"),
    title: "Education Plus and team plans",
    caption:
      "Scroll for Education Plus (individual teachers), Team Basic, and Team Gold. Each card lists features and Change to… to start checkout.",
  },
  {
    src: uiSrc("05 Flipvise - Pricing - 04.png"),
    title: "Education Gold, Platinum, and Enterprise",
    caption:
      "Education Gold adds teacher collaboration and higher workspace limits. Platinum and Enterprise scale team workspaces and members for larger organizations.",
  },
  {
    src: uiSrc("05 Flipvise - Pricing - 05.png"),
    title: "Education Enterprise",
    caption:
      "Education Enterprise is the school tier — school administration tools plus the highest workspace and member limits. Choose Change to Education Enterprise to start checkout.",
  },
];

export const SUBSCRIBE_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc("06 Flipvise - Do A Subscribing - 01.png"),
    title: "Choose a plan",
    caption:
      "On /pricing, pick a paid card such as Education Plus. Choose Change to… or Subscribe now to open checkout review.",
  },
  {
    src: uiSrc("06 Flipvise - Do A Subscribing - 02.png"),
    title: "Review checkout",
    caption:
      "Confirm the plan name, Monthly or Yearly, and the price. Slide to continue to open Stripe Embedded Checkout.",
  },
  {
    src: uiSrc("06 Flipvise - Do A Subscribing - 03.png"),
    title: "Order summary",
    caption:
      "Secure Checkout shows the plan, billing period, and total due today. Account email is your signed-in Flipvise address for receipts.",
  },
  {
    src: uiSrc("06 Flipvise - Do A Subscribing - 04.png"),
    title: "Enter payment details",
    caption:
      "Add a genuine card (test numbers are not accepted), expiration, and security code. Keep Same as my Flipvise mailing address checked when that address is correct.",
  },
  {
    src: uiSrc("06 Flipvise - Do A Subscribing - 05.png"),
    title: "Name on payment method",
    caption:
      "Enter the name on the card. Slide to subscribe stays disabled until payment details, name, and billing address are complete.",
  },
  {
    src: uiSrc("06 Flipvise - Do A Subscribing - 06.png"),
    title: "Slide to subscribe",
    caption:
      "When the control is enabled, slide to subscribe to pay. You authorize Flipvise to charge you until you cancel.",
  },
  {
    src: uiSrc("06 Flipvise - Do A Subscribing - 07.png"),
    title: "Subscription active",
    caption:
      "You return to Personal Dashboard. The header shows your new plan. A toast confirms the subscription and that a notice was sent to Inbox.",
  },
  {
    src: uiSrc("06 Flipvise - Do A Subscribing - 08.png"),
    title: "Inbox confirmation",
    caption:
      "Open Inbox for Subscription confirmed and the paid invoice. Use Receipt on either item to open the Flipvise receipt.",
  },
  {
    src: uiSrc("06 Flipvise - Do A Subscribing - 09.png"),
    title: "Billing tab",
    caption:
      "Account menu → Billing shows the current plan as Active, Manage subscription, and Plan history with start and end dates.",
  },
  {
    src: uiSrc("06 Flipvise - Do A Subscribing - 10.png"),
    title: "Open the receipt link",
    caption:
      "In Plan history, scroll to Receipt and open the invoice number (for example WV99HW27-0001) to view the Flipvise receipt.",
  },
  {
    src: uiSrc("06 Flipvise - Do A Subscribing - 11.png"),
    title: "Download PDF",
    caption:
      "The on-screen receipt lists seller, bill-to, amount paid, and line items. Current receipts also show plan start, plan end, auto-renewal, and a Flipvise Team signature. Choose Download PDF to save a copy.",
  },
  {
    src: uiSrc("06 Flipvise - Do A Subscribing - 12.png"),
    title: "Save or open the file",
    caption:
      "Use the browser download bar to save Flipvise-receipt-….pdf to your computer, or open it in a new tab.",
  },
  {
    src: uiSrc("06 Flipvise - Do A Subscribing - 13.png"),
    title: "PDF receipt",
    caption:
      "The PDF matches the on-screen receipt: invoice number, date paid, line items, and amount paid. Current PDFs also list plan start, plan end, and auto-renewal, and close with Regards, Flipvise Team by Flipvise Studio LLC.",
  },
];

export const CREATE_DECK_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc("07 Flipvise - Create Deck From Personal DB - 01.png"),
    title: "Open New Deck",
    caption:
      "On Personal Dashboard, choose + New Deck (or Create your first deck when the library is empty).",
  },
  {
    src: uiSrc("07 Flipvise - Create Deck From Personal DB - 02.png"),
    title: "Fill in deck details",
    caption:
      "Enter a name/subject/course, description/topic, and optional grade and difficulty. You can add a cover image and a background gradient.",
  },
  {
    src: uiSrc("07 Flipvise - Create Deck From Personal DB - 03.png"),
    title: "Add an optional cover",
    caption:
      "Choose a cover image for the deck card on your dashboard. The cover is not a flashcard and does not count toward your cards-per-deck limit.",
  },
  {
    src: uiSrc("07 Flipvise - Create Deck From Personal DB - 04.png"),
    title: "Deck created",
    caption:
      "The new deck appears on Personal Dashboard. Open it to add flashcards or generate them with AI.",
  },
];

export const AI_CREATED_CARDS_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc("08 Flipvise - AI created cards - 01.png"),
    title: "Open the deck",
    caption:
      "On Personal Dashboard, click a deck tile once to open its menu. Choose Open deck to enter Deck Editor. Edit deck and Delete deck are also in this menu.",
  },
  {
    src: uiSrc("08 Flipvise - AI created cards - 02.png"),
    title: "Choose a batch size",
    caption:
      "In AI generation, open the count dropdown to pick how many cards to generate. Remaining slots and AI quota are shown above Generate.",
  },
  {
    src: uiSrc("08 Flipvise - AI created cards - 03.png"),
    title: "Generate the batch",
    caption:
      "Select a count (for example 5 cards through 50, limited by remaining slots), then choose Generate. AI matches your deck’s style and avoids duplicates.",
  },
  {
    src: uiSrc("08 Flipvise - AI created cards - 04.png"),
    title: "Review AI cards",
    caption:
      "New cards appear in the Cards list with an AI badge. Edit or Delete any card. AI quota and remaining slots update after generation.",
  },
];

export const MANUAL_ADDED_CARDS_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc("09 Flipvise - Manual added cards - 01.png"),
    title: "Open the deck",
    caption:
      "On Personal Dashboard, click a deck tile once to open its menu, then choose Open deck.",
  },
  {
    src: uiSrc("09 Flipvise - Manual added cards - 02.png"),
    title: "Add a card",
    caption:
      "In Deck Editor, choose + Add Card (or Add your first card when the list is empty).",
  },
  {
    src: uiSrc("09 Flipvise - Manual added cards - 03 - 1a.png"),
    title: "Use the Standard tab",
    caption:
      "Standard is for a single front-and-back card. Multiple Choice and From source are other formats in this dialog.",
  },
  {
    src: uiSrc("09 Flipvise - Manual added cards - 03 - 1b.png"),
    title: "Enter front and back",
    caption:
      "Type the front (question or term). Use the microphone for voice input, Add image for an optional picture on either side, and type the back or generate it with AI.",
  },
  {
    src: uiSrc("09 Flipvise - Manual added cards - 03 - 1c.png"),
    title: "Open Generate answer",
    caption:
      "Click the sparkle icon beside the front text to generate an answer that matches this deck’s topic, tone, and existing cards.",
  },
  {
    src: uiSrc("09 Flipvise - Manual added cards - 03 - 1d.png"),
    title: "Choose answer and image options",
    caption:
      "Place a decorative image on Front of card or Back of card, then pick Answer with diagram, Answer with image, or Answer only.",
  },
  {
    src: uiSrc("09 Flipvise - Manual added cards - 03 - 1e.png"),
    title: "Save the card",
    caption:
      "Review the generated back text and image, then choose Add Card to save it to the deck.",
  },
  {
    src: uiSrc("09 Flipvise - Manual added cards - 03 - 1f.png"),
    title: "Card in the list",
    caption:
      "The new Standard card appears in Cards. Hover to preview the answer. Manual count increases; AI-generated cards stay marked with the AI badge.",
  },
];

export const MANUAL_ADD_MCQ_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc("10 Flipvise - Manual Add MCQ - 01.png"),
    title: "Open the deck",
    caption:
      "On Personal Dashboard, click a deck tile once to open its menu, then choose Open deck.",
  },
  {
    src: uiSrc("10 Flipvise - Manual Add MCQ - 02.png"),
    title: "Add a card",
    caption: "In Deck Editor, choose + Add Card.",
  },
  {
    src: uiSrc("10 Flipvise - Manual Add MCQ - 03.png"),
    title: "Choose Multiple Choice",
    caption:
      "Select the Multiple Choice tab to write a question, one correct answer, and three required wrong answers.",
  },
  {
    src: uiSrc("10 Flipvise - Manual Add MCQ - 04.png"),
    title: "Enter the question",
    caption:
      "Type or dictate the question with the microphone. Then choose AI generate to fill the correct answer and three distractors — or type them yourself.",
  },
  {
    src: uiSrc("10 Flipvise - Manual Add MCQ - 05.png"),
    title: "Pick Answers + image or Answers only",
    caption:
      "Answers + image generates the correct answer, wrong answers, and a question illustration (saved when you add the card). Answers only fills the text fields.",
  },
  {
    src: uiSrc("10 Flipvise - Manual Add MCQ - 06.png"),
    title: "Review and save",
    caption:
      "Check the optional image, correct answer, and three wrong answers. Edit any field, then choose Add Card.",
  },
  {
    src: uiSrc("10 Flipvise - Manual Add MCQ - 07.png"),
    title: "MCQ in the list",
    caption:
      "The new card appears with an MC badge. Hover to preview the correct answer. Manual count increases.",
  },
];

export const ADD_CARD_FROM_SOURCE_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc("11 Flipvise - Add card from source - 01.png"),
    title: "Open the deck",
    caption:
      "On Personal Dashboard, click a deck tile once to open its menu, then choose Open deck.",
  },
  {
    src: uiSrc("11 Flipvise - Add card from source - 02.png"),
    title: "Add a card",
    caption: "In Deck Editor, choose + Add Card.",
  },
  {
    src: uiSrc("11 Flipvise - Add card from source - 03.png"),
    title: "Choose From source",
    caption:
      "Select the From source tab, then pick a source type: Website URL, Plain text, PDF, Word, PowerPoint, or Handwritten. AI reads the material once and does not store it.",
  },
  {
    src: uiSrc("11 Flipvise - Add card from source - 04.png"),
    title: "Website URL example",
    caption:
      "A public article or quiz page can be a Website URL source. Wikipedia and articles usually work best for URLs.",
  },
  {
    src: uiSrc("11 Flipvise - Add card from source - 05.png"),
    title: "Printed or PDF pages",
    caption:
      "Clear scans or photos of printed pages, textbooks, or PDF exports work as PDF or Handwritten uploads.",
  },
  {
    src: uiSrc("11 Flipvise - Add card from source - 06.png"),
    title: "Handwritten notes",
    caption:
      "Upload a clear photo (JPG, PNG, or WebP) of handwritten or printed notes when you choose Handwritten.",
  },
  {
    src: uiSrc("11 Flipvise - Add card from source - 07.png"),
    title: "Set count and generate for review",
    caption:
      "Choose how many cards to generate. Optionally check Reading passage + multiple choice so each front includes a short passage and question. Then choose Generate for review — cards are not saved yet.",
  },
  {
    src: uiSrc("11 Flipvise - Add card from source - 08.png"),
    title: "Unrelated source warning",
    caption:
      "If the upload does not match the deck name and topic, Flipvise warns you. Change source, or choose Generate anyway.",
  },
  {
    src: uiSrc("11 Flipvise - Add card from source - 09.png"),
    title: "Review drafted cards",
    caption:
      "Edit front, back, and quiz wrong answers before saving. Check a card to include it. With reading-passage mode, the front has a passage and question; the back holds the answer.",
  },
  {
    src: uiSrc("11 Flipvise - Add card from source - 10.png"),
    title: "Edit quiz wrong answers",
    caption:
      "Scroll each card to preview three quiz wrong answers. Edit the fields or use Regenerate to refresh them from AI.",
  },
  {
    src: uiSrc("11 Flipvise - Add card from source - 11.png"),
    title: "Swap and distractor side",
    caption:
      "Use Swap to flip front and back. Wrong answers from original front is off by default (distractors match the answer side). Turn it on after Swap when the saved back is the short term or question.",
  },
  {
    src: uiSrc("11 Flipvise - Add card from source - 12.png"),
    title: "Add selected cards",
    caption:
      "When the drafts look right, choose Add N selected to save the checked cards to the deck.",
  },
  {
    src: uiSrc("11 Flipvise - Add card from source - 13.png"),
    title: "Cards from source",
    caption:
      "Imported cards appear in the Cards list with an AI badge. Edit or Delete any card. Remaining slots update after you save.",
  },
];

export const CREATE_WORKSPACE_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc("13 Flipvise - Team Tier Plan - Create a new workspace - 01.png"),
    title: "Open Add Workspace",
    caption:
      "On Team Admin home, the selected workspace name appears as the subtitle and in the header switcher. Plan owners add another workspace with Add Workspace, or open Manage workspaces from the switcher.",
  },
  {
    src: uiSrc("13 Flipvise - Team Tier Plan - Create a new workspace - 02.png"),
    title: "Manage workspaces",
    caption:
      "Manage workspaces lists the workspaces you own (name, plan, rename, and delete) and a history of creates, renames, and deletes. Choose Add Workspace to open Create a team.",
  },
  {
    src: uiSrc("13 Flipvise - Team Tier Plan - Create a new workspace - 03.png"),
    title: "Choose who it is for",
    caption:
      "Pick Corporation or Government, Education Institution, Teacher or Tutor, Parent or Guardian, or Student or Study Group. That choice decides which details Flipvise uses for the suggested name.",
  },
  {
    src: uiSrc("13 Flipvise - Team Tier Plan - Create a new workspace - 04.png"),
    title: "Fill in the details",
    caption:
      "After you pick an option, fill every matching field (for Teacher or Tutor: level of education, school name, and class name). Use Change if you need a different option.",
  },
  {
    src: uiSrc("13 Flipvise - Team Tier Plan - Create a new workspace - 05.png"),
    title: "Review the name and create",
    caption:
      "Flipvise suggests an abbreviated workspace name from your details. You can edit that name, then choose Create team. Duplicate auto-generated names get a suffix such as -2.",
  },
  {
    src: uiSrc("13 Flipvise - Team Tier Plan - Create a new workspace - 06.png"),
    title: "New workspace listed",
    caption:
      "The new workspace appears in Your workspaces and in Workspace history. Back To Team Dashboard returns to Team Admin.",
  },
];

const INVITE_UNREGISTERED_MEMBER_FILE =
  "14 Flipvise - Team Tier Plan - Invite Unregistered Member A Workspace";

export const INVITE_UNREGISTERED_MEMBER_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc(`${INVITE_UNREGISTERED_MEMBER_FILE} - 01.png`),
    title: "Team Admin home",
    caption:
      "On Team Admin home, confirm the workspace name under the heading. The members table lists the owner. Use Team & members in the sidebar for roster, Send invite, Pending invitations, and Invitation history.",
  },
  {
    src: uiSrc(`${INVITE_UNREGISTERED_MEMBER_FILE} - 02.png`),
    title: "Send invite",
    caption:
      "Open Send invite. Choose the workspace, enter the invitee’s email and name, then pick Member or Team admin. Fill every field, then choose Send invitation. People without a Flipvise account get email; registered users see the invite in Inbox.",
  },
  {
    src: uiSrc(`${INVITE_UNREGISTERED_MEMBER_FILE} - 03.png`),
    title: "Copy the invitation link",
    caption:
      "After you send, Invitation link shows the /invite/team URL. Copy it if you need to share the link besides the email.",
  },
  {
    src: uiSrc(`${INVITE_UNREGISTERED_MEMBER_FILE} - 04.png`),
    title: "Pending invitations",
    caption:
      "Pending invitations lists open invites for this workspace. Use View URL to copy the link, or Revoke to withdraw it before it is accepted or expires.",
  },
  {
    src: uiSrc(`${INVITE_UNREGISTERED_MEMBER_FILE} - 05.png`),
    title: "Workspace history",
    caption:
      "Workspace history records when this workspace was created, renamed, or removed. Invitation status stays on Pending invitations and Invitation history.",
  },
  {
    src: uiSrc(`${INVITE_UNREGISTERED_MEMBER_FILE} - 06.png`),
    title: "Invitation email arrives",
    caption:
      "The invitee who does not yet have a Flipvise account receives email from Flipvise Studio, for example Invitation to join UC-K26.",
  },
  {
    src: uiSrc(`${INVITE_UNREGISTERED_MEMBER_FILE} - 07.png`),
    title: "Open Accept invitation",
    caption:
      "The email names the workspace and role. Choose Accept invitation, or paste the link into a browser. The invite expires in 3 days.",
  },
  {
    src: uiSrc(`${INVITE_UNREGISTERED_MEMBER_FILE} - 08.png`),
    title: "Accept on the invite page",
    caption:
      "You’re invited! shows the workspace and role. Sign in with the invited email, then choose Accept and join team. If another account is signed in, sign out and continue with the invited address.",
  },
  {
    src: uiSrc(`${INVITE_UNREGISTERED_MEMBER_FILE} - 09.png`),
    title: "Continue with the invited email",
    caption:
      "Clerk opens Continue to Flipvise Studio with the invited email filled in. Choose Continue to sign up or sign in.",
  },
  {
    src: uiSrc(`${INVITE_UNREGISTERED_MEMBER_FILE} - 10.png`),
    title: "Create a password",
    caption:
      "On Create your account, keep the invited email and set a password, then Continue. Sign up with a different email cannot accept this invite.",
  },
  {
    src: uiSrc(`${INVITE_UNREGISTERED_MEMBER_FILE} - 11.png`),
    title: "Verify your email",
    caption:
      "Enter the six-digit verification code sent to the invited address.",
  },
  {
    src: uiSrc(`${INVITE_UNREGISTERED_MEMBER_FILE} - 12.png`),
    title: "Copy the verification code",
    caption:
      "Open the Flipvise Studio verification email and copy the code. Do not share this code.",
  },
  {
    src: uiSrc(`${INVITE_UNREGISTERED_MEMBER_FILE} - 13.png`),
    title: "Account created",
    caption:
      "A Welcome to Flipvise toast confirms the new account. Return to You’re invited! and choose Accept and join team with the invited email.",
  },
  {
    src: uiSrc(`${INVITE_UNREGISTERED_MEMBER_FILE} - 14.png`),
    title: "Contact information",
    caption:
      "Complete account recovery step 1: phone number and mailing address, then Continue.",
  },
  {
    src: uiSrc(`${INVITE_UNREGISTERED_MEMBER_FILE} - 15.png`),
    title: "Account type",
    caption:
      "Step 2: choose how you use Flipvise (for example Student), then Continue.",
  },
  {
    src: uiSrc(`${INVITE_UNREGISTERED_MEMBER_FILE} - 16.png`),
    title: "Security questions",
    caption:
      "Step 3: choose three different security questions and answers known only to you, then Save and continue.",
  },
  {
    src: uiSrc(`${INVITE_UNREGISTERED_MEMBER_FILE} - 17.png`),
    title: "Personal Dashboard",
    caption:
      "The invitee’s Personal Dashboard opens on the Free plan. The account menu shows the invited email.",
  },
  {
    src: uiSrc(`${INVITE_UNREGISTERED_MEMBER_FILE} - 18.png`),
    title: "Open the invited workspace",
    caption:
      "In the workspace switcher, Invited workspaces lists the team (for example Team: UC-K26). Choose it to open Team Dashboard for that workspace.",
  },
  {
    src: uiSrc(`${INVITE_UNREGISTERED_MEMBER_FILE} - 19.png`),
    title: "Member on the roster",
    caption:
      "Back on Team Admin → Members roster, the owner sees the new member, role, and who added them.",
  },
];

const LINKING_DECK_TO_WORKSPACE_FILE =
  "15 Flipvise - Team Tier Plan - Linking Deck To Workspace";

export const LINKING_DECK_TO_WORKSPACE_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc(`${LINKING_DECK_TO_WORKSPACE_FILE} - 01.png`),
    title: "Open Assign decks",
    caption:
      "On Team Admin, open Deck Manager → Assign decks. Confirm the workspace under the heading and in Team workspace (for example UC-K26). Deck from Personal Dashboard is where the owner ties a personal deck to this workspace.",
  },
  {
    src: uiSrc(`${LINKING_DECK_TO_WORKSPACE_FILE} - 02.png`),
    title: "Choose a personal deck",
    caption:
      "Open Choose a personal deck to link. The list is the owner’s Personal Dashboard decks (for example Social Studies: British History and Math: Alegbra 1).",
  },
  {
    src: uiSrc(`${LINKING_DECK_TO_WORKSPACE_FILE} - 03.png`),
    title: "Decks on Personal Dashboard",
    caption:
      "Those decks live on the owner’s Personal Dashboard — create and edit them there, then return to Assign decks to link them. Card counts and names match what the picker shows.",
  },
  {
    src: uiSrc(`${LINKING_DECK_TO_WORKSPACE_FILE} - 04.png`),
    title: "Link deck to workspace",
    caption:
      "Select the deck (for example Social Studies: British History), then choose Link deck to workspace. Linking attaches it to this workspace so you can assign it to members or co-admins below.",
  },
  {
    src: uiSrc(`${LINKING_DECK_TO_WORKSPACE_FILE} - 05.png`),
    title: "Already linked",
    caption:
      "Linked decks show (already linked) in the picker. Unlinked decks stay listed without that label. Assign deck and Remove assignment appear once a workspace-linked deck is available.",
  },
];

const ASSIGN_DECK_TO_MEMBER_FILE =
  "16 Flipvise - Team Tier Plan - Assign Deck to Member in a Workspace";

export const ASSIGN_DECK_TO_MEMBER_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc(`${ASSIGN_DECK_TO_MEMBER_FILE} - 01.png`),
    title: "Linked deck ready to assign",
    caption:
      "On Team Admin → Assign decks, confirm the workspace (for example UC-K26). Deck from Personal Dashboard is only for linking or unlinking. Once a deck is linked, use Member or co-admin and Deck below to assign it.",
  },
  {
    src: uiSrc(`${ASSIGN_DECK_TO_MEMBER_FILE} - 02.png`),
    title: "Choose member, deck, and study modes",
    caption:
      "Select the workspace, a member or co-admin (for example williams.bruce2698), a linked deck (for example Social Studies: British History), and Study modes. Default is all — Standard Review, AI Recall™, and Quiz.",
  },
  {
    src: uiSrc(`${ASSIGN_DECK_TO_MEMBER_FILE} - 03.png`),
    title: "Assign deck",
    caption:
      "Study modes lists single modes and combinations (Standard Review only, AI Recall™ only, Quiz only, or pairs, or all three). Choose Assign deck to give that member access in this workspace.",
  },
  {
    src: uiSrc(`${ASSIGN_DECK_TO_MEMBER_FILE} - 04.png`),
    title: "Assignment recorded",
    caption:
      "Assignments by member lists the member, decks allowed for Education Gold / Enterprise team admins, deck, workspace, who signed, and when. Update assignment changes study modes. Remove assignment takes the deck off that member’s Team Dashboard — it stays linked to the workspace. Team admins can remove an assignment only when they invited that member (Added by); the workspace owner can remove any assignment.",
  },
  {
    src: uiSrc(`${ASSIGN_DECK_TO_MEMBER_FILE} - 05.png`),
    title: "Member opens the workspace",
    caption:
      "The member signs in and opens the workspace switcher. Under Invited workspaces, choose the team (for example Team: UC-K26) to open Team Dashboard.",
  },
  {
    src: uiSrc(`${ASSIGN_DECK_TO_MEMBER_FILE} - 06.png`),
    title: "Assigned deck on Team Dashboard",
    caption:
      "Team Dashboard shows the workspace name and the plan owner. Assigned decks appear here (for example Social Studies: British History). The account menu is the member’s email.",
  },
  {
    src: uiSrc(`${ASSIGN_DECK_TO_MEMBER_FILE} - 07.png`),
    title: "Open the deck menu",
    caption:
      "Click the deck once to open its menu. Assigned members see Study and Preview cards.",
  },
  {
    src: uiSrc(`${ASSIGN_DECK_TO_MEMBER_FILE} - 08.png`),
    title: "Preview cards",
    caption:
      "Preview cards opens a full-screen walkthrough of the deck (question and answer) without starting a study session. Close returns to Team Dashboard.",
  },
  {
    src: uiSrc(`${ASSIGN_DECK_TO_MEMBER_FILE} - 09.png`),
    title: "Start Study",
    caption:
      "From the same deck menu, choose Study to open the study session for this assigned deck.",
  },
  {
    src: uiSrc(`${ASSIGN_DECK_TO_MEMBER_FILE} - 10.png`),
    title: "Study modes in the session",
    caption:
      "The study page shows the deck and the modes granted on the assignment — Standard Review, AI Recall™, and Quiz when all were selected. The member studies from their own account.",
  },
];

const ASSIGN_DECK_TO_TEAM_ADMIN_FILE =
  "16 Flipvise - Team Tier Plan - Assign Deck to Team Admin in a Workspace";

export const ASSIGN_DECK_TO_TEAM_ADMIN_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc(`${ASSIGN_DECK_TO_TEAM_ADMIN_FILE} - 01.png`),
    title: "Assign a deck and set the create limit",
    caption:
      "On Team Admin → Assign decks, choose the workspace (for example UC-K26). Select Member or co-admin (for example Teddy Watt). For Education Gold / Enterprise, Decks this team admin may create appears — enter a cap (for example 5) and Save create limit. Choose a linked deck (for example Social Studies: British History) and Study modes (for example AI Recall™ and Quiz), then Assign deck.",
  },
  {
    src: uiSrc(`${ASSIGN_DECK_TO_TEAM_ADMIN_FILE} - 02.png`),
    title: "Confirm the team admin on the roster",
    caption:
      "Team Admin home → Members roster lists the co-admin (for example Teddy Watt) with Role team_admin and Added by (inviter). Workspace overview Decks shows used versus allowed on the plan (for example 2 / 15 on Education Gold).",
  },
  {
    src: uiSrc(`${ASSIGN_DECK_TO_TEAM_ADMIN_FILE} - 03.png`),
    title: "Assignment recorded for the team admin",
    caption:
      "Assignments by member lists the team admin row — member, deck (for example Social Studies: British History), workspace (for example UC-K26), who signed, and when. Click a row to load it into the form above.",
  },
];

const CHANGE_STUDY_MODE_PRIVILEGES_FILE =
  "17 Flipvise - Team Tier Plan - Change Study Mode Privileges From Workspace Member";

export const CHANGE_STUDY_MODE_PRIVILEGES_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc(`${CHANGE_STUDY_MODE_PRIVILEGES_FILE} - 01.png`),
    title: "Open Study privileges",
    caption:
      "On Team Admin, open Deck Manager → Study privileges. Member study modes lists every assignment in a table (member, deck, workspace, and access granted).",
  },
  {
    src: uiSrc(`${CHANGE_STUDY_MODE_PRIVILEGES_FILE} - 02.png`),
    title: "Open an assignment",
    caption:
      "Click a row to open that assignment. The panel shows the member, deck, workspace, access granted, Study modes, and Save changes.",
  },
  {
    src: uiSrc(`${CHANGE_STUDY_MODE_PRIVILEGES_FILE} - 03.png`),
    title: "Choose study modes",
    caption:
      "Open Study modes and pick a single mode or a combination (Standard Review, AI Recall™, Quiz, or pairs, or all three). Then choose Save changes. Updates apply on the member’s next study session.",
  },
  {
    src: uiSrc(`${CHANGE_STUDY_MODE_PRIVILEGES_FILE} - 04.png`),
    title: "Access granted updates",
    caption:
      "After you save, Access granted in the table and in the open panel match the new set (for example AI Recall™ & Quiz). You can change modes again and Save changes.",
  },
  {
    src: uiSrc(`${CHANGE_STUDY_MODE_PRIVILEGES_FILE} - 05.png`),
    title: "Member sees the new modes",
    caption:
      "When the member opens Study for that deck, only the granted modes appear (for example AI Recall™ and Quiz). Standard Review is hidden if it was removed.",
  },
];

const WORKSPACE_STUDY_MODE_SETTINGS_FILE =
  "18 Flipvise - Team Tier Plan - AI-Recall Study Mode Control and Settings for Workspace";

export const WORKSPACE_STUDY_MODE_SETTINGS_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc(`${WORKSPACE_STUDY_MODE_SETTINGS_FILE} - 01.png`),
    title: "Open Active Recall Performance",
    caption:
      "On Team Admin, open Study Modes → Active Recall Mode → Performance. Review saved AI Recall™ results for the workspace (for example UC-K26). Performance and Session cards sit under Active Recall Mode.",
  },
  {
    src: uiSrc(`${WORKSPACE_STUDY_MODE_SETTINGS_FILE} - 02.png`),
    title: "Empty insights until a session is saved",
    caption:
      "Key indicators and Where to focus next stay empty until a member completes and saves an AI Recall™ session. Most missed cards, most missed decks, top learners, and weakest subjects fill in from saved results.",
  },
  {
    src: uiSrc(`${WORKSPACE_STUDY_MODE_SETTINGS_FILE} - 03.png`),
    title: "Member starts AI Recall™",
    caption:
      "A workspace member opens an assigned deck (for example Social Studies: British History), chooses AI Recall™, checks cards this session and cards in the deck, then Ready to start.",
  },
  {
    src: uiSrc(`${WORKSPACE_STUDY_MODE_SETTINGS_FILE} - 04.png`),
    title: "Session complete",
    caption:
      "When the session finishes, the member sees reviewed, correct, incorrect, and forced unlocks, plus a session score. Results save to Active Recall analytics and the member’s inbox.",
  },
  {
    src: uiSrc(`${WORKSPACE_STUDY_MODE_SETTINGS_FILE} - 05.png`),
    title: "Performance updates",
    caption:
      "Back on Team Admin → Active Recall Mode → Performance, Key indicators update (team recall accuracy, average AI score, and average session time). Track members and decks appears below.",
  },
  {
    src: uiSrc(`${WORKSPACE_STUDY_MODE_SETTINGS_FILE} - 06.png`),
    title: "Monitor decks",
    caption:
      "In Saved session monitor, open Decks to see each deck with saved sessions (for example Social Studies: British History — sessions, members, accuracy, average AI score, misses, and last session). Instructional insights list missed cards, missed decks, top learners, and weakest subjects.",
  },
  {
    src: uiSrc(`${WORKSPACE_STUDY_MODE_SETTINGS_FILE} - 07.png`),
    title: "Monitor members",
    caption:
      "Open Members and click a learner (for example williams.bruce2698) to expand that person’s saved session — date, deck, accuracy, AI score, time, cards, correct, and misses.",
  },
];

const AI_RECALL_SESSION_CARDS_FILE =
  "19 Flipvise - Team Tier Plan - Study Mode AI-Recall Session Card for Workspace";

export const AI_RECALL_SESSION_CARDS_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc(`${AI_RECALL_SESSION_CARDS_FILE} - 01.png`),
    title: "Open Session cards",
    caption:
      "On Team Admin, open Study Modes → Active Recall Mode → Session cards. Set a workspace default and optional per-deck overrides for how many cards members see in each AI Recall™ session (for example workspace UC-K26).",
  },
  {
    src: uiSrc(`${AI_RECALL_SESSION_CARDS_FILE} - 02.png`),
    title: "Workspace default and per-deck overrides",
    caption:
      "Workspace default applies to linked decks without an override (All cards in the deck, or a fixed number per session). Per-deck overrides can use the workspace default, all cards in that deck, or a fixed count for one deck (for example Social Studies: British History).",
  },
  {
    src: uiSrc(`${AI_RECALL_SESSION_CARDS_FILE} - 03.png`),
    title: "Save a deck override",
    caption:
      "Choose Fixed number of cards for that deck, enter the count (for example 5), then Save deck. A confirmation shows the override (for example 5 cards per session).",
  },
  {
    src: uiSrc(`${AI_RECALL_SESSION_CARDS_FILE} - 04.png`),
    title: "Member sees the new count",
    caption:
      "When the member opens AI Recall™ on that deck, Cards this session matches the override (for example 5) and Cards in deck still shows the full deck size (for example 10).",
  },
];

const QUIZ_FORMATS_WORKSPACE_FILE =
  "20 Flipvise - Team Tier Plan - Study Mode Quiz Format for Workspace";

export const QUIZ_FORMATS_WORKSPACE_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc(`${QUIZ_FORMATS_WORKSPACE_FILE} - 01.png`),
    title: "Open Quiz formats",
    caption:
      "On Team Admin, open Study Modes → Quiz Mode → Quiz formats. Choose question types, set questions per format, and publish the quiz mix for workspace decks (for example UC-K26).",
  },
  {
    src: uiSrc(`${QUIZ_FORMATS_WORKSPACE_FILE} - 02.png`),
    title: "Workspace defaults and per-deck overrides",
    caption:
      "Workspace defaults apply to linked decks that inherit settings (multiple choice, true/false, fill in the blank). Shuffle card order gives each assignee a unique sequence. Per-deck overrides can set formats for one deck (for example Social Studies: British History).",
  },
  {
    src: uiSrc(`${QUIZ_FORMATS_WORKSPACE_FILE} - 03.png`),
    title: "Save a deck’s formats",
    caption:
      "Uncheck Use workspace defaults to set formats for that deck. Enable the types you want, then Save deck formats before entering question counts.",
  },
  {
    src: uiSrc(`${QUIZ_FORMATS_WORKSPACE_FILE} - 04.png`),
    title: "Set counts and generate AI sentences",
    caption:
      "Enter Questions per format so the total is within the deck size (for example 5 multiple choice, 3 true/false, 2 fill in the blank on a 10-card deck). Then Generate AI quiz sentences when true/false or fill-in-the-blank still need content.",
  },
  {
    src: uiSrc(`${QUIZ_FORMATS_WORKSPACE_FILE} - 05.png`),
    title: "Preview and republish",
    caption:
      "When counts are valid and AI content is ready, Preview shows how each card will appear. Republish to quiz replaces the published mix so members see it on their next quiz.",
  },
  {
    src: uiSrc(`${QUIZ_FORMATS_WORKSPACE_FILE} - 06.png`),
    title: "Preview multiple choice",
    caption:
      "In Quiz format preview, multiple choice shows What quiz takers see (for example Battle of Hastings with options A–D, and the correct option marked). The original card question and MCQ options stay preserved underneath. Close returns to Quiz formats.",
  },
  {
    src: uiSrc(`${QUIZ_FORMATS_WORKSPACE_FILE} - 07.png`),
    title: "Preview true/false",
    caption:
      "In Quiz format preview, true/false shows What quiz takers see and the answer. The original card question and MCQ options stay preserved. Choose Edit to change only the quiz format on that card.",
  },
  {
    src: uiSrc(`${QUIZ_FORMATS_WORKSPACE_FILE} - 08.png`),
    title: "Preview fill-in-the-blank",
    caption:
      "Fill in the blank shows the generated prompt (with a blank) and accepted answers, plus the original card question and MCQ options. Close returns to Quiz formats.",
  },
  {
    src: uiSrc(`${QUIZ_FORMATS_WORKSPACE_FILE} - 09.png`),
    title: "Republish the mix",
    caption:
      "After preview, Republish to quiz publishes the mix (for example 5 multiple choice, 3 true/false, 2 fill-in-the-blank). Members see this mix the next time they start Quiz.",
  },
  {
    src: uiSrc(`${QUIZ_FORMATS_WORKSPACE_FILE} - 10.png`),
    title: "Member sees the published formats",
    caption:
      "When the member opens Quiz on that deck, Timed quiz lists the formats in this quiz (for example 5 multiple choice, 3 true/false, 2 fill-in-the-blank) and Start quiz.",
  },
];

const QUIZ_TIMER_WORKSPACE_FILE =
  "21 Flipvise - Team Tier Plan - Study Mode Quiz Timer for Workspace";

export const QUIZ_TIMER_WORKSPACE_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc(`${QUIZ_TIMER_WORKSPACE_FILE} - 01.png`),
    title: "Open Quiz timer",
    caption:
      "On Team Admin, open Study Modes → Quiz Mode → Quiz timer. Set a general quiz time for linked decks, or choose timed-quiz minutes for each deck (for example UC-K26). Factory default is 10 minutes.",
  },
  {
    src: uiSrc(`${QUIZ_TIMER_WORKSPACE_FILE} - 02.png`),
    title: "Workspace-wide time or a per-deck row",
    caption:
      "Turn on Use one quiz time for all decks linked to each workspace to apply Quick Presets to every linked deck, then Save general quiz time for linked decks. Deck quiz timers lists every linked deck; click a row (for example Social Studies: British History) to set a timed-quiz length for that deck.",
  },
  {
    src: uiSrc(`${QUIZ_TIMER_WORKSPACE_FILE} - 03.png`),
    title: "Save a deck timer",
    caption:
      "Choose a Quick Preset for that deck (for example 20 minutes), then Save deck timer. A confirmation shows Deck quiz timer updated. Use workspace default clears the custom override.",
  },
  {
    src: uiSrc(`${QUIZ_TIMER_WORKSPACE_FILE} - 04.png`),
    title: "Member sees the clock",
    caption:
      "When the member opens Quiz on that deck, Timed quiz shows the limit on the clock (for example 10 questions · 20:00 on the clock) and Start quiz.",
  },
];

const QUIZ_SCHEDULE_WORKSPACE_FILE =
  "22 Flipvise - Team Tier Plan - Study Mode Quiz Schedule for Workspace";

export const QUIZ_SCHEDULE_WORKSPACE_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc(`${QUIZ_SCHEDULE_WORKSPACE_FILE} - 01.png`),
    title: "Open Quiz schedule",
    caption:
      "On Team Admin, open Study Modes → Quiz Mode → Quiz schedule. Configure when quizzes may start for this workspace (for example UC-K26), for every linked deck or for one deck.",
  },
  {
    src: uiSrc(`${QUIZ_SCHEDULE_WORKSPACE_FILE} - 02.png`),
    title: "Workspace or per-deck start times",
    caption:
      "Turn on scheduling for the workspace to set one start date and time for every quiz, then Save schedule. Deck quiz start overrides that for a single deck (for example Social Studies: British History). When a deck schedule is off, the workspace schedule applies.",
  },
  {
    src: uiSrc(`${QUIZ_SCHEDULE_WORKSPACE_FILE} - 03.png`),
    title: "Save a deck schedule",
    caption:
      "Enable the deck toggle, choose Start date & time (for example Oct 5, 2026, 11:40 AM), then Save schedule. A confirmation shows Schedule saved. Members cannot start that deck’s quiz until this moment.",
  },
  {
    src: uiSrc(`${QUIZ_SCHEDULE_WORKSPACE_FILE} - 04.png`),
    title: "Member waits until unlock",
    caption:
      "When the member opens Quiz on that deck, Timed quiz shows Quiz unlocks with the date and time (for example Oct 5, 2026, 11:40 AM) and a countdown. Start quiz stays greyed out until that time, unless a team admin or owner enables it.",
  },
];

const QUIZ_EXAM_MODE_WORKSPACE_FILE =
  "23 Flipvise - Team Tier Plan - Study Mode Quiz Exam Mode for Workspace";

export const QUIZ_EXAM_MODE_WORKSPACE_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc(`${QUIZ_EXAM_MODE_WORKSPACE_FILE} - 01.png`),
    title: "Open Exam Mode",
    caption:
      "On Team Admin, open Study Modes → Quiz Mode → Exam Mode. Manage quiz lock settings and review locked sessions for this workspace (for example UC-K26). Members on a quiz in Exam Mode cannot switch tabs or leave until they submit.",
  },
  {
    src: uiSrc(`${QUIZ_EXAM_MODE_WORKSPACE_FILE} - 02.png`),
    title: "Workspace Exam Mode and who it applies to",
    caption:
      "Select the workspace, then turn on Workspace Exam Mode so every linked deck uses this default unless a deck has its own setting. Apply Exam Mode to Plan owner, Team Admin, and/or Member. Only the plan owner can enable or disable Exam Mode for the plan owner.",
  },
  {
    src: uiSrc(`${QUIZ_EXAM_MODE_WORKSPACE_FILE} - 03.png`),
    title: "Confirm each member’s role",
    caption:
      "On Members roster, check Role so you know who Exam Mode will apply to (for example Owner (subscriber), Member, or Team admin).",
  },
  {
    src: uiSrc(`${QUIZ_EXAM_MODE_WORKSPACE_FILE} - 04.png`),
    title: "Deck Exam Mode",
    caption:
      "Deck Exam Mode sets Exam Mode for one linked deck (for example Social Studies: British History). Decks without a custom setting use the workspace default above.",
  },
  {
    src: uiSrc(`${QUIZ_EXAM_MODE_WORKSPACE_FILE} - 05.png`),
    title: "Member sees Exam Mode on",
    caption:
      "When a member (for example williams.bruce2698) opens Quiz on that deck, Timed quiz shows a green Exam Mode on light and: Exam Mode is on. Stay on this tab until you submit — leaving will lock your session.",
  },
  {
    src: uiSrc(`${QUIZ_EXAM_MODE_WORKSPACE_FILE} - 06.png`),
    title: "Locked & terminated sessions",
    caption:
      "Locked & terminated sessions lists members who left a quiz, finished and need a redo, or were terminated. Continue lets them resume, Start over is a fresh attempt, and Terminate ends an active lock. The table stays empty until one of those events happens.",
  },
  {
    src: uiSrc(`${QUIZ_EXAM_MODE_WORKSPACE_FILE} - 07.png`),
    title: "Start the Exam Mode quiz",
    caption:
      "The member chooses Start quiz on Timed quiz to begin. They must stay on this tab until they submit.",
  },
  {
    src: uiSrc(`${QUIZ_EXAM_MODE_WORKSPACE_FILE} - 08.png`),
    title: "Stay on the quiz",
    caption:
      "While answering, the member remains on the quiz (timer and questions). Opening another page, tab, or window can lock them out until a team admin or plan owner grants access.",
  },
  {
    src: uiSrc(`${QUIZ_EXAM_MODE_WORKSPACE_FILE} - 09.png`),
    title: "Grant Continue after a lock",
    caption:
      "When a member leaves, Locked & terminated sessions lists them (for example williams.bruce2698 on Social Studies: British History) with Status Locked. Continue lets them resume where they stopped; Terminate ends the session. Only a team admin or plan owner can grant access.",
  },
  {
    src: uiSrc(`${QUIZ_EXAM_MODE_WORKSPACE_FILE} - 10.png`),
    title: "Member sees Quiz paused",
    caption:
      "The member sees Quiz paused: You left the quiz window. Your session is locked until your team admin grants access. After Continue is granted, they choose Check for access to resume.",
  },
  {
    src: uiSrc(`${QUIZ_EXAM_MODE_WORKSPACE_FILE} - 11.png`),
    title: "Continue granted",
    caption:
      "After Continue, Status shows Continue granted — the member can resume after Check for access. Terminate is still available.",
  },
  {
    src: uiSrc(`${QUIZ_EXAM_MODE_WORKSPACE_FILE} - 12.png`),
    title: "Member resumes the quiz",
    caption:
      "Once access is restored, the member sees Resume quiz with remaining time and prior answers, then Resume quiz to continue from where they left off.",
  },
  {
    src: uiSrc(`${QUIZ_EXAM_MODE_WORKSPACE_FILE} - 13.png`),
    title: "Active quizzes stay off the table",
    caption:
      "While a member is actively taking the quiz, their row does not appear in Locked & terminated sessions until they leave, finish, or are terminated.",
  },
  {
    src: uiSrc(`${QUIZ_EXAM_MODE_WORKSPACE_FILE} - 14.png`),
    title: "Terminate a session",
    caption:
      "Terminate immediately ends that member’s quiz. They cannot resume or retake until a team admin or plan owner grants Start over.",
  },
  {
    src: uiSrc(`${QUIZ_EXAM_MODE_WORKSPACE_FILE} - 15.png`),
    title: "Session terminated",
    caption:
      "Status shows Terminated with Session terminated. Start over grants a fresh attempt.",
  },
  {
    src: uiSrc(`${QUIZ_EXAM_MODE_WORKSPACE_FILE} - 16.png`),
    title: "Member sees Quiz terminated",
    caption:
      "The member sees Quiz terminated: This quiz was ended by your team admin. After Start over is granted, they choose Check for access; otherwise they can return to Dashboard.",
  },
  {
    src: uiSrc(`${QUIZ_EXAM_MODE_WORKSPACE_FILE} - 17.png`),
    title: "Grant Start over",
    caption:
      "Start over lets the member begin a new quiz with full time. Only a team admin or plan owner can grant it.",
  },
  {
    src: uiSrc(`${QUIZ_EXAM_MODE_WORKSPACE_FILE} - 18.png`),
    title: "Start over granted",
    caption:
      "Status shows Start over granted — the member can begin a fresh quiz after Check for access. Terminate is still available.",
  },
  {
    src: uiSrc(`${QUIZ_EXAM_MODE_WORKSPACE_FILE} - 19.png`),
    title: "Member starts over",
    caption:
      "The member sees Start over with full time (for example 20:00 on the clock) and Start over. Exam Mode is still on. Stay on this tab until you submit — leaving will lock your session.",
  },
  {
    src: uiSrc(`${QUIZ_EXAM_MODE_WORKSPACE_FILE} - 20.png`),
    title: "Confirm the grant",
    caption:
      "Locked & terminated sessions still shows Start over granted until the member starts the new attempt. Terminate remains available if you need to end that grant.",
  },
];

const QUIZ_RESULTS_WORKSPACE_FILE =
  "24 Flipvise - Team Tier Plan - Study Mode Quiz Results for Workspace";

export const QUIZ_RESULTS_WORKSPACE_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc(`${QUIZ_RESULTS_WORKSPACE_FILE} - 01.png`),
    title: "Open Quiz results",
    caption:
      "On Team Admin, open Study Modes → Quiz Mode → Quiz results. Review member quiz attempts across your workspaces (for example UC-K26). The table lists saved attempts by workspace and member (for example williams.bruce2698 on Social Studies: British History) with score, correct, wrong, skipped, and cards.",
  },
  {
    src: uiSrc(`${QUIZ_RESULTS_WORKSPACE_FILE} - 02.png`),
    title: "View or delete an attempt",
    caption:
      "Use View to expand full details below the table, or Delete to remove the record. Double-click a row to open the quiz question sheet and answer key.",
  },
  {
    src: uiSrc(`${QUIZ_RESULTS_WORKSPACE_FILE} - 03.png`),
    title: "Quiz sheets",
    caption:
      "Quiz sheets shows Question sheet and Answer key for that attempt (for example Social Studies: British History). Download question sheet, Close, or Save to resources. Double-click a result row anytime to reopen these sheets.",
  },
  {
    src: uiSrc(`${QUIZ_RESULTS_WORKSPACE_FILE} - 04.png`),
    title: "Member sees the saved result",
    caption:
      "When the member finishes Quiz, they see their score (for example Nice Progress!, 50 / 100, 5 Correct, 2 Incorrect, 3 Unanswered) and Result saved — check your inbox; your team owner was notified.",
  },
  {
    src: uiSrc(`${QUIZ_RESULTS_WORKSPACE_FILE} - 05.png`),
    title: "Member Review",
    caption:
      "Review lists each question as correct, incorrect, or unanswered, with Your answer and the Correct answer on missed or unanswered items.",
  },
];

const EDU_TEACHER_DASHBOARD_FILE =
  "25 Flipvise - Team Tier Edu Plan - Teacher DB";

export const EDU_TEACHER_DASHBOARD_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc(`${EDU_TEACHER_DASHBOARD_FILE} - 01.png`),
    title: "Open Teacher Dashboard",
    caption:
      "On the plan owner’s Personal Dashboard (for example John Brown on Education Gold), open the workspace switcher. Personal Dash is the current workspace. Teacher Dash opens the Teacher Dashboard. Team Admin Dash is listed too, because this Education Gold subscription includes both. Personal decks stay on this dashboard (for example Social Studies: British History).",
  },
  {
    src: uiSrc(`${EDU_TEACHER_DASHBOARD_FILE} - 02.png`),
    title: "Teacher Dashboard for the workspace",
    caption:
      "Teacher Dashboard shows the Education Gold badge for the selected workspace (UC-K26). Personal Dashboard and Team Admin Dashboard are at the top. The sidebar groups AI content tools (AI Lesson Builder, AI Quiz/Test Generator, Homework Generator, Study Guide Generator, Worksheet Generator, and AI Document Studio), Classroom management (Classes and Student Progress), and Resources (Teacher Resource Library). Using your teacher tools walks through three steps: select a tool, link source decks, then generate, refine, and save.",
  },
];

const EDU_TEACHER_LESSON_PLAN_OWNER_FILE =
  "26 Flipvise - Team Tier Edu Plan - Teacher DB AI-Lesson Plan owner";

export const EDU_TEACHER_LESSON_PLAN_OWNER_GUIDE_STEPS: readonly DocsUiGuideStep[] =
  [
    {
      src: uiSrc(`${EDU_TEACHER_LESSON_PLAN_OWNER_FILE} - 01.png`),
      title: "Open AI Lesson Builder",
      caption:
        "On Teacher Dashboard, open AI Lesson Builder. Save to deck is set to Existing deck for workspace UC-K26 (Education Gold). Subject, Topic, Grade Level, Lesson Duration, Plan Period, Difficulty, Learning Standard, Class Size, special needs, and reference material (Website URL, Plain text, PDF, Word, PowerPoint, Handwritten) are on the form.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_LESSON_PLAN_OWNER_FILE} - 02.png`),
      title: "Choose whose decks to use",
      caption:
        "Workspace owner or team admin is how the plan owner picks decks for the lesson plan. The owner can use their own personal decks and team decks that a team admin created on the Team Dashboard. A team admin’s personal decks stay private to that member.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_LESSON_PLAN_OWNER_FILE} - 03.png`),
      title: "Owner and team admin records",
      caption:
        "Open Workspace owner or team admin. The list shows the subscriber (owner) record, for example John Brown — Workspace owner, and the team admin record, for example Teddy Watt. The workspace selector still shows UC-K26.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_LESSON_PLAN_OWNER_FILE} - 04.png`),
      title: "Select the team admin’s deck",
      caption:
        "With the team admin selected (Teddy Watt) and Existing deck still on, open Deck and choose that admin’s team deck (for example Science : Environmental Science — Air pollution LP Day 1). Selecting the deck fills the fields below from the deck.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_LESSON_PLAN_OWNER_FILE} - 05.png`),
      title: "Review the filled form and Generate",
      caption:
        "The deck fills Subject (Science : Environmental Science), Topic (Air pollution), Grade Level (grade 7), Lesson Duration (45 minutes), Plan Period (3 days), Difficulty (Intermediate), and Learning Standard (NGSS). Each field has a help icon. Learning Standard steers the curriculum framework. Special need or Accommodations (for example large print and reading support) and reference material (Website URL, Plain text, PDF, Word, PowerPoint, Handwritten) give the AI more context. When the required fields are complete, choose Generate.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_LESSON_PLAN_OWNER_FILE} - 06.png`),
      title: "Preview the generated plan",
      caption:
        "The generated plan appears under Generate (for example Understanding Air Pollution, a 3-day unit, 45 minutes per class), with learning objectives, materials, and the daily schedule. Preview is the current view. Edit changes the plan before you save. Regenerate builds a new version from the same inputs. Save Lesson Plan stores it in the Teacher Resource Library. Download PDF saves a summary. Download vocabulary PDF saves the plan with expanded vocabulary.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_LESSON_PLAN_OWNER_FILE} - 07.png`),
      title: "Objectives, materials, and vocabulary",
      caption:
        "Learning Objectives and Materials Needed recommend what students should achieve and which resources support the class. Re-expand all day vocabulary (AI) writes a deeper explanation of every vocabulary term (context, definitions, and examples). View detail opens that expanded vocabulary for the day.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_LESSON_PLAN_OWNER_FILE} - 08.png`),
      title: "Daily schedule",
      caption:
        "Each day has the same layout: a weekday, Daily focus, Vocabulary, and Class timeline sized to the lesson length (for example 45 minutes). Day 1 does not have to stay Monday — set the weekday to the day you will teach (Day 1 on Wednesday, Day 2 on Friday, and so on). Focus, vocabulary, and activities can differ by day.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_LESSON_PLAN_OWNER_FILE} - 09.png`),
      title: "Full-unit overview",
      caption:
        "Further down, the plan gives a full-unit overview: vocabulary for the unit, unit pacing, warm-up, main teaching steps, classroom activity, assessment questions, homework, differentiated instruction, and teacher notes. Use it as the delivery guide, and adjust activities and accommodations for the class.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_LESSON_PLAN_OWNER_FILE} - 10.png`),
      title: "What each closing section is for",
      caption:
        "Vocabulary (full unit) lists terms for the whole unit. Unit pacing overview spreads topics across the teaching days. Warm-Up activates prior knowledge. Main Teaching Steps is the instructional sequence. Classroom Activity is student practice. Assessment Questions check understanding. Homework reinforces learning outside class. Differentiated Instruction offers supports for different needs. Teacher Notes add standards alignment and delivery guidance.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_LESSON_PLAN_OWNER_FILE} - 11.png`),
      title: "Preview after another generate",
      caption:
        "Generating again replaces the preview. This pass is a 5-day unit, 45 minutes per class, still titled Understanding Air Pollution, with updated objectives and vocabulary (for example Fossil Fuel). Day 1’s weekday stays --none-- until you choose the teaching day. Edit, Regenerate, Save Lesson Plan, Download PDF, and Download vocabulary PDF stay on the preview. Save Lesson Plan stores the plan in Teacher Resource Library and creates a new deck on the owner’s Personal Dashboard under Owner lesson plans. That deck is not copied onto the team admin’s Team Dashboard.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_LESSON_PLAN_OWNER_FILE} - 12.png`),
      title: "Owner lesson-plan deck on Personal Dashboard",
      caption:
        "Open the plan owner’s Personal Dashboard after saving. Personal still lists the owner’s own decks that have no lesson plan (for example Social Studies: British History and Math: Alegbra 1). Under Workspaces, the Workspace menu shows the workspace name (UC-K26). Created by team admin lists decks that team admin made in the workspace (Teddy Watt’s Science : Environmental Science — Air pollution quiz deck, Lesson plan Day 1). Owner lesson plans lists the deck created for the owner from that team-admin deck and its lesson (the Teacher lesson plan deck). The owner deck stays on this dashboard.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_LESSON_PLAN_OWNER_FILE} - 13.png`),
      title: "Saved lesson plans in Teacher Resource Library",
      caption:
        "On Teacher Dashboard for UC-K26, open Teacher Resource Library and Saved Lesson Plans. Plans are grouped by who saved them, then by subject. The owner’s plan (John Brown, Understanding Air Pollution, Science : Environmental Science, grade 7, Intermediate, from the owner lesson-plan deck) is under the owner. The team admin’s plan (Teddy Watt, Air Pollution and its Effects, from Science : Environmental Science — Air pollution LP Day 1) is under the team admin. Each row offers PDF, Edit, Create Quiz, Rename, and Delete.",
    },
  ];

const EDU_TEACHER_LESSON_PLAN_OWNER_NEW_DECK_FILE =
  "27 Flipvise - Team Tier Edu Plan - Teacher DB AI-Lesson Plan owner new deck";

export const EDU_TEACHER_LESSON_PLAN_OWNER_NEW_DECK_GUIDE_STEPS: readonly DocsUiGuideStep[] =
  [
    {
      src: uiSrc(`${EDU_TEACHER_LESSON_PLAN_OWNER_NEW_DECK_FILE} - 01.png`),
      title: "Choose New deck",
      caption:
        "On Teacher Dashboard for workspace UC-K26 (Education Gold), open AI Lesson Builder and set Save to deck to New deck. A new deck is created when you save, using Subject — Topic as the deck name. Each field has a help icon. Learning Standard (for example NGSS, Common Core, or Jamaica NSC) steers the curriculum framework. Special need or Accommodations and reference material (Website URL, Plain text, PDF, Word, PowerPoint, Handwritten) give the AI more context. Choose Generate when the form is ready.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_LESSON_PLAN_OWNER_NEW_DECK_FILE} - 02.png`),
      title: "Preview the generated plan",
      caption:
        "The generated plan appears under Generate (for example Understanding Air Pollution, a 3-day unit, 45 minutes per class). Preview is the current view. Edit changes the plan before you save. Regenerate builds a new version from the same inputs without re-entering them. Save Lesson Plan stores it in Teacher Resource Library. Download PDF saves a summary. Download vocabulary PDF saves the plan with expanded vocabulary.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_LESSON_PLAN_OWNER_NEW_DECK_FILE} - 03.png`),
      title: "Objectives, materials, and vocabulary",
      caption:
        "Learning Objectives and Materials Needed recommend what students should achieve and which resources support the class. Re-expand all day vocabulary (AI) writes a deeper explanation of every vocabulary term (context, definitions, and examples). View detail opens that expanded vocabulary for the day.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_LESSON_PLAN_OWNER_NEW_DECK_FILE} - 04.png`),
      title: "Daily schedule",
      caption:
        "Each day has the same layout: a weekday, Daily focus, Vocabulary, and Class timeline sized to the lesson length (for example 45 minutes). Day 1 does not have to stay Monday — set the weekday to the day you will teach (Day 1 on Wednesday, Day 2 on Friday, and so on). Focus, vocabulary, and activities can differ by day.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_LESSON_PLAN_OWNER_NEW_DECK_FILE} - 05.png`),
      title: "Full-unit overview",
      caption:
        "Further down, the plan gives a full-unit overview: vocabulary for the unit, unit pacing, warm-up, main teaching steps, classroom activity, assessment questions, homework, differentiated instruction, and teacher notes. Use it as the delivery guide, and adjust activities and accommodations for the class.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_LESSON_PLAN_OWNER_NEW_DECK_FILE} - 06.png`),
      title: "What each closing section is for",
      caption:
        "Vocabulary (full unit) lists terms for the whole unit. Unit pacing overview spreads topics across the teaching days. Warm-Up activates prior knowledge. Main Teaching Steps is the instructional sequence. Classroom Activity is student practice. Assessment Questions check understanding. Homework reinforces learning outside class. Differentiated Instruction offers supports for different needs. Teacher Notes add standards alignment and delivery guidance.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_LESSON_PLAN_OWNER_NEW_DECK_FILE} - 07.png`),
      title: "Save the plan and create the deck",
      caption:
        "Save Lesson Plan stores the plan in Teacher Resource Library and creates a new deck on the owner’s Personal Dashboard. The deck name comes from Subject — Topic. Edit, Regenerate, Download PDF, and Download vocabulary PDF stay on the preview.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_LESSON_PLAN_OWNER_NEW_DECK_FILE} - 08.png`),
      title: "New deck on Personal Dashboard",
      caption:
        "Open the plan owner’s Personal Dashboard after saving. Personal still lists the owner’s own decks that have no lesson plan (for example Social Studies: British History and Math: Alegbra 1). Under Workspaces, the Workspace menu shows the workspace name (UC-K26). Created by team admin lists decks that team admin made in the workspace. Owner lesson plans lists the deck created when you saved with New deck (the Teacher lesson plan deck). That deck stays on this dashboard.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_LESSON_PLAN_OWNER_NEW_DECK_FILE} - 09.png`),
      title: "Saved lesson plans in Teacher Resource Library",
      caption:
        "On Teacher Dashboard for UC-K26, open Teacher Resource Library and Saved Lesson Plans. Plans are grouped by who saved them, then by subject. The owner’s plan (John Brown, Understanding Air Pollution) is under the owner. The team admin’s plan (Teddy Watt, Air Pollution and its Effects) is under the team admin. Each row offers PDF, Edit, Create Quiz, Rename, and Delete.",
    },
  ];

const EDU_TEACHER_QUIZ_OWNER_LESSON_PLAN_FILE =
  "28 Flipvise - Team Tier Edu Plan - Teacher DB AI-Quiz_TestGenerate - owner_UI-LP";

export const EDU_TEACHER_QUIZ_OWNER_LESSON_PLAN_GUIDE_STEPS: readonly DocsUiGuideStep[] =
  [
    {
      src: uiSrc(`${EDU_TEACHER_QUIZ_OWNER_LESSON_PLAN_FILE} - 01.png`),
      title: "Open AI Quiz/Test Generator",
      caption:
        "On Teacher Dashboard for workspace UC-K26 (Education Gold), the plan owner (John Brown) opens AI Quiz/Test Generator. The page creates a quiz deck from a saved lesson plan. Decks shows the workspace count (for example 4 / 15) and the card cap (up to 52 cards per deck). Workspace owner or team admin is the first field — open it to choose whose lesson plans to use.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_QUIZ_OWNER_LESSON_PLAN_FILE} - 02.png`),
      title: "Choose the owner or a team admin",
      caption:
        "Open Workspace owner or team admin. The list shows the subscriber (owner), for example John Brown — Workspace owner, and the team admin, for example Teddy Watt. The plan owner can use their own records and each team admin’s records in this workspace. A team admin can use their own records and other team admins in the same workspace.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_QUIZ_OWNER_LESSON_PLAN_FILE} - 03.png`),
      title: "Select a saved lesson plan",
      caption:
        "After a team admin is selected (Teddy Watt), Quiz source shows Lesson plan and Existing deck. Lesson plan is the tab for a saved plan. Open the list and choose a plan (for example Air Pollution and Its Effects · Lesson Plan · 3 days · grade 7). Subject, grade, topic, and difficulty fill from that plan.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_QUIZ_OWNER_LESSON_PLAN_FILE} - 04.png`),
      title: "Review the filled lesson plan",
      caption:
        "The selected plan fills Subject (Science : Environmental Science), Grade Level (grade 7), Topic (Air pollution), and Difficulty Level (Intermediate). Saved reference materials lists references from the plan (for example the website scied.ucar.edu). Number of Cards starts at 10 (1–52 on Education Gold). Include reading passage is still off. Choose AI Generate when the form is ready, or turn on a reading passage first.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_QUIZ_OWNER_LESSON_PLAN_FILE} - 05.png`),
      title: "Set regular cards and a reading passage",
      caption:
        "Set Regular quiz cards (for example 2). Turn on Include reading passage, then set Number of passages (for example 1) and Questions for each passage (for example 1). Passage type and Passage style can stay on Auto, and Reading level on On Grade. Question types include Multiple Choice (on by default), Critical Thinking, Scenario-Based, and Practical/Application — keep at least one on. Passage options can include key vocabulary, explanations for correct answers, teacher notes, local or cultural context, and avoiding previous passages. The footnote shows the mix (for example 2 regular + (1) passage questions = 3 / 52 cards). Choose AI Generate.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_QUIZ_OWNER_LESSON_PLAN_FILE} - 06.png`),
      title: "Choose which part of the lesson plan",
      caption:
        "For a multi-day plan, Which part of the lesson plan? asks for a scope before generation. All Days uses vocabulary, focus, and outlines from every day. A single day (Day 1, Day 2, or Day 3) uses only that day’s vocabulary, daily focus, and class outline — for example Day 1 Understanding air pollution and its health impacts. Choose a scope, then Generate. Quiz cards are created only from that choice.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_QUIZ_OWNER_LESSON_PLAN_FILE} - 07.png`),
      title: "Preview the generated cards",
      caption:
        "Preview lists the cards before they are saved (for example Card 1 · Regular, under Science : Environmental Science — Air pollution LP All Days). The front is blue, the correct back is green, and the three wrong answers are red. Expand opens the review larger so the question and answers are easier to read. Check the cards you want, then Save selected stores them on the new quiz deck.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_QUIZ_OWNER_LESSON_PLAN_FILE} - 08.png`),
      title: "Review a regular card",
      caption:
        "With Expand open, Collapse returns to the page. A regular card has one question on the front and the correct answer on the back. Swap exchanges the front and the back. The front, the back, and each wrong answer stay editable. Wrong answers from original front can supply distractors taken from the source card when that option applies.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_QUIZ_OWNER_LESSON_PLAN_FILE} - 09.png`),
      title: "Review a passage card",
      caption:
        "A passage card (for example Card 2 · Passage) puts the reading on the front — passage title, passage text, and the question — and the correct answer on the back (for example Ground-level ozone and particulate matter). Three wrong answers sit below for quiz mode. Regenerate replaces only those wrong answers and keeps the question and the correct answer. Save selected stores the checked cards.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_QUIZ_OWNER_LESSON_PLAN_FILE} - 10.png`),
      title: "Workspace Decks for the workspace",
      caption:
        "Workspace Decks — UC-K26 lists decks in this workspace. Search & filters matches name, day label, or description, and Sort by can order the list (for example Deck A–Z). Each row shows a Creator badge: Owner for the plan owner’s decks (for example Math: Alegbra 1, Science : Environmental Science — Air pollution, and Social Studies: British History) and Team admin for a deck that team admin created (Science : Environmental Science — Air pollution, labeled LESSON PLAN DAY 1).",
    },
    {
      src: uiSrc(`${EDU_TEACHER_QUIZ_OWNER_LESSON_PLAN_FILE} - 11.png`),
      title: "Open a deck from the table",
      caption:
        "Double-click a row to open that deck’s summary. The team admin deck (Science : Environmental Science — Air pollution, LESSON PLAN DAY 1) shows its description (topic, subject, grade, difficulty, and that it is a teacher quiz deck). Open Deck from the summary goes to that deck.",
    },
  ];

const EDU_TEACHER_QUIZ_OWNER_EXISTING_DECK_FILE =
  "28 Flipvise - Team Tier Edu Plan - Teacher DB AI-Quiz_TestGenerate - owner_UI-ExistingDeck";

export const EDU_TEACHER_QUIZ_OWNER_EXISTING_DECK_GUIDE_STEPS: readonly DocsUiGuideStep[] =
  [
    {
      src: uiSrc(`${EDU_TEACHER_QUIZ_OWNER_EXISTING_DECK_FILE} - 01.png`),
      title: "Choose Existing deck",
      caption:
        "On Teacher Dashboard for workspace UC-K26 (Education Gold), the plan owner opens AI Quiz/Test Generator and selects the team admin (Teddy Watt). Set Quiz source to Existing deck, then choose that admin’s deck (Science : Environmental Science — Air pollution LP Day 1). Cards are added to the selected deck. A new deck is not created.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_QUIZ_OWNER_EXISTING_DECK_FILE} - 02.png`),
      title: "Review the filled deck details",
      caption:
        "Selecting the deck fills Subject (Science : Environmental Science), Grade Level (grade 7), Topic (Air pollution), and Difficulty Level (Intermediate). Number of Cards stays at 10 (1–52 on Education Gold). Include reading passage is still off. New cards are added to this deck; cards already on it stay. Choose AI Generate when the form is ready, or turn on a reading passage first.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_QUIZ_OWNER_EXISTING_DECK_FILE} - 03.png`),
      title: "Set regular cards and a reading passage",
      caption:
        "Set Regular quiz cards (for example 1). Turn on Include reading passage, then set Number of passages (for example 1) and Questions for each passage (for example 1). Passage type and Passage style can stay on Auto, and Reading level on On Grade. Question types include Multiple Choice (on by default), Critical Thinking, Scenario-Based, and Practical/Application — keep at least one on. Passage options can include key vocabulary, explanations for correct answers, teacher notes, local or cultural context, and avoiding previous passages. The footnote shows the mix (for example 1 regular + (1) passage questions = 2 / 52 cards). Choose AI Generate.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_QUIZ_OWNER_EXISTING_DECK_FILE} - 04.png`),
      title: "Choose which part of the lesson plan",
      caption:
        "When the selected deck is tied to a multi-day lesson plan, Which part of the lesson plan? asks for a scope before generation. All Days uses vocabulary, focus, and outlines from every day. A single day (Day 1, Day 2, or Day 3) uses only that day’s vocabulary, daily focus, and class outline — for example Day 1 Understanding air pollution and its health impacts. Choose a scope, then Generate.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_QUIZ_OWNER_EXISTING_DECK_FILE} - 05.png`),
      title: "Preview the generated cards",
      caption:
        "Preview lists the cards before they are saved onto the selected deck (for example Card 1 · Regular). The front is blue, the correct back is green, and the three wrong answers are red. Expand opens the review larger so the question and answers are easier to read. Check the cards you want, then Save selected adds them. Cards already on the deck stay.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_QUIZ_OWNER_EXISTING_DECK_FILE} - 06.png`),
      title: "Review a regular card",
      caption:
        "With Expand open, Collapse returns to the page. A regular card has one question on the front and the correct answer on the back. Swap exchanges the front and the back. The front, the back, and each wrong answer stay editable. Wrong answers from original front can supply distractors taken from the source card when that option applies.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_QUIZ_OWNER_EXISTING_DECK_FILE} - 07.png`),
      title: "Review a passage card",
      caption:
        "A passage card (for example Card 2 · Passage) puts the reading on the front — passage title, passage text, and the question — and the correct answer on the back (for example Ground-level ozone and particulate matter). Three wrong answers sit below for quiz mode. Regenerate replaces only those wrong answers and keeps the question and the correct answer. Save selected stores the checked cards on the deck you chose.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_QUIZ_OWNER_EXISTING_DECK_FILE} - 08.png`),
      title: "Workspace Decks for the workspace",
      caption:
        "Workspace Decks — UC-K26 lists decks in this workspace. Search & filters matches name, day label, or description, and Sort by can order the list (for example Deck A–Z). Each row shows a Creator badge: Owner for the plan owner’s decks (for example Math: Alegbra 1, Science : Environmental Science — Air pollution, and Social Studies: British History) and Team admin for a deck that team admin created (Science : Environmental Science — Air pollution, labeled LESSON PLAN DAY 1).",
    },
    {
      src: uiSrc(`${EDU_TEACHER_QUIZ_OWNER_EXISTING_DECK_FILE} - 09.png`),
      title: "Open the team admin deck",
      caption:
        "Double-click a row to open that deck’s summary. The team admin deck (Science : Environmental Science — Air pollution, LESSON PLAN DAY 1) shows its description (topic, subject, grade, difficulty, and that it is a teacher quiz deck). Open Deck from the summary goes to that deck, including the cards you just added.",
    },
  ];

const EDU_TEACHER_HOMEWORK_OWNER_DECK_FILE =
  "29 Flipvise - Team Tier Edu Plan - Teacher DB HomeworkGenerate - owner_UI-deck";

export const EDU_TEACHER_HOMEWORK_OWNER_DECK_GUIDE_STEPS: readonly DocsUiGuideStep[] =
  [
    {
      src: uiSrc(`${EDU_TEACHER_HOMEWORK_OWNER_DECK_FILE} - 01.png`),
      title: "Generate from a deck",
      caption:
        "On Teacher Dashboard for workspace UC-K26 (Education Gold), the plan owner opens Homework Generator and sets Generate from to Deck. Choose the team admin (Teddy Watt), then that admin’s deck (Science : Environmental Science — Air pollution LP Day 1). The deck fills Subject (Science : Environmental Science), Grade Level (grade 7), Topic (Air pollution), and Difficulty Level (Intermediate). Number of Questions stays at 8. Choose Generate.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_HOMEWORK_OWNER_DECK_FILE} - 02.png`),
      title: "Preview the homework",
      caption:
        "Preview shows the assignment (for example Understanding Air Pollution - Lesson Plan All Days), the instructions, numbered questions, and the Answer Key. Expand opens the review larger. Edit changes the homework before you save. Save Homework stores it in Teacher Resource Library. Download PDF saves a copy for printing or sharing.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_HOMEWORK_OWNER_DECK_FILE} - 03.png`),
      title: "Expanded preview",
      caption:
        "Collapse returns to the page. The enlarged preview lists the assignment title (for example Air Pollution and Health Effects), the instructions, each question, and the Answer Key. Edit, Save Homework, and Download PDF stay on the preview.",
    },
  ];

const EDU_TEACHER_HOMEWORK_OWNER_LESSON_PLAN_FILE =
  "29 Flipvise - Team Tier Edu Plan - Teacher DB HomeworkGenerate - owner_UI-LP";

export const EDU_TEACHER_HOMEWORK_OWNER_LESSON_PLAN_GUIDE_STEPS: readonly DocsUiGuideStep[] =
  [
    {
      src: uiSrc(`${EDU_TEACHER_HOMEWORK_OWNER_LESSON_PLAN_FILE} - 01.png`),
      title: "Open Homework Generator",
      caption:
        "On Teacher Dashboard for workspace UC-K26 (Education Gold), the plan owner (John Brown) opens Homework Generator. Generate from is set to Lesson plan. Workspace owner or team admin is the next field — open it to choose whose saved lesson plans to use. Subject, grade, topic, and difficulty stay empty until a plan is selected. Number of Questions starts at 8 and Difficulty Level at On-level.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_HOMEWORK_OWNER_LESSON_PLAN_FILE} - 02.png`),
      title: "Select a saved lesson plan",
      caption:
        "Choose the team admin (Teddy Watt), then a saved plan (for example Air Pollution and Its Effects · Lesson Plan · 3 days · grade 7). The plan fills Subject (Science : Environmental Science), Grade Level (grade 7), Topic (Air pollution), and Difficulty Level (Intermediate). View saved PDF opens the plan. Choose Generate.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_HOMEWORK_OWNER_LESSON_PLAN_FILE} - 03.png`),
      title: "Choose which part of the lesson plan",
      caption:
        "For a multi-day plan, Which part of the lesson plan? asks for a scope before generation. All Days uses vocabulary, focus, and outlines from every day. A single day (Day 1, Day 2, or Day 3) uses only that day’s vocabulary, daily focus, and class outline — for example Day 1 Understanding air pollution and its health impacts. Choose a scope, then Generate.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_HOMEWORK_OWNER_LESSON_PLAN_FILE} - 04.png`),
      title: "Preview the homework",
      caption:
        "Preview shows the assignment (for example Air Pollution: Causes and Effects - Lesson Plan All Days), the instructions, numbered questions, and the Answer Key. Expand opens the review larger. Edit changes the homework before you save. Save Homework stores it in Teacher Resource Library. Download PDF saves a copy for printing or sharing.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_HOMEWORK_OWNER_LESSON_PLAN_FILE} - 05.png`),
      title: "Expanded preview",
      caption:
        "Collapse returns to the page. The enlarged preview lists the assignment title, the instructions, each question, and the Answer Key. Edit, Save Homework, and Download PDF stay on the preview.",
    },
  ];

const EDU_TEACHER_STUDY_GUIDE_OWNER_LESSON_PLAN_FILE =
  "30 Flipvise - Team Tier Edu Plan - Teacher DB StudyGuideGenerate - owner_UI";

export const EDU_TEACHER_STUDY_GUIDE_OWNER_LESSON_PLAN_GUIDE_STEPS: readonly DocsUiGuideStep[] =
  [
    {
      src: uiSrc(`${EDU_TEACHER_STUDY_GUIDE_OWNER_LESSON_PLAN_FILE} - 01.png`),
      title: "Generate from a saved lesson plan",
      caption:
        "On Teacher Dashboard for workspace UC-K26 (Education Gold), the plan owner (John Brown) opens Study Guide Generator. Choose the workspace owner or a team admin, then a saved lesson plan (for example Understanding Air Pollution · Lesson Plan · 5 days · grade 7). The plan fills Subject (Science : Environmental Science), Grade Level (grade 7), and Topic (Air pollution). Homework assignment is optional when one is already saved for that plan. Reference material is optional — Website URL, Plain text, PDF, Word, PowerPoint, or handwritten notes. Choose Generate. A multi-day plan asks which part to use — All Days or one day — and the study guide is written from that choice.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_STUDY_GUIDE_OWNER_LESSON_PLAN_FILE} - 02.png`),
      title: "Preview the study guide",
      caption:
        "Preview shows the guide (for example Understanding Air Pollution · Lesson Plan All Days) with the summary, Key Vocabulary, Important Points, Worked Examples, Sample Problems, Practice Questions, and Study Tips. Expand opens the review larger. Edit changes the guide before you save. Save stores it in Teacher Resource Library. Download PDF saves a copy for printing or sharing. Regenerate AI builds another version from the same lesson plan.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_STUDY_GUIDE_OWNER_LESSON_PLAN_FILE} - 03.png`),
      title: "Expanded preview",
      caption:
        "Collapse returns to the page. The enlarged preview lists the same sections — summary, Key Vocabulary, Important Points, Worked Examples, Sample Problems, Practice Questions, and Study Tips. Edit, Save, Download PDF, and Regenerate AI stay on the preview.",
    },
  ];

const EDU_TEACHER_WORKSHEET_OWNER_LESSON_PLAN_FILE =
  "31 Flipvise - Team Tier Edu Plan - Teacher DB WorksheetGenerate - owner_UI";

export const EDU_TEACHER_WORKSHEET_OWNER_LESSON_PLAN_GUIDE_STEPS: readonly DocsUiGuideStep[] =
  [
    {
      src: uiSrc(`${EDU_TEACHER_WORKSHEET_OWNER_LESSON_PLAN_FILE} - 01.png`),
      title: "Generate from a saved lesson plan",
      caption:
        "On Teacher Dashboard for workspace UC-K26 (Education Gold), the plan owner (John Brown) opens Worksheet Generator. Choose the workspace owner or a team admin, then a saved lesson plan (for example Science : Environmental Science — Air pollution). The plan fills Subject (Science : Environmental Science), Grade Level (grade 7), and Topic (Air pollution). Worksheet Type is Practice, Number of Questions is 10, and Difficulty Level is Intermediate. Choose Generate. A multi-day plan asks which part to use — All Days or one day — and the worksheet is written from that choice.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_WORKSHEET_OWNER_LESSON_PLAN_FILE} - 02.png`),
      title: "Preview the worksheet",
      caption:
        "Preview shows the practice instructions, the questions (for example 10 items on air pollution), and an Answer key preview. Expand opens the review larger. Edit changes the worksheet before you save. Save stores it in Teacher Resource Library. Worksheet PDF and Answer Key PDF each save a copy for printing or sharing.",
    },
  ];

const EDU_TEACHER_CLASSES_OWNER_FILE =
  "32 Flipvise - Team Tier Edu Plan - Teacher DB Classes - owner_UI";

export const EDU_TEACHER_CLASSES_OWNER_GUIDE_STEPS: readonly DocsUiGuideStep[] = [
  {
    src: uiSrc(`${EDU_TEACHER_CLASSES_OWNER_FILE} - 01.png`),
    title: "Open Classes",
    caption:
      "On Teacher Dashboard for workspace UC-K26 (Education Gold), the plan owner (John Brown) opens Classes under Classroom management. The page lists decks linked to classes for lesson plan generation, grouped by team admin. Choose Create class. Each class record holds that week’s lesson plan together with homework, cards, the study guide, and the worksheet.",
  },
  {
    src: uiSrc(`${EDU_TEACHER_CLASSES_OWNER_FILE} - 02.png`),
    title: "Choose the member and deck",
    caption:
      "Create class starts with Workspace owner or team admin. Choose the workspace owner (John Brown · Workspace owner) or a team admin (Teddy Watt). Deck then lists only that person’s decks that already have a linked lesson plan.",
  },
  {
    src: uiSrc(`${EDU_TEACHER_CLASSES_OWNER_FILE} - 03.png`),
    title: "Fill the academic schedule",
    caption:
      "After the member and deck (for example Teddy Watt and Science : Environmental Science — Air pollution LP Day 1), complete Academic schedule and Timetable. Academic year is the school year (2025–2026). Term / semester lists Fall, Spring, Summer, Semester 1, Semester 2, Trimester 1, Trimester 2, and Trimester 3. Month lists January through December. Week is the week within that month (Week 1). Plan period shows the lesson length (3 days). Period of the day 1, 2, and 3 are the class periods for those teaching days.",
  },
  {
    src: uiSrc(`${EDU_TEACHER_CLASSES_OWNER_FILE} - 04.png`),
    title: "Create the class",
    caption:
      "With Teddy Watt, the deck Science : Environmental Science — Air pollution LP Day 1, academic year 2026, Fall, Week 2, October, a 3-day plan period, and periods Period 2, Period 1, and Period 4, choose Create class.",
  },
  {
    src: uiSrc(`${EDU_TEACHER_CLASSES_OWNER_FILE} - 05.png`),
    title: "Open the class record",
    caption:
      "The new row appears under John Brown (Owner): Fall · Week 2 — Science : Environmental Science — Air pollution LP Day 1, subject Science : Environmental Science, grade 7, academic year 2026, term Fall, week Week 2 · No of Class : 3, month October. Open the row to see Edit, Delete, and Lesson plan, Homework, Cards, Study guide, and Worksheet.",
  },
];

const EDU_TEACHER_STUDENT_PROGRESS_OWNER_FILE =
  "32 Flipvise - Team Tier Edu Plan - Teacher DB StudentProgress - owner_UI";

export const EDU_TEACHER_STUDENT_PROGRESS_OWNER_GUIDE_STEPS: readonly DocsUiGuideStep[] =
  [
    {
      src: uiSrc(`${EDU_TEACHER_STUDENT_PROGRESS_OWNER_FILE} - 01.png`),
      title: "Open Student Progress",
      caption:
        "On Teacher Dashboard for workspace UC-K26 (Education Gold), the plan owner (John Brown) opens Student Progress under Classroom management. AI Recall™ insights shows the workspace totals (for example 1% average score, 47s average time, 1 forced unlock, 1 session) and the lowest and highest decks (Social Studies: British History). Track each student lists saved sessions — open Bruce Williams to see that person’s accuracy (50%), average AI score (1%), time (7m 49s), and last session. Below that, Student Progress has Registering a student, Quiz results, and Reports & Grades.",
    },
  ];

const EDU_TEACHER_STUDENT_PROGRESS_ADD_STUDENT_OWNER_FILE =
  "32 Flipvise - Team Tier Edu Plan - Teacher DB StudentProgress AddStudent - owner_UI";

export const EDU_TEACHER_STUDENT_PROGRESS_ADD_STUDENT_OWNER_GUIDE_STEPS: readonly DocsUiGuideStep[] =
  [
    {
      src: uiSrc(`${EDU_TEACHER_STUDENT_PROGRESS_ADD_STUDENT_OWNER_FILE} - 01.png`),
      title: "Open Register student",
      caption:
        "On Student Progress, stay on Registering a student. A class must already exist. Choose Register student to link an invited workspace member to that class.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_STUDENT_PROGRESS_ADD_STUDENT_OWNER_FILE} - 02.png`),
      title: "Choose a class and a member",
      caption:
        "Class lists classes created under Classes. Workspace student lists invited members with the Member role (team admins are not listed). Choose Save student after both are selected.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_STUDENT_PROGRESS_ADD_STUDENT_OWNER_FILE} - 03.png`),
      title: "Save the student",
      caption:
        "For example, Class is Fall · Week 2 — Science : Environmental Science — Air pollution LP Day 1, and Workspace student is Bruce Williams (williams.bruce2698@yahoo.com), invited by John Brown. Choose Save student.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_STUDENT_PROGRESS_ADD_STUDENT_OWNER_FILE} - 04.png`),
      title: "Student registered",
      caption:
        "The roster shows Bruce Williams, williams.bruce2698@yahoo.com, and the class Fall · Week 2 — Science : Environmental Science — Air pollution LP Day 1. A confirmation says Bruce Williams was added to the roster.",
    },
  ];

const EDU_TEACHER_STUDENT_PROGRESS_QUIZ_RESULT_OWNER_FILE =
  "32 Flipvise - Team Tier Edu Plan - Teacher DB StudentProgress QuizResult- owner_UI";

export const EDU_TEACHER_STUDENT_PROGRESS_QUIZ_RESULT_OWNER_GUIDE_STEPS: readonly DocsUiGuideStep[] =
  [
    {
      src: uiSrc(`${EDU_TEACHER_STUDENT_PROGRESS_QUIZ_RESULT_OWNER_FILE} - 01.png`),
      title: "Open Quiz results",
      caption:
        "On Student Progress, choose Quiz results. Workspace quiz results groups saved attempts by team admin, then by member. Under John Brown (Owner), Bruce Williams (Member) has Social Studies: British History, topic Learning British history, saved Oct 4, 2026, 11:38 PM, score 50%. Double-click the row to open the question sheet and answer key.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_STUDENT_PROGRESS_QUIZ_RESULT_OWNER_FILE} - 02.png`),
      title: "Question sheet",
      caption:
        "Quiz sheets opens on Question sheet for Social Studies: British History, Bruce Williams, 10 questions. Review the questions, download the question sheet, or choose Save to resources.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_STUDENT_PROGRESS_QUIZ_RESULT_OWNER_FILE} - 03.png`),
      title: "Answer key",
      caption:
        "Answer key shows the correct answers for that quiz (for example Q1 John Wycliffe). Download answer key saves a separate PDF. Close returns to the results table.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_STUDENT_PROGRESS_QUIZ_RESULT_OWNER_FILE} - 04.png`),
      title: "View quiz result",
      caption:
        "On the same Quiz results row, View quiz result opens the member’s completed attempt. Delete removes that saved result.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_STUDENT_PROGRESS_QUIZ_RESULT_OWNER_FILE} - 05.png`),
      title: "Score and question review",
      caption:
        "The result names the deck (Social Studies: British History), who took it (Bruce Williams, williams.bruce2698@yahoo.com), workspace UC-K26, role Member, and owner John Brown. Score is 50% (5/10) in 01:39, with 5 correct, 2 incorrect, and 3 unanswered. Question review filters All, Correct, Incorrect, and Unanswered, and expands each question beside the correct answer.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_STUDENT_PROGRESS_QUIZ_RESULT_OWNER_FILE} - 06.png`),
      title: "Unanswered questions and Download PDF",
      caption:
        "Unanswered questions show Your answer as Not answered and the correct answer beside it (for example Queen Elizabeth I reigned for 45 years, from 1558 to 1603). The footer repeats 5 correct, 2 incorrect, 3 unanswered, and 10 total questions. Choose Download PDF.",
    },
    {
      src: uiSrc(`${EDU_TEACHER_STUDENT_PROGRESS_QUIZ_RESULT_OWNER_FILE} - 07.png`),
      title: "Quiz result PDF",
      caption:
        "The PDF (quiz_result_social_studies_british_history.pdf) lists the deck, date, taker, workspace UC-K26, role, owner, 50% (5/10 correct), and the question review with each submitted answer marked Correct or Incorrect.",
    },
  ];

export const DOCS_UI_GUIDES: Record<
  DocsUiGuideId,
  { title: string; summary: string; steps: readonly DocsUiGuideStep[] }
> = {
  signup: {
    title: "Create a Flipvise account",
    summary: "Sign up, verify your email, and finish account setup.",
    steps: SIGNUP_GUIDE_STEPS,
  },
  signin: {
    title: "Sign in to Flipvise",
    summary: "Sign in with email, Apple, Google, or an email code.",
    steps: SIGNIN_GUIDE_STEPS,
  },
  "personal-dashboard": {
    title: "Personal Dashboard",
    summary: "Dashboard, inbox, Help Center, documentation, and Manage account.",
    steps: PERSONAL_DASHBOARD_GUIDE_STEPS,
  },
  pricing: {
    title: "Plans & Pricing",
    summary: "Open pricing, compare tiers, and start checkout or a free trial.",
    steps: PRICING_GUIDE_STEPS,
  },
  subscribe: {
    title: "Subscribe to a plan",
    summary: "Choose a plan, complete Stripe checkout, and open your receipt.",
    steps: SUBSCRIBE_GUIDE_STEPS,
  },
  "create-deck": {
    title: "Create a deck",
    summary: "Add a deck from Personal Dashboard, including an optional cover image.",
    steps: CREATE_DECK_GUIDE_STEPS,
  },
  "ai-created-cards": {
    title: "Generate cards with AI",
    summary: "Open a deck, choose a batch size, and generate AI flashcards.",
    steps: AI_CREATED_CARDS_GUIDE_STEPS,
  },
  "manual-added-cards": {
    title: "Add a standard card",
    summary: "Add a front-and-back card by hand, with optional AI answer and image.",
    steps: MANUAL_ADDED_CARDS_GUIDE_STEPS,
  },
  "manual-add-mcq": {
    title: "Add a multiple-choice card",
    summary: "Create an MCQ with a correct answer and three quiz distractors.",
    steps: MANUAL_ADD_MCQ_GUIDE_STEPS,
  },
  "add-card-from-source": {
    title: "Add cards from a source",
    summary: "Import from a URL or file, review drafts, then save selected cards.",
    steps: ADD_CARD_FROM_SOURCE_GUIDE_STEPS,
  },
  "create-workspace": {
    title: "Create a new workspace",
    summary:
      "Add another team workspace from Team Admin or Manage workspaces, then review the new row.",
    steps: CREATE_WORKSPACE_GUIDE_STEPS,
  },
  "invite-unregistered-member": {
    title: "Invite unregistered member to a workspace",
    summary:
      "Send a team invite to someone without a Flipvise account, then they sign up and join the workspace.",
    steps: INVITE_UNREGISTERED_MEMBER_GUIDE_STEPS,
  },
  "link-deck-to-workspace": {
    title: "Link a deck to a workspace",
    summary:
      "On Assign decks, choose a Personal Dashboard deck and link it to the selected team workspace.",
    steps: LINKING_DECK_TO_WORKSPACE_GUIDE_STEPS,
  },
  "assign-deck-to-member": {
    title: "Assign deck to member in a workspace",
    summary:
      "On Assign decks, choose a member and a linked deck, then confirm the assignment on Team Dashboard.",
    steps: ASSIGN_DECK_TO_MEMBER_GUIDE_STEPS,
  },
  "assign-deck-to-team-admin": {
    title: "Assign deck to team admin in a workspace",
    summary:
      "On Assign decks, choose a co-admin, set how many decks they may create, assign a linked deck, then confirm the roster and Assignments by member.",
    steps: ASSIGN_DECK_TO_TEAM_ADMIN_GUIDE_STEPS,
  },
  "change-study-mode-privileges": {
    title: "Change study mode privileges for a workspace member",
    summary:
      "On Study privileges, open an assignment, change study modes, and confirm the member’s study session.",
    steps: CHANGE_STUDY_MODE_PRIVILEGES_GUIDE_STEPS,
  },
  "workspace-study-mode-settings": {
    title: "AI Recall™ study mode control and settings for a workspace",
    summary:
      "Open Active Recall Mode on Team Admin, have a member complete a session, then monitor results by deck and by member.",
    steps: WORKSPACE_STUDY_MODE_SETTINGS_GUIDE_STEPS,
  },
  "ai-recall-session-cards": {
    title: "AI Recall™ session cards for a workspace",
    summary:
      "On Session cards, set a workspace default or per-deck override, then confirm the member’s AI Recall™ lobby.",
    steps: AI_RECALL_SESSION_CARDS_GUIDE_STEPS,
  },
  "quiz-formats-workspace": {
    title: "Quiz formats for a workspace",
    summary:
      "On Quiz formats, set workspace or per-deck question types, generate AI sentences, preview, and republish the mix.",
    steps: QUIZ_FORMATS_WORKSPACE_GUIDE_STEPS,
  },
  "quiz-timer-workspace": {
    title: "Quiz timer for a workspace",
    summary:
      "On Quiz timer, set a workspace-wide duration or a per-deck override, then confirm the member’s Timed quiz clock.",
    steps: QUIZ_TIMER_WORKSPACE_GUIDE_STEPS,
  },
  "quiz-schedule-workspace": {
    title: "Quiz schedule for a workspace",
    summary:
      "On Quiz schedule, set a workspace or per-deck start time, then confirm the member’s Timed quiz unlock and greyed-out Start quiz.",
    steps: QUIZ_SCHEDULE_WORKSPACE_GUIDE_STEPS,
  },
  "quiz-exam-mode-workspace": {
    title: "Quiz Exam Mode for a workspace",
    summary:
      "On Exam Mode, turn on workspace or per-deck locks for selected roles, then Continue, Start over, or Terminate sessions from Locked & terminated sessions.",
    steps: QUIZ_EXAM_MODE_WORKSPACE_GUIDE_STEPS,
  },
  "quiz-results-workspace": {
    title: "Quiz results for a workspace",
    summary:
      "On Quiz results, review member attempts, open View or the question sheet, then confirm the member’s saved score and Review.",
    steps: QUIZ_RESULTS_WORKSPACE_GUIDE_STEPS,
  },
  "edu-teacher-dashboard": {
    title: "Teacher Dashboard",
    summary:
      "From the Education Gold plan owner’s Personal Dashboard, open Teacher Dashboard and review the workspace tools.",
    steps: EDU_TEACHER_DASHBOARD_GUIDE_STEPS,
  },
  "edu-teacher-lesson-plan-owner": {
    title: "AI Lesson Builder for the plan owner",
    summary:
      "On Teacher Dashboard, build a lesson plan from an existing team-admin deck, save it, then find the new owner deck under Owner lesson plans and the plan in Teacher Resource Library.",
    steps: EDU_TEACHER_LESSON_PLAN_OWNER_GUIDE_STEPS,
  },
  "edu-teacher-lesson-plan-owner-new-deck": {
    title: "AI Lesson Builder for a new deck",
    summary:
      "On Teacher Dashboard, choose New deck, generate a lesson plan, save it, then find that deck under Owner lesson plans and the plan in Teacher Resource Library.",
    steps: EDU_TEACHER_LESSON_PLAN_OWNER_NEW_DECK_GUIDE_STEPS,
  },
  "edu-teacher-quiz-owner-lesson-plan": {
    title: "AI Quiz/Test Generator from a lesson plan",
    summary:
      "On Teacher Dashboard, the plan owner chooses a team admin and a saved lesson plan, sets regular cards and a reading passage, generates, reviews the cards, then opens a deck from Workspace Decks.",
    steps: EDU_TEACHER_QUIZ_OWNER_LESSON_PLAN_GUIDE_STEPS,
  },
  "edu-teacher-quiz-owner-existing-deck": {
    title: "AI Quiz/Test Generator for an existing deck",
    summary:
      "On Teacher Dashboard, the plan owner chooses a team admin and Existing deck, reviews the filled subject and grade, generates cards, then saves them onto that deck.",
    steps: EDU_TEACHER_QUIZ_OWNER_EXISTING_DECK_GUIDE_STEPS,
  },
  "edu-teacher-homework-owner-deck": {
    title: "Homework Generator from a deck",
    summary:
      "On Teacher Dashboard, the plan owner chooses Deck, a team admin’s deck, then generates, previews, saves, or downloads the homework.",
    steps: EDU_TEACHER_HOMEWORK_OWNER_DECK_GUIDE_STEPS,
  },
  "edu-teacher-homework-owner-lesson-plan": {
    title: "Homework Generator from a lesson plan",
    summary:
      "On Teacher Dashboard, the plan owner chooses a team admin and a saved lesson plan, picks All Days or one day, then previews, saves, or downloads the homework.",
    steps: EDU_TEACHER_HOMEWORK_OWNER_LESSON_PLAN_GUIDE_STEPS,
  },
  "edu-teacher-study-guide-owner-lesson-plan": {
    title: "Study Guide Generator from a lesson plan",
    summary:
      "On Teacher Dashboard, the plan owner chooses a saved lesson plan, optionally adds reference material, then previews, saves, downloads, or regenerates the study guide.",
    steps: EDU_TEACHER_STUDY_GUIDE_OWNER_LESSON_PLAN_GUIDE_STEPS,
  },
  "edu-teacher-worksheet-owner-lesson-plan": {
    title: "Worksheet Generator from a lesson plan",
    summary:
      "On Teacher Dashboard, the plan owner chooses a saved lesson plan, then previews, edits, saves, or downloads the worksheet and answer key.",
    steps: EDU_TEACHER_WORKSHEET_OWNER_LESSON_PLAN_GUIDE_STEPS,
  },
  "edu-teacher-classes-owner": {
    title: "Classes for the plan owner",
    summary:
      "On Teacher Dashboard, the plan owner creates a class from a member’s lesson-plan deck, sets the academic schedule, then opens the saved class record.",
    steps: EDU_TEACHER_CLASSES_OWNER_GUIDE_STEPS,
  },
  "edu-teacher-student-progress-owner": {
    title: "Student Progress for the plan owner",
    summary:
      "On Teacher Dashboard, the plan owner opens Student Progress, reviews AI Recall™ insights, and opens a student’s saved session.",
    steps: EDU_TEACHER_STUDENT_PROGRESS_OWNER_GUIDE_STEPS,
  },
  "edu-teacher-student-progress-add-student-owner": {
    title: "Register a student for the plan owner",
    summary:
      "On Student Progress, the plan owner registers an invited member onto an existing class.",
    steps: EDU_TEACHER_STUDENT_PROGRESS_ADD_STUDENT_OWNER_GUIDE_STEPS,
  },
  "edu-teacher-student-progress-quiz-result-owner": {
    title: "Student quiz results for the plan owner",
    summary:
      "On Student Progress, the plan owner opens a member’s quiz result, the question sheet, the answer key, and the PDF.",
    steps: EDU_TEACHER_STUDENT_PROGRESS_QUIZ_RESULT_OWNER_GUIDE_STEPS,
  },
};
