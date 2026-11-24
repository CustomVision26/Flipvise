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

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const [{ homeHref, isSignedIn }, settings, sessionUser, params] = await Promise.all([
    resolvePublicPageHomeContext(),
    getPlatformContactSettings(),
    currentUser(),
    searchParams,
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
        whatsapp={settings.whatsapp ?? null}
        socialLinks={settings.socialLinks ?? []}
        companyAddress={settings.companyAddress ?? null}
        defaultName={defaultName}
        defaultEmail={defaultEmail}
        defaultSubject={typeof params.subject === "string" ? params.subject.slice(0, 200) : ""}
      />
    </PublicMarketingPageChrome>
  );
}
