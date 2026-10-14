import Link from "next/link";
import { ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import { LegalLinks } from "@/components/legal-links";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getPlatformContactSettings, type ContactSocialLink } from "@/db/queries/contact-us";
import {
  formatPlatformCompanyAddressLines,
  type PlatformCompanyAddress,
} from "@/lib/platform-company-address";
import { supportMailtoHref } from "@/lib/support-contact";
import { cn } from "@/lib/utils";

function ContactMark({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl border shadow-[0_0_18px]",
        className,
      )}
    >
      {children}
    </span>
  );
}

function FooterContactDetails({
  email,
  phone,
  companyAddress,
  socialLinks,
}: {
  email: string;
  phone: string | null;
  companyAddress: PlatformCompanyAddress;
  socialLinks: ContactSocialLink[];
}) {
  const addressLines = formatPlatformCompanyAddressLines(companyAddress);
  const companyName = companyAddress.name.trim() || "Flipvise Studio LLC";
  const year = new Date().getFullYear();
  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null;
  const mapHref = `https://maps.google.com/?q=${encodeURIComponent(addressLines.join(", "))}`;

  return (
    <footer className="dark relative z-10 mt-auto border-t border-cyan-400/25 bg-gradient-to-b from-cyan-950/40 via-background to-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden" aria-hidden>
        <div className="animate-aurora h-full w-full bg-gradient-to-r from-cyan-400/0 via-cyan-300 to-teal-300/0" />
      </div>
      <div
        className="pointer-events-none absolute -left-16 top-6 size-40 rounded-full bg-cyan-500/15 blur-3xl motion-safe:animate-float-gentle"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-10 bottom-0 size-36 rounded-full bg-teal-500/15 blur-3xl motion-safe:animate-float-gentle"
        aria-hidden
      />

      <div className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <Card className="animate-in fade-in-0 slide-in-from-bottom-3 overflow-hidden border-cyan-400/30 bg-card/75 shadow-none ring-1 ring-cyan-400/25 duration-700">
          <CardContent className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 items-start gap-3">
              <ContactMark className="border-teal-400/45 bg-teal-500/15 text-teal-800 shadow-teal-400/25 dark:text-teal-200">
                <MapPin className="size-4" aria-hidden />
              </ContactMark>
              <div className="min-w-0 space-y-2">
                <Badge variant="outline" className="border-teal-400/40 text-teal-800 dark:text-teal-200">
                  {companyName}
                </Badge>
                <address className="text-sm leading-relaxed font-medium text-foreground not-italic">
                  {addressLines.slice(1).map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
                <a
                  href={mapHref}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({
                    variant: "link",
                    size: "sm",
                    className: "h-auto px-0 text-teal-800 dark:text-teal-200",
                  })}
                >
                  Open map
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="flex min-w-0 items-start gap-3 rounded-xl border border-cyan-400/25 bg-cyan-500/5 p-3">
                <ContactMark className="border-cyan-400/45 bg-cyan-500/15 text-cyan-800 shadow-cyan-400/25 dark:text-cyan-200">
                  <Mail className="size-4" aria-hidden />
                </ContactMark>
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Support email</p>
                  <a
                    href={supportMailtoHref(undefined, email)}
                    className="block truncate text-sm font-medium text-foreground hover:underline"
                  >
                    {email}
                  </a>
                </div>
              </div>

              {phone && telHref ? (
                <div className="flex min-w-0 items-start gap-3 rounded-xl border border-violet-400/25 bg-violet-500/5 p-3">
                  <ContactMark className="border-violet-400/45 bg-violet-500/15 text-violet-800 shadow-violet-400/25 dark:text-violet-200">
                    <Phone className="size-4" aria-hidden />
                  </ContactMark>
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Phone</p>
                    <a href={telHref} className="block text-sm font-medium text-foreground hover:underline">
                      {phone}
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>

          {socialLinks.length > 0 ? (
            <div className="flex flex-wrap gap-2 px-5 pb-2 sm:px-6">
              {socialLinks.map((link) => (
                <a
                  key={`${link.platform}-${link.url}`}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {link.label}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ))}
            </div>
          ) : null}

          <Separator className="bg-cyan-400/20" />
          <div className="space-y-3 px-5 py-4 sm:px-6">
            <LegalLinks />
            <p className="text-center text-xs text-muted-foreground">
              © {year} {companyName}.{" "}
              <Link href="/contact" className="underline-offset-4 hover:text-foreground hover:underline">
                Contact support
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </footer>
  );
}

export async function SiteContactFooter() {
  try {
    const settings = await getPlatformContactSettings();
    return (
      <FooterContactDetails
        email={settings.email}
        phone={settings.phone ?? null}
        companyAddress={settings.companyAddress}
        socialLinks={Array.isArray(settings.socialLinks) ? settings.socialLinks : []}
      />
    );
  } catch (error) {
    console.error("[SiteContactFooter]", error);
    return (
      <footer className="relative z-10 mt-auto border-t border-border px-4 py-6">
        <LegalLinks />
      </footer>
    );
  }
}
