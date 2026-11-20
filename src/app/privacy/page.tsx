import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  CreditCard,
  Lock,
  Mail,
  MessageSquare,
  Shield,
  Smartphone,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { LegalDocument } from "@/components/legal-document";
import { PublicMarketingPageChrome } from "@/components/public-marketing-page-chrome";
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
      <LegalDocument
        badge="Privacy"
        title="Privacy Policy"
        description="Updated November 19, 2026. This page describes the Flipvise website and the Flipvise iPhone and Android apps from Flipvise Studio LLC."
        sections={[
          {
            id: "age",
            title: "Ages 13 and up",
            icon: Users,
            tone: "cyan",
            body: (
              <p>
                Flipvise is for people 13 and older. Do not create an account if you are under 13.
                The website and the iPhone and Android apps are not directed to children under 13.
              </p>
            ),
          },
          {
            id: "account",
            title: "Account information",
            icon: UserRound,
            tone: "cyan",
            body: (
              <p>
                When you create an account, Flipvise stores your name, email address, and the
                sign-in method you choose (email code or password). After sign-up, account setup
                stores your phone number, mailing address, account type, and three security
                answers. Sign-in is provided by Clerk.
              </p>
            ),
          },
          {
            id: "study-content",
            title: "Study content",
            icon: BookOpen,
            tone: "teal",
            body: (
              <p>
                Decks, cards, images, quiz results, lesson plans, homework, worksheets, study
                guides, class rosters, and grades that you create or that a teacher records for
                you are stored so the product can show them to the account that owns them.
              </p>
            ),
          },
          {
            id: "payments",
            title: "Payments",
            icon: CreditCard,
            tone: "violet",
            body: (
              <p>
                Paid plans are billed by Stripe. Flipvise stores your plan, subscription status,
                and invoice history. Card numbers are handled by Stripe and are not stored in
                Flipvise.
              </p>
            ),
          },
          {
            id: "mobile-apps",
            title: "The mobile apps",
            icon: Smartphone,
            tone: "teal",
            body: (
              <p>
                The iPhone and Android apps can keep a copy of your decks on the device for
                offline study. If you allow notifications, the app stores a push token so Flipvise
                can send inbox alerts. Camera and photo-library access are used only when you add
                or save an image. Face ID is used only to unlock the offline library on that
                device.
              </p>
            ),
          },
          {
            id: "ai-features",
            title: "AI features",
            icon: Sparkles,
            tone: "violet",
            body: (
              <p>
                When you generate study material, the topic, deck text, or source file you submit
                is sent to OpenAI over HTTPS to produce the result. Flipvise does not send your
                password, card number, phone number, mailing address, or security answers with
                those requests. The result is saved in your account. Usage records store the
                feature, model, and token counts, not the prompt. Details are on the{" "}
                <Link href="/ai" className="text-primary underline-offset-4 hover:underline">
                  AI data handling
                </Link>{" "}
                page.
              </p>
            ),
          },
          {
            id: "security",
            title: "Encryption and sale of data",
            icon: Lock,
            tone: "violet",
            body: (
              <>
                <p>
                  Data sent between the Flipvise app or website and Flipvise is encrypted in
                  transit with HTTPS. Requests to OpenAI and to Loops, which sends account and
                  invite email, use HTTPS as well.
                </p>
                <p className="mt-3">
                  Flipvise does not sell user data. Loops receives only what an email needs, such
                  as the address, name, and link or message summary. OpenAI receives only the
                  topic, deck text, or file for that generation.
                </p>
              </>
            ),
          },
          {
            id: "support",
            title: "Support messages",
            icon: MessageSquare,
            tone: "cyan",
            body: (
              <p>
                Messages you send from Contact Us or the Help Center, including images you attach,
                are stored so support can reply.
              </p>
            ),
          },
          {
            id: "delete-account",
            title: "Delete your account and data",
            icon: Shield,
            tone: "teal",
            body: (
              <p>
                Request deletion of your Flipvise account and the data associated with it on the{" "}
                <Link
                  href="/account-deletion"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  delete your Flipvise account
                </Link>{" "}
                page from Flipvise Studio LLC. That page lists the steps, the data that is
                deleted, the data that is kept, and the retention period. You do not need the app
                installed to read it.
              </p>
            ),
          },
          {
            id: "contact",
            title: "Contact",
            icon: Mail,
            tone: "cyan",
            body: (
              <p>
                Questions about this policy can be sent from{" "}
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
