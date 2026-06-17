import type { DocSection } from "@/lib/documentation-content-types";

export type { DocPage, DocSection } from "@/lib/documentation-content-types";

export const USER_DOCUMENTATION_SECTIONS: DocSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Sign-in, navigation, and how workspaces fit together.",
    pages: [
      {
        id: "homepage",
        title: "Homepage",
        route: "/",
        purpose:
          "Landing page for guests. Sign in or create an account to reach your dashboard.",
        howItWorks: [
          "Use Sign In or Sign Up to open the Clerk authentication modal.",
          "If you arrived from a team invite, the page may pre-fill your invited email.",
          "After sign-in you are redirected to your personal dashboard automatically.",
        ],
        requirements: ["None — guests can browse pricing and documentation."],
        doNots: [
          "There is no separate /sign-in page — always start from the homepage.",
          "Do not share sign-in links with a different email than the one on your invite.",
        ],
      },
      {
        id: "header-navigation",
        title: "Top Navigation Bar",
        purpose:
          "Quick links to Home, Documentation, and Contact Support from anywhere in the app.",
        howItWorks: [
          "Home returns to your dashboard when signed in, or the homepage when signed out.",
          "Documentation opens this guide.",
          "Contact Us appears in the top nav for guests only — it opens the public Contact Support page with live chat.",
          "Signed-in users see Documentation in the nav (not Contact Us); visit /contact directly or use the link in this guide.",
          "Guest homepage nav shows Contact Us only; on /docs or /contact you also see Home and Documentation.",
          "Signed-in users also see plan label, workspace switcher, inbox, and account menu.",
        ],
        requirements: ["Signed in for inbox and account controls."],
        doNots: [
          "Do not rely on browser back alone after switching workspaces — use the workspace switcher.",
        ],
      },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Personal and team workspace home for your decks.",
    pages: [
      {
        id: "personal-dashboard",
        title: "Personal Dashboard",
        route: "/dashboard",
        purpose:
          "Create, organize, and open your personal flashcard decks.",
        howItWorks: [
          "View decks in grid or list mode.",
          "Add Deck opens the deck creation dialog (title, optional AI generation on eligible plans).",
          "Click a deck to edit cards or start studying.",
          "Usage banners show deck and card limits for your current plan.",
        ],
        requirements: [
          "Signed-in account.",
          "Free: up to 2 decks, 5 cards per deck.",
          "Pro: up to 10 decks, 30 cards per deck.",
          "Pro Plus / team-tier personal: up to 15 decks, 52 cards per deck.",
        ],
        doNots: [
          "Do not create decks beyond your plan limit — the Add Deck action is blocked at the cap.",
          "Team-tier subscribers author decks here, not on a duplicate team deck dashboard.",
          "Do not change another user’s userid query parameter in the URL.",
        ],
      },
      {
        id: "team-workspace-dashboard",
        title: "Team Workspace View",
        route: "/dashboard?team=…",
        purpose:
          "Study or preview decks inside a team workspace you belong to.",
        howItWorks: [
          "Switch workspaces from the header dropdown (Personal Dash vs team workspaces).",
          "Team admins/co-admins with edit access see full deck management links.",
          "Assigned members see only decks assigned to them.",
          "Team context is stored in a cookie when you switch workspaces.",
        ],
        requirements: [
          "Team membership or team-tier subscription.",
          "Assigned members need an active assignment from a team admin.",
        ],
        doNots: [
          "Members cannot create or edit decks in another owner’s workspace unless they are team admin/co-admin.",
          "Do not bookmark cookie-only team context for co-admins — use the canonical ?team= URL.",
        ],
      },
      {
        id: "manage-workspaces",
        title: "Manage Workspaces",
        route: "/dashboard/workspaces",
        purpose:
          "Team-tier subscribers create, rename, delete, and review history for owned team workspaces.",
        howItWorks: [
          "Add workspaces up to your plan’s workspace limit.",
          "Rename or delete workspaces you own.",
          "Workspace history shows create/rename/delete audit events.",
        ],
        requirements: [
          "Active team-tier plan (Team Basic, Team Gold, Platinum, or Enterprise).",
          "At least one owned team workspace.",
        ],
        doNots: [
          "Deleting a workspace removes associated team data — confirm before deleting.",
          "Invited co-admins cannot access this page unless they own a team-tier subscription.",
        ],
      },
    ],
  },
  {
    id: "decks-study",
    title: "Decks & Study",
    description: "Editing cards and running study sessions.",
    pages: [
      {
        id: "deck-editor",
        title: "Deck Editor",
        route: "/decks/[deckId]",
        purpose: "View and edit deck metadata and individual flashcards.",
        howItWorks: [
          "Add, edit, reorder, and delete cards.",
          "Generate cards with AI on eligible plans.",
          "Upload a deck cover image when your plan allows.",
          "Open Study to start flashcard review or quiz mode.",
        ],
        requirements: [
          "Deck owner or team admin/co-admin with edit access.",
          "AI generation: Pro Plus or team-tier workspace.",
          "Cover images: Pro on personal workspace, or team-tier workspace.",
        ],
        doNots: [
          "Plain team members are redirected to study — they cannot edit deck content.",
          "Do not study an empty deck — add at least one card first.",
          "Do not exceed your plan’s cards-per-deck limit.",
        ],
      },
      {
        id: "study-session",
        title: "Study Session",
        route: "/decks/[deckId]/study",
        purpose:
          "Review flashcards and take quizzes with progress tracking.",
        howItWorks: [
          "Flashcard review flips cards and tracks familiarity.",
          "Quiz mode supports multiple question formats: multiple choice, true/false, and fill-in-the-blank.",
          "The quiz start screen lists enabled formats and shows how many of each type appear in this session (e.g. 5 MCQ, 2 True/False, 3 Fill in the blank).",
          "When a team admin has set a question distribution and reshuffled, the lobby mix matches those exact counts.",
          "Each question shows a format badge (e.g. True / false, Fill in the blank) while you answer.",
          "When an admin has reshuffled formats, each card keeps its assigned format until reshuffled again; otherwise formats are chosen at random per card.",
          "Team quizzes may enforce timers, schedules, and security rules set by admins.",
          "AI Reading (text-to-speech) is available on Pro Plus when enabled.",
        ],
        requirements: [
          "At least one card in the deck.",
          "Quiz mode requires a paid or team-tier deck (above free card cap).",
          "Team members: review/quiz modes depend on admin study privileges per assignment.",
          "True/false and fill-in-the-blank require admin-enabled formats and AI-generated quiz content on cards.",
        ],
        doNots: [
          "Do not attempt to bypass quiz security or schedule locks — contact your team admin.",
          "Do not refresh mid-quiz if autosave fails — note your score and contact support if needed.",
        ],
      },
      {
        id: "quiz-result-detail",
        title: "Quiz Result Detail",
        route: "/dashboard/quiz-results/[resultId]",
        purpose: "Full breakdown of a quiz attempt opened from your inbox.",
        howItWorks: [
          "Shows score, answers, and timing for a specific quiz result.",
          "Each question in the review lists its format (MCQ, True/False, or Fill in the blank) next to the question number.",
          "Linked from inbox notifications for team quiz activity.",
          "PDF downloads include the format label on each question when available.",
        ],
        requirements: ["You must be the result owner or have permission to view it."],
        doNots: ["Do not share result URLs — they are tied to your account access."],
      },
    ],
  },
  {
    id: "inbox",
    title: "Inbox & Notifications",
    description: "Central place for actionable messages and history.",
    pages: [
      {
        id: "inbox",
        title: "Inbox",
        route: "/dashboard/inbox",
        purpose:
          "Unified notification center for invites, billing, quiz results, affiliate messages, and support tickets.",
        howItWorks: [
          "Inbox tab shows unread and actionable items.",
          "History tab shows completed or read items.",
          "Accept team invites, review billing receipts, open quiz results, and continue Contact Us live chats from here.",
          "Contact Us notifications appear as “Support replied: …” when an administrator responds to your public message — tap Open conversation to return to the thread.",
          "The header inbox icon shows a badge count for pending items.",
        ],
        requirements: ["Signed-in account with a primary email on file."],
        doNots: [
          "Do not ignore expired team invites — request a new invite from your admin.",
          "Do not delete emails before accepting affiliate or plan-assignment invites if you still need the link.",
        ],
      },
    ],
  },
  {
    id: "help-center",
    title: "Help Center",
    description: "In-app support panel, ticket types, and conversation tracking.",
    pages: [
      {
        id: "help-center-overview",
        title: "Help Center overview",
        purpose:
          "Side panel for submitting support tickets and tracking replies without leaving Flipvise.",
        howItWorks: [
          "Open the Help Center section in Documentation (/docs#help-center-overview) for ticket categories and workflows.",
          "The landing screen lists every ticket category — tap a row to open its form.",
          "Use ← Back in the sheet header to return to the category list.",
          "Closing the sheet resets to the landing screen.",
          "After a successful submission you see a confirmation and can submit another request.",
          "For public live chat without signing in, use Contact Us (/contact) instead — see the Contact Us section in this guide.",
        ],
        requirements: [
          "Signed-in account with a primary email.",
          "Visible for personal workspace users and most paid plans.",
          "Hidden for plain team members while actively viewing a team workspace (use email support or ask your admin).",
        ],
        doNots: [
          "Do not submit the same issue in multiple categories — pick the best match.",
          "Do not include passwords, full payment card numbers, or secret API keys in any ticket.",
          "Do not expect Help Center while plain team members are actively viewing a team workspace.",
        ],
      },
      {
        id: "help-center-support",
        title: "Support ticket",
        purpose:
          "General help for anything not covered by a more specific category.",
        howItWorks: [
          "Fields: Subject (required), Message (required, minimum 10 characters), optional screenshot.",
          "Screenshot uploader accepts JPEG, PNG, WebP, or GIF up to 10 MB — click, drag-and-drop, or remove before sending.",
          "Submit with Send Request; a ticket is created and routed to the support team.",
          "Use for how-to questions, unexpected behaviour, or issues that do not fit Billing, Account, or Bug Report.",
        ],
        requirements: ["Signed-in account.", "Help Center visible in your current workspace context."],
        doNots: [
          "Do not use this for subscription charges — use the Billing tab instead.",
          "Do not use for login or profile problems — use the Account tab.",
          "Do not attach unrelated files; screenshots should show the issue clearly.",
        ],
      },
      {
        id: "help-center-bug-report",
        title: "Bug Report ticket",
        purpose:
          "Report broken behaviour, errors, or data problems with structured severity.",
        howItWorks: [
          "Fields: Bug Summary (required), Severity dropdown, Steps to Reproduce (required, min 10 characters), optional screenshot.",
          "Severity options: Low (cosmetic), Normal (partial functionality), High (feature blocked), Urgent (app broken or data loss).",
          "Write numbered reproduction steps (e.g. “1. Open deck… 2. Click Study… 3. Error appears”).",
          "Submit with Report Bug (destructive-styled button).",
          "Screenshots strongly recommended for UI bugs.",
        ],
        requirements: ["Signed-in account.", "Ability to describe steps that reproduce the issue."],
        doNots: [
          "Do not mark Urgent unless the app is unusable or data may be lost.",
          "Do not submit feature ideas here — use Feature Request.",
          "Do not omit reproduction steps; “it doesn’t work” slows investigation.",
        ],
      },
      {
        id: "help-center-feature-request",
        title: "Feature Request ticket",
        purpose:
          "Suggest new product capabilities or improvements to existing features.",
        howItWorks: [
          "Fields: Feature Title (required), Description & Use-case (required, min 10 characters), optional mockup/reference image.",
          "Explain who benefits and how the feature would be used in your workflow.",
          "Optional image helps illustrate layout or workflow ideas.",
          "Submit with Submit Request; requests are reviewed but not guaranteed to ship.",
        ],
        requirements: ["Signed-in account."],
        doNots: [
          "Do not report broken behaviour as a feature request — use Bug Report.",
          "Do not submit duplicate requests for the same idea without checking My tickets first.",
          "Do not expect immediate implementation; feature requests are prioritised separately from bugs.",
        ],
      },
      {
        id: "help-center-feedback",
        title: "Feedback ticket",
        purpose:
          "Share overall experience, satisfaction, and qualitative thoughts about Flipvise.",
        howItWorks: [
          "Fields: Overall Rating (1–5 stars, optional), Subject (defaults to “App Feedback”), Your Feedback (required, min 5 characters), optional attachment.",
          "Star rating is included in the ticket message sent to support.",
          "Use for praise, UX suggestions, or general comments that are not bug reports or feature specs.",
          "Submit with Send Feedback.",
        ],
        requirements: ["Signed-in account."],
        doNots: [
          "Do not use Feedback for urgent bugs or billing disputes — use the dedicated tabs.",
          "Do not expect a star-only submission; the text field is still required.",
        ],
      },
      {
        id: "help-center-billing",
        title: "Billing ticket",
        purpose:
          "Resolve subscription charges, refunds, plan mismatches, and Stripe billing issues.",
        howItWorks: [
          "Fields: Issue Summary (required), Details (required, min 10 characters), optional attachment (e.g. invoice screenshot).",
          "Include charge dates, amounts, plan names, or Stripe receipt details in Details.",
          "Submit with Submit Billing Request.",
          "For self-service changes (upgrade, cancel, payment method), also try Account → Billing or the Stripe portal from the pricing page.",
        ],
        requirements: [
          "Signed-in account.",
          "Billing-related issue (charges, refunds, subscription status).",
        ],
        doNots: [
          "Do not paste full credit card numbers — use last four digits only if needed.",
          "Do not use Billing for general app how-to questions.",
          "Do not cancel solely via ticket if Manage subscription in the app meets your needs.",
        ],
      },
      {
        id: "help-center-account",
        title: "Account ticket",
        purpose:
          "Problems with sign-in, profile, access, data export, or account settings.",
        howItWorks: [
          "Fields: Issue Summary (required), Details (required, min 10 characters), optional screenshot.",
          "Use for locked-out accounts, wrong email on file, missing access after invite, or profile issues.",
          "Submit with Submit Account Request.",
          "For permanent deletion, use Clerk Security → Delete account (intercepted by Flipvise confirmation).",
        ],
        requirements: ["Signed-in account (or describe the email on the affected account in Details)."],
        doNots: [
          "Do not request account deletion through this form — use the account delete flow.",
          "Do not share your password in the ticket.",
          "Do not use Account for Stripe charge disputes — use Billing.",
        ],
      },
      {
        id: "help-center-my-tickets",
        title: "My tickets",
        purpose:
          "View submitted tickets, read support replies, and continue conversations.",
        howItWorks: [
          "Lists all your tickets with subject, preview text, and status badge (Open, In progress, Resolved, Closed).",
          "Tap a ticket to open the thread dialog with full message history.",
          "Original message and attachments appear at the top; support replies are highlighted.",
          "Reply to support with the text area and Send reply while the ticket is open.",
          "Mark issue as resolved when satisfied; Reopen ticket if the problem returns after resolution.",
          "Closed tickets cannot receive new replies.",
        ],
        requirements: ["Signed-in account.", "At least one previously submitted ticket to see a list."],
        doNots: [
          "Do not open a duplicate ticket for an existing open thread — reply in My tickets instead.",
          "Do not mark resolved until the issue is actually fixed.",
          "Do not expect to edit or delete sent messages after submission.",
        ],
      },
      {
        id: "help-center-priority-support",
        title: "Priority Support (Pro Plus & team tier)",
        purpose:
          "Fast-track email support for Pro Plus subscribers and team-tier plan owners.",
        howItWorks: [
          "Appears as the first row on the Help Center landing screen when you have Pro Plus, an active team-tier subscription, or platform admin access.",
          "Shows Pro Plus / Team badge, response-time targets, and benefits (senior engineers, screen-sharing, best-practice guidance).",
          "Send Email opens your mail client with a pre-filled Priority Support subject.",
          "Target response: within 4 business hours (Mon–Fri, 9am–5pm EST).",
          "Standard Pro subscribers do not see this tab — use Support or email support instead.",
        ],
        requirements: [
          "Pro Plus personal subscription, active team-tier plan (Team Basic, Team Gold, Platinum, or Enterprise), or platform administrator role.",
        ],
        doNots: [
          "Do not expect Priority Support on the standard Pro plan — upgrade to Pro Plus or a team tier.",
          "Do not assume Priority Support replaces in-app tickets — use My tickets to track formal requests.",
          "Do not omit your account email in priority email requests.",
        ],
      },
    ],
  },
  {
    id: "contact-us",
    title: "Contact Us",
    description:
      "Public Contact Support page, live chat threads, and how guests and signed-in users continue conversations.",
    pages: [
      {
        id: "contact-us-page",
        title: "Contact Support page",
        route: "/contact",
        purpose:
          "Public page to start a live conversation with Flipvise platform administrators, view official contact channels, and find links to Help Center and documentation.",
        howItWorks: [
          "Send a message card: fill in Name, Email, Subject, and Message (minimum 10 characters), then click Start conversation.",
          "After submit you are redirected to your live chat thread at /contact/thread/[messageId] — administrators are notified immediately.",
          "Name and Email pre-fill when you are signed in (from your Clerk profile).",
          "Contact details card lists the support inbox (mailto link), optional phone number, and social media links configured by the platform team.",
          "In-app Help Center card explains categorized tickets for signed-in users and links to the Help Center section in this guide.",
          "Check the documentation first card links back to this user guide for self-service answers.",
        ],
        requirements: [
          "None — guests and signed-in users can open /contact.",
          "Valid email address on the form (used to match your thread if you sign in later).",
        ],
        doNots: [
          "Do not include passwords, full payment card numbers, or secret API keys in your message.",
          "Do not use Contact Us for team quiz or assignment issues — contact your team admin first.",
          "Do not expect the Contact Us link in the top nav when signed in — bookmark /contact or use your inbox notification instead.",
        ],
      },
      {
        id: "contact-us-live-chat",
        title: "Live conversation thread",
        route: "/contact/thread/[messageId]",
        purpose:
          "Real-time-style chat with the support team after submitting Contact Us — view history, send follow-up messages, and receive admin replies.",
        howItWorks: [
          "Opens automatically after you submit the Contact Us form, or from an inbox notification when signed in.",
          "Header shows the conversation subject; a status badge reads Open, In progress, or Archived.",
          "Your original message appears at the top; subsequent messages appear in chronological order below.",
          "Administrator replies are highlighted with a “Support team” label and distinct styling.",
          "Type in Reply to support and click Send message to continue the conversation.",
          "New replies from either side appear automatically — the page refreshes the thread every few seconds while it is open.",
          "An Updating… indicator appears briefly during background refresh.",
          "Archived conversations show a notice and no longer accept new messages.",
        ],
        requirements: [
          "A previously submitted Contact Us message (message ID in the URL).",
          "Guests: the private access token in the URL (?token=…) from your redirect after submit — bookmark this page.",
          "Signed-in users: access without the token when the message belongs to your account (matching user ID or email).",
        ],
        doNots: [
          "Do not lose your guest thread URL — without the token you cannot reopen the conversation.",
          "Do not share your thread URL publicly — anyone with the token can read and reply.",
          "Do not start a duplicate thread for the same issue — reply in the existing conversation instead.",
          "Do not refresh expecting instant push notifications — updates use short-interval polling, not WebSockets.",
        ],
      },
      {
        id: "contact-us-guest-vs-signed-in",
        title: "Guests vs signed-in users",
        purpose:
          "How access, notifications, and navigation differ depending on whether you have a Flipvise account.",
        howItWorks: [
          "Guests submit Contact Us with any name and email — no sign-in required.",
          "After submit, guests receive a thread URL with a private ?token= query parameter; save or bookmark it to return.",
          "Guests do not receive inbox notifications — check the thread page for admin replies.",
          "Signed-in users get Name and Email pre-filled; threads are linked to your Clerk user ID.",
          "When an admin replies, signed-in users see a “Support replied: …” item in Dashboard → Inbox with a link to the thread.",
          "Signed-in users can open /contact/thread/[messageId] without the token if they own the message.",
          "Contact Us appears in the top navigation for guests; signed-in users reach /contact via direct URL, documentation, or inbox.",
        ],
        requirements: [
          "Guest: keep the full thread URL including ?token=.",
          "Signed-in: primary email on file for inbox notifications.",
        ],
        doNots: [
          "Do not submit Contact Us with an email you cannot access — you will not receive inbox alerts as a guest.",
          "Do not sign in with a different email than the one on the thread and expect automatic access without the token.",
          "Do not rely on Contact Us inbox items if you submitted while signed out — use your saved thread URL instead.",
        ],
      },
      {
        id: "contact-us-vs-help-center",
        title: "Contact Us vs Help Center",
        purpose:
          "Choose the right support channel: public live chat on Contact Us or categorized in-app tickets in Help Center.",
        howItWorks: [
          "Contact Us (/contact): public page, live chat thread, available to guests and signed-in users; best for general outreach or when not signed in.",
          "Help Center (Documentation → Help Center section): categorized tickets (Support, Bug Report, Feature Request, Feedback, Billing, Account) with optional attachments.",
          "Help Center My tickets tracks formal ticket threads with resolve/reopen — separate from Contact Us live chat.",
          "Priority Support (Pro Plus / team tier) appears inside Help Center, not on Contact Us.",
          "Contact details (email, phone, social) on /contact are managed by platform administrators and apply to both channels.",
          "Use Contact Us for a quick live conversation; use Help Center when you need a specific category, screenshot attachment, or ticket status workflow.",
        ],
        requirements: [
          "Contact Us: none.",
          "Help Center: signed-in account with Help Center visible in your workspace context.",
        ],
        doNots: [
          "Do not submit the same issue in both Contact Us and Help Center unless instructed — pick one channel.",
          "Do not use Contact Us for structured bug reports with severity — use Help Center → Bug Report.",
          "Do not expect Help Center ticket attachments on Contact Us — the live chat is text-only.",
        ],
      },
    ],
  },
  {
    id: "pricing-billing",
    title: "Pricing & Billing",
    description:
      "Plans, Stripe checkout, overseas billing, prorations, and promotion codes.",
    pages: [
      {
        id: "pricing",
        title: "Pricing Page",
        route: "/pricing",
        purpose:
          "Compare tiers, choose monthly or yearly billing, and start checkout.",
        howItWorks: [
          "Toggle Billing period between monthly and yearly (yearly shows an effective monthly rate).",
          "Filter plans with the View plans dropdown, or show all tiers in the grid.",
          "Each card lists features, price, and — during a sale — a promo badge and code for that tier only.",
          "Enter a promotion code in the field above the plan cards (optional). Codes can also pre-fill from ?promo= in the URL.",
          "Active public codes appear as quick-fill chips under the promo field when a tier’s general sale is running.",
          "Signed-in users see a Current plan badge; active subscribers also get Manage subscription.",
          "Choose a plan → review on /pricing/checkout → pay on Stripe Embedded Checkout.",
        ],
        requirements: [
          "Guests can browse; sign-in is required to purchase.",
          "Promotion codes only apply to new subscriptions — not when changing plans (see Prorations).",
        ],
        doNots: [
          "Do not complete checkout signed in as the wrong Clerk account.",
          "Do not enter a Pro promo when buying Pro Plus — each code is tier-specific.",
          "Team-tier subscribers: workspace switcher is hidden on /pricing — return to dashboard first if needed.",
        ],
      },
      {
        id: "stripe-billing-payment",
        title: "Stripe Billing & Payment",
        purpose:
          "How Flipvise collects payment, including overseas billing addresses and cards.",
        howItWorks: [
          "All paid plans bill through Stripe Checkout (subscription mode) — not a separate in-app card form on the pricing page.",
          "Billing address is required at checkout. Enter your real country, city, postal code, and street address — overseas/international addresses are supported.",
          "Pay with a credit or debit card Stripe accepts in your region. Flipvise does not store your full card number; Stripe handles PCI-compliant payment data.",
          "Stripe Automatic Tax may calculate tax from your billing address. The checkout summary shows subtotal, any discount, tax (if applicable), and total before you confirm.",
          "Tax ID collection is enabled for business customers where Stripe supports it.",
          "After purchase, receipts and invoices appear in the Stripe Customer Portal (Manage subscription) and may sync to your Flipvise inbox.",
          "Currency is determined by the Stripe Price for your selected plan (typically USD for this app’s catalog).",
        ],
        requirements: [
          "Signed-in Clerk account.",
          "Valid payment method accepted by Stripe for your country.",
          "Billing address that matches what your bank expects for international charges (reduces declines).",
        ],
        doNots: [
          "Do not use a VPN-only fake address — mismatches can cause tax errors or payment failures.",
          "Do not assume tax is always zero; overseas customers may see VAT/GST/sales tax when Stripe Tax applies.",
          "Do not share Checkout session links — they are tied to your account session.",
        ],
      },
      {
        id: "checkout",
        title: "Checkout Flow",
        route: "/pricing/checkout",
        purpose:
          "Confirm plan, billing period, promo, and amount due before Stripe payment.",
        howItWorks: [
          "Review selected plan name, monthly vs yearly period, and list price.",
          "New subscribers: promo field applies here; discount shows on the payment step if valid.",
          "Existing subscribers upgrading/downgrading: see a proration preview instead of a fresh promo (promos are blocked on plan changes).",
          "Slide to confirm or continue → /pricing/checkout/pay (new sub) or plan-change payment (existing sub).",
          "Stripe Embedded Checkout collects card + billing address and shows final total with tax.",
          "Success redirects to /dashboard?checkout=success with a confirmation toast.",
        ],
        requirements: ["Signed-in account.", "Valid paid plan slug in the URL."],
        doNots: [
          "Do not abandon checkout and retry with a different Clerk account — metadata is tied to your user.",
          "Do not apply a promo on plan-change checkout — remove the code and rely on proration.",
        ],
      },
      {
        id: "manage-subscription",
        title: "Manage Subscription & Billing Portal",
        purpose:
          "Update payment method, view invoices, cancel, or change plan outside first purchase.",
        howItWorks: [
          "From /pricing: Manage subscription (when you have an active Stripe subscription).",
          "From Account menu → Billing tab: Manage billing and Cancel subscription.",
          "Opens Stripe Customer Portal in a new page — update card, download invoices, cancel at period end.",
          "Plan upgrades/downgrades can also start from /pricing (Change to …) which uses in-app proration checkout.",
          "Billing tab shows plan history (past plan slugs and dates) synced from your account.",
        ],
        requirements: ["Active or manageable Stripe subscription on your account."],
        doNots: [
          "Do not cancel in Stripe portal without understanding you lose paid features at period end.",
          "Complimentary or admin-granted plans may hide paid Stripe controls — contact support instead.",
        ],
      },
      {
        id: "prorations-plan-changes",
        title: "Prorations & Plan Changes",
        purpose:
          "Fair billing when switching plans mid-cycle on an existing subscription.",
        howItWorks: [
          "If you already subscribe, choosing another paid tier on /pricing routes to plan-change checkout — not a second full-price subscription.",
          "Stripe calculates proration: credit for unused time on the old plan and charge for the new plan for the remainder of the billing period.",
          "Checkout shows line items (credits as negative amounts, charges as positive) and Amount due today.",
          "Badge on plan-change payment: “Prorated adjustment — no additional promo discount”.",
          "Previous promotion discounts do not carry over to plan changes — only the prorated difference is billed.",
          "Switching monthly ↔ yearly on the same tier also reprices with proration.",
        ],
        requirements: ["Active Stripe subscription managed by Flipvise."],
        doNots: [
          "Do not enter a promo code when changing plans — the app rejects it; use proration only.",
          "Do not expect a second introductory discount after you already used a campaign on first purchase.",
          "Do not purchase the same plan and period again — checkout blocks duplicate selections.",
        ],
      },
      {
        id: "promo-general",
        title: "General Promotion Codes",
        purpose:
          "Seasonal or campaign discounts configured per plan tier (e.g. SUMMER26 on Pro).",
        howItWorks: [
          "Each paid tier can have its own general promo in admin/plans config: discount %, label, Stripe coupon id, and a start/end schedule (promo window).",
          "When a tier’s general sale is active, its plan card shows the promo label and code; the code also appears under Active codes on the pricing page.",
          "Enter the exact code (case-insensitive) in Promotion code, or leave blank — if the tier has an active general sale, checkout may auto-apply that tier’s coupon for new subscriptions.",
          "General codes apply only to the matching tier. Using SUMMER26 on Pro Plus when that code belongs to Pro will fail.",
          "Each customer can redeem a given promo campaign once per account (tracked across checkout and invoices).",
          "If the window has not started or has ended, checkout rejects the code even if you still have it saved.",
        ],
        requirements: [
          "New subscription checkout (not plan change).",
          "Plan tier must have general discount active inside its promo window.",
        ],
        doNots: [
          "Do not reuse the same campaign code on a second subscription — you will see an already redeemed error.",
          "Do not apply a code to a tier with no active general sale — remove the code and pay list price.",
        ],
      },
      {
        id: "promo-affiliate",
        title: "Affiliate Promotion Codes",
        purpose:
          "Combined codes that link a tier’s base promo with an affiliate partner for a higher discount.",
        howItWorks: [
          "Format: {baseCouponId}{affiliateSuffix} — e.g. SummerLaunchusera1276 (base + affiliate promotional code, no separator).",
          "Base coupon id matches the tier’s general stripeCouponId (Pro and Pro Plus use different bases).",
          "Affiliate discount % comes from the checkout plan’s affiliateDiscount setting (can differ per tier).",
          "Affiliate sales require both general and affiliate discounts active in the tier’s promo window.",
          "Affiliate must be an active marketing partner in the system; inactive affiliates are rejected.",
          "Affiliate codes follow the same once-per-customer-per-campaign redemption rule as general promos.",
          "Successful affiliate checkouts record affiliateId in subscription metadata for reporting.",
        ],
        requirements: [
          "Valid combined code from an active affiliate.",
          "Target plan must have affiliate discount enabled for the current promo season.",
          "New subscription only.",
        ],
        doNots: [
          "Do not guess suffixes — invalid affiliate segments show “Unknown affiliate promotion code”.",
          "Do not use an affiliate code on a tier whose affiliate sale is off even if general sale runs on another tier.",
        ],
      },
      {
        id: "promo-seasonal-by-plan",
        title: "Seasonal Promos by Plan",
        purpose:
          "Why some plans show a sale while others do not at the same time.",
        howItWorks: [
          "Promotions are configured per plan — not globally. Pro can run a summer sale while Pro Plus, Team Basic, etc. have no discount.",
          "Each tier with a sale needs: discount.active, a stripeCouponId, promoStartsAt, and promoEndsAt (or discontinueAt) defining the season.",
          "Outside that window, the plan card shows list price only — no badge, no active code chip.",
          "Affiliate discounts on a tier are independently toggled (affiliateDiscount.active) but share the same schedule window as the tier’s general promo.",
          "When a season ends, expired promos deactivate automatically — codes stop working at checkout.",
          "Example pattern: Pro has SUMMER26 5% Jun 1–14; Pro Plus had SummerLaunchProPlus26 but affiliate/general flags off — only Pro shows a live sale.",
          "Team tiers may have no promo fields at all — full price unless admin adds a future season.",
        ],
        requirements: [
          "Check each plan card on /pricing for badges and Promo code lines — that tier only.",
        ],
        doNots: [
          "Do not assume one site-wide coupon works on every tier.",
          "Do not copy a code from a tier that is not displaying an active promo badge.",
          "Do not expect expired seasons to honor old marketing emails — verify on the pricing page first.",
        ],
      },
    ],
  },
  {
    id: "account-clerk",
    title: "Account Menu (Clerk)",
    description:
      "Profile, security, appearance, billing, and account deletion via the account avatar.",
    pages: [
      {
        id: "clerk-profile",
        title: "Clerk Profile & Security",
        purpose:
          "Manage name, email, password, connected accounts, and sessions.",
        howItWorks: [
          "Click your avatar in the header to open Manage account.",
          "Profile: update display name and profile image.",
          "Email addresses: add, verify, or set primary email.",
          "Security: change password, enable 2FA, review active sessions.",
        ],
        requirements: ["Signed-in account."],
        doNots: [
          "Do not remove your primary email if you rely on team or affiliate invites tied to it.",
          "Do not delete your account from Clerk Security without reading Flipvise’s delete confirmation first.",
        ],
      },
      {
        id: "appearance-settings",
        title: "Appearance (Custom Tab)",
        clerkTab: "appearance",
        purpose: "Theme mode, interface colors, and microphone settings.",
        howItWorks: [
          "Choose light or dark base theme.",
          "Pro users pick interface background accent colors (8 on Pro, 12 on Pro Plus and above).",
          "Free users choose from 3 interface color presets.",
          "Microphone settings configure speech-to-text input for deck creation.",
        ],
        requirements: [
          "Signed-in account.",
          "Pro palette requires Pro or higher.",
          "Full 12-color palette requires Pro Plus, team tier, or admin grant.",
        ],
        doNots: [
          "Do not expect Pro Plus colors on a Free plan — upgrade via Pricing.",
        ],
      },
      {
        id: "billing-tab",
        title: "Billing (Custom Tab)",
        clerkTab: "billing",
        purpose:
          "View current plan, Stripe portal access, cancellation, and plan history.",
        howItWorks: [
          "Shows effective plan label and access subtitle.",
          "Manage billing opens Stripe Customer Portal — update overseas billing address, card, download invoices.",
          "Cancel subscription with prorated refund preview when eligible.",
          "Plan history table lists past plan changes.",
          "See Pricing & Billing docs for prorations, promos, and first-time checkout.",
        ],
        requirements: [
          "Signed-in account.",
          "Paid Stripe controls hidden for complimentary or admin-granted access.",
        ],
        doNots: [
          "Do not cancel via Stripe portal alone without reviewing in-app plan impact.",
          "Complimentary plans: contact support instead of expecting Stripe charges.",
        ],
      },
      {
        id: "account-delete",
        title: "Delete Account",
        purpose:
          "Permanently remove your Flipvise account and associated data.",
        howItWorks: [
          "Clerk Security → Delete account is intercepted by Flipvise.",
          "A confirmation dialog explains consequences and any prorated refund.",
          "Type DELETE to confirm permanent deletion.",
        ],
        requirements: ["Signed-in account."],
        doNots: [
          "Do not delete if you are the sole owner of active team workspaces without transferring ownership.",
          "Deletion is irreversible — export important decks first.",
        ],
      },
    ],
  },
  {
    id: "team-admin",
    title: "Team Admin Dashboard",
    description: "Management tools for team owners and co-admins.",
    pages: [
      {
        id: "team-admin-overview",
        title: "Team Admin Overview",
        route: "/dashboard/team-admin",
        purpose:
          "Central hub for members, deck assignment, invites, quiz settings, and workspace history.",
        howItWorks: [
          "Access via workspace switcher → To Admin Dash, or direct URL with ?team= and teamMemberId=.",
          "Default landing: Deck Manager → Assign decks to members.",
          "Owners (teamMemberId=0) see all owned workspaces; co-admins see scoped workspaces.",
        ],
        requirements: [
          "Team owner or invited team_admin role.",
          "Active team-tier subscription on the workspace.",
        ],
        doNots: [
          "Plain team members cannot access Team Admin.",
          "Do not create decks here — author on Personal Dashboard, then assign in Deck Manager.",
        ],
      },
      {
        id: "members",
        title: "Members",
        route: "/dashboard/team-admin/members",
        purpose: "View roster, change roles, and remove members.",
        howItWorks: [
          "List all members with roles (Member, Team Admin).",
          "Double-click a member row to open a details dialog (name, email, acceptance date, role, workspace, assigned decks).",
          "Promote or demote co-admins.",
          "Remove members who should no longer access the workspace.",
        ],
        requirements: ["Team owner or team_admin."],
        doNots: [
          "Do not remove yourself if you are the only admin.",
          "Removing a member revokes their assignments immediately.",
        ],
      },
      {
        id: "deck-manager",
        title: "Deck Manager",
        route: "/dashboard/team-admin/deck-manager/assign-decks-to-members",
        purpose: "Link subscriber decks to the workspace and assign them to members.",
        howItWorks: [
          "Assign decks from the subscriber’s personal library to team members.",
          "Study Privileges sub-tab (/dashboard/team-admin/deck-manager/study-privileges) controls review vs quiz access per member per deck.",
          "Study Privileges also configures quiz question formats (multiple choice, true/false, fill-in-the-blank) per workspace or per deck.",
          "Workspace selector shows the workspace name (not the numeric id).",
          "After formats are saved, set Questions per format — number inputs for each enabled type that must add up to the deck’s card total (e.g. 10 cards: MCQ 5, True/False 2, Fill in the blank 3).",
          "Progressive workflow per deck: change formats → Save deck formats → enter question counts → Generate AI quiz sentences (when needed) → Reshuffle format questions.",
          "Reshuffle assigns your exact per-format counts across cards (which card gets which format is shuffled) for all members until reshuffled again.",
        ],
        requirements: [
          "Team owner or team_admin.",
          "Decks authored on personal dashboard.",
          "AI quiz generation: Pro Plus, team-tier workspace, or platform admin; OpenAI API key configured in production.",
          "Question counts must sum to eligible cards (front and back filled) before Generate or Reshuffle.",
          "Reshuffle requires at least two formats with a count greater than zero and AI content where true/false or fill-in-the-blank counts require it.",
        ],
        doNots: [
          "Do not expect members to see unassigned decks.",
          "Do not disable all study modes without notifying members.",
          "Do not click Generate or Reshuffle before saving format checkboxes — save deck or workspace formats first.",
          "Do not generate or reshuffle until question counts add up to the deck total shown in the UI.",
          "Saving new format settings clears prior counts and reshuffle assignments — re-enter counts and reshuffle after saving if needed.",
        ],
      },
      {
        id: "invite-members",
        title: "Invite Members",
        route: "/dashboard/team-admin/invite-members/send-invite",
        purpose: "Send, track, and revoke team invitations.",
        howItWorks: [
          "Send Invite emails a 3-day expiring link.",
          "Pending Invitations lists revocable open invites.",
          "Invite History shows past invitations.",
        ],
        requirements: ["Team owner or team_admin.", "Member slots available on your plan."],
        doNots: [
          "Do not invite the wrong email — invites are email-locked.",
          "Expired invites must be resent; they cannot be extended.",
        ],
      },
      {
        id: "quiz-results-admin",
        title: "Quiz Results",
        route: "/dashboard/team-admin/quiz-results",
        purpose: "Review member quiz scores and configure quiz policies.",
        howItWorks: [
          "View and filter quiz results across members.",
          "Quiz Timer: set time limits for team quizzes.",
          "Quiz Schedule: restrict when quizzes can be taken.",
          "Quiz Security: anti-cheating and session rules.",
        ],
        requirements: ["Team owner or team_admin."],
        doNots: [
          "Do not change schedule or security mid-session without warning members.",
        ],
      },
      {
        id: "ws-history",
        title: "Workspace History",
        route: "/dashboard/team-admin/ws-history",
        purpose: "Audit log of workspace create, rename, and delete events.",
        howItWorks: ["Read-only timeline of workspace administration actions."],
        requirements: ["Team owner or team_admin."],
        doNots: ["History cannot be edited or deleted by users."],
      },
    ],
  },
  {
    id: "invites-onboarding",
    title: "Invites & Onboarding",
    description: "Team setup and invitation acceptance flows.",
    pages: [
      {
        id: "team-onboarding",
        title: "Team Onboarding",
        route: "/onboarding/team",
        purpose: "Create your first team workspace after purchasing a team-tier plan.",
        howItWorks: [
          "Wizard prompts for team name and creates the workspace.",
          "Redirects to Team Admin or dashboard when complete.",
          "Banner on personal dashboard links here if you have a team plan but no team yet.",
        ],
        requirements: ["Active team-tier subscription.", "No existing team yet."],
        doNots: ["Do not skip onboarding if you need team features — create the workspace first."],
      },
      {
        id: "accept-team-invite",
        title: "Accept Team Invite",
        route: "/invite/team/[token]",
        purpose: "Join a team workspace from an email invitation link.",
        howItWorks: [
          "Shows team name and assigned role before acceptance.",
          "Sign in with the invited email address, then accept.",
          "Redirects to dashboard in team context after success.",
        ],
        requirements: ["Valid pending invite.", "Clerk account matching invited email."],
        doNots: [
          "Do not accept with a different email — acceptance will fail.",
          "Expired or used invites show an error; ask the admin to resend.",
        ],
      },
      {
        id: "affiliate-invite",
        title: "Affiliate Invites",
        route: "/affiliate/accept",
        purpose: "Accept marketing affiliate arrangements and complimentary plan grants.",
        howItWorks: [
          "Email link opens acceptance page.",
          "Sign in with invited email to activate affiliate benefits.",
          "Confirm arrangement changes via /affiliate/confirm-arrangement when prompted.",
        ],
        requirements: ["Valid affiliate token.", "Matching invited email."],
        doNots: [
          "Do not forward invite links — they are single-use and email-bound.",
        ],
      },
    ],
  },
  {
    id: "affiliate-portal",
    title: "Affiliate Portal",
    description: "Self-service tools for active marketing affiliates.",
    pages: [
      {
        id: "affiliate-dashboard",
        title: "Affiliate Portal",
        route: "/dashboard/affiliate",
        purpose: "Manage promo codes, track referrals, and view quotas.",
        howItWorks: [
          "Header Affiliate button appears when you have an active arrangement.",
          "View active and expired promo codes.",
          "Monitor referral stats and arrangement end dates.",
        ],
        requirements: ["Active marketing affiliate arrangement."],
        doNots: [
          "Do not share promo codes outside your approved channels.",
          "Non-affiliates are redirected to the main dashboard.",
        ],
      },
    ],
  },
];
