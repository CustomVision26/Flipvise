import type { Metadata } from "next";
import Link from "next/link";
import { LegalLinks } from "@/components/legal-links";
import { PublicMarketingPageChrome } from "@/components/public-marketing-page-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolvePublicPageHomeContext } from "@/lib/public-page-home-context";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using the Flipvise website and the Flipvise iPhone and Android apps.",
};

export default async function TermsPage() {
  const { homeHref, isSignedIn } = await resolvePublicPageHomeContext();

  return (
    <PublicMarketingPageChrome homeHref={homeHref} isSignedIn={isSignedIn}>
      <Card className="border-cyan-400/30 bg-card/80 shadow-lg shadow-cyan-500/10">
        <CardHeader className="gap-2">
          <CardTitle className="text-2xl tracking-tight">Terms of Service</CardTitle>
          <p className="text-sm text-muted-foreground">
            Effective October 12, 2026. These terms cover the Flipvise website and the Flipvise
            iPhone and Android apps.
          </p>
        </CardHeader>
        <CardContent className="space-y-6 text-sm leading-relaxed text-foreground">
          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">Using Flipvise</h2>
            <p>
              Flipvise provides flashcards, study tools, classrooms, and optional AI features. You
              may use them for your own learning or for a class or workspace you are allowed to
              manage. You are responsible for the content you add and for keeping your sign-in
              private.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">Accounts</h2>
            <p>
              Creating an account means you agree to these terms and the{" "}
              <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
                Privacy Policy
              </Link>
              . Sign-in is provided by Clerk. After sign-up, Flipvise asks for the recovery details
              shown on account setup. You can delete the account from the account menu, under
              Manage account, by confirming with DELETE.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">Study and classroom content</h2>
            <p>
              Decks, cards, images, quizzes, lesson plans, homework, worksheets, study guides,
              class rosters, and grades stay with the account or workspace that owns them. Do not
              upload content you are not allowed to use. Teachers may record progress and grades
              for students in their classes.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">Plans, add-ons, and promos</h2>
            <p>
              Paid plans and add-ons are billed by Stripe. Prices, trials, and promo codes shown
              at checkout are the ones that apply to that purchase. A promo code works only on the
              plans it was created for, and only while it is active. Complimentary or affiliate
              access is not a paid subscription. If a paid subscription is refunded, Stripe sends
              the prorated amount to the original payment method.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">AI features</h2>
            <p>
              When you generate study material, the topic or source text you submit is sent to
              OpenAI to produce the result. How that data is handled is described on the{" "}
              <Link href="/ai" className="text-primary underline-offset-4 hover:underline">
                AI data handling
              </Link>{" "}
              page. Review generated material before you rely on it in class.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">The mobile apps</h2>
            <p>
              The iPhone and Android apps open Flipvise and can keep a copy of your decks on the
              device for offline study. Notifications, camera, photo library, and Face ID are used
              only for the features described in the Privacy Policy.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">Contact</h2>
            <p>
              Questions about these terms can be sent from{" "}
              <Link href="/contact" className="text-primary underline-offset-4 hover:underline">
                Contact Us
              </Link>
              .
            </p>
          </section>
          <LegalLinks className="justify-start border-t border-border/60 pt-4" />
        </CardContent>
      </Card>
    </PublicMarketingPageChrome>
  );
}
