import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/access";
import { getAddonCatalogSettings } from "@/db/queries/addons";
import { AI_DOC_STUDIO_BASE } from "@/lib/ai-document-studio-paths";
import { EssayDashboardShell } from "@/components/essay-dashboard-shell";
import { hasEssayAddon } from "@/lib/essay-access";

/**
 * AI Essay inside AI Document Studio — requires an active AI Essay entitlement
 * (Stripe-paid or admin/team assigned), or platform admin preview access.
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
    // User may still access the studio hub with another future document add-on.
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
