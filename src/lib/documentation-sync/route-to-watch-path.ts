/** Map a static app route to its Next.js `page.tsx` path (skips dynamic segments). */
const ROUTE_APP_PAGE_OVERRIDES: Readonly<Record<string, string>> = {
  "/dashboard/team-admin": "src/app/dashboard/(team-admin)/team-admin/page.tsx",
  "/dashboard/team-admin/members": "src/app/dashboard/(team-admin)/team-admin/members/page.tsx",
  "/dashboard/team-admin/deck-manager/assign-decks-to-members":
    "src/app/dashboard/(team-admin)/team-admin/deck-manager/assign-decks-to-members/page.tsx",
  "/dashboard/team-admin/invite-members/send-invite":
    "src/app/dashboard/(team-admin)/team-admin/invite-members/send-invite/page.tsx",
  "/dashboard/team-admin/quiz-results":
    "src/app/dashboard/(team-admin)/team-admin/quiz-results/page.tsx",
  "/dashboard/team-admin/ws-history":
    "src/app/dashboard/(team-admin)/team-admin/ws-history/page.tsx",
};

export function routeToAppPagePath(route: string | undefined): string | null {
  if (!route) return null;
  const pathOnly = route.split("?")[0].replace(/…/g, "").replace(/\/+$/, "");
  if (pathOnly.includes("[")) return null;

  const override = ROUTE_APP_PAGE_OVERRIDES[pathOnly];
  if (override) return override;

  if (!pathOnly || pathOnly === "/") return "src/app/page.tsx";
  const segments = pathOnly.split("/").filter(Boolean);
  return `src/app/${segments.join("/")}/page.tsx`;
}
