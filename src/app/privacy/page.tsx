import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  CreditCard,
  Mail,
  MessageSquare,
  Shield,
  Smartphone,
  Sparkles,
  UserRound,
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
        description="Effective October 10, 2026. This page describes the Flipvise website and the Flipvise iPhone and Android apps."
        sections={[
          {
            id: "account",
            title: "Account information",
            icon: UserRound,
            tone: "cyan",
            body: (
              <p>
                When you create an account, Flipvise stores your name, email address, and the
                sign-in method you choose (email code or password), plus the recovery details you
                enter after sign-up. Sign-in is provided by Clerk.
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
                When you generate study material, the topic or source text you submit is sent to
                OpenAI to produce the result. The result is saved in your account. Usage records
                store the feature, model, and token counts, not the prompt. Details are on the{" "}
                <Link href="/ai" className="text-primary underline-offset-4 hover:underline">
                  AI data handling
                </Link>{" "}
                page.
              </p>
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
            title: "Deleting your account",
            icon: Shield,
            tone: "teal",
            body: (
              <p>
                Open your account menu, choose Manage account, then Delete account, and confirm
                with DELETE. Deleting the account removes the Flipvise account and its study data.
                If a paid subscription is refunded, Stripe sends the prorated amount to the
                original payment method.
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
