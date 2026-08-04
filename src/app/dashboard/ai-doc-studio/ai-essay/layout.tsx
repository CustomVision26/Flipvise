import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/access";
import { getAddonCatalogSettings } from "@/db/queries/addons";
import { AI_DOC_STUDIO_BASE } from "@/lib/ai-document-studio-paths";
import { AiEssayComingSoon } from "@/components/ai-essay-coming-soon";
import { EssayDashboardShell } from "@/components/essay-dashboard-shell";
import {
  hasEssayAddon,
  isAiEssayComingSoonForTeamMember,
} from "@/lib/essay-access";

/**
 * AI Essay inside AI Document Studio — requires an active AI Essay entitlement
 * (Stripe-paid or admin), or platform admin preview access.
 * Workspace members without owner eligibility see Coming soon.
 */
export default async function AiEssayStudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getAccessContext();
  if (!access.userId) redirect("/");

  const unlocked = hasEssayAddon(access);
  if (!unlocked) {
    const comingSoon = await isAiEssayComingSoonForTeamMember(
      access.userId,
      access,
    );
    if (comingSoon) {
      return <AiEssayComingSoon />;
    }
    try {
      const settings = await getAddonCatalogSettings();
      if (settings.pricingCatalogVisible) {
        redirect("/pricing/add-ons");
      }
    } catch {
      // Fall through.
    }
    redirect(AI_DOC_STUDIO_BASE);
  }

  return <EssayDashboardShell unlocked>{children}</EssayDashboardShell>;
}
