import type { Metadata } from "next";
import { ContactSupportView } from "@/components/contact-support-view";
import { PublicMarketingPageChrome } from "@/components/public-marketing-page-chrome";
import { getPlatformContactSettings } from "@/db/queries/contact-us";
import { currentUser } from "@/lib/clerk-auth";
import { resolvePublicPageHomeContext } from "@/lib/public-page-home-context";

export const metadata: Metadata = {
  title: "Contact Support",
  description:
    "Contact Flipvise support by email, phone, or message — or use the in-app Help Center for tickets.",
};

export default async function ContactPage() {
  const [{ homeHref, isSignedIn }, settings, sessionUser] = await Promise.all([
    resolvePublicPageHomeContext(),
    getPlatformContactSettings(),
    currentUser(),
  ]);

  const defaultName =
    [sessionUser?.firstName, sessionUser?.lastName].filter(Boolean).join(" ") ||
    sessionUser?.username ||
    "";
  const defaultEmail = sessionUser?.primaryEmailAddress?.emailAddress ?? "";

  return (
    <PublicMarketingPageChrome homeHref={homeHref} isSignedIn={isSignedIn}>
      <ContactSupportView
        email={settings.email}
        phone={settings.phone ?? null}
        socialLinks={settings.socialLinks ?? []}
        defaultName={defaultName}
        defaultEmail={defaultEmail}
      />
    </PublicMarketingPageChrome>
  );
}
