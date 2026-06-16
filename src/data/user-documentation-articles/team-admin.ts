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
          "Co-admins do not see personal library — only owner links decks.",
        ],
      },
      {
        id: "assign",
        title: "Step 2 — Assign to members",
        bullets: [
          "Assign to members and team admins (not the owner row).",
          "Records who assigned and when.",
          "Set study privilege on assign: Standard Review only, Quiz only, or Both (default).",
          "Unassign removes member access to that deck in the workspace.",
        ],
      },
      {
        id: "privileges",
        title: "Study privileges sub-tab",
        bullets: [
          "/dashboard/team-admin/deck-manager/study-privileges",
          "Change review vs quiz access per member per assigned deck.",
          "Applies to team members in the privileges table.",
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
          "Choose workspace, email, display name (optional), and role (Member or Team admin).",
          "Email must match the address they will sign in with.",
          "Invites expire in 3 days — expired invites must be resent.",
          "Cannot invite subscriber’s own primary email.",
          "Blocked when members + pending invites reach plan capacity.",
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
          "Accepted, declined, expired, and revoked invitations.",
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
          "Owner sets global default duration for all workspaces.",
          "Per-workspace overrides with presets (5–120 minutes).",
          "Co-admins configure workspace overrides when owner allows.",
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
