import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Mail, Save, Send, Shield } from "lucide-react";
import { LegalDocument } from "@/components/legal-document";
import { PublicMarketingPageChrome } from "@/components/public-marketing-page-chrome";
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
      <LegalDocument
        badge="AI"
        title="AI data handling"
        description="Effective October 12, 2026. This page explains what happens when you use AI in Flipvise."
        sections={[
          {
            id: "what-is-sent",
            title: "What is sent",
            icon: Send,
            tone: "cyan",
            body: (
              <p>
                Flashcards, quizzes, lesson plans, homework, worksheets, study guides, essays,
                document import, and voice features send the topic, deck text, or source you submit
                to OpenAI so it can return the result. The model used for generation is GPT-4o.
                Flipvise does not send your password or your card number with those requests.
              </p>
            ),
          },
          {
            id: "what-is-saved",
            title: "What is saved",
            icon: Save,
            tone: "teal",
            body: (
              <p>
                The generated result is saved in the account or workspace that requested it, such as
                a deck, lesson plan, essay, or class record. Teachers and students see the study
                content their account or class already owns.
              </p>
            ),
          },
          {
            id: "usage-records",
            title: "Usage records",
            icon: BarChart3,
            tone: "violet",
            body: (
              <p>
                Flipvise keeps a usage record for each AI request: the feature, model, token counts,
                estimated cost, and whether the request succeeded. That record does not include the
                prompt or the generated text.
              </p>
            ),
          },
          {
            id: "delete-account",
            title: "Deleting your account",
            icon: Shield,
            tone: "teal",
            body: (
              <p>
                Open your account menu, choose Manage account, then Delete account, and confirm with
                DELETE. Deleting the account removes the Flipvise account and the study data stored
                for it.
              </p>
            ),
          },
          {
            id: "related",
            title: "Related pages",
            icon: Mail,
            tone: "cyan",
            body: (
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
            ),
          },
        ]}
      />
    </PublicMarketingPageChrome>
  );
}
