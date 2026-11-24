import type { Metadata } from "next";
import { AboutPageView } from "@/components/about-page-view";
import { PublicMarketingPageChrome } from "@/components/public-marketing-page-chrome";
import { getPublishedAboutContent, getAboutAdminState } from "@/db/queries/about-page";
import { readAppReleaseMetadata } from "@/lib/app-release-metadata";
import { LOGO_PUBLIC_URL } from "@/lib/branding";
import { getAccessContext } from "@/lib/access";
import { DEFAULT_PLATFORM_COMPANY_ADDRESS } from "@/lib/platform-company-address";
import { resolvePublicPageHomeContext } from "@/lib/public-page-home-context";
import { resolveAppUrl } from "@/lib/stripe";
import { getPlatformContactSettings } from "@/db/queries/contact-us";

const description =
  "Learn about Flipvise Studio, our leadership team, mission, AI-powered educational tools and commitment to supporting students, educators, families and organizations.";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = `${resolveAppUrl()}/about`;
  return {
    title: { absolute: "About Us | Flipvise Studio" },
    description,
    alternates: { canonical },
    openGraph: {
      title: "About Us | Flipvise Studio",
      description,
      url: canonical,
      type: "website",
    },
  };
}

export default async function AboutPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const [{ homeHref, isSignedIn }, published, release, params] = await Promise.all([
    resolvePublicPageHomeContext(),
    getPublishedAboutContent(),
    Promise.resolve(readAppReleaseMetadata()),
    searchParams,
  ]);

  let content = published;
  let previewing = false;
  if (params.preview === "draft") {
    const access = await getAccessContext();
    if (access.isAdmin || access.isSuperadmin) {
      const state = await getAboutAdminState();
      if (state.hasSavedDraft) {
        content = state.draft;
        previewing = true;
      }
    }
  }

  const canonical = `${resolveAppUrl()}/about`;
  let email: string | undefined;
  let address = DEFAULT_PLATFORM_COMPANY_ADDRESS;
  try {
    const settings = await getPlatformContactSettings();
    email = settings.email;
    address = settings.companyAddress;
  } catch {
    email = undefined;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: address.name || "Flipvise Studio LLC",
    url: canonical,
    logo: `${resolveAppUrl()}${LOGO_PUBLIC_URL}`,
    ...(email ? { email } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: [address.streetAddress, address.line2].filter(Boolean).join(", "),
      addressLocality: address.city,
      addressRegion: address.stateProvince,
      postalCode: address.postalCode,
      addressCountry: address.country,
    },
  };

  return (
    <PublicMarketingPageChrome homeHref={homeHref} isSignedIn={isSignedIn} followTheme>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <AboutPageView
        content={content}
        release={release}
        signedIn={isSignedIn}
        dashboardHref={homeHref}
        previewing={previewing}
      />
    </PublicMarketingPageChrome>
  );
}
