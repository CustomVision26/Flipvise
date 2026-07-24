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
          "Workspace switcher → To Admin Dash.",
          "Direct URL: /dashboard/team-admin?team=<id>&teamMemberId=<id>.",
          "Default landing redirects to Deck Manager → Assign decks to members.",
          "teamMemberId=0 means you are the subscriber owner.",
        ],
      },
      {
        id: "structure",
        title: "Dashboard structure",
        bullets: [
          "Quick navigation — personal dashboard vs workspace dashboard.",
          "Workspace overview stats — workspaces, members, decks, cards vs plan limits.",
          "Add workspace button for owners at plan cap check.",
          "Main tabs: Members, Deck Manager, Workspace history, Invite members, Quiz results.",
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
          "Co-admins cannot demote other team admins (owner only).",
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
          "Pulls decks from subscriber’s personal library.",
          "Link adds a deck to the workspace for assignment.",
          "Already-linked decks show an Unlink from workspace button — unlinking removes the deck from the workspace and drops every member’s access to it (the deck stays on Personal Dashboard and can be re-linked).",
          "Co-admins do not see personal library — only owner links or unlinks decks.",
        ],
      },
      {
        id: "assign",
        title: "Step 2 — Assign to members",
        bullets: [
          "Assign to members and team admins (not the owner row).",
          "Records who assigned and when.",
          "Set study privilege on assign: Standard Review, AI Recall™, Quiz, or combinations (default: all three).",
          "Unassign removes member access to that deck in the workspace.",
          "Assignments by member table — workspace owner sees all members and workspaces; team admins see only the current workspace’s members (no Workspace column).",
        ],
      },
      {
        id: "privileges",
        title: "Study privileges sub-tab",
        bullets: [
          "/dashboard/team-admin/deck-manager/study-privileges",
          "Change Standard Review, AI Recall™, and/or Quiz access per member per assigned deck.",
          "Options include single modes and combinations (e.g. AI Recall™ only, Standard Review & AI Recall™, all three).",
          "Applies to team members in the privileges table (and Education Gold / Enterprise team admins).",
        ],
      },
      {
        id: "quiz-formats",
        title: "Quiz question formats (Study privileges)",
        bullets: [
          "Route: /dashboard/team-admin/deck-manager/study-privileges",
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
          "Enter how many questions of each enabled type should appear in quizzes for that deck — counts must be whole numbers and add up to the deck’s eligible card total (cards with front and back text).",
          "Example for a 10-card deck: Multiple choice 5, True / false 2, Fill in the blank 3 — order of entry does not matter.",
          "Disabled formats must stay at 0; enabled formats can be 0 only if you are not using that type in the mix.",
          "The total turns red with an error message until counts match the card total.",
          "Saving workspace or deck format changes clears entered counts and any prior reshuffle — set counts again after saving.",
        ],
      },
      {
        id: "quiz-formats-workflow",
        title: "Format setup workflow (save → counts → generate → reshuffle)",
        table: {
          headers: ["Step", "When it appears", "What it does"],
          rows: [
            [
              "Save deck formats",
              "After you change format checkboxes or toggle Use workspace defaults",
              "Writes settings to the deck (or clears per-deck override when inheriting workspace defaults). Clears prior counts and reshuffle mix.",
            ],
            [
              "Save workspace formats",
              "After you change workspace default checkboxes",
              "Applies defaults to inheriting decks and clears their counts and reshuffle mixes.",
            ],
            [
              "Questions per format",
              "After formats are saved and the deck has at least one eligible card",
              "Number inputs per enabled format. Generate and Reshuffle stay hidden until counts add up to the deck total.",
            ],
            [
              "Generate AI quiz sentences",
              "After counts are valid and true/false or fill-in-the-blank is enabled but not enough cards have AI content for those counts",
              "Creates only as many true/false and/or fill-in-the-blank variants as your counts require (not necessarily every card).",
            ],
            [
              "Reshuffle format questions",
              "After counts are valid, AI content is ready when needed, and at least two formats have a count greater than zero",
              "Assigns exactly your requested counts across cards (e.g. 5 MCQ, 2 True/False, 3 Fill in the blank), shuffling which card gets which format. Tooltip confirms success; last reshuffled time is shown.",
            ],
          ],
        },
        bullets: [
          "Only one action button shows at a time per deck — follow the order above.",
          "Requires Pro Plus, team-tier workspace, or platform admin for AI generation; production needs a valid OpenAI API key.",
          "Members see the admin’s distribution on the quiz lobby at /decks/[deckId]/study and on each question — in-progress sessions are not updated mid-quiz.",
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
          "Choose workspace, email, invitee name (required), and role (Member or Team admin).",
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
    "Review scores and configure quiz timer, schedule, and security.",
    [
      {
        id: "results",
        title: "Quiz results tab",
        bullets: [
          "Table: workspace, member, email, deck, score, counts, time, saved date.",
          "Search and filter by workspace and deck.",
          "View full attempt detail; delete result records.",
        ],
      },
      {
        id: "timer",
        title: "Quiz timer",
        bullets: [
          "Owner sets a general quiz duration (minutes) for linked decks, or locks one time across workspaces.",
          "Owner/team admin can set a timed-quiz length per individual deck (presets 5–120 minutes) when not locked.",
          "Per-deck timer overrides the workspace/subscriber default when set.",
        ],
      },
      {
        id: "schedule",
        title: "Quiz schedule",
        bullets: [
          "Workspace-level: enable + start date/time for all decks.",
          "Deck-level overrides for specific start times.",
          "Members cannot start quizzes before the scheduled time.",
        ],
      },
      {
        id: "security",
        title: "Quiz security",
        bullets: [
          "Workspace toggle applies to all decks unless deck overrides.",
          "Choose Team Admin and/or Member checkboxes for whom security applies; the plan owner is always restricted when security is on.",
          "Per-deck checkboxes can override the workspace audience default.",
          "Sessions can lock, complete, or terminate.",
          "Admins grant resume, restart/redo, or terminate from sessions table.",
          "Disabling security clears active sessions for that workspace.",
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
];
