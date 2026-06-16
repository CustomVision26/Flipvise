import type { Metadata } from "next";
import { UserDocumentationView } from "@/components/user-documentation-view";
import { PublicMarketingPageChrome } from "@/components/public-marketing-page-chrome";
import { resolvePublicPageHomeContext } from "@/lib/public-page-home-context";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "User guide for Flipvise — dashboards, decks, inbox, billing, team admin, and account settings.",
};

export default async function DocsPage() {
  const { homeHref, isSignedIn } = await resolvePublicPageHomeContext();

  return (
    <PublicMarketingPageChrome homeHref={homeHref} isSignedIn={isSignedIn}>
      <UserDocumentationView />
    </PublicMarketingPageChrome>
  );
}
