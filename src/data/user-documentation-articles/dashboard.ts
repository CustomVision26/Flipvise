import type { DocArticle } from "@/lib/user-documentation-article-types";

function a(
  pageId: string,
  title: string,
  intro: string,
  sections: DocArticle["sections"],
): DocArticle {
  return { pageId, title, intro, sections };
}

export const DASHBOARD_ARTICLES: DocArticle[] = [
  a(
    "personal-dashboard",
    "Personal Dashboard — In-Depth Guide",
    "Your personal dashboard (/dashboard) is where you create, organize, and open your own flashcard decks.",
    [
      {
        id: "overview",
        title: "Screen layout",
        bullets: [
          "Open personal dashboard guide to follow the screenshots in order. The guide stays open if you leave this page — close it only when you are finished.",
          "Deck grid, list, or compact tiles. Hover a deck tile to preview its cover image when one is set (the cover is not a flashcard).",
          "Add Deck opens creation: name/subject/course, description/topic, grade, difficulty, optional deck cover image, and gradient.",
          "Edit deck updates the same metadata and cover image from a deck card menu. The cover is not a flashcard.",
          "Delete deck confirms first. Education plans get a detailed impact list: linked lesson plans stay in the Resource Library; Edit and Create Quiz stay available when another related deck (for example a quiz deck from that plan) can take over the link, and become unavailable only when this is the last linked deck. On a non-Education plan with leftover Education lesson-plan links, the dialog warns that the Education link will be lost and that returning to Education later shows only the saved plan without a working deck link.",
          "Each deck card links to the deck editor and study session.",
          "Premium add-ons appear as a running colored banner above the workspace header (not a large mid-page card).",
          "Usage banners show deck count and cards-per-deck limits for your plan.",
        ],
      },
      {
        id: "ai-essay-card",
        title: "Add-ons running banner",
        bullets: [
          "Chips scroll in a soft accent ticker in the top bar; each add-on keeps a distinct tint (e.g. teal for AI Essay, rose for Live Classroom).",
          "Locked chips open Unlock Feature (monthly/yearly Stripe add-on checkout).",
          "Unlocked AI Essay opens the AI Essay workspace; hover pauses the marquee.",
          "Access also comes from Team Admin assignment or a platform admin grant.",
        ],
      },
      {
        id: "limits",
        title: "Plan limits (personal workspace)",
        bullets: [
          "Usage banners on Personal Dashboard follow the deck and cards-per-deck columns below.",
          "Team Basic, Team Gold, Platinum, Enterprise, Education Gold, and Education Enterprise use Pro Plus personal deck and card limits (15 decks, 52 cards per deck).",
          "Education Plus is personal only — Teacher Dashboard tools, no team workspaces.",
          "Team workspace and member caps are enforced on Manage Workspaces, not on the personal deck grid.",
        ],
        table: {
          headers: [
            "Plan",
            "Decks",
            "Cards per deck",
            "Team workspaces",
            "Members per workspace",
          ],
          rows: [
            ["Free", "2", "5", "—", "—"],
            ["Pro", "10", "30", "—", "—"],
            ["Pro Plus", "15", "52", "—", "—"],
            ["Education Plus", "15", "52", "Personal only", "—"],
            ["Team Basic", "15", "52", "2", "5"],
            ["Team Gold", "15", "52", "5", "15"],
            ["Education Gold", "15", "52", "10", "25"],
            ["Platinum", "15", "52", "10", "25"],
            ["Enterprise", "15", "52", "20", "35"],
            ["Education Enterprise", "15", "52", "30", "45"],
          ],
        },
      },
      {
        id: "deleting-decks",
        title: "Deleting decks",
        bullets: [
          "Deleting permanently removes the deck and its flashcards.",
          "Team assignments for that deck are removed — assignees lose access.",
          "Saved Education lesson plans that pointed at the deck can remain in the Resource Library. If another related deck still links the plan, Edit and Create Quiz stay available; if this was the last linked deck, the plan shows Deck deleted and Edit/Create Quiz are unavailable.",
          "If you deleted the deck while on Free, Pro, Pro Plus, or a consumer team tier after previously using Education, the delete dialog already explained that returning to Education later will not restore the deck link.",
        ],
      },
      {
        id: "team-subscribers",
        title: "Team-tier subscribers",
        bullets: [
          "Author all deck content on the personal dashboard — even for team use.",
          "Link and assign decks to members from Team Admin → Deck Manager.",
          "A banner may prompt team onboarding if you have a team plan but no workspace yet.",
        ],
      },
      {
        id: "url-params",
        title: "URL parameters",
        bullets: [
          "The address bar does not include Clerk user ids, plan slugs, or Stripe session ids — identity comes from your signed-in session.",
          "After successful Stripe checkout you may land with ?checkout=success and a confirmation toast.",
        ],
      },
      {
        id: "offline",
        title: "Offline (mobile app)",
        bullets: [
          "Inside the installed Flipvise mobile app, “Offline study” and “Make available offline” buttons appear next to Add Deck.",
          "“Make available offline” downloads your decks and cards to the device; “Offline study” opens the on-device study shell.",
          "Both controls appear only in the native iOS/Android app — they are hidden in a web browser and in the installed website (PWA), where they don't work.",
          "See the Offline & Mobile App guide for the full offline study and sync flow.",
        ],
      },
    ],
  ),
  a(
    "team-workspace-dashboard",
    "Team Workspace View — In-Depth Guide",
    "Invited members and co-admins switch to a team workspace dashboard (/dashboard?team=…). Plan owners keep decks on Personal Dash and manage workspaces in Team Admin.",
    [
      {
        id: "who-sees-what",
        title: "Who sees what",
        table: {
          headers: ["Role", "Deck visibility", "Edit access"],
          rows: [
            [
              "Owner (subscriber)",
              "Personal Dashboard only (workspace-linked decks appear under workspace sections there)",
              "Full edit on Personal Dash; manage members/assignments in Team Admin — not Team Dashboard",
            ],
            [
              "Team admin (invited)",
              "Team Dashboard — created decks (education) and/or assigned decks",
              "Edit decks they created (education); assign via Team Admin; study assigned decks",
            ],
            ["Team member (invited)", "Assigned decks only on Team Dashboard", "Study only — no deck editor"],
          ],
        },
      },
      {
        id: "ai-essay",
        title: "Add-ons on Team Dashboard",
        bullets: [
          "The same premium add-ons running banner appears above the workspace heading.",
          "Hover a deck tile to preview its cover image when one is set. Deck card counts exclude the optional cover image — covers are not flashcards.",
          "Unlocked members can open the AI Essay workspace from the AI Essay chip.",
        ],
      },
      {
        id: "switching",
        title: "Switching workspaces",
        bullets: [
          "Use the header workspace switcher — Personal Dash for owners; invited workspaces open Team Dashboard.",
          "Owners open Team Admin Dash from the switcher (owned workspaces are not Team Dashboard rows).",
          "Plan owners create, rename, and delete owned workspaces from Manage Workspaces, listed under Team Workspace View in this sidebar.",
          "Team context is stored in a cookie when invited members switch.",
          "Co-admins should bookmark /dashboard?team=<workspaceId> — not cookie-only context.",
        ],
      },
      {
        id: "study",
        title: "Studying in team context",
        bullets: [
          "Review vs quiz modes depend on study privileges set per assignment.",
          "Team quizzes may enforce timer, schedule, and Exam Mode rules from Team Admin.",
          "Quiz results sync to team admin reporting and your inbox when applicable.",
        ],
      },
    ],
  ),
  a(
    "manage-workspaces",
    "Manage Workspaces — In-Depth Guide",
    "Team and Education team subscribers manage owned workspaces from Manage Workspaces.",
    [
      {
        id: "actions",
        title: "Available actions",
        bullets: [
          "Create new workspaces up to your plan’s workspace limit.",
          "Rename workspaces you own.",
          "Delete workspaces — this removes associated team data permanently.",
          "View workspace history (create, rename, delete audit events).",
        ],
      },
      {
        id: "limits",
        title: "Workspace limits by tier",
        table: {
          headers: ["Plan", "Max workspaces", "Max members / workspace"],
          rows: [
            ["Team Basic", "2", "5"],
            ["Team Gold", "5", "15"],
            ["Platinum", "10", "25"],
            ["Enterprise", "20", "35"],
            ["Education Gold", "10", "25"],
            ["Education Enterprise", "30", "45"],
          ],
        },
      },
      {
        id: "access",
        title: "Who can access this page",
        bullets: [
          "Requires an active team-tier or education team subscription (Team Basic, Team Gold, Platinum, Enterprise, Education Gold, or Education Enterprise) and at least one owned workspace.",
          "Education Plus is personal only — it does not include Manage Workspaces.",
          "Invited co-admins without their own qualifying plan cannot manage workspaces here — they use Team Admin for assigned workspaces only.",
        ],
      },
    ],
  ),
];
