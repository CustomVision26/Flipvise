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
          "Deck grid or list toggle for browsing your library.",
          "Add Deck opens creation: name/subject/course, description/topic, grade, difficulty, optional first card front image, and gradient.",
          "Edit deck updates the same metadata and first card front image from a deck card menu.",
          "Each deck card links to the deck editor and study session.",
          "Usage banners show deck count and cards-per-deck limits for your plan.",
        ],
      },
      {
        id: "limits",
        title: "Plan limits (personal workspace)",
        table: {
          headers: ["Plan", "Decks", "Cards per deck"],
          rows: [
            ["Free", "2", "5"],
            ["Pro", "10", "30"],
            ["Pro Plus / team-tier personal", "15", "52"],
            ["Education Plus", "15", "52"],
          ],
        },
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
          "userid and plan query params scope the dashboard for workspace navigation — do not change another user’s userid.",
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
        id: "switching",
        title: "Switching workspaces",
        bullets: [
          "Use the header workspace switcher — Personal Dash for owners; invited workspaces open Team Dashboard.",
          "Owners open Team Admin Dash from the switcher (owned workspaces are not Team Dashboard rows).",
          "Team context is stored in a cookie when invited members switch.",
          "Co-admins should use canonical URLs with ?team= and teamMemberId= — not cookie-only bookmarks.",
        ],
      },
      {
        id: "study",
        title: "Studying in team context",
        bullets: [
          "Review vs quiz modes depend on study privileges set per assignment.",
          "Team quizzes may enforce timer, schedule, and security rules from Team Admin.",
          "Quiz results sync to team admin reporting and your inbox when applicable.",
        ],
      },
    ],
  ),
  a(
    "manage-workspaces",
    "Manage Workspaces — In-Depth Guide",
    "Team-tier subscribers manage owned workspaces at /dashboard/workspaces.",
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
          ],
        },
      },
      {
        id: "access",
        title: "Who can access this page",
        bullets: [
          "Requires an active team-tier subscription and at least one owned workspace.",
          "Invited co-admins without their own team-tier plan cannot manage workspaces here — they use Team Admin for assigned workspaces only.",
        ],
      },
    ],
  ),
];
