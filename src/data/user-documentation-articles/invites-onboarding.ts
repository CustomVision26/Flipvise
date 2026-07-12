import type { DocArticle } from "@/lib/user-documentation-article-types";

function a(
  pageId: string,
  title: string,
  intro: string,
  sections: DocArticle["sections"],
): DocArticle {
  return { pageId, title, intro, sections };
}

export const INVITES_ONBOARDING_ARTICLES: DocArticle[] = [
  a(
    "team-onboarding",
    "Team Onboarding — In-Depth Guide",
    "Create your first team workspace at /onboarding/team after purchasing a team-tier plan.",
    [
      {
        id: "wizard",
        title: "Onboarding wizard",
        bullets: [
          "Prompts for team (workspace) name.",
          "Creates the workspace linked to your subscription.",
          "Redirects to Team Admin or dashboard when complete.",
        ],
      },
      {
        id: "when",
        title: "When you need this",
        bullets: [
          "Active team-tier subscription (Team Basic, Gold, Platinum, Enterprise).",
          "No existing team workspace yet.",
          "Personal dashboard may show a banner linking here if onboarding is pending.",
        ],
      },
    ],
  ),
  a(
    "accept-team-invite",
    "Accept Team Invite — In-Depth Guide",
    "Join a team workspace from an email link at /invite/team/[token].",
    [
      {
        id: "flow",
        title: "Acceptance flow",
        bullets: [
          "Page shows team name and assigned role before you accept.",
          "Sign in with the invited email address.",
          "Accept joins the workspace and redirects to dashboard in team context.",
          "If you already have a Flipvise account, the invite appears in dashboard inbox; email is sent only when you are not registered yet.",
        ],
      },
      {
        id: "errors",
        title: "Common failures",
        bullets: [
          "Wrong email — acceptance fails; sign in with invited address.",
          "Expired invite — ask admin to resend (3-day expiry).",
          "Already used or revoked token — request new invite.",
        ],
      },
    ],
  ),
  a(
    "affiliate-invite",
    "Affiliate Invites — In-Depth Guide",
    "Accept marketing affiliate arrangements at /affiliate/accept.",
    [
      {
        id: "flow",
        title: "Invite acceptance",
        bullets: [
          "Email or inbox link opens /affiliate/accept?token=…",
          "Sign in with invited email.",
          "Accept activates complimentary plan for arrangement period.",
          "Affiliate Portal unlocks at /dashboard/affiliate.",
        ],
      },
      {
        id: "arrangement-change",
        title: "Arrangement changes",
        bullets: [
          "Admin plan/end date updates require your confirmation.",
          "Confirm via dashboard inbox or /affiliate/confirm-arrangement?token=…",
          "Plan does not change until you confirm.",
        ],
      },
      {
        id: "rules",
        title: "Rules",
        bullets: [
          "Do not forward invite links — email-bound and single-use.",
          "Unregistered invitees may receive email; registered users get inbox only.",
        ],
      },
    ],
  ),
];
