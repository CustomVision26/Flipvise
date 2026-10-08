import type { DocArticle } from "@/lib/user-documentation-article-types";

function a(
  pageId: string,
  title: string,
  intro: string,
  sections: DocArticle["sections"],
): DocArticle {
  return { pageId, title, intro, sections };
}

export const TEAM_ADMIN_ARTICLES: DocArticle[] = [
  a(
    "team-admin-overview",
    "Team Admin Dashboard — In-Depth Guide",
    "The Team Admin Dashboard (/dashboard/team-admin) is the management hub for team workspace owners and co-admins.",
    [
      {
        id: "access",
        title: "Who can access",
        table: {
          headers: ["Role", "Access"],
          rows: [
            ["Workspace owner (subscriber)", "All owned workspaces under team plan"],
            ["Team admin (co-admin)", "Workspaces they were invited to manage"],
            ["Team member", "No access — redirected to /dashboard"],
            ["No team yet", "Redirected to /onboarding/team"],
          ],
        },
      },
      {
        id: "navigation",
        title: "Getting there",
        bullets: [
          "Workspace switcher → WS Admin Dash (invited) or Team Admin Dash (personal).",
          "Direct URL: /dashboard/team-admin?team=<id>&teamMemberId=<id>. The member Team Dashboard is /dashboard?team=<id> only.",
          "Default landing redirects to Deck Manager → Assign decks to members.",
          "teamMemberId=0 means you are the subscriber owner.",
        ],
      },
      {
        id: "structure",
        title: "Dashboard structure",
        bullets: [
          "Dashboards bar — owners see Personal Dashboard only. Team Dashboard is omitted because owners already use Personal Dash for workspace decks; Team Admin is omitted because they are already on that dashboard. Invited co-admins still get Team Dashboard (and Team Admin).",
          "Info opens workspace details (name, plan, owner, created date, and setup fields saved when the workspace was created).",
          "Workspace overview stats — workspaces, members, decks, cards vs plan limits.",
          "Add Workspace (owners) opens Manage Workspaces (/dashboard/workspaces) to create another workspace. Open create workspace guide for the screenshot walkthrough.",
          "Main tabs: Members, Deck Manager, Add-ons (only when a paid or assigned add-on matches this workspace plan), Workspace history, Invite members, Quiz results.",
        ],
      },
      {
        id: "workflow",
        title: "Core workflow",
        paragraphs: [
          "Create decks on Personal Dashboard → link in Deck Manager → assign to members → configure study privileges and quiz policies.",
        ],
      },
    ],
  ),
  a(
    "team-admin-add-ons",
    "Member Add-ons — In-Depth Guide",
    "Review member add-on availability at /dashboard/team-admin/add-ons. AI Essay member assignment is coming soon.",
    [
      {
        id: "assign",
        title: "Assigning features",
        bullets: [
          "AI Essay is not assignable to workspace members yet — Coming soon on Member add-ons.",
          "Only the plan owner can use AI Essay on their personal dashboard right now.",
          "Workspace members who open AI Essay see Coming soon until member access ships.",
          "Live Classroom™ is an organization add-on purchased by the subscription owner. After purchase, assign members to the Live Classroom team in Live Classroom™ → Settings.",
          "Future member add-ons will reuse this Team Admin surface.",
          "Catalog purchase uses /pricing/add-ons/pay without a Stripe session id in the URL.",
        ],
      },
    ],
  ),
  a(
    "members",
    "Members — In-Depth Guide",
    "Manage roster, roles, and removals at /dashboard/team-admin/members.",
    [
      {
        id: "table",
        title: "Member table",
        bullets: [
          "Owner row always shown with Owner (subscriber) role — cannot be removed.",
          "Columns: User, Created, Updated, Added by (inviter), Role, Actions.",
          "Inviter shows workspace owner vs team admin who sent the invite.",
          "Double-click any member row to open a details dialog with name, email, acceptance date, role, workspace, and assigned deck names.",
        ],
      },
      {
        id: "roles",
        title: "Roles",
        table: {
          headers: ["Role", "Capabilities"],
          rows: [
            ["Owner", "Full control; creates decks on personal dashboard"],
            ["Team admin", "Manage members, decks, invites, quiz settings"],
            ["Member", "Studies assigned decks only"],
          ],
        },
      },
      {
        id: "history",
        title: "Membership history",
        bullets: [
          "Use the Membership history sub-tab in the Members panel (next to Roster) to review add/remove events.",
          "Columns: Event time, Action (Added / Removed), Member, Role, By (who performed the action).",
          "History starts from when this feature was enabled — earlier joins and removals are not backfilled.",
        ],
      },
      {
        id: "actions",
        title: "Actions and restrictions",
        bullets: [
          "Promote member to Team admin or demote co-admin to Member.",
          "Remove member — they lose workspace access immediately.",
          "Cannot change your own role or remove yourself from the table.",
          "Team admins can change role and remove a member only when Added by (inviter) is that team admin. The workspace owner can manage every member.",
          "Removing a member does not auto-clean deck assignments — review separately.",
        ],
      },
    ],
  ),
  a(
    "deck-manager",
    "Deck Manager — In-Depth Guide",
    "Link personal decks and assign them to members at /dashboard/team-admin/deck-manager/assign-decks-to-members.",
    [
      {
        id: "link",
        title: "Step 1 — Link personal decks (owner only)",
        bullets: [
          "Pulls decks from subscriber’s personal library. Open link deck to workspace guide to follow Assign decks, choosing a personal deck, and linking it until it shows (already linked).",
          "Link adds a deck to the workspace for assignment.",
          "Already-linked decks show an Unlink from workspace button — unlinking removes the deck from the workspace and drops every member’s access to it (the deck stays on Personal Dashboard and can be re-linked).",
          "Co-admins do not see personal library — only owner links or unlinks decks.",
        ],
      },
      {
        id: "assign",
        title: "Step 2 — Assign to members",
        bullets: [
          "Assign to members and team admins (not the owner row). Open assign deck to member in a workspace guide to follow choosing the member, linked deck, and study modes, then Assign deck and the member’s Team Dashboard. Open assign deck to team admin in a workspace guide to follow choosing a co-admin, setting Decks this team admin may create, Assign deck, the Members roster, and Assignments by member.",
          "Records who assigned and when.",
          "Set study privilege on assign: Standard Review, AI Recall™, Quiz, or combinations (default: all three).",
          "Unassign removes member access to that deck in the workspace.",
          "Assignments by member table — workspace owner sees all members and workspaces; team admins see only the current workspace’s members (no Workspace column). Decks allowed shows how many decks an Education Gold / Enterprise team admin may create in that workspace (owner-set cap, or the plan default) and how many they have already created. Regular members show an em dash. Team admins can update assignments. They can remove a member’s deck access only if they invited that member (Added by).",
        ],
      },
      {
        id: "privileges",
        title: "Study privileges sub-tab",
        bullets: [
          "/dashboard/team-admin/deck-manager/study-privileges",
          "The table lists every eligible assignment. Click a row to open that member’s study modes (Standard Review, AI Recall™, Quiz, or combinations) and Save changes. Open change study mode privileges guide to follow the table, the open panel, Save changes, and the member’s study session.",
          "Change Standard Review, AI Recall™, and/or Quiz access per member per assigned deck.",
          "Options include single modes and combinations (e.g. AI Recall™ only, Standard Review & AI Recall™, all three).",
          "Applies to team members in the privileges table (and Education Gold / Enterprise team admins).",
          "Quiz question formats (workspace defaults, per-deck overrides, publish) are under Study Modes → Quiz Mode → Quiz formats.",
        ],
      },
    ],
  ),
  a(
    "study-modes-active-recall",
    "Active Recall Mode — In-Depth Guide",
    "Monitor saved AI Recall™ results at /dashboard/team-admin/study-modes/active-recall.",
    [
      {
        id: "performance",
        title: "Performance overview",
        bullets: [
          "Team recall accuracy, average AI score, and average session time roll up every saved session in the workspace. Open AI Recall™ study mode control and settings for a workspace guide to follow Performance, a member completing AI Recall™, then deck and member monitors.",
          "Metrics update when a member completes and saves an AI Recall™ session on an assigned deck.",
        ],
      },
      {
        id: "members",
        title: "Track members",
        bullets: [
          "The Members tab lists each learner with at least one saved session: session count, accuracy, average AI score, average time, and last session.",
          "Click a member row to open that person’s saved sessions (deck, accuracy, AI score, duration, cards, correct answers, and misses).",
          "Search filters the member list by name.",
        ],
      },
      {
        id: "decks",
        title: "Track decks",
        bullets: [
          "The Decks tab lists each deck with saved sessions: session count, unique members, accuracy, average AI score, misses, and last session.",
          "Click a deck row to open every saved session on that material, including which member completed it.",
          "Search filters the deck list by deck name.",
        ],
      },
      {
        id: "insights",
        title: "Instructional insights",
        bullets: [
          "Most missed cards and decks, top learners, and weakest subjects help prioritize reteaching.",
          "Use Track members and decks for the full session history, not only the insight shortlists.",
        ],
      },
      {
        id: "session-cards",
        title: "Session cards",
        bullets: [
          "Route: /dashboard/team-admin/study-modes/active-recall/session-cards",
          "Workspace default applies to linked decks without an override — all cards in the deck, or a fixed number per session. Open AI Recall™ session cards for a workspace guide to follow the default, a per-deck override, Save deck, and the member’s lobby counts.",
          "Per-deck overrides can inherit the workspace default, use all cards in that deck, or set a fixed count.",
          "Members see Cards this session from the effective setting and Cards in deck as the full deck size.",
        ],
      },
    ],
  ),
  a(
    "invite-members",
    "Invite Members — In-Depth Guide",
    "Send, track, and revoke team invitations from Team Admin.",
    [
      {
        id: "send",
        title: "Send invite",
        bullets: [
          "Choose workspace, email, invitee name (required), and role (Member or Team admin). Open invite unregistered member to a workspace guide to follow the screenshots from Send invite through the new member on the roster.",
          "Email must match the address they will sign in with.",
          "Invitee name auto-fills when the email matches a workspace member, a prior invite, or a registered Flipvise account (you can still edit it).",
          "Invites expire in 3 days — expired invites must be resent.",
          "Cannot invite subscriber’s own primary email.",
          "Blocked when members + pending invites reach plan capacity.",
          "New users without a Flipvise account may receive a Loops invitation email; registered users see the invite in dashboard inbox only.",
        ],
      },
      {
        id: "pending",
        title: "Pending invitations",
        bullets: [
          "Lists open invites for the workspace.",
          "Revoke withdraws link before acceptance or expiry.",
        ],
      },
      {
        id: "history",
        title: "Invite history",
        bullets: [
          "Accepted, declined, expired, and revoked invitations — latest outcome per email.",
          "Resending after revoke replaces the earlier revoked/expired row for that address.",
          "Recipients accept at /invite/team/[token].",
        ],
      },
    ],
  ),
  a(
    "quiz-results-admin",
    "Quiz Results & Policies — In-Depth Guide",
    "Review scores and configure quiz formats, timer, schedule, and Exam Mode.",
    [
      {
        id: "results",
        title: "Quiz results tab",
        bullets: [
          "Table: workspace, member, email, deck, score, counts, time, saved date. Open quiz results for a workspace guide to follow the results table, View, Quiz sheets, and the member’s saved score and Review.",
          "Search and filter by workspace and deck.",
          "View full attempt detail; delete result records.",
        ],
      },
      {
        id: "quiz-formats",
        title: "Quiz formats",
        bullets: [
          "Route: /dashboard/team-admin/quiz-results/quiz-formats",
          "Open quiz formats for a workspace guide to follow workspace defaults, a per-deck override, questions per format, Generate AI quiz sentences, Preview (multiple choice, true/false, and fill-in-the-blank), Republish to quiz, and the member’s Timed quiz lobby.",
          "Workspace selector shows the workspace name — pick the workspace before editing defaults or per-deck overrides.",
          "Workspace defaults — enable multiple choice, true/false, and/or fill-in-the-blank for all linked decks that inherit defaults.",
          "Per-deck overrides — uncheck Use workspace defaults to set formats for one deck only.",
          "Shuffle card order (workspace or per-deck) gives each assignee a unique quiz question sequence; the Timed quiz lobby shows when shuffle is in effect and owners/admins can reshuffle there.",
          "Multiple choice works from card content; true/false and fill-in-the-blank need AI-generated quiz sentences.",
          "Personal Pro Plus / Education Plus (paid, admin-assigned, or affiliate) use Format Quiz Question on /decks/[deckId]/study instead of this Team Admin panel.",
        ],
      },
      {
        id: "quiz-format-distribution",
        title: "Questions per format (required counts)",
        bullets: [
          "After format checkboxes are saved, each deck shows a Questions per format panel with a live total (e.g. 7 / 10 cards).",
          "Enter how many questions of each enabled type should appear in quizzes for that deck — counts must be whole numbers totaling between 1 and the deck’s eligible card total (cards with front and back text).",
          "Example for a 10-card deck: Multiple choice 5, True / false 2, Fill in the blank 3 — or a smaller subset such as 3 MCQ only.",
          "Disabled formats must stay at 0; enabled formats can be 0 only if you are not using that type in the mix.",
          "The total turns red with an error message until counts are within the allowed range.",
          "Saving workspace or deck format changes clears entered counts and any prior published mix — set counts again after saving.",
        ],
      },
      {
        id: "quiz-formats-workflow",
        title: "Format setup workflow (save → counts → generate → publish)",
        table: {
          headers: ["Step", "When it appears", "What it does"],
          rows: [
            [
              "Save deck formats",
              "After you change format checkboxes or toggle Use workspace defaults",
              "Writes settings to the deck (or clears per-deck override when inheriting workspace defaults). Clears prior counts and published mix.",
            ],
            [
              "Save workspace formats",
              "After you change workspace default checkboxes",
              "Applies defaults to inheriting decks and clears their counts and published mixes.",
            ],
            [
              "Questions per format",
              "After formats are saved and the deck has at least one eligible card",
              "Number inputs per enabled format. Generate and Publish stay unavailable until counts are valid (1 through the deck total).",
            ],
            [
              "Generate AI quiz sentences",
              "After counts are valid and true/false or fill-in-the-blank is enabled but not enough cards have AI content for those counts",
              "Creates only as many true/false and/or fill-in-the-blank variants as your counts require (not necessarily every card).",
            ],
            [
              "Publish / Republish to quiz",
              "After counts are valid and AI content is ready when needed",
              "Choose Publish all cards (auto-assign formats for your counts) or Choose cards (enter quiz size, browse What quiz takers see previews for enabled formats, check specific cards, then Publish settings). Republish replaces the previous mix.",
            ],
          ],
        },
        bullets: [
          "Follow the order above per deck.",
          "Requires Pro Plus, team-tier workspace, or platform admin for AI generation; production needs a valid OpenAI API key.",
          "Members see the admin’s published mix on the quiz lobby at /decks/[deckId]/study and on each question — in-progress sessions are not updated mid-quiz.",
        ],
      },
      {
        id: "timer",
        title: "Quiz timer",
        bullets: [
          "Owner sets a general quiz duration (minutes) for linked decks, or locks one time across workspaces. Open quiz timer for a workspace guide to follow a workspace-wide time, a per-deck override, Save deck timer, and the member’s Timed quiz clock.",
          "Owner/team admin can set a timed-quiz length per individual deck (presets 5–120 minutes) when not locked. The table lists every linked deck; click a row to open that deck’s timer.",
          "Per-deck timer overrides the workspace/subscriber default when set.",
        ],
      },
      {
        id: "schedule",
        title: "Quiz schedule",
        bullets: [
          "Workspace-level: enable + start date/time for all decks. Open quiz schedule for a workspace guide to follow a workspace or per-deck start time, Save schedule, and the member’s Timed quiz unlock.",
          "Deck-level overrides for specific start times.",
          "Members cannot start quizzes before the scheduled time — Start quiz is greyed out until then, unless a team admin or owner enables it. Timed quiz shows that date and time (and a countdown while the quiz is still locked).",
        ],
      },
      {
        id: "security",
        title: "Exam Mode",
        bullets: [
          "Workspace toggle applies to all decks unless deck overrides. Open quiz Exam Mode for a workspace guide to follow workspace and per-deck locks, Continue, Start over, and Terminate.",
          "Choose Plan owner, Team Admin, and/or Member checkboxes for whom Exam Mode applies. Only the plan owner can enable or disable Exam Mode for the plan owner; team admins cannot change that checkbox.",
          "Per-deck checkboxes can override the workspace audience default.",
          "Sessions can lock, complete, or terminate.",
          "Admins grant resume, restart/redo, or terminate from sessions table.",
          "Disabling Exam Mode clears active sessions for that workspace.",
        ],
      },
    ],
  ),
  a(
    "ws-history",
    "Workspace History — In-Depth Guide",
    "Read-only audit log at /dashboard/team-admin/ws-history.",
    [
      {
        id: "events",
        title: "Recorded events",
        bullets: [
          "Created — workspace created with name.",
          "Updated — rename (shows previous → new name).",
          "Deleted — workspace removed.",
        ],
      },
      {
        id: "notes",
        title: "Notes",
        paragraphs: [
          "History cannot be edited or deleted by users. Empty until the first administrative change.",
        ],
      },
    ],
  ),
  a(
    "live-classroom",
    "Live Classroom™ — In-Depth Guide",
    "Flipvise Live Classroom™ turns eligible Team and Enterprise organizations into a live teaching platform with battles, strategy cards, projector mode, and AI reports.",
    [
      {
        id: "eligibility",
        title: "Who can use it",
        table: {
          headers: ["Plan", "Live Classroom"],
          rows: [
            ["Pro Plus Team Basic / Gold / Platinum / Enterprise", "Eligible organization add-on"],
            ["Education Gold / Education Enterprise", "Eligible organization add-on"],
            ["Free / Pro / Pro Plus / Education Plus", "Not available"],
          ],
        },
      },
      {
        id: "seats",
        title: "Licensing",
        paragraphs: [
          "Live Classroom is an organization add-on purchased by the subscription owner. There are no separate participant packages — maximum participants always equal the organization's licensed seats (for example Team Basic = 5).",
        ],
      },
      {
        id: "workflow",
        title: "Typical session flow",
        bullets: [
          "Open /dashboard/live-classroom?team=<id> (also linked from Personal Dashboard and Team Admin → Add-ons → Live Classroom™ when that add-on is paid or assigned on a compatible plan).",
          "Assign members to the Live Classroom team under Settings before they can join.",
          "Start Session: choose deck or AI warm-up, battle type/mode, timing, and team assignment.",
          "Assigned members join with the lobby code (Join with code); host randomizes battle teams, then starts.",
          "Host dashboard: pause, resume, add time, skip, reveal, mute music, end session.",
          "Projector mode hides private student names while showing question, timer, and leaderboard.",
          "End of session generates AI summary, recommendations, and report exports actions.",
        ],
      },
      {
        id: "roles",
        title: "Permissions",
        bullets: [
          "Subscription owner: purchase/cancel, org settings, Live Classroom team assignments, reports. Always has access.",
          "Workspace membership alone does not grant Live Classroom — members and team admins must be assigned under Settings → Live Classroom team.",
          "Assigned team administrator: create sessions, configure battles, view reports, manage assignments.",
          "Assigned teacher (Can host): host sessions, assign battle teams, monitor battles.",
          "Assigned student (member): join with the lobby code, answer, view own results.",
        ],
      },
    ],
  ),
];
