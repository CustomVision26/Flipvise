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
  | "add-card-from-source";

export const FLIPVISE_UI_GUIDE_LABEL = "Flipvise UI guide";

export const DOCS_UI_GUIDE_ORDER: readonly DocsUiGuideId[] = [
  "signup",
  "signin",
  "personal-dashboard",
  "pricing",
  "subscribe",
  "create-deck",
  "ai-created-cards",
  "manual-added-cards",
  "manual-add-mcq",
  "add-card-from-source",
];

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
};
