export type DocsUiGuideId = "signup" | "signin" | "personal-dashboard" | "pricing";

export const FLIPVISE_UI_GUIDE_LABEL = "Flipvise UI guide";

export const DOCS_UI_GUIDE_ORDER: readonly DocsUiGuideId[] = [
  "signup",
  "signin",
  "personal-dashboard",
  "pricing",
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
};
