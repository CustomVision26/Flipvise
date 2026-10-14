import Link from "next/link";
import { ExternalLink, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { LegalLinks } from "@/components/legal-links";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getPlatformContactSettings, type ContactSocialLink } from "@/db/queries/contact-us";
import {
  formatPlatformCompanyAddressLines,
  type PlatformCompanyAddress,
} from "@/lib/platform-company-address";
import { supportMailtoHref, whatsappChatHref } from "@/lib/support-contact";
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
        "flex size-7 shrink-0 items-center justify-center rounded-lg border",
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
  whatsapp,
  companyAddress,
  socialLinks,
}: {
  email: string;
  phone: string | null;
  whatsapp: string | null;
  companyAddress: PlatformCompanyAddress;
  socialLinks: ContactSocialLink[];
}) {
  const addressLines = formatPlatformCompanyAddressLines(companyAddress);
  const companyName = companyAddress.name.trim() || "Flipvise Studio LLC";
  const addressLine = addressLines.slice(1).join(", ");
  const year = new Date().getFullYear();
  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null;
  const whatsappHref = whatsappChatHref(whatsapp);
  const mapHref = `https://maps.google.com/?q=${encodeURIComponent(addressLines.join(", "))}`;

  return (
    <footer className="dark relative z-10 mt-auto border-t border-cyan-400/20 bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden" aria-hidden>
        <div className="animate-aurora h-full w-full bg-gradient-to-r from-cyan-400/0 via-cyan-300/80 to-teal-300/0" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 py-3 sm:px-6">
        <Card
          size="sm"
          className="animate-in fade-in-0 slide-in-from-bottom-2 gap-0 overflow-hidden border-cyan-400/25 bg-card/80 py-0 shadow-none ring-1 ring-cyan-400/20 duration-500"
        >
          <CardContent className="flex flex-col gap-2 px-3 py-2.5 sm:px-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-5">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <ContactMark className="border-teal-400/40 bg-teal-500/15 text-teal-800 dark:text-teal-200">
                  <MapPin className="size-3.5" aria-hidden />
                </ContactMark>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">{companyName}</p>
                  <address className="truncate text-[11px] leading-4 text-muted-foreground not-italic">
                    {addressLine}
                  </address>
                </div>
                <a
                  href={mapHref}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({
                    variant: "link",
                    size: "sm",
                    className: "h-7 shrink-0 px-1 text-[11px] text-teal-800 dark:text-teal-200",
                  })}
                >
                  Map
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5">
                <a
                  href={supportMailtoHref(undefined, email)}
                  className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-foreground hover:underline"
                >
                  <Mail className="size-3.5 shrink-0 text-cyan-700 dark:text-cyan-300" aria-hidden />
                  {email}
                </a>
                {phone && telHref ? (
                  <a
                    href={telHref}
                    className="inline-flex shrink-0 items-center gap-1.5 text-xs text-foreground hover:underline"
                  >
                    <Phone className="size-3.5 shrink-0 text-violet-700 dark:text-violet-300" aria-hidden />
                    {phone}
                  </a>
                ) : null}
                {whatsapp && whatsappHref ? (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1.5 text-xs text-foreground hover:underline"
                  >
                    <MessageCircle className="size-3.5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden />
                    {whatsapp}
                  </a>
                ) : null}
                {socialLinks.map((link) => (
                  <a
                    key={`${link.platform}-${link.url}`}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-foreground hover:underline"
                  >
                    {link.label}
                    <ExternalLink className="size-3 shrink-0" aria-hidden />
                  </a>
                ))}
              </div>
            </div>

            <Separator className="bg-cyan-400/15" />
            <div className="flex flex-col items-center gap-1 sm:flex-row sm:justify-between">
              <LegalLinks className="justify-center gap-x-3 text-[11px] sm:justify-start" />
              <p className="text-[11px] text-muted-foreground">
                © {year} {companyName}.{" "}
                <Link href="/contact" className="underline-offset-4 hover:text-foreground hover:underline">
                  Contact support
                </Link>
              </p>
            </div>
          </CardContent>
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
        whatsapp={settings.whatsapp ?? null}
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
