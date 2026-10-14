import type { Metadata } from "next";
import Link from "next/link";
import { LegalLinks } from "@/components/legal-links";
import { PublicMarketingPageChrome } from "@/components/public-marketing-page-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolvePublicPageHomeContext } from "@/lib/public-page-home-context";

export const metadata: Metadata = {
  title: "AI data handling",
  description:
    "What Flipvise sends to OpenAI when you generate study material, and what is stored in your account.",
};

export default async function AiDataPage() {
  const { homeHref, isSignedIn } = await resolvePublicPageHomeContext();

  return (
    <PublicMarketingPageChrome homeHref={homeHref} isSignedIn={isSignedIn}>
      <Card className="border-cyan-400/30 bg-card/80 shadow-lg shadow-cyan-500/10">
        <CardHeader className="gap-2">
          <CardTitle className="text-2xl tracking-tight">AI data handling</CardTitle>
          <p className="text-sm text-muted-foreground">
            Effective October 12, 2026. This page explains what happens when you use AI in
            Flipvise.
          </p>
        </CardHeader>
        <CardContent className="space-y-6 text-sm leading-relaxed text-foreground">
          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">What is sent</h2>
            <p>
              Flashcards, quizzes, lesson plans, homework, worksheets, study guides, essays,
              document import, and voice features send the topic, deck text, or source you submit
              to OpenAI so it can return the result. The model used for generation is GPT-4o.
              Flipvise does not send your password or your card number with those requests.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">What is saved</h2>
            <p>
              The generated result is saved in the account or workspace that requested it, such as
              a deck, lesson plan, essay, or class record. Teachers and students see the study
              content their account or class already owns.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">Usage records</h2>
            <p>
              Flipvise keeps a usage record for each AI request: the feature, model, token counts,
              estimated cost, and whether the request succeeded. That record does not include the
              prompt or the generated text.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">Deleting your account</h2>
            <p>
              Open your account menu, choose Manage account, then Delete account, and confirm with
              DELETE. Deleting the account removes the Flipvise account and the study data stored
              for it.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-heading text-base font-semibold">Related pages</h2>
            <p>
              Account, billing, and device details are in the{" "}
              <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
                Privacy Policy
              </Link>
              . Use of the product is covered by the{" "}
              <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
                Terms of Service
              </Link>
              . Questions can be sent from{" "}
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
