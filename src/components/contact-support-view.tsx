import Link from "next/link";
import {
  Clock,
  ExternalLink,
  HelpCircle,
  Mail,
  MessageSquare,
  Phone,
} from "lucide-react";
import { ContactSupportForm } from "@/components/contact-support-form";
import { PublicPageIntro } from "@/components/public-page-intro";
import { supportMailtoHref } from "@/lib/support-contact";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ContactSocialLink } from "@/db/queries/contact-us";
import { cn } from "@/lib/utils";

function SupportOptionIcon({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-muted/25",
        className,
      )}
    >
      {children}
    </span>
  );
}

function SupportBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
      <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/45" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

type ContactSupportViewProps = {
  email: string;
  phone: string | null;
  socialLinks: ContactSocialLink[];
  defaultName?: string;
  defaultEmail?: string;
};

export function ContactSupportView({
  email,
  phone,
  socialLinks,
  defaultName,
  defaultEmail,
}: ContactSupportViewProps) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-10">
      <PublicPageIntro
        badge="Support"
        title="Contact Support"
        description="Send us a message, reach our team by email, or use the in-app Help Center when you are signed in."
        centered
      />

      <div className="grid gap-4">
        <Card className="overflow-hidden border-border/60 bg-card/40 shadow-none ring-1 ring-border/30">
          <CardHeader className="gap-3 border-b border-border/40 pb-4">
            <div className="flex items-start gap-3">
              <SupportOptionIcon>
                <MessageSquare className="size-4 text-foreground/80" aria-hidden />
              </SupportOptionIcon>
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base font-semibold">Send a message</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  Start a live conversation — our platform administrators are notified immediately
                  and can reply in real time.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <ContactSupportForm defaultName={defaultName} defaultEmail={defaultEmail} />
            <Link
              href="/docs#contact-us-live-chat"
              className={buttonVariants({
                variant: "link",
                size: "sm",
                className: "mt-4 h-auto px-0",
              })}
            >
              How live chat works
            </Link>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/60 bg-card/40 shadow-none ring-1 ring-border/30">
          <CardHeader className="gap-3 border-b border-border/40 pb-4">
            <div className="flex items-start gap-3">
              <SupportOptionIcon>
                <Mail className="size-4 text-foreground/80" aria-hidden />
              </SupportOptionIcon>
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base font-semibold">Contact details</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  Official support channels published by the Flipvise team.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Support inbox</p>
                <a
                  href={supportMailtoHref(undefined, email)}
                  className="inline-flex items-center gap-1.5 break-all text-sm font-medium text-foreground hover:underline"
                >
                  {email}
                  <ExternalLink className="size-3.5 shrink-0 opacity-70" aria-hidden />
                </a>
              </div>
              <a
                href={supportMailtoHref(undefined, email)}
                className={buttonVariants({ size: "sm", className: "shrink-0 sm:ml-2" })}
              >
                Send email
              </a>
            </div>

            {phone ? (
              <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/15 p-4">
                <Phone className="size-4 shrink-0 text-foreground/80" aria-hidden />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Phone</p>
                  <a href={`tel:${phone.replace(/\s/g, "")}`} className="text-sm font-medium hover:underline">
                    {phone}
                  </a>
                </div>
              </div>
            ) : null}

            {socialLinks.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Social media</p>
                <ul className="space-y-2">
                  {socialLinks.map((link) => (
                    <li key={`${link.platform}-${link.url}`}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline"
                      >
                        {link.label}
                        <ExternalLink className="size-3.5 shrink-0 opacity-70" aria-hidden />
                      </a>
                      <span className="ml-2 text-xs text-muted-foreground">({link.platform})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <ul className="space-y-2.5">
              <SupportBullet>
                Include the email address on your Flipvise account when writing about billing or
                access.
              </SupportBullet>
              <SupportBullet>
                Describe what you expected, what happened, and how to reproduce the issue.
              </SupportBullet>
            </ul>

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="size-3.5 shrink-0" aria-hidden />
              We aim to respond within 1–2 business days. Pro Plus and team-tier subscribers with
              Priority Support see faster targets via the Help Center tab.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40 shadow-none ring-1 ring-border/30">
          <CardHeader className="gap-3 pb-2">
            <div className="flex items-start gap-3">
              <SupportOptionIcon>
                <HelpCircle className="size-4 text-foreground/80" aria-hidden />
              </SupportOptionIcon>
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base font-semibold">In-app Help Center</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  Submit categorized tickets with attachments and full conversation history.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-1 text-sm leading-relaxed text-muted-foreground">
            <p>
              Signed-in users can open the{" "}
              <span className="font-medium text-foreground">Help Center</span> from the top
              navigation. Pick a category, submit a ticket, then follow up under{" "}
              <span className="font-medium text-foreground">My tickets</span>.
            </p>
            <Link
              href="/docs#help-center-overview"
              className={buttonVariants({ variant: "link", size: "sm", className: "h-auto px-0" })}
            >
              Read full Help Center guide
            </Link>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-muted/10 shadow-none ring-1 ring-border/30">
          <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <SupportOptionIcon className="bg-background/40">
                <MessageSquare className="size-4 text-foreground/80" aria-hidden />
              </SupportOptionIcon>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Check the documentation first</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Deck limits, billing, team admin, and account settings are covered in the user
                  guide.
                </p>
              </div>
            </div>
            <Link
              href="/docs"
              className={buttonVariants({ variant: "outline", size: "sm", className: "shrink-0" })}
            >
              Open documentation
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
