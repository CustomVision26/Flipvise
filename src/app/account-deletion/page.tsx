import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Shield, Trash2 } from "lucide-react";
import { LegalDocument } from "@/components/legal-document";
import { PublicMarketingPageChrome } from "@/components/public-marketing-page-chrome";
import { resolvePublicPageHomeContext } from "@/lib/public-page-home-context";

export const metadata: Metadata = {
  title: "Delete your Flipvise account",
  description:
    "Request deletion of your Flipvise account and associated data from Flipvise Studio LLC.",
};

export default async function AccountDeletionPage() {
  const { homeHref, isSignedIn } = await resolvePublicPageHomeContext();

  return (
    <PublicMarketingPageChrome homeHref={homeHref} isSignedIn={isSignedIn}>
      <LegalDocument
        badge="Flipvise"
        title="Delete your Flipvise account"
        description="Flipvise Studio LLC provides the Flipvise app. Use this page to request that your Flipvise account and the data associated with it are deleted. You do not need the Android app installed to follow these steps."
        sections={[
          {
            id: "steps",
            title: "Steps to request deletion",
            icon: Trash2,
            tone: "teal",
            body: (
              <>
                <p>
                  These are the steps to request deletion of your Flipvise account.
                </p>
                <ol className="mt-3 list-decimal space-y-2 pl-5">
                  <li>
                    Open Flipvise at{" "}
                    <Link href="/" className="text-primary underline-offset-4 hover:underline">
                      learn.flipvisestudio.com
                    </Link>{" "}
                    or in the Flipvise app, and sign in with the account you want deleted.
                  </li>
                  <li>Open the account menu, choose Manage account, then Delete account.</li>
                  <li>Type DELETE and confirm with your sign-in. Deletion is permanent.</li>
                </ol>
                <p className="mt-3">
                  If you cannot sign in, send the request from{" "}
                  <Link href="/contact" className="text-primary underline-offset-4 hover:underline">
                    Contact Us
                  </Link>{" "}
                  and include the email address on the Flipvise account. Flipvise Studio LLC will
                  delete that account and the associated data after the email is matched to the
                  account.
                </p>
              </>
            ),
          },
          {
            id: "deleted-or-kept",
            title: "Data deleted, data kept, and retention",
            icon: Shield,
            tone: "violet",
            body: (
              <>
                <p>
                  Flipvise deletes the following when the request is completed. There is no
                  additional retention period. Signed-in deletion finishes when you confirm
                  DELETE. A Contact Us request finishes when Flipvise Studio LLC matches the email
                  and completes the deletion. Flipvise does not keep this data after that.
                </p>
                <ul className="mt-3 list-disc space-y-1 pl-5">
                  <li>Account name, email address, and sign-in</li>
                  <li>Phone number, mailing address, account type, and security answers</li>
                  <li>
                    Decks, cards, images, quiz results, lesson plans, homework, essays, and class
                    records stored for that account
                  </li>
                  <li>Inbox messages, support messages, push tokens, and AI usage records for that account</li>
                </ul>
                <p className="mt-3">The following is kept:</p>
                <ul className="mt-3 list-disc space-y-1 pl-5">
                  <li>
                    A copy of decks stored only on your phone for offline study stays on that
                    device until you remove the Flipvise app or its storage. Flipvise does not
                    keep a server copy of that account after deletion.
                  </li>
                  <li>
                    Study content owned by another account, such as a class workspace you joined,
                    stays with that owner. It is not your account&apos;s data.
                  </li>
                  <li>
                    Stripe keeps the payment record for a prorated refund and for Stripe&apos;s own
                    legal records. Flipvise does not store the card number and does not keep a
                    separate copy after the account is deleted.
                  </li>
                </ul>
              </>
            ),
          },
          {
            id: "contact",
            title: "Contact Flipvise Studio LLC",
            icon: Mail,
            tone: "cyan",
            body: (
              <p>
                Questions about deleting a Flipvise account can be sent from{" "}
                <Link href="/contact" className="text-primary underline-offset-4 hover:underline">
                  Contact Us
                </Link>
                . The{" "}
                <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
                  Privacy Policy
                </Link>{" "}
                describes the rest of the data Flipvise collects.
              </p>
            ),
          },
        ]}
      />
    </PublicMarketingPageChrome>
  );
}
