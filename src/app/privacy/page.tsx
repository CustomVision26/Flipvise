import type { Metadata } from "next";
import Link from "next/link";
import { PublicMarketingPageChrome } from "@/components/public-marketing-page-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolvePublicPageHomeContext } from "@/lib/public-page-home-context";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Flipvise collects, uses, and deletes account, study, billing, and device information.",
};

export default async function PrivacyPage() {
  const { homeHref, isSignedIn } = await resolvePublicPageHomeContext();

  return (
    <PublicMarketingPageChrome homeHref={homeHref} isSignedIn={isSignedIn}>
      <Card className="border-cyan-400/30 bg-card/80 shadow-lg shadow-cyan-500/10">
        <CardHeader className="gap-2">
          <CardTitle className="text-2xl tracking-tight">Privacy Policy</CardTitle>
          <p className="text-sm text-muted-foreground">
            Effective October 10, 2026. This page describes the Flipvise website and the
            Flipvise iPhone and Android apps.
          </p>
        </CardHeader>
        <CardContent className="space-y-6 text-sm leading-relaxed text-foreground">
          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">Account information</h2>
            <p>
              When you create an account, Flipvise stores your name, email address, and the
              sign-in method you choose (email code or password), plus the recovery details you
              enter after sign-up. Sign-in is provided by Clerk.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">Study content</h2>
            <p>
              Decks, cards, images, quiz results, lesson plans, homework, worksheets, study
              guides, class rosters, and grades that you create or that a teacher records for
              you are stored so the product can show them to the account that owns them.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">Payments</h2>
            <p>
              Paid plans are billed by Stripe. Flipvise stores your plan, subscription status,
              and invoice history. Card numbers are handled by Stripe and are not stored in
              Flipvise.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">The mobile apps</h2>
            <p>
              The iPhone and Android apps can keep a copy of your decks on the device for
              offline study. If you allow notifications, the app stores a push token so Flipvise
              can send inbox alerts. Camera and photo-library access are used only when you add
              or save an image. Face ID is used only to unlock the offline library on that
              device.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">Support messages</h2>
            <p>
              Messages you send from Contact Us or the Help Center, including images you attach,
              are stored so support can reply.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">Deleting your account</h2>
            <p>
              Open your account menu, choose Manage account, then Delete account, and confirm
              with DELETE. Deleting the account removes the Flipvise account and its study data.
              If a paid subscription is refunded, Stripe sends the prorated amount to the
              original payment method.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">Contact</h2>
            <p>
              Questions about this policy can be sent from{" "}
              <Link href="/contact" className="text-primary underline-offset-4 hover:underline">
                Contact Us
              </Link>
              .
            </p>
          </section>
        </CardContent>
      </Card>
    </PublicMarketingPageChrome>
  );
}
